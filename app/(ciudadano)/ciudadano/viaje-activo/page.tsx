'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import {
  MapPin, Clock, Bike, CheckCircle, AlertCircle,
  ChevronUp, Navigation2, Wifi, WifiOff, X, ChevronDown
} from 'lucide-react'

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

function haversine(a: Coord, b: Coord) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
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

const VELOCIDAD_KMH = 12

export default function ViajeActivoPage() {
  const [viaje, setViaje]           = useState<ViajeActivo | null>(null)
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [destino, setDestino]       = useState<EstacionConDisponibilidad | null>(null)
  const [loading, setLoading]       = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [sheetExpanded, setSheetExpanded] = useState(false)

  // GPS
  const [userLocation, setUserLocation] = useState<Coord | null>(null)
  const [distanciaKm, setDistanciaKm]   = useState(0)
  const [gpsActivo, setGpsActivo]       = useState<'waiting' | 'ok' | 'denied'>('waiting')
  const lastCoordRef = useRef<Coord | null>(null)
  const watchIdRef   = useRef<number | null>(null)
  const distanciaRef = useRef(0)

  const tiempo  = useTiempo(viaje?.inicio_at ?? null)
  const router  = useRouter()
  const supabase = createClient()

  // ETA al destino desde ubicación actual
  const eta = useMemo(() => {
    if (!userLocation || !destino) return null
    const d = haversine(userLocation, { lat: destino.latitud, lng: destino.longitud })
    return { km: Math.round(d * 100) / 100, min: Math.max(1, Math.ceil(d / VELOCIDAD_KMH * 60)) }
  }, [userLocation, destino])

  // Cargar estaciones
  const cargarEstaciones = useCallback(async () => {
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
  }, [supabase])

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/viajes/activo')
      const { viaje: v } = await res.json()
      if (!v) { router.replace('/ciudadano'); return }
      setViaje(v)
      await cargarEstaciones()
      setLoading(false)

      if (!navigator.geolocation) { setGpsActivo('denied'); return }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coord: Coord = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLocation(coord)
          setGpsActivo('ok')
          if (lastCoordRef.current) {
            const d = haversine(lastCoordRef.current, coord)
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

  async function finalizar() {
    if (!destino) { setError('Toca una estación en el mapa para elegir destino'); return }
    if (!viaje) return
    setFinalizando(true); setError(null)
    if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current)

    const res = await fetch('/api/viajes/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viaje_id: viaje.id,
        estacion_destino_id: destino.id,
        distancia_km: distanciaRef.current > 0 ? Math.round(distanciaRef.current * 100) / 100 : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setFinalizando(false); return }
    router.push(`/ciudadano/viaje/${data.viaje.id}`)
  }

  if (loading) return (
    <div className="fixed inset-0 bg-surface flex items-center justify-center z-50">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-container mx-auto" />
        <p className="text-sm text-outline">Cargando tu viaje...</p>
      </div>
    </div>
  )

  const co2 = Math.round(distanciaKm * 0.21 * 10) / 10
  const velMedia = distanciaKm > 0 && viaje
    ? Math.round(distanciaKm / ((Date.now() - new Date(viaje.inicio_at).getTime()) / 3_600_000) * 10) / 10
    : 0

  const SHEET_COLLAPSED = 'translate-y-[calc(100%-172px)]'
  const SHEET_EXPANDED  = 'translate-y-0'

  return (
    /* Fullscreen — rompe fuera del layout del nav */
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">

      {/* ── MAPA ── */}
      <div className="flex-1 relative min-h-0">
        <MapaViaje
          estaciones={estaciones}
          destino={destino}
          userLocation={userLocation}
          onEstacionClick={(est) => { setDestino(est); setError(null) }}
        />

        {/* ── TOP BAR ── */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe-top">
          <div className="mt-3 flex items-center gap-2">
            {/* Timer pill */}
            <div className="glass-panel flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/50 shadow-md flex-1">
              <div className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse shrink-0" />
              <Clock size={13} className="text-primary-container shrink-0" />
              <span className="text-sm font-bold text-on-surface">Viaje en curso</span>
              <span className="ml-auto font-mono text-base font-extrabold text-primary-container tabular-nums">{tiempo}</span>
            </div>
            {/* GPS status */}
            <div className="glass-panel w-10 h-10 rounded-2xl border border-white/50 shadow-md flex items-center justify-center shrink-0">
              {gpsActivo === 'denied'  && <WifiOff size={15} className="text-error" />}
              {gpsActivo === 'ok'      && <Wifi size={15} className="text-[#166534]" />}
              {gpsActivo === 'waiting' && <div className="w-3 h-3 rounded-full border-2 border-primary-container/30 border-t-primary-container animate-spin" />}
            </div>
          </div>
        </div>

        {/* ── SIDE CHIPS (right) ── */}
        <div className="absolute top-20 right-4 z-20 flex flex-col gap-2">
          {/* Bici chip */}
          <div className="glass-panel px-3 py-2 rounded-xl border border-white/50 shadow-md">
            <div className="flex items-center gap-1.5">
              <Bike size={13} className="text-primary-container" />
              <span className="text-xs font-bold text-on-surface">{viaje?.bicicleta.codigo}</span>
            </div>
            <p className="text-[10px] text-outline mt-0.5">{viaje?.bicicleta.tipo}</p>
          </div>
          {/* Distancia chip */}
          <div className="glass-panel px-3 py-2 rounded-xl border border-white/50 shadow-md text-center">
            <p className="text-base font-extrabold text-primary-container leading-none">
              {distanciaKm.toFixed(2)}
            </p>
            <p className="text-[10px] text-outline mt-0.5">km</p>
            {velMedia > 0 && (
              <p className="text-[9px] text-on-surface-variant flex items-center justify-center gap-0.5 mt-0.5">
                <Navigation2 size={8} />{velMedia}km/h
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM SHEET ── */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-out ${sheetExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED}`}>

        {/* Pull handle + destination header (always visible) */}
        <button
          onClick={() => setSheetExpanded(e => !e)}
          className="w-full glass-panel rounded-t-3xl border-t border-x border-white/60 px-5 pt-3 pb-4 flex flex-col items-center shadow-2xl"
        >
          <div className="w-10 h-1 rounded-full bg-outline-variant/50 mb-3" />

          <div className="w-full flex items-center gap-3">
            {/* Destination */}
            <div className="flex-1 min-w-0 text-left">
              {destino ? (
                <>
                  <p className="text-[10px] text-[#166534] font-extrabold uppercase tracking-widest">Destino</p>
                  <p className="font-extrabold text-on-surface text-sm leading-tight truncate">{destino.nombre}</p>
                  {eta && (
                    <p className="text-xs text-outline mt-0.5 flex items-center gap-1">
                      <Navigation2 size={10} className="text-primary-container" />
                      ~{eta.min} min · {eta.km} km
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold text-outline">Toca el mapa para elegir destino</p>
              )}
            </div>

            {/* ETA badge */}
            {destino && eta && (
              <div className="shrink-0 flex flex-col items-center bg-primary-container/10 rounded-2xl px-3 py-2">
                <p className="text-xl font-extrabold text-primary-container leading-none">{eta.min}</p>
                <p className="text-[10px] text-outline">min</p>
              </div>
            )}

            {destino && (
              <button
                onClick={(e) => { e.stopPropagation(); setDestino(null) }}
                className="shrink-0 w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center">
                <X size={13} className="text-outline" />
              </button>
            )}

            <ChevronDown size={16} className={`text-outline shrink-0 transition-transform ${sheetExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Sheet body */}
        <div className="glass-panel border-x border-b border-white/60 shadow-2xl px-5 pb-8 space-y-4 bg-white/95">

          {/* Origen */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-3 h-3 rounded-full bg-primary-container border-2 border-white shadow" />
              <div className="w-0.5 h-8 bg-outline-variant/40" />
              <div className="w-3 h-3 rounded-full bg-[#b2f746] border-2 border-primary-container/40 shadow" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] text-outline uppercase font-semibold">Partida</p>
                <p className="text-sm font-semibold text-on-surface">{viaje?.estacion_origen.nombre}</p>
              </div>
              <div>
                <p className="text-[10px] text-outline uppercase font-semibold">Llegada</p>
                <p className="text-sm font-semibold text-on-surface">{destino?.nombre ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Stats en vivo */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Recorrido', value: `${distanciaKm.toFixed(2)} km`, sub: '' },
              { label: 'CO₂ ahorrado', value: `${co2} kg`, sub: '' },
              { label: 'Calorías', value: `${Math.round(distanciaKm * 40)}`, sub: 'kcal' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-surface-container-low rounded-2xl p-3 text-center">
                <p className="text-sm font-extrabold text-on-surface">{value}{sub && <span className="text-[10px] font-normal text-outline ml-0.5">{sub}</span>}</p>
                <p className="text-[9px] text-outline mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* GPS warning */}
          {gpsActivo === 'denied' && (
            <div className="flex items-start gap-2 text-sm text-error bg-error-container px-3 py-2.5 rounded-2xl">
              <WifiOff size={15} className="shrink-0 mt-0.5" />
              <p className="text-xs">Sin GPS — la distancia se estimará según el tiempo transcurrido</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-error bg-error-container px-3 py-2.5 rounded-2xl">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={finalizar}
            disabled={finalizando || !destino}
            className="w-full flex items-center justify-center gap-2 font-bold py-4 rounded-2xl text-sm shadow-md active:scale-[0.98] transition-all disabled:opacity-40"
            style={{ background: destino ? '#064e3b' : undefined, color: destino ? 'white' : undefined }}
          >
            <CheckCircle size={18} />
            {finalizando ? 'Finalizando...' : destino ? 'Finalizar viaje' : 'Elige un destino en el mapa'}
          </button>

          {!destino && (
            <p className="text-center text-xs text-outline pb-1 flex items-center justify-center gap-1">
              <MapPin size={11} className="text-primary-container" />
              Toca cualquier estación en el mapa para seleccionarla como destino
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
