'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg"><div className="animate-pulse text-gray-500">Cargando mapa...</div></div> }
)

export default function MapaOperadorPage() {
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const cargarEstaciones = useCallback(async () => {
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id, estado)')
      .order('nombre')

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EstacionConDisponibilidad[] = (data as any[]).map((est) => ({
        ...est,
        bicicletas_disponibles: Array.isArray(est.bicicletas)
          ? est.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length
          : 0,
      }))
      setEstaciones(mapped)
      setUltimaActualizacion(new Date())
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    cargarEstaciones()

    // Realtime subscription
    const channel = supabase
      .channel('mapa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargarEstaciones)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargarEstaciones)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [cargarEstaciones, supabase])

  const activas = estaciones.filter(e => e.estado === 'activa').length
  const inactivas = estaciones.filter(e => e.estado === 'inactiva').length
  const mantenimiento = estaciones.filter(e => e.estado === 'mantenimiento').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa en Tiempo Real</h1>
          <p className="text-gray-500 text-sm">Estado de estaciones y disponibilidad</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
          Última actualización: {ultimaActualizacion.toLocaleTimeString('es-CO')}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{activas}</div>
            <div className="text-xs text-gray-500">Estaciones Activas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-yellow-600">{mantenimiento}</div>
            <div className="text-xs text-gray-500">En Mantenimiento</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-600">{inactivas}</div>
            <div className="text-xs text-gray-500">Inactivas</div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-600" />
          <span className="text-gray-600">≥50% disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-600">1-49% disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span className="text-gray-600">Sin disponibilidad</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: '500px' }}>
        {loading ? (
          <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg" />
        ) : (
          <MapaEstaciones estaciones={estaciones} modoOperador />
        )}
      </div>
    </div>
  )
}
