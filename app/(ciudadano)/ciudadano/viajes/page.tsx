'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bike, MapPin, Clock, ChevronRight, CalendarDays } from 'lucide-react'

interface Viaje {
  id: string
  inicio: string
  fin: string | null
  estacion_origen: { nombre: string } | null
  estacion_destino: { nombre: string } | null
  bicicleta: { codigo: string } | null
}

function duracion(inicio: string, fin: string | null): string {
  if (!fin) return 'En curso'
  const mins = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export default function ViajesPage() {
  const [viajes, setViajes] = useState<Viaje[]>([])
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
          id, inicio, fin,
          estacion_origen:estacion_origen_id(nombre),
          estacion_destino:estacion_destino_id(nombre),
          bicicleta:bicicleta_id(codigo)
        `)
        .eq('usuario_id', user.id)
        .order('inicio', { ascending: false })
        .limit(50)

      if (data) setViajes(data as unknown as Viaje[])
      setLoading(false)
    }
    cargar()
  }, [router, supabase])

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="bg-white rounded-xl h-24 animate-pulse border border-gray-100" />
      ))}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Mis viajes</h1>
        <p className="text-sm text-gray-500 mt-0.5">{viajes.length} viaje{viajes.length !== 1 ? 's' : ''} registrado{viajes.length !== 1 ? 's' : ''}</p>
      </div>

      {viajes.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bike size={28} className="text-gray-400" />
          </div>
          <p className="font-semibold text-gray-700">Aún no tienes viajes</p>
          <p className="text-sm text-gray-400 mt-1">Cuando uses una bicicleta, aparecerá aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {viajes.map(v => (
            <div key={v.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              {/* fecha + bici */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <CalendarDays size={12} />
                  {fechaCorta(v.inicio)}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Bike size={11} />
                  {v.bicicleta?.codigo ?? '—'}
                </div>
              </div>

              {/* ruta */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <div className="w-0.5 h-6 bg-gray-200" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Origen · {horaCorta(v.inicio)}</p>
                    <p className="text-sm font-medium text-gray-800">{v.estacion_origen?.nombre ?? 'Sin registro'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Destino{v.fin ? ` · ${horaCorta(v.fin)}` : ''}</p>
                    <p className="text-sm font-medium text-gray-800">{v.estacion_destino?.nombre ?? (v.fin ? 'Sin registro' : 'En curso')}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${v.fin ? 'bg-gray-50 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Clock size={11} />
                    {duracion(v.inicio, v.fin)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
