'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bike, Clock, MapPin, Leaf, Star, ArrowRight } from 'lucide-react'

interface ViajeResumen {
  id: string
  inicio_at: string
  fin_at: string
  duracion_min: number | null
  distancia_km: number | null
  bicicleta: { codigo: string; tipo: string } | null
  estacion_origen: { nombre: string } | null
  estacion_destino: { nombre: string } | null
}

export default function ResumenViajePage() {
  const { id } = useParams()
  const [viaje, setViaje] = useState<ViajeResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data } = await supabase
        .from('viajes')
        .select(`
          id, inicio_at, fin_at, duracion_min, distancia_km,
          bicicleta:bicicleta_id(codigo, tipo),
          estacion_origen:estacion_origen_id(nombre),
          estacion_destino:estacion_destino_id(nombre)
        `)
        .eq('id', id as string)
        .eq('usuario_id', user.id)
        .single()

      if (data) setViaje(data as unknown as ViajeResumen)
      setLoading(false)
    }
    cargar()
  }, [id, router, supabase])

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-surface">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-container" />
    </div>
  )

  if (!viaje) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-on-surface-variant">Viaje no encontrado</p>
      <Link href="/ciudadano" className="btn-primary text-sm px-6 py-2 rounded-lg">Volver al inicio</Link>
    </div>
  )

  const dur = viaje.duracion_min ?? Math.round((new Date(viaje.fin_at).getTime() - new Date(viaje.inicio_at).getTime()) / 60000)
  const dist = viaje.distancia_km ?? Math.round(dur / 60 * 12 * 10) / 10
  const co2 = Math.round(dist * 0.21 * 10) / 10  // 210g CO₂/km en auto
  const cal = Math.round(dist * 40)               // ~40 kcal/km en bici

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Hero celebración */}
      <div className="bg-primary-container px-6 pt-12 pb-8 text-center relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-[#b2f746]/20" />

        <div className="relative z-10">
          <div className="w-20 h-20 rounded-full bg-[#b2f746] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Bike size={36} className="text-primary-container" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">¡Viaje completado!</h1>
          <p className="text-on-primary-container text-sm opacity-80">
            {new Date(viaje.inicio_at).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4 max-w-lg mx-auto w-full">

        {/* Stats principales */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <div className="w-9 h-9 bg-surface-container-low rounded-lg flex items-center justify-center mx-auto mb-2">
              <Clock size={16} className="text-primary-container" />
            </div>
            <p className="text-xl font-extrabold text-on-surface">{dur < 60 ? `${dur}m` : `${Math.floor(dur/60)}h ${dur%60}m`}</p>
            <p className="text-[10px] text-outline uppercase font-semibold tracking-wide mt-0.5">Duración</p>
          </div>
          <div className="card p-4 text-center">
            <div className="w-9 h-9 bg-surface-container-low rounded-lg flex items-center justify-center mx-auto mb-2">
              <MapPin size={16} className="text-secondary" />
            </div>
            <p className="text-xl font-extrabold text-on-surface">{dist} km</p>
            <p className="text-[10px] text-outline uppercase font-semibold tracking-wide mt-0.5">Distancia</p>
          </div>
          <div className="card p-4 text-center">
            <div className="w-9 h-9 bg-[#dcfce7] rounded-lg flex items-center justify-center mx-auto mb-2">
              <Leaf size={16} className="text-[#166534]" />
            </div>
            <p className="text-xl font-extrabold text-[#003527]">{co2} kg</p>
            <p className="text-[10px] text-[#166534] uppercase font-semibold tracking-wide mt-0.5">CO₂ ahorrado</p>
          </div>
        </div>

        {/* Ruta */}
        <div className="card p-4">
          <h2 className="text-xs font-bold text-outline uppercase tracking-wide mb-3">Ruta</h2>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-primary-container" />
              <div className="w-0.5 h-10 bg-outline-variant" />
              <div className="w-3 h-3 rounded-full bg-[#b2f746] border-2 border-secondary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] text-outline font-semibold uppercase">Origen</p>
                <p className="text-sm font-semibold text-on-surface">{viaje.estacion_origen?.nombre ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-outline font-semibold uppercase">Destino</p>
                <p className="text-sm font-semibold text-on-surface">{viaje.estacion_destino?.nombre ?? '—'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-outline">{viaje.bicicleta?.codigo}</p>
              <p className="text-[10px] text-outline-variant">{viaje.bicicleta?.tipo}</p>
            </div>
          </div>
        </div>

        {/* Impacto ecológico */}
        <div className="bg-primary-container rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Leaf size={16} className="text-[#b2f746]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Impacto Ecológico</h3>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-extrabold text-[#b2f746]">{co2} kg</p>
              <p className="text-xs text-on-primary-container opacity-70">CO₂ que no emitiste</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-2xl font-extrabold text-white">{cal}</p>
              <p className="text-xs text-on-primary-container opacity-70">Calorías quemadas</p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="space-y-3 pb-6">
          <Link
            href="/ciudadano"
            className="w-full flex items-center justify-center gap-2 bg-[#064e3b] text-white font-bold py-4 rounded-2xl text-sm shadow-md active:scale-[0.98] transition-all"
          >
            Volver al inicio <ArrowRight size={16} />
          </Link>
          <Link
            href="/ciudadano/mapa"
            className="w-full flex items-center justify-center gap-2 border-2 border-outline-variant text-on-surface font-semibold py-3.5 rounded-2xl text-sm hover:bg-surface-container-low transition-colors"
          >
            Buscar otra bicicleta
          </Link>
        </div>
      </div>
    </div>
  )
}
