'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Bike, RefreshCw } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg"><div className="animate-pulse text-gray-500">Cargando mapa...</div></div> }
)

export default function MapaCiudadanoPage() {
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [seleccionada, setSeleccionada] = useState<EstacionConDisponibilidad | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id, estado)')
      .eq('estado', 'activa')
      .order('nombre')

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EstacionConDisponibilidad[] = (data as any[]).map((est) => ({
        ...est,
        bicicletas_disponibles: Array.isArray(est.bicicletas)
          ? est.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length
          : 0,
      }))
      setEstaciones(mapped.sort((a, b) => b.bicicletas_disponibles - a.bicicletas_disponibles))
      setUltimaActualizacion(new Date())
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('ciudadano-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [cargar, supabase])

  const disponibilidadColor = (disp: number, cap: number) => {
    if (disp === 0) return 'text-red-600 bg-red-50 border-red-200'
    if (disp / cap < 0.3) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    return 'text-green-700 bg-green-50 border-green-200'
  }

  const disponibilidadBadge = (disp: number, cap: number) => {
    if (disp === 0) return 'destructive'
    if (disp / cap < 0.3) return 'warning'
    return 'success'
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="w-full h-full bg-gray-100 animate-pulse" />
        ) : (
          <MapaEstaciones
            estaciones={estaciones}
            onEstacionClick={setSeleccionada}
          />
        )}

        {/* Update indicator */}
        <div className="absolute top-3 right-3 bg-white rounded-full px-3 py-1 shadow text-xs text-gray-500 flex items-center gap-1 z-10">
          <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
          {ultimaActualizacion.toLocaleTimeString('es-CO')}
        </div>

        {/* Selected station popup */}
        {seleccionada && (
          <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4 z-10 max-w-sm mx-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{seleccionada.nombre}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{seleccionada.direccion}</p>
              </div>
              <button onClick={() => setSeleccionada(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border ${disponibilidadColor(seleccionada.bicicletas_disponibles, seleccionada.capacidad)}`}>
              <Bike size={18} />
              <span className="font-bold text-lg">{seleccionada.bicicletas_disponibles}</span>
              <span className="text-sm">de {seleccionada.capacidad} disponibles</span>
            </div>
          </div>
        )}
      </div>

      {/* Station list */}
      <div className="w-full lg:w-80 bg-white border-l overflow-y-auto">
        <div className="p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">Estaciones Activas</h2>
          <p className="text-xs text-gray-500 mt-0.5">Ordenadas por disponibilidad</p>
        </div>
        <div className="divide-y">
          {estaciones.map(est => (
            <button
              key={est.id}
              onClick={() => setSeleccionada(est)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${seleccionada?.id === est.id ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{est.nombre}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} /> {est.direccion}
                  </div>
                </div>
                <Badge variant={disponibilidadBadge(est.bicicletas_disponibles, est.capacidad)} className="shrink-0">
                  <Bike size={10} className="mr-1" />
                  {est.bicicletas_disponibles}
                </Badge>
              </div>
            </button>
          ))}
          {estaciones.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-400 text-sm">
              No hay estaciones activas
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
