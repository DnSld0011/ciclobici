'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { RefreshCw, MapPin, Bike, AlertTriangle } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container-low animate-pulse rounded-xl" /> }
)

export default function MapaOperadorPage() {
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [seleccionada, setSeleccionada] = useState<EstacionConDisponibilidad | null>(null)
  const [ultimaAct, setUltimaAct] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id, estado)')
      .order('nombre')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEstaciones((data as any[]).map(e => ({
        ...e,
        bicicletas_disponibles: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      })))
      setUltimaAct(new Date())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    cargar()
    const ch = supabase.channel('mapa-op-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  const activas      = estaciones.filter(e => e.estado === 'activa').length
  const enMantenimiento = estaciones.filter(e => e.estado === 'mantenimiento').length
  const inactivas    = estaciones.filter(e => e.estado === 'inactiva').length
  const criticas     = estaciones.filter(e => e.bicicletas_disponibles === 0 && e.estado === 'activa').length

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container">Mapa en Tiempo Real</h1>
          <p className="text-xs text-outline mt-0.5">Estado de estaciones · San Borja en Bici</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-outline bg-white border border-outline-variant/30 px-3 py-1.5 rounded-full shadow-sm">
          <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
          {ultimaAct.toLocaleTimeString('es-PE')}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: MapPin,       label: 'Activas',        value: activas,        color: 'text-[#166534] bg-[#dcfce7]' },
          { icon: RefreshCw,    label: 'Mantenimiento',  value: enMantenimiento, color: 'text-[#854d0e] bg-[#fef9c3]' },
          { icon: AlertTriangle,label: 'Vacías',         value: criticas,       color: 'text-error bg-[#ffdad6]' },
          { icon: Bike,         label: 'Bicis disponibles', value: estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0), color: 'text-primary-container bg-[#e5eeff]' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-xl font-extrabold text-on-surface">{loading ? '—' : value}</p>
              <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mapa + Lista */}
      <div className="flex gap-4" style={{ height: 520 }}>
        <div className="flex-1 card overflow-hidden relative">
          {loading
            ? <div className="w-full h-full bg-surface-container-low animate-pulse" />
            : <MapaEstaciones estaciones={estaciones} modoOperador onEstacionClick={setSeleccionada} focusEstacion={seleccionada} />
          }
          {/* Leyenda */}
          <div className="absolute bottom-4 left-4 glass-panel px-3 py-2.5 rounded-xl border border-white/50 shadow-md space-y-1.5">
            {[
              { color: 'bg-[#b2f746]',  text: 'Disponible (>20%)' },
              { color: 'bg-amber-400',   text: 'Stock bajo (<20%)' },
              { color: 'bg-error',       text: 'Vacía / Crítica' },
              { color: 'bg-outline-variant', text: 'Mantenimiento' },
            ].map(({ color, text }) => (
              <div key={text} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-[10px] font-semibold text-on-surface">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lista lateral */}
        <div className="w-72 card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-outline-variant/20">
            <h2 className="font-extrabold text-sm text-on-surface">Estaciones</h2>
            <p className="text-[10px] text-outline mt-0.5">Por disponibilidad</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
            {[...estaciones]
              .sort((a, b) => a.bicicletas_disponibles - b.bicicletas_disponibles)
              .map(est => {
                const pct = est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0
                const dot = pct === 0 ? 'bg-error' : pct < 0.2 ? 'bg-amber-400' : 'bg-[#b2f746]'
                return (
                  <button key={est.id} onClick={() => setSeleccionada(est)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-container-low transition-colors ${seleccionada?.id === est.id ? 'bg-surface-container-low' : ''}`}>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{est.nombre}</p>
                      <p className="text-[10px] text-outline truncate">{est.estado}</p>
                    </div>
                    <span className="text-xs font-bold text-on-surface shrink-0">
                      {est.bicicletas_disponibles}<span className="text-outline font-normal">/{est.capacidad}</span>
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
