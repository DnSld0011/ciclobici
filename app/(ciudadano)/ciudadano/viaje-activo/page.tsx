'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Bike, Leaf, AlertCircle, Wifi, WifiOff, Square, MapPin, Navigation, CheckCircle, X } from 'lucide-react'

const MapaViaje = dynamicImport(
  () => import('@/components/maps/MapaViaje').then(m => m.MapaViaje),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container animate-pulse" /> }
)

interface ViajeActivo {
  id: string
  inicio_at: string
  bicicleta: { id: string; codigo: string; tipo: string; marca: string | null }
  estacion_origen: { id: string; nombre: string; direccion: string }
}

interface Coord { lat: number; lng: number }

function haversineKm(a: Coord, b: Coord) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function useTiempo(inicioAt: string | null) {
  const [seg, setSeg] = useState(0)
  useEffect(() => {
    if (!inicioAt) return
    const calc = () => Math.floor((Date.now() - new Date(inicioAt).getTime()) / 1000)
    setSeg(calc())
    const id = setInterval(() => setSeg(calc()), 1000)
    return () => clearInterval(id)
  }, [inicioAt])
  const hh = String(Math.floor(seg / 3600)).padStart(2, '0')
  const mm = String(Math.floor((seg % 3600) / 60)).padStart(2, '0')
  const ss = String(seg % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function ViajeActivoPage() {
  const [viaje, setViaje]         = useState<ViajeActivo | null>(null)
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // GPS tracking
  const [userLocation, setUserLocation] = useState<Coord | null>(null)
  const [distanciaKm, setDistanciaKm]   = useState(0)
  const [gpsActivo, setGpsActivo]       = useState<'waiting' | 'ok' | 'denied'>('waiting')
  const lastCoordRef  = useRef<Coord | null>(null)
  const watchIdRef    = useRef<number | null>(null)
  const distanciaRef  = useRef(0)
  const userLocRef    = useRef<Coord | null>(null)  // ref sincrónica para uso en handlers

  // Flujo finalizar
  const [detectando, setDetectando]               = useState(false)
  const [finalizando, setFinalizando]             = useState(false)
  const [estacionDetectada, setEstacionDetectada] = useState<EstacionConDisponibilidad | null>(null)
  const [distEstacion, setDistEstacion]           = useState(0)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

  // Flujo cancelar
  const [cancelando, setCancelando]           = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  const tiempo = useTiempo(viaje?.inicio_at ?? null)
  const router = useRouter()

  const cargarEstaciones = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('estaciones')
      .select('*, bicicletas(id,estado)').eq('estado', 'activa')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEstaciones((data as any[]).map(e => ({
        ...e,
        bicicletas_disponibles: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      })))
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/viajes/activo')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const v = json?.viaje
        if (!v) { router.replace('/ciudadano'); return }
        setViaje(v)
      } catch {
        router.replace('/ciudadano')
        return
      }
      try { await cargarEstaciones() } catch { /* mapa puede quedar vacío */ }
      setLoading(false)

      if (!navigator.geolocation) { setGpsActivo('denied'); return }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coord: Coord = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLocation(coord)
          userLocRef.current = coord
          setGpsActivo('ok')
          if (lastCoordRef.current) {
            const d = haversineKm(lastCoordRef.current, coord)
            if (d < 0.5) {
              distanciaRef.current = Math.round((distanciaRef.current + d) * 1000) / 1000
              setDistanciaKm(distanciaRef.current)
            }
          }
          lastCoordRef.current = coord
        },
        () => setGpsActivo('denied'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      )
    }
    init()
    return () => { if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Obtiene la ubicación del usuario: usa la del watch si existe, si no pide una nueva */
  async function obtenerUbicacion(): Promise<Coord> {
    if (userLocRef.current) return userLocRef.current
    return new Promise<Coord>((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS no disponible')); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error('No se pudo obtener tu ubicación. Activa el GPS e intenta de nuevo.')),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  async function iniciarFinalizar() {
    if (!viaje || detectando) return
    setDetectando(true)
    setError(null)

    let ubicacion: Coord
    try {
      ubicacion = await obtenerUbicacion()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de GPS')
      setDetectando(false)
      return
    }

    if (estaciones.length === 0) {
      setError('No se pudieron cargar las estaciones. Intenta de nuevo.')
      setDetectando(false)
      return
    }

    // Encontrar la estación más cercana
    let masNear: EstacionConDisponibilidad | null = null
    let menorDist = Infinity
    for (const est of estaciones) {
      const d = haversineKm(ubicacion, { lat: est.latitud, lng: est.longitud })
      if (d < menorDist) { menorDist = d; masNear = est }
    }

    setDetectando(false)

    if (!masNear) { setError('No hay estaciones disponibles.'); return }

    const distMetros = Math.round(menorDist * 1000)

    if (distMetros > 200) {
      setError(`La estación más cercana es "${masNear.nombre}" a ${distMetros}m. Acércate a una estación para finalizar.`)
      return
    }

    setEstacionDetectada(masNear)
    setDistEstacion(distMetros)
    setMostrarConfirmacion(true)
  }

  async function confirmarFinalizar() {
    if (!viaje || !estacionDetectada) return
    setFinalizando(true)
    if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current)

    const res = await fetch('/api/viajes/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viaje_id: viaje.id,
        estacion_destino_id: estacionDetectada.id,
        distancia_km: distanciaRef.current > 0 ? Math.round(distanciaRef.current * 100) / 100 : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setFinalizando(false)
      setMostrarConfirmacion(false)
      return
    }
    router.push(`/ciudadano/viaje/${data.viaje.id}`)
  }

  async function cancelar() {
    if (!viaje) return
    setCancelando(true)
    if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current)
    const res = await fetch('/api/viajes/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viaje_id: viaje.id }),
    })
    if (res.ok) {
      router.replace('/ciudadano')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error al cancelar')
      setCancelando(false)
      setConfirmarCancelar(false)
    }
  }

  if (loading) return (
    <div className="fixed inset-0 bg-surface flex items-center justify-center z-30">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-container mx-auto" />
        <p className="text-sm text-outline">Cargando tu viaje...</p>
      </div>
    </div>
  )

  const co2 = Math.round(distanciaKm * 0.21 * 10) / 10

  return (
    <div
      className="fixed inset-x-0 top-0 z-30 flex flex-col bg-surface"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-surface border-b border-outline-variant/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: '#003527' }}>
            <Bike size={17} className="text-white" />
          </div>
          <div>
            <p className="font-extrabold text-sm leading-none" style={{ color: '#003527' }}>
              {viaje?.bicicleta?.codigo ?? 'San Borja Bici'}
            </p>
            <p className="text-[10px] text-outline mt-0.5">
              Desde: {viaje?.estacion_origen?.nombre ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gpsActivo === 'denied'  && <WifiOff size={16} className="text-error" title="Sin GPS" />}
          {gpsActivo === 'ok'      && <Wifi size={16} className="text-[#166534]" title="GPS activo" />}
          {gpsActivo === 'waiting' && (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-container/30 border-t-primary-container animate-spin" />
          )}
          <span className="font-mono text-sm font-extrabold tabular-nums" style={{ color: '#003527' }}>
            {tiempo}
          </span>
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative min-h-0">
        <MapaViaje
          estaciones={estaciones}
          userLocation={userLocation}
          estacionDestino={estacionDetectada}
        />
      </div>

      {/* Tarjeta inferior */}
      <div className="shrink-0 bg-white rounded-t-3xl shadow-2xl px-5 pt-4 pb-5 space-y-3">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3.5" style={{ background: '#e5eeff' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-outline mb-1">
              <Bike size={13} className="text-primary-container" /> Distancia
            </div>
            <p className="text-2xl font-extrabold" style={{ color: '#002117' }}>
              {distanciaKm.toFixed(1)}<span className="text-sm font-normal text-outline ml-1">km</span>
            </p>
          </div>
          <div className="rounded-2xl p-3.5" style={{ background: '#e5eeff' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-outline mb-1">
              <Leaf size={13} className="text-primary-container" /> CO₂ evitado
            </div>
            <p className="text-2xl font-extrabold" style={{ color: '#002117' }}>
              {co2}<span className="text-sm font-normal text-outline ml-1">kg</span>
            </p>
          </div>
        </div>

        {/* GPS warning */}
        {gpsActivo === 'denied' && (
          <div className="flex items-start gap-2 bg-error-container px-3 py-2.5 rounded-xl">
            <WifiOff size={14} className="text-error shrink-0 mt-0.5" />
            <p className="text-xs text-error">Sin GPS — actívalo para que la detección de estación funcione al finalizar</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-error-container px-3 py-2.5 rounded-xl">
            <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        {/* Botón finalizar */}
        <button
          onClick={iniciarFinalizar}
          disabled={detectando || finalizando}
          className="w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
          style={{ background: '#b2f746', color: '#002117' }}
        >
          {detectando ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-[#002117]/30 border-t-[#002117] animate-spin" />
              Detectando estación...
            </>
          ) : (
            <>
              <Square size={17} fill="#002117" />
              Finalizar Viaje
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-outline flex items-center justify-center gap-1">
          <Navigation size={10} />
          Al llegar a una estación, pulsa Finalizar — detectaremos tu ubicación
        </p>

        {/* Cancelar */}
        {!confirmarCancelar ? (
          <button
            onClick={() => setConfirmarCancelar(true)}
            className="w-full text-center text-xs text-outline/50 py-1 hover:text-error transition-colors"
          >
            Cancelar viaje
          </button>
        ) : (
          <div className="rounded-2xl border border-error/30 bg-[#fff5f5] p-4 space-y-3">
            <p className="text-sm font-bold text-error text-center">¿Cancelar este viaje?</p>
            <p className="text-xs text-outline text-center">La bicicleta volverá a la estación de origen.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarCancelar(false)}
                className="flex-1 h-10 rounded-xl border border-outline-variant/30 text-sm font-semibold text-on-surface">
                No, continuar
              </button>
              <button onClick={cancelar} disabled={cancelando}
                className="flex-1 h-10 rounded-xl bg-error text-white text-sm font-bold disabled:opacity-50">
                {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación de estación detectada */}
      {mostrarConfirmacion && estacionDetectada && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

            {/* Header modal */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <p className="font-extrabold text-base" style={{ color: '#003527' }}>
                ¿Llegaste a esta estación?
              </p>
              <button onClick={() => { setMostrarConfirmacion(false); setEstacionDetectada(null) }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#f3f4f6' }}>
                <X size={16} className="text-gray-600" />
              </button>
            </div>

            {/* Estación detectada */}
            <div className="mx-5 mb-5 rounded-2xl border border-outline-variant/20 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: '#003527' }}>
                  <MapPin size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-surface leading-snug">
                    {estacionDetectada.nombre}
                  </p>
                  {estacionDetectada.direccion && (
                    <p className="text-xs text-outline mt-0.5 truncate">{estacionDetectada.direccion}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-outline flex items-center gap-1">
                      🚲 {estacionDetectada.bicicletas_disponibles}/{estacionDetectada.capacidad} docks
                    </span>
                    <span className="text-xs font-semibold text-[#166534]">
                      📍 A {distEstacion}m de ti
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-3 px-5 pb-6">
              <button
                onClick={() => { setMostrarConfirmacion(false); setEstacionDetectada(null) }}
                className="flex-1 h-12 rounded-2xl border border-outline-variant/30 text-sm font-semibold text-on-surface"
              >
                No es aquí
              </button>
              <button
                onClick={confirmarFinalizar}
                disabled={finalizando}
                className="flex-1 h-12 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#b2f746', color: '#002117' }}
              >
                {finalizando ? (
                  <div className="w-4 h-4 rounded-full border-2 border-[#002117]/30 border-t-[#002117] animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Sí, finalizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
