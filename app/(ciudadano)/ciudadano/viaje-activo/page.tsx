'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { MapPin, Clock, Bike, CheckCircle, AlertCircle, ChevronUp, Navigation2, Wifi, WifiOff } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container animate-pulse" /> }
)

interface ViajeActivo {
  id: string
  inicio_at: string
  bicicleta: { id: string; codigo: string; tipo: string; marca: string | null }
  estacion_origen: { id: string; nombre: string; direccion: string }
}

interface Coord { lat: number; lng: number }

/** Distancia Haversine entre dos puntos GPS, en km */
function haversine(a: Coord, b: Coord): number {
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
  const [destino, setDestino]     = useState<EstacionConDisponibilidad | null>(null)
  const [loading, setLoading]     = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // GPS state
  const [distanciaKm, setDistanciaKm] = useState(0)
  const [gpsActivo, setGpsActivo]     = useState(false)
  const [gpsDenegado, setGpsDenegado] = useState(false)
  const lastCoordRef = useRef<Coord | null>(null)
  const watchIdRef   = useRef<number | null>(null)

  const tiempo = useTiempo(viaje?.inicio_at ?? null)
  const router  = useRouter()
  const supabase = createClient()

  // ── Cargar estaciones ──
  const cargarEstaciones = useCallback(async () => {
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id,estado)')
      .eq('estado', 'activa')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEstaciones((data as any[]).map(e => ({
        ...e,
        bicicletas_disponibles: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      })))
    }
  }, [supabase])

  // ── Cargar viaje activo + iniciar GPS ──
  useEffect(() => {
    async function init() {
      const res = await fetch('/api/viajes/activo')
      const { viaje: v } = await res.json()
      if (!v) { router.replace('/ciudadano'); return }
      setViaje(v)
      await cargarEstaciones()
      setLoading(false)

      // Iniciar seguimiento GPS
      if (!navigator.geolocation) return
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coord: Coord = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setGpsActivo(true)
          if (lastCoordRef.current) {
            const d = haversine(lastCoordRef.current, coord)
            // Filtrar saltos GPS absurdos (>0.5 km en una lectura = error)
            if (d < 0.5) {
              setDistanciaKm(prev => Math.round((prev + d) * 1000) / 1000)
            }
          }
          lastCoordRef.current = coord
        },
        (err) => {
          if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
            setGpsDenegado(true)
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      )
    }
    init()

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Finalizar viaje ──
  async function finalizar() {
    if (!destino) { setError('Selecciona una estación de destino en el mapa'); return }
    if (!viaje)   return
    setFinalizando(true)
    setError(null)

    // Detener GPS
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current)
    }

    const res = await fetch('/api/viajes/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viaje_id: viaje.id,
        estacion_destino_id: destino.id,
        distancia_km: distanciaKm > 0 ? Math.round(distanciaKm * 100) / 100 : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setFinalizando(false); return }
    router.push(`/ciudadano/viaje/${data.viaje.id}`)
  }

  if (loading) return (
    <div className="h-screen bg-surface flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-container" />
    </div>
  )

  const velMedia = distanciaKm > 0 && viaje
    ? Math.round(distanciaKm / ((Date.now() - new Date(viaje.inicio_at).getTime()) / 3600000) * 10) / 10
    : 0

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">

      {/* ── MAPA ── */}
      <div className="flex-1 relative">
        <MapaEstaciones
          estaciones={estaciones}
          onEstacionClick={setDestino}
          focusEstacion={destino}
        />

        {/* Top bar flotante — timer + GPS */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-2">
          {/* Timer */}
          <div className="glass-panel flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/50 shadow-md flex-1">
            <div className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse" />
            <Clock size={13} className="text-primary-container" />
            <span className="text-sm font-bold text-on-surface">Viaje en curso</span>
            <span className="ml-auto font-mono text-sm font-semibold text-primary-container">{tiempo}</span>
          </div>
          {/* GPS indicator */}
          <div className="glass-panel px-3 py-2.5 rounded-2xl border border-white/50 shadow-md flex items-center gap-1.5">
            {gpsDenegado
              ? <WifiOff size={15} className="text-error" />
              : gpsActivo
                ? <Wifi size={15} className="text-[#166534]" />
                : <div className="w-3 h-3 rounded-full border-2 border-primary-container/40 border-t-primary-container animate-spin" />
            }
          </div>
        </div>

        {/* Info bici + distancia — top right */}
        <div className="absolute top-16 right-4 z-20 flex flex-col gap-2">
          <div className="glass-panel px-3 py-2 rounded-xl border border-white/50 shadow-md">
            <div className="flex items-center gap-2">
              <Bike size={14} className="text-primary-container" />
              <span className="text-xs font-bold text-on-surface">{viaje?.bicicleta.codigo}</span>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{viaje?.bicicleta.tipo} · {viaje?.bicicleta.marca}</p>
          </div>

          {/* Distancia GPS en tiempo real */}
          <div className="glass-panel px-3 py-2 rounded-xl border border-white/50 shadow-md text-center">
            <p className="text-lg font-extrabold text-primary-container leading-none">
              {distanciaKm.toFixed(2)}
            </p>
            <p className="text-[10px] text-outline">km recorridos</p>
            {velMedia > 0 && (
              <p className="text-[10px] text-on-surface-variant mt-0.5 flex items-center justify-center gap-1">
                <Navigation2 size={8} /> {velMedia} km/h
              </p>
            )}
          </div>
        </div>

        {/* Aviso GPS denegado */}
        {gpsDenegado && (
          <div className="absolute top-16 left-4 z-20 glass-panel px-3 py-2 rounded-xl border border-error/30 shadow-md max-w-[220px]">
            <p className="text-xs font-semibold text-error flex items-center gap-1.5">
              <WifiOff size={12} /> Sin permiso GPS
            </p>
            <p className="text-[10px] text-outline mt-0.5">La distancia se estimará al finalizar</p>
          </div>
        )}
      </div>

      {/* ── BOTTOM SHEET ── */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ease-out ${sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-130px)]'}`}>
        {/* Pull handle */}
        <button
          onClick={() => setSheetOpen(o => !o)}
          className="glass-panel w-full rounded-t-3xl border-t border-x border-white/50 px-6 pt-3 pb-4 flex flex-col items-center shadow-lg"
        >
          <div className="w-10 h-1 bg-outline-variant rounded-full mb-3" />
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary-container" />
              <span className="text-sm font-bold text-on-surface">
                {destino ? destino.nombre : 'Elige estación de destino'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {distanciaKm > 0 && (
                <span className="text-xs font-extrabold text-primary-container">
                  {distanciaKm.toFixed(2)} km
                </span>
              )}
              <ChevronUp size={18} className={`text-outline transition-transform ${sheetOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </button>

        {/* Sheet content */}
        <div className="glass-panel border-x border-b border-white/50 px-6 pb-8 space-y-4">
          {/* Origen */}
          <div className="bg-surface-container-low rounded-xl p-3">
            <p className="text-xs text-outline font-semibold uppercase tracking-wide mb-1.5">Origen</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-container shrink-0" />
              <p className="text-sm font-medium text-on-surface">{viaje?.estacion_origen.nombre}</p>
            </div>
          </div>

          {/* Destino */}
          {destino ? (
            <div className="bg-surface-container-low rounded-xl p-3">
              <p className="text-xs text-outline font-semibold uppercase tracking-wide mb-1.5">Destino</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#b2f746] shrink-0" />
                  <p className="text-sm font-medium text-on-surface">{destino.nombre}</p>
                </div>
                <span className="text-xs bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded-full font-semibold">
                  {destino.capacidad - destino.bicicletas_disponibles < destino.capacidad
                    ? `${destino.capacidad - destino.bicicletas_disponibles} dock libres`
                    : 'Sin espacio'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-outline text-center py-1">
              Toca una estación en el mapa para elegir destino
            </p>
          )}

          {/* Stats del viaje */}
          {distanciaKm > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Distancia', value: `${distanciaKm.toFixed(2)} km`, color: 'text-primary-container' },
                { label: 'Vel. media', value: `${velMedia} km/h`, color: 'text-on-surface' },
                { label: 'CO₂ ahorrado', value: `${Math.round(distanciaKm * 0.21 * 10) / 10} kg`, color: 'text-[#166534]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-surface-container-low rounded-xl p-2.5 text-center">
                  <p className={`text-sm font-extrabold ${color}`}>{value}</p>
                  <p className="text-[9px] text-outline mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-error bg-error-container px-3 py-2 rounded-xl">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <button
            onClick={finalizar}
            disabled={finalizando || !destino}
            className="w-full flex items-center justify-center gap-2 font-bold py-4 rounded-2xl text-sm shadow-lg active:scale-[0.98] transition-all disabled:opacity-40"
            style={{ background: '#064e3b', color: 'white' }}
          >
            <CheckCircle size={18} />
            {finalizando ? 'Finalizando...' : 'Finalizar viaje'}
          </button>
        </div>
      </div>
    </div>
  )
}
