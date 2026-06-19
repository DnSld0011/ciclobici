'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Clock, Route, TreePine, Check, X, MapPin, Star } from 'lucide-react'

const MapaResumenViaje = dynamicImport(
  () => import('@/components/maps/MapaResumenViaje').then(m => m.MapaResumenViaje),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container-low animate-pulse" /> }
)

interface EstacionResumen { nombre: string; latitud: number; longitud: number }

interface ViajeResumen {
  id: string
  inicio_at: string
  fin_at: string
  duracion_min: number | null
  distancia_km: number | null
  calificacion: number | null
  bicicleta: { codigo: string; tipo: string } | null
  estacion_origen: EstacionResumen | null
  estacion_destino: EstacionResumen | null
}

export default function ResumenViajePage() {
  const { id } = useParams()
  const [viaje, setViaje]         = useState<ViajeResumen | null>(null)
  const [loading, setLoading]     = useState(true)
  const [rating, setRating]       = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [calificado, setCalificado] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data } = await supabase
        .from('viajes')
        .select(`
          id, inicio_at, fin_at, duracion_min, distancia_km, calificacion,
          bicicleta:bicicleta_id(codigo, tipo),
          estacion_origen:estacion_origen_id(nombre, latitud, longitud),
          estacion_destino:estacion_destino_id(nombre, latitud, longitud)
        `)
        .eq('id', id as string)
        .eq('usuario_id', user.id)
        .single()

      if (data) {
        setViaje(data as unknown as ViajeResumen)
        if ((data as unknown as ViajeResumen).calificacion) {
          setRating((data as unknown as ViajeResumen).calificacion!)
          setCalificado(true)
        }
      }
      setLoading(false)
    }
    cargar()
  }, [id, router])

  async function guardarCalificacion(stars: number) {
    if (calificado || guardando) return
    setRating(stars)
    setGuardando(true)
    const supabase = createClient()
    await supabase.from('viajes').update({ calificacion: stars }).eq('id', id as string)
    setCalificado(true)
    setGuardando(false)
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-surface">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-container" />
    </div>
  )

  if (!viaje) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-on-surface-variant">Viaje no encontrado</p>
      <button onClick={() => router.push('/ciudadano')} className="btn-primary text-sm px-6 py-2 rounded-lg">Volver al inicio</button>
    </div>
  )

  const dur  = viaje.duracion_min ?? Math.round((new Date(viaje.fin_at).getTime() - new Date(viaje.inicio_at).getTime()) / 60000)
  const dist = viaje.distancia_km ?? Math.round(dur / 60 * 12 * 10) / 10
  const co2  = Math.round(dist * 0.21 * 10) / 10

  const origenCoord  = viaje.estacion_origen  ? { lat: viaje.estacion_origen.latitud,  lng: viaje.estacion_origen.longitud  } : null
  const destinoCoord = viaje.estacion_destino ? { lat: viaje.estacion_destino.latitud, lng: viaje.estacion_destino.longitud } : null

  const starLabels = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', '¡Excelente!']

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="flex-1 px-5 py-6 space-y-5 max-w-lg mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold" style={{ color: '#003527' }}>Resumen</h1>
          <button onClick={() => router.push('/ciudadano')} aria-label="Cerrar"
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: '#e5eeff' }}>
            <X size={18} className="text-on-surface" />
          </button>
        </div>

        {/* Check + título */}
        <div className="flex flex-col items-center text-center pt-2 pb-1">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: '#b2f746', boxShadow: '0 0 0 14px rgba(178,247,70,0.25)' }}>
            <Check size={36} style={{ color: '#002117' }} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-extrabold leading-tight" style={{ color: '#003527' }}>
            ¡Viaje Finalizado!
          </h2>
          <p className="text-sm text-outline mt-2">
            {viaje.bicicleta?.codigo} · {viaje.bicicleta?.tipo}
          </p>
        </div>

        {/* Stats: Tiempo + Distancia */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-outline-variant/30 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-outline">
              <Clock size={14} /> Tiempo Total
            </div>
            <p className="text-2xl font-extrabold mt-1" style={{ color: '#002117' }}>
              {dur} <span className="text-sm font-normal text-outline">min</span>
            </p>
          </div>
          <div className="rounded-2xl border border-outline-variant/30 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-outline">
              <Route size={14} /> Distancia
            </div>
            <p className="text-2xl font-extrabold mt-1" style={{ color: '#002117' }}>
              {dist} <span className="text-sm font-normal text-outline">km</span>
            </p>
          </div>
        </div>

        {/* Impacto Ambiental */}
        <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: '#003527' }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#95d3ba' }}>
              <TreePine size={14} /> Impacto Ambiental
            </div>
            <p className="text-2xl font-extrabold mt-1 text-white">
              {co2} <span className="text-sm font-normal" style={{ color: '#95d3ba' }}>kg CO₂ evitado</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(178,247,70,0.15)' }}>
            <TreePine size={20} style={{ color: '#b2f746' }} />
          </div>
        </div>

        {/* ── Calificación ── */}
        <div className="rounded-2xl border border-outline-variant/30 p-5">
          <p className="text-sm font-extrabold text-on-surface mb-1">
            {calificado ? '¡Gracias por tu calificación!' : '¿Cómo estuvo tu experiencia?'}
          </p>
          <p className="text-xs text-outline mb-4">
            {calificado
              ? starLabels[rating]
              : 'Tu opinión nos ayuda a mejorar el servicio'}
          </p>
          <div className="flex items-center gap-2 justify-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n}
                disabled={calificado || guardando}
                onClick={() => guardarCalificacion(n)}
                onMouseEnter={() => !calificado && setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform active:scale-90 disabled:cursor-default"
                style={{ transform: (hoverRating || rating) >= n ? 'scale(1.1)' : 'scale(1)' }}>
                <Star
                  size={36}
                  fill={(hoverRating || rating) >= n ? '#f59e0b' : 'none'}
                  stroke={(hoverRating || rating) >= n ? '#f59e0b' : '#d1d5db'}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          {guardando && (
            <p className="text-center text-xs text-outline mt-3">Guardando...</p>
          )}
        </div>

        {/* Mapa */}
        <div className="relative rounded-2xl overflow-hidden border border-outline-variant/20" style={{ height: 240 }}>
          {origenCoord && destinoCoord ? (
            <MapaResumenViaje origen={origenCoord} destino={destinoCoord} />
          ) : (
            <div className="w-full h-full bg-surface-container-low flex items-center justify-center">
              <p className="text-xs text-outline">Ruta no disponible</p>
            </div>
          )}
          {viaje.estacion_destino && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-md">
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
              <span className="text-xs font-semibold text-on-surface flex items-center gap-1">
                <MapPin size={11} className="text-[#16a34a]" />
                {viaje.estacion_destino.nombre}
              </span>
            </div>
          )}
        </div>

        {/* Cerrar */}
        <button onClick={() => router.push('/ciudadano')}
          className="w-full h-14 rounded-2xl font-bold text-base active:scale-[0.98] transition-all"
          style={{ background: '#b2f746', color: '#002117' }}>
          Volver al inicio
        </button>

      </div>
    </div>
  )
}
