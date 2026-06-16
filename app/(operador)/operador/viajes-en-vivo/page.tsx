'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Activity, Bike, Clock, MapPin, User, RefreshCw, Leaf } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container animate-pulse rounded-2xl" /> }
)

interface ViajeVivo {
  id: string
  inicio_at: string
  usuario: { nombre: string; email: string } | null
  bicicleta: { codigo: string; tipo: string } | null
  estacion_origen: { id: string; nombre: string; latitud: number; longitud: number; direccion: string } | null
}

function tiempoTranscurrido(inicioAt: string) {
  const seg = Math.floor((Date.now() - new Date(inicioAt).getTime()) / 1000)
  const mm  = String(Math.floor(seg / 60)).padStart(2, '0')
  const ss  = String(seg % 60).padStart(2, '0')
  if (seg >= 3600) {
    const hh = String(Math.floor(seg / 3600)).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

function useTick(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [active])
}

export default function ViajesEnVivoPage() {
  const [viajes, setViajes]     = useState<ViajeVivo[]>([])
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [loading, setLoading]   = useState(true)
  const [ultimaAct, setUltimaAct] = useState(new Date())

  useTick(viajes.length > 0)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [{ data: viajesData }, { data: estData }] = await Promise.all([
      supabase
        .from('viajes')
        .select(`
          id, inicio_at,
          usuario:usuario_id(nombre, email),
          bicicleta:bicicleta_id(codigo, tipo),
          estacion_origen:estacion_origen_id(id, nombre, latitud, longitud, direccion)
        `)
        .eq('estado', 'activo')
        .order('inicio_at', { ascending: false }),
      supabase
        .from('estaciones')
        .select('*, bicicletas(id,estado)')
        .eq('estado', 'activa'),
    ])

    if (viajesData) setViajes(viajesData as unknown as ViajeVivo[])
    if (estData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEstaciones((estData as any[]).map(e => ({
        ...e,
        bicicletas_disponibles: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      })))
    }
    setUltimaAct(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    cargar()
    const ch = supabase.channel('viajes-vivo-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  // Estadísticas
  const totalActivos = viajes.length
  const bikesEnUso   = viajes.length
  const durPromedioSeg = viajes.length > 0
    ? viajes.reduce((s, v) => s + (Date.now() - new Date(v.inicio_at).getTime()) / 1000, 0) / viajes.length
    : 0
  const durPromedioMin = Math.floor(durPromedioSeg / 60)
  const co2TotalEstimado = Math.round(viajes.reduce((s, v) => {
    const minutos = (Date.now() - new Date(v.inicio_at).getTime()) / 60000
    return s + (minutos / 60 * 10 * 0.21) // estimación 10km/h
  }, 0) * 10) / 10

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface flex items-center gap-2">
            <Activity size={22} className="text-primary-container" />
            Viajes en vivo
          </h1>
          <p className="text-sm text-outline mt-0.5">
            Actualizado: {ultimaAct.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/30 bg-white text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors self-start sm:self-auto">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: Activity, label: 'Viajes activos', value: totalActivos,
            unit: '', color: 'text-primary-container', bg: 'bg-[#e5eeff]',
            dot: totalActivos > 0,
          },
          {
            icon: Bike, label: 'Bicicletas en uso', value: bikesEnUso,
            unit: '', color: 'text-[#854d0e]', bg: 'bg-[#fef9c3]', dot: false,
          },
          {
            icon: Clock, label: 'Duración promedio', value: durPromedioMin,
            unit: ' min', color: 'text-[#166534]', bg: 'bg-[#dcfce7]', dot: false,
          },
          {
            icon: Leaf, label: 'CO₂ ahorrado est.', value: co2TotalEstimado,
            unit: ' kg', color: 'text-primary-container', bg: 'bg-[#e5eeff]', dot: false,
          },
        ].map(({ icon: Icon, label, value, unit, color, bg, dot }) => (
          <div key={label} className="card p-4">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <p className={`text-2xl font-extrabold ${color} flex items-baseline gap-0.5`}>
              {loading ? '—' : value}
              {dot && value > 0 && <span className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse ml-1 inline-block" />}
              <span className="text-sm font-normal text-outline">{unit}</span>
            </p>
            <p className="text-xs text-outline mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Map + List grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Mapa */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-outline-variant/20 shadow-sm" style={{ height: '460px' }}>
          {loading
            ? <div className="w-full h-full bg-surface-container animate-pulse" />
            : <MapaEstaciones
                estaciones={estaciones}
                modoOperador
                focusEstacion={null}
              />
          }
        </div>

        {/* Lista de viajes */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="card flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
              <h2 className="font-extrabold text-sm text-on-surface">Viajes en curso</h2>
              <span className="text-xs text-outline">{totalActivos} activo{totalActivos !== 1 ? 's' : ''}</span>
            </div>

            {loading && (
              <div className="flex-1 p-4 space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded bg-surface-container-low w-3/4" />
                      <div className="h-2.5 rounded bg-surface-container-low w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && viajes.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 bg-surface-container-low rounded-2xl flex items-center justify-center mb-3">
                  <Bike size={24} className="text-outline" />
                </div>
                <p className="font-semibold text-on-surface text-sm">Sin viajes activos</p>
                <p className="text-xs text-outline mt-1">Cuando un ciudadano inicie un viaje aparecerá aquí en tiempo real</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
              {viajes.map((v) => {
                const durMin = Math.floor((Date.now() - new Date(v.inicio_at).getTime()) / 60000)
                const urgent = durMin >= 60

                return (
                  <div key={v.id} className="px-4 py-3.5 hover:bg-surface-container-low/50 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${urgent ? 'bg-[#ffdad6]' : 'bg-[#e5eeff]'}`}>
                        <User size={17} className={urgent ? 'text-error' : 'text-primary-container'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Nombre + badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-on-surface truncate">
                            {v.usuario?.nombre ?? 'Usuario'}
                          </p>
                          {urgent && (
                            <span className="text-[10px] font-bold bg-[#ffdad6] text-error px-1.5 py-0.5 rounded-full shrink-0">+1h</span>
                          )}
                        </div>
                        {/* Bici + origen */}
                        <p className="text-xs text-outline mt-0.5 flex items-center gap-1 truncate">
                          <Bike size={10} className="shrink-0" />
                          {v.bicicleta?.codigo ?? '—'} · {v.bicicleta?.tipo}
                        </p>
                        <p className="text-xs text-outline flex items-center gap-1 truncate">
                          <MapPin size={9} className="shrink-0 text-primary-container" />
                          {v.estacion_origen?.nombre ?? '—'}
                        </p>
                      </div>
                      {/* Timer */}
                      <div className="shrink-0 text-right">
                        <p className={`font-mono text-sm font-extrabold tabular-nums ${urgent ? 'text-error' : 'text-primary-container'}`}>
                          {tiempoTranscurrido(v.inicio_at)}
                        </p>
                        <p className="text-[10px] text-outline mt-0.5">
                          {new Date(v.inicio_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
