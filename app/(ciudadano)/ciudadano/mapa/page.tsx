'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { distanciaKm, formatoDistancia, minutosCaminando } from '@/lib/geo'
import { MapPin, Bike, RefreshCw, X, ChevronDown, AlertTriangle, Footprints, LocateFixed } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-surface-container animate-pulse flex items-center justify-center">
        <div className="text-outline text-sm">Cargando mapa...</div>
      </div>
    ),
  }
)

type EstacionConDistancia = EstacionConDisponibilidad & { distancia_km?: number }

export default function MapaCiudadanoPage() {
  const [estaciones, setEstaciones]   = useState<EstacionConDistancia[]>([])
  const [seleccionada, setSeleccionada] = useState<EstacionConDistancia | null>(null)
  const [ultimaAct, setUltimaAct]     = useState<Date | null>(null)
  const [loading, setLoading]         = useState(true)
  const [listaAbierta, setListaAbierta] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError]       = useState('')
  const autoSeleccionoRef = useRef(false)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id, estado)')
      .eq('estado', 'activa')
      .order('nombre')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EstacionConDistancia[] = (data as any[]).map(est => ({
        ...est,
        bicicletas_disponibles: Array.isArray(est.bicicletas)
          ? est.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      }))
      setEstaciones(mapped)
      setUltimaAct(new Date())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    // Debounce para no re-cargar todas las estaciones en cada UPDATE de bici
    let timeout: ReturnType<typeof setTimeout> | null = null
    const debouncedCargar = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(cargar, 800)
    }
    const ch = supabase.channel('mapa-ciudadano-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bicicletas' }, debouncedCargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, debouncedCargar)
      .subscribe()
    return () => {
      if (timeout) clearTimeout(timeout)
      supabase.removeChannel(ch)
    }
  }, [cargar])

  // Pedir ubicación del usuario al entrar al mapa
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Tu navegador no soporta geolocalización.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Activa el GPS para ver tu ubicación y recomendaciones cercanas.'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  // Estaciones con distancia calculada y ordenadas por cercanía (si hay ubicación)
  const estacionesOrdenadas = useMemo(() => {
    if (!userLocation) return estaciones
    return estaciones
      .map(e => ({ ...e, distancia_km: distanciaKm(userLocation.lat, userLocation.lng, e.latitud, e.longitud) }))
      .sort((a, b) => (a.distancia_km ?? 0) - (b.distancia_km ?? 0))
  }, [estaciones, userLocation])

  // Auto-seleccionar la estación más cercana como tarjeta principal (solo una vez)
  useEffect(() => {
    if (autoSeleccionoRef.current || !userLocation || estacionesOrdenadas.length === 0) return
    setSeleccionada(estacionesOrdenadas[0])
    autoSeleccionoRef.current = true
  }, [estacionesOrdenadas, userLocation])

  // Recomendaciones proactivas: las siguientes estaciones más cercanas con bicis disponibles
  const recomendaciones = useMemo(() => {
    if (!userLocation || !seleccionada) return []
    return estacionesOrdenadas
      .filter(e => e.id !== seleccionada.id)
      .slice(0, 2)
  }, [estacionesOrdenadas, seleccionada, userLocation])

  const pct = (est: EstacionConDistancia) =>
    est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0

  const barColor = (e: EstacionConDistancia) =>
    pct(e) === 0 ? '#ba1a1a' : pct(e) < 0.2 ? '#f59e0b' : '#b2f746'

  const dotClass = (e: EstacionConDistancia) =>
    pct(e) === 0 ? 'bg-error' : pct(e) < 0.2 ? 'bg-amber-400' : 'bg-[#b2f746]'

  const totalLibres = estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)

  return (
    // fixed en mobile: el <main> del layout aplica pb-24 para páginas con scroll normal,
    // pero esto es una vista de pantalla completa — con esa altura inherente, el documento
    // queda más alto que el viewport y el navegador permite "arrastrar" revelando un hueco
    // bajo el mapa. fixed inset-0 saca esta vista del flujo y evita ese desborde.
    <div className="fixed inset-0 flex flex-col lg:static lg:flex-row lg:h-[calc(100vh-3.5rem)]">

      {/* ── MAPA — full screen ── */}
      <div className="absolute inset-0 lg:relative lg:flex-1">
        {loading
          ? <div className="w-full h-full bg-surface-container animate-pulse" />
          : <MapaEstaciones
              estaciones={estaciones}
              userLocation={userLocation}
              onEstacionClick={e => { setSeleccionada(e); setListaAbierta(false) }}
              focusEstacion={seleccionada}
            />
        }

        {/* Stats flotantes — top left */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10 pointer-events-none">
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/50 shadow-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#b2f746]" />
            <span className="text-xs font-bold text-on-surface">{totalLibres} bicis libres</span>
          </div>
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/50 shadow-md flex items-center gap-2">
            <MapPin size={11} className="text-primary-container" />
            <span className="text-xs font-bold text-on-surface">{estaciones.length} estaciones</span>
          </div>
          {geoError && (
            <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/50 shadow-md flex items-center gap-2 max-w-[220px] pointer-events-auto">
              <LocateFixed size={11} className="text-outline shrink-0" />
              <span className="text-[10px] text-outline leading-tight">{geoError}</span>
            </div>
          )}
        </div>

        {/* Hora actualización — top right */}
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/50 shadow-md flex items-center gap-1.5 text-xs text-outline">
            <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
            {ultimaAct ? ultimaAct.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
        </div>

        {/* Chip "Ver lista" — mobile, bottom center (solo si no hay tarjeta de recomendación) */}
        {/* mismo offset que la tarjeta: despeja la barra de navegación inferior */}
        {!seleccionada && (
          <div
            className="lg:hidden absolute left-1/2 -translate-x-1/2 z-10"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <button onClick={() => setListaAbierta(true)}
              className="glass-panel flex items-center gap-2 px-4 py-2 rounded-full border border-white/50 shadow-lg text-xs font-bold text-on-surface active:scale-[.97] transition-all">
              <ChevronDown size={13} /> Ver {estaciones.length} estaciones
            </button>
          </div>
        )}

        {/* Tarjeta principal: estación seleccionada / más cercana + recomendaciones — mobile */}
        {/* bottom calculado para despejar la barra de navegación inferior (z-40, h-16 + safe-area)
            que de otro modo tapa la parte baja de la tarjeta (la 2da recomendación quedaba oculta). */}
        {seleccionada && (
          <div
            className="absolute left-3 right-3 z-20 lg:hidden max-h-[55vh] overflow-y-auto"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <div className="glass-panel rounded-2xl border border-white/60 shadow-2xl p-4 space-y-4">

              {/* Header: nombre + distancia + botón cerrar */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-extrabold leading-tight text-lg" style={{ color: '#003527' }}>
                    {seleccionada.nombre}
                  </h3>
                  {seleccionada.distancia_km != null && (
                    <p className="text-xs text-outline flex items-center gap-1 mt-1">
                      <MapPin size={11} /> {formatoDistancia(seleccionada.distancia_km)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {(seleccionada.bicicletas_disponibles === 0 || seleccionada.capacidad - seleccionada.bicicletas_disponibles === 0) && (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#ffdad6] text-error border border-error/20 whitespace-nowrap">
                      <AlertTriangle size={10} />
                      {seleccionada.bicicletas_disponibles === 0 ? 'Sin bicicletas' : 'Estación llena'}
                    </span>
                  )}
                  <button onClick={() => setSeleccionada(null)}
                    className="w-6 h-6 rounded-lg bg-surface-container flex items-center justify-center">
                    <X size={12} className="text-outline" />
                  </button>
                </div>
              </div>

              {/* Stat boxes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-low rounded-xl p-3">
                  <p className="text-[10px] text-outline">Bicicletas Disp.</p>
                  <p className="text-2xl font-extrabold mt-0.5" style={{ color: '#002117' }}>
                    {seleccionada.bicicletas_disponibles}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3">
                  <p className="text-[10px] text-outline">Espacios Libres</p>
                  <p className="text-2xl font-extrabold mt-0.5"
                    style={{ color: seleccionada.capacidad - seleccionada.bicicletas_disponibles === 0 ? '#ba1a1a' : '#002117' }}>
                    {Math.max(0, seleccionada.capacidad - seleccionada.bicicletas_disponibles)}
                  </p>
                </div>
              </div>

              {/* Recomendaciones proactivas */}
              {recomendaciones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold text-outline uppercase tracking-widest">
                    Recomendaciones proactivas
                  </p>
                  {recomendaciones.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSeleccionada(r)}
                      className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-outline-variant/15 text-left"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: '#dcfce7' }}>
                        <Bike size={16} style={{ color: '#003527' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{r.nombre}</p>
                        <p className="text-[10px] text-outline flex items-center gap-1 mt-0.5">
                          <Footprints size={10} />
                          {r.distancia_km != null ? `A ${minutosCaminando(r.distancia_km)} min caminando` : '—'}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: '#b2f746', color: '#002117' }}>
                        <Bike size={11} /> {r.bicicletas_disponibles}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL DERECHO — desktop ── */}
      {/* Overlay mobile */}
      {listaAbierta && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-30 backdrop-blur-sm"
          onClick={() => setListaAbierta(false)} />
      )}

      <div className={`
        lg:relative lg:w-72 lg:flex lg:flex-col
        fixed bottom-0 left-0 right-0 z-40
        bg-white border-t lg:border-t-0 lg:border-l border-outline-variant/20 rounded-t-3xl lg:rounded-none
        transition-transform duration-300 ease-out
        ${listaAbierta ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        max-h-[70vh] lg:max-h-none lg:h-full
      `}>
        {/* Handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-outline-variant/40" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-outline-variant/15 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-sm text-on-surface">Estaciones</h2>
            <p className="text-[10px] text-outline mt-0.5">
              {totalLibres} bicis disponibles{userLocation ? ' · ordenadas por cercanía' : ''}
            </p>
          </div>
          <button className="lg:hidden w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center"
            onClick={() => setListaAbierta(false)}>
            <X size={14} className="text-outline" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
          {loading && Array(5).fill(0).map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-surface-container-low animate-pulse mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 rounded bg-surface-container-low animate-pulse w-3/4" />
                <div className="h-2 rounded bg-surface-container-low animate-pulse w-1/2" />
              </div>
            </div>
          ))}
          {estacionesOrdenadas.map(est => (
            <button key={est.id}
              onClick={() => { setSeleccionada(est); setListaAbierta(false) }}
              className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-surface-container-low/70 transition-colors ${
                seleccionada?.id === est.id ? 'bg-surface-container-low border-l-2 border-primary-container' : ''
              }`}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${dotClass(est)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate">{est.nombre}</p>
                <p className="text-[10px] text-outline truncate mt-0.5 flex items-center gap-1">
                  <MapPin size={9} className="shrink-0" />
                  {est.distancia_km != null ? formatoDistancia(est.distancia_km) : est.direccion}
                </p>
                <div className="mt-1.5 h-1 rounded-full bg-outline-variant/15 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min(100, pct(est) * 100)}%`, background: barColor(est) }} />
                </div>
              </div>
              <span className={`font-extrabold text-xs shrink-0 px-1.5 py-0.5 rounded ${pct(est) === 0 ? '' : ''}`}>
                <span className="text-on-surface">{est.bicicletas_disponibles}</span>
                <span className="text-outline font-normal">/{est.capacidad}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
