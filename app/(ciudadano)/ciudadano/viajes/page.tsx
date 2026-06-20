'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bike, Clock, CalendarDays, Route, Star, ChevronRight } from 'lucide-react'

interface Viaje {
  id: string
  inicio_at: string
  fin_at: string | null
  duracion_min: number | null
  distancia_km: number | null
  calificacion: number | null
  estado: string
  estacion_origen: { nombre: string } | null
  estacion_destino: { nombre: string } | null
  bicicleta: { codigo: string } | null
}

function formatDuracion(inicio: string, fin: string | null, duracion_min: number | null): string {
  if (!fin) return 'En curso'
  const mins = duracion_min ?? Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000)
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

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data, error } = await supabase
        .from('viajes')
        .select(`
          id, inicio_at, fin_at, duracion_min, distancia_km, calificacion, estado,
          estacion_origen:estacion_origen_id(nombre),
          estacion_destino:estacion_destino_id(nombre),
          bicicleta:bicicleta_id(codigo)
        `)
        .eq('usuario_id', user.id)
        .order('inicio_at', { ascending: false })
        .limit(50)

      if (error?.message?.includes('calificacion')) {
        // Migración 0001 pendiente — consultar sin esa columna para no bloquear la vista
        const { data: data2 } = await supabase
          .from('viajes')
          .select(`
            id, inicio_at, fin_at, duracion_min, distancia_km, estado,
            estacion_origen:estacion_origen_id(nombre),
            estacion_destino:estacion_destino_id(nombre),
            bicicleta:bicicleta_id(codigo)
          `)
          .eq('usuario_id', user.id)
          .order('inicio_at', { ascending: false })
          .limit(50)
        if (data2) setViajes(data2 as unknown as Viaje[])
      } else if (data) {
        setViajes(data as unknown as Viaje[])
      }
      setLoading(false)
    }
    cargar()
  }, [router])

  // Totales para el resumen
  const finalizados = viajes.filter(v => v.estado === 'finalizado')
  const totalKm  = Math.round(finalizados.reduce((s, v) => s + (v.distancia_km ?? 0), 0) * 10) / 10
  const totalCo2 = Math.round(totalKm * 0.21 * 10) / 10

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="bg-white rounded-xl h-28 animate-pulse border border-gray-100" />
      ))}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mis viajes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {viajes.length} viaje{viajes.length !== 1 ? 's' : ''} registrado{viajes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Resumen acumulado */}
      {finalizados.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Viajes',      value: String(finalizados.length), unit: '' },
            { label: 'Kilómetros', value: String(totalKm),            unit: 'km' },
            { label: 'CO₂ ahorrado', value: String(totalCo2),         unit: 'kg' },
          ].map(({ label, value, unit }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
              <p className="text-xl font-extrabold" style={{ color: '#003527' }}>
                {value}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

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
          {viajes.map(v => {
            const finalizado = v.estado === 'finalizado'
            const activo    = v.estado === 'activo'
            const cancelado = v.estado === 'cancelado'
            const dist = v.distancia_km
            return (
              <div key={v.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-gray-200 transition-colors">

                {/* Fecha + bici + estado */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <CalendarDays size={12} />
                    {fechaCorta(v.inicio_at)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: finalizado ? '#f0fdf4' : activo ? '#eff6ff' : '#f3f4f6',
                        color: finalizado ? '#166534' : activo ? '#1d4ed8' : '#6b7280',
                      }}>
                      <Bike size={11} />
                      {v.bicicleta?.codigo ?? '—'}
                    </div>
                    {activo && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        En curso
                      </span>
                    )}
                    {cancelado && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Cancelado
                      </span>
                    )}
                  </div>
                </div>

                {/* Ruta */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <div className="w-0.5 h-6 bg-gray-200" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <p className="text-[10px] text-gray-400">Origen · {horaCorta(v.inicio_at)}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {v.estacion_origen?.nombre ?? 'Sin registro'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">
                        Destino{v.fin_at ? ` · ${horaCorta(v.fin_at)}` : ''}
                      </p>
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {v.estacion_destino?.nombre ?? (activo ? 'En curso' : 'Sin registro')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats + acciones */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                  {/* Duración */}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={11} />
                    {formatDuracion(v.inicio_at, v.fin_at, v.duracion_min)}
                  </div>

                  {/* Distancia */}
                  {dist != null && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Route size={11} />
                      {dist} km
                    </div>
                  )}

                  {/* Calificación */}
                  {v.calificacion != null ? (
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={12}
                          fill={n <= v.calificacion! ? '#f59e0b' : 'none'}
                          stroke={n <= v.calificacion! ? '#f59e0b' : '#d1d5db'}
                          strokeWidth={1.5} />
                      ))}
                    </div>
                  ) : finalizado ? (
                    <Link href={`/ciudadano/viaje/${v.id}`}
                      className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline">
                      <Star size={11} />Calificar
                    </Link>
                  ) : null}

                  {/* Link al resumen */}
                  {finalizado && (
                    <Link href={`/ciudadano/viaje/${v.id}`}
                      className={`${v.calificacion != null ? 'ml-2' : ''} flex items-center text-xs text-gray-400 hover:text-gray-600 transition-colors`}>
                      <ChevronRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
