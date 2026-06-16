'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Bike, Leaf, AlertCircle, Wifi, WifiOff, QrCode, Square, MapPin } from 'lucide-react'

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

export default function ViajeActivoPage() {
  const [viaje, setViaje]           = useState<ViajeActivo | null>(null)
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [destino, setDestino]       = useState<EstacionConDisponibilidad | null>(null)
  const [loading, setLoading]       = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // GPS
  const [userLocation, setUserLocation] = useState<Coord | null>(null)
  const [distanciaKm, setDistanciaKm]   = useState(0)
  const [gpsActivo, setGpsActivo]       = useState<'waiting' | 'ok' | 'denied'>('waiting')
  const lastCoordRef = useRef<Coord | null>(null)
  const watchIdRef   = useRef<number | null>(null)
  const distanciaRef = useRef(0)

  const tiempo  = useTiempo(viaje?.inicio_at ?? null)
  const router  = useRouter()

  // Cargar estaciones
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
    <div className="fixed inset-0 bg-surface flex items-center justify-center z-30">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-container mx-auto" />
        <p className="text-sm text-outline">Cargando tu viaje...</p>
      </div>
    </div>
  )

  const co2 = Math.round(distanciaKm * 0.21 * 10) / 10

  return (
    // z-30 (debajo del bottom nav, z-40) y bottom recortado a la altura del nav,
    // para que la barra de navegación siga visible mientras el viaje está activo.
    <div
      className="fixed inset-x-0 top-0 z-30 flex flex-col bg-surface"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-surface">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: '#003527' }}>
            <Bike size={17} className="text-white" />
          </div>
          <span className="font-extrabold text-lg leading-none" style={{ color: '#003527' }}>San Borja Bici</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gpsActivo === 'denied'  && <WifiOff size={16} className="text-error" />}
          {gpsActivo === 'ok'      && <Wifi size={16} className="text-[#166534]" />}
          {gpsActivo === 'waiting' && <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-container/30 border-t-primary-container animate-spin" />}
          <QrCode size={20} className="text-on-surface" />
        </div>
      </div>

      {/* ── MAPA ── */}
      <div className="flex-1 relative min-h-0">
        <MapaViaje
          estaciones={estaciones}
          destino={destino}
          userLocation={userLocation}
          onEstacionClick={(est) => { setDestino(est); setError(null) }}
        />
      </div>

      {/* ── Tarjeta del viaje ── */}
      <div className="shrink-0 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-5 space-y-4">

        <div className="flex justify-center">
          <span className="px-4 py-1.5 rounded-full text-sm font-bold border"
            style={{ background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }}>
            Viaje en Curso
          </span>
        </div>

        <p className="text-center font-mono text-5xl font-extrabold tabular-nums" style={{ color: '#003527' }}>
          {tiempo}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: '#e5eeff' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-outline">
              <Bike size={14} className="text-primary-container" /> Distancia
            </div>
            <p className="text-2xl font-extrabold mt-1" style={{ color: '#002117' }}>
              {distanciaKm.toFixed(1)} <span className="text-sm font-normal text-outline">km</span>
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#e5eeff' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-outline">
              <Leaf size={14} className="text-primary-container" /> CO2 evitado
            </div>
            <p className="text-2xl font-extrabold mt-1" style={{ color: '#002117' }}>
              {co2} <span className="text-sm font-normal text-outline">kg</span>
            </p>
          </div>
        </div>

        {destino && (
          <p className="text-center text-xs font-semibold text-outline flex items-center justify-center gap-1">
            <MapPin size={11} className="text-primary-container" /> Destino: {destino.nombre}
          </p>
        )}

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
          disabled={finalizando}
          className="w-full h-14 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          style={{ background: '#b2f746', color: '#002117' }}
        >
          <Square size={18} fill="#002117" />
          {finalizando ? 'Finalizando...' : 'Finalizar Viaje'}
        </button>

        {!destino && (
          <p className="text-center text-xs text-outline flex items-center justify-center gap-1">
            <MapPin size={11} className="text-primary-container" />
            Toca una estación en el mapa para elegir destino
          </p>
        )}
      </div>
    </div>
  )
}
