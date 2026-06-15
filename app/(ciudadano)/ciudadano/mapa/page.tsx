'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { MapPin, Bike, RefreshCw, X, Navigation, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

export default function MapaCiudadanoPage() {
  const [estaciones, setEstaciones]   = useState<EstacionConDisponibilidad[]>([])
  const [seleccionada, setSeleccionada] = useState<EstacionConDisponibilidad | null>(null)
  const [ultimaAct, setUltimaAct]     = useState(new Date())
  const [loading, setLoading]         = useState(true)
  const [listaAbierta, setListaAbierta] = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id, estado)')
      .eq('estado', 'activa')
      .order('nombre')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EstacionConDisponibilidad[] = (data as any[]).map(est => ({
        ...est,
        bicicletas_disponibles: Array.isArray(est.bicicletas)
          ? est.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      }))
      setEstaciones(mapped.sort((a, b) => b.bicicletas_disponibles - a.bicicletas_disponibles))
      setUltimaAct(new Date())
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    cargar()
    const ch = supabase.channel('mapa-ciudadano-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar, supabase])

  const pct = (est: EstacionConDisponibilidad) =>
    est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0

  const barColor = (e: EstacionConDisponibilidad) =>
    pct(e) === 0 ? '#ba1a1a' : pct(e) < 0.2 ? '#f59e0b' : '#b2f746'

  const dotClass = (e: EstacionConDisponibilidad) =>
    pct(e) === 0 ? 'bg-error' : pct(e) < 0.2 ? 'bg-amber-400' : 'bg-[#b2f746]'

  const chipClass = (e: EstacionConDisponibilidad) =>
    pct(e) === 0
      ? 'bg-[#ffdad6] text-error border-error/20'
      : pct(e) < 0.2
        ? 'bg-[#fef9c3] text-[#854d0e] border-[#fde68a]'
        : 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]'

  const totalLibres = estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] md:h-[calc(100vh-3.5rem)] relative">

      {/* ── MAPA — full screen ── */}
      <div className="absolute inset-0 lg:relative lg:flex-1">
        {loading
          ? <div className="w-full h-full bg-surface-container animate-pulse" />
          : <MapaEstaciones estaciones={estaciones} onEstacionClick={e => { setSeleccionada(e); setListaAbierta(false) }} focusEstacion={seleccionada} />
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
        </div>

        {/* Hora actualización — top right */}
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/50 shadow-md flex items-center gap-1.5 text-xs text-outline">
            <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
            {ultimaAct.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Chip "Ver lista" — mobile, bottom center */}
        <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <button onClick={() => setListaAbierta(true)}
            className="glass-panel flex items-center gap-2 px-4 py-2 rounded-full border border-white/50 shadow-lg text-xs font-bold text-on-surface active:scale-[.97] transition-all">
            <ChevronDown size={13} /> Ver {estaciones.length} estaciones
          </button>
        </div>

        {/* Popup estación seleccionada — mobile */}
        {seleccionada && (
          <div className="absolute bottom-14 left-3 right-3 z-20 lg:hidden">
            <div className="glass-panel rounded-2xl border border-white/60 shadow-2xl p-4">
              <div className="flex items-start gap-3">
                {/* Icono */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  pct(seleccionada) === 0 ? 'bg-[#ffdad6]' : pct(seleccionada) < 0.2 ? 'bg-[#fef9c3]' : 'bg-[#dcfce7]'
                }`}>
                  <Bike size={18} className={
                    pct(seleccionada) === 0 ? 'text-error' : pct(seleccionada) < 0.2 ? 'text-[#854d0e]' : 'text-[#166534]'
                  } />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-on-surface text-sm truncate">{seleccionada.nombre}</h3>
                  <p className="text-xs text-outline truncate flex items-center gap-1 mt-0.5">
                    <MapPin size={9} /> {seleccionada.direccion}
                  </p>
                  {/* Disponibilidad */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min(100, pct(seleccionada) * 100)}%`, background: barColor(seleccionada) }} />
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${chipClass(seleccionada)}`}>
                      {seleccionada.bicicletas_disponibles}/{seleccionada.capacidad}
                    </span>
                  </div>
                </div>
                {/* Cierre + nav */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => setSeleccionada(null)}
                    className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center">
                    <X size={13} className="text-outline" />
                  </button>
                  <button
                    onClick={() => router.push(`/ciudadano/mapa?nav=${seleccionada.latitud},${seleccionada.longitud}`)}
                    className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center">
                    <Navigation size={13} className="text-primary-container" />
                  </button>
                </div>
              </div>
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
            <p className="text-[10px] text-outline mt-0.5">{totalLibres} bicis disponibles</p>
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
          {estaciones.map(est => (
            <button key={est.id}
              onClick={() => { setSeleccionada(est); setListaAbierta(false) }}
              className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-surface-container-low/70 transition-colors ${
                seleccionada?.id === est.id ? 'bg-surface-container-low border-l-2 border-primary-container' : ''
              }`}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${dotClass(est)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate">{est.nombre}</p>
                <p className="text-[10px] text-outline truncate mt-0.5 flex items-center gap-1">
                  <MapPin size={9} className="shrink-0" /> {est.direccion}
                </p>
                <div className="mt-1.5 h-1 rounded-full bg-outline-variant/15 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min(100, pct(est) * 100)}%`, background: barColor(est) }} />
                </div>
              </div>
              <span className="font-extrabold text-xs text-on-surface shrink-0">
                {est.bicicletas_disponibles}
                <span className="text-outline font-normal">/{est.capacidad}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
