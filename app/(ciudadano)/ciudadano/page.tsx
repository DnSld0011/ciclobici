'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Map, Bike, MapPin, ChevronRight, Zap, TrendingUp, Clock } from 'lucide-react'

interface Stats { viajes: number; estacionesActivas: number }

export default function DashboardCiudadano() {
  const [nombre, setNombre] = useState('')
  const [stats, setStats] = useState<Stats>({ viajes: 0, estacionesActivas: 0 })
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: perfil }, { data: ests }, { count: viajes }] = await Promise.all([
        supabase.from('usuarios').select('nombre').eq('id', user.id).single(),
        supabase.from('estaciones').select('*, bicicletas(id,estado)').eq('estado', 'activa').order('nombre'),
        supabase.from('viajes').select('*', { count: 'exact', head: true }).eq('usuario_id', user.id),
      ])

      if (perfil) setNombre(perfil.nombre.split(' ')[0])

      if (ests) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (ests as any[]).map(e => ({
          ...e,
          bicicletas_disponibles: Array.isArray(e.bicicletas)
            ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
        }))
        setEstaciones(mapped.sort((a, b) => b.bicicletas_disponibles - a.bicicletas_disponibles))
        setStats({ viajes: viajes ?? 0, estacionesActivas: ests.length })
      }
      setLoading(false)
    }
    cargar()
  }, [router, supabase])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Saludo */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-blue-200 text-sm">{saludo}</p>
        <h1 className="text-2xl font-bold mt-0.5">{loading ? '...' : nombre} 👋</h1>
        <p className="text-blue-100 text-sm mt-1">¿Listo para pedalear por San Borja?</p>
        <Link
          href="/ciudadano/mapa"
          className="mt-4 inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-xl text-sm shadow hover:shadow-md transition-all"
        >
          <Map size={16} /> Encontrar bicicleta
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Bike size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.viajes}</p>
          <p className="text-xs text-gray-500 mt-0.5">Viajes</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-2">
            <MapPin size={18} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.estacionesActivas}</p>
          <p className="text-xs text-gray-500 mt-0.5">Estaciones</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Zap size={18} className="text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Bicis libres</p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/ciudadano/mapa" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:border-blue-200 hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <Map size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Ver mapa</p>
            <p className="text-xs text-gray-500">Estaciones en vivo</p>
          </div>
        </Link>
        <Link href="/ciudadano/viajes" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:border-purple-200 hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
            <Clock size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Historial</p>
            <p className="text-xs text-gray-500">Mis viajes</p>
          </div>
        </Link>
      </div>

      {/* Estaciones cercanas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Estaciones disponibles</h2>
          <Link href="/ciudadano/mapa" className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
            Ver mapa <ChevronRight size={12} />
          </Link>
        </div>
        <div className="space-y-2">
          {loading
            ? Array(3).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-xl h-16 animate-pulse border border-gray-100" />
              ))
            : estaciones.slice(0, 5).map(est => {
                const pct = est.bicicletas_disponibles / est.capacidad
                const color = pct === 0 ? 'bg-red-500' : pct < 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                return (
                  <Link
                    key={est.id}
                    href="/ciudadano/mapa"
                    className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3 hover:border-blue-200 transition-all"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{est.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{est.direccion}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900 text-sm">{est.bicicletas_disponibles}</p>
                      <p className="text-xs text-gray-400">/{est.capacidad}</p>
                    </div>
                  </Link>
                )
              })}
        </div>
      </div>

      {/* Tip */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
        <TrendingUp size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Mayor disponibilidad</p>
          <p className="text-xs text-blue-700 mt-0.5">Las horas con más bicis disponibles son entre 10am–12pm y 2pm–4pm.</p>
        </div>
      </div>
    </div>
  )
}
