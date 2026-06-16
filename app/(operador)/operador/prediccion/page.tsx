'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Estacion, PrediccionHora } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { TrendingUp, Info, AlertTriangle } from 'lucide-react'

export default function PrediccionPage() {
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [estacionId, setEstacionId] = useState('')
  const [intervalo, setIntervalo] = useState('3')
  const [datos, setDatos] = useState<PrediccionHora[]>([])
  const [loading, setLoading] = useState(false)
  const [sinDatos, setSinDatos] = useState(false)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('estaciones').select('*').eq('estado', 'activa').order('nombre')
      .then(({ data }) => { if (data) setEstaciones(data) })
  }, [])

  const consultar = useCallback(async () => {
    if (!estacionId) return
    setLoading(true); setSinDatos(false)
    try {
      const res = await fetch(`/api/prediccion?estacion_id=${estacionId}&intervalo=${intervalo}`)
      const json = await res.json()
      if (json.sin_datos) { setSinDatos(true); setDatos([]) }
      else { setDatos(json.prediccion ?? []) }
    } catch {
      setSinDatos(true)
    } finally {
      setLoading(false)
    }
  }, [estacionId, intervalo])

  useEffect(() => { consultar() }, [consultar])

  const estacionSeleccionada = estaciones.find(e => e.id === estacionId)

  const maxDemanda = datos.reduce((m, d) => Math.max(m, d.demanda_estimada), 0)

  return (
    <div className="p-6 space-y-5 max-w-[1100px]">

      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-primary-container">Predicción de Demanda</h1>
        <p className="text-xs text-outline mt-0.5">Disponibilidad proyectada con datos históricos</p>
      </div>

      {/* Controles */}
      <div className="card p-5">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1">Estación</label>
            <select
              className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
              value={estacionId} onChange={e => setEstacionId(e.target.value)}>
              <option value="">Seleccionar estación...</option>
              {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div className="w-44">
            <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1">Horizonte</label>
            <select
              className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
              value={intervalo} onChange={e => setIntervalo(e.target.value)}>
              <option value="1">Próxima 1h</option>
              <option value="3">Próximas 3h</option>
              <option value="6">Próximas 6h</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estado vacío */}
      {!estacionId && (
        <div className="card p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
            <Info size={18} className="text-outline" />
          </div>
          <p className="text-sm text-on-surface">Selecciona una estación para ver la predicción de demanda.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="card p-6">
          <div className="h-72 bg-surface-container-low animate-pulse rounded-xl" />
        </div>
      )}

      {/* Sin datos */}
      {sinDatos && !loading && (
        <div className="card p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#fef9c3] flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-[#854d0e]" />
          </div>
          <div>
            <p className="font-bold text-on-surface text-sm">Modelo en entrenamiento</p>
            <p className="text-xs text-outline mt-1">
              No hay suficientes datos históricos de viajes para esta estación.
              La predicción estará disponible una vez que se registren más viajes.
            </p>
          </div>
        </div>
      )}

      {/* Gráfico */}
      {datos.length > 0 && !loading && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-on-surface flex items-center gap-2">
                <TrendingUp size={18} className="text-primary-container" />
                Demanda Proyectada — {estacionSeleccionada?.nombre}
              </h2>
              <p className="text-xs text-outline mt-0.5">
                Próximas {intervalo}h · Capacidad total: {estacionSeleccionada?.capacidad} bicicletas
              </p>
            </div>
            {/* Mini leyenda */}
            <div className="flex items-center gap-4 text-xs text-outline">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: '#003527' }} />
                Demanda est.
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-error opacity-60" />
                Capacidad
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={datos} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eeff" vertical={false} />
              <XAxis dataKey="hora" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11, fill: '#707974' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#707974' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.95)', border: '1px solid #e5eeff',
                  borderRadius: 12, fontSize: 12, boxShadow: '0 4px 20px rgba(51,65,85,.12)'
                }}
                formatter={(value, name) => [
                  value as number,
                  name === 'demanda_estimada' ? 'Demanda Estimada' : 'Capacidad',
                ]}
              />
              <ReferenceLine
                y={estacionSeleccionada?.capacidad}
                stroke="#ba1a1a" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: 'Capacidad', position: 'insideTopRight', fontSize: 11, fill: '#ba1a1a' }}
              />
              <Bar dataKey="demanda_estimada" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {datos.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.demanda_estimada >= (estacionSeleccionada?.capacidad ?? 999)
                        ? '#ba1a1a'
                        : d.demanda_estimada >= (estacionSeleccionada?.capacidad ?? 0) * 0.8
                        ? '#f59e0b'
                        : '#003527'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Insight cards */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest">Hora pico</p>
              <p className="text-lg font-extrabold text-primary-container mt-1">
                {(() => { const h = datos.find(d => d.demanda_estimada === maxDemanda)?.hora; return h != null ? `${h}:00` : '—' })()}
              </p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest">Demanda máx.</p>
              <p className="text-lg font-extrabold text-on-surface mt-1">{maxDemanda} bicis</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest">Capacidad libre</p>
              <p className={`text-lg font-extrabold mt-1 ${(estacionSeleccionada?.capacidad ?? 0) - maxDemanda < 0 ? 'text-error' : 'text-[#166534]'}`}>
                {Math.max(0, (estacionSeleccionada?.capacidad ?? 0) - maxDemanda)} bicis
              </p>
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-outline">
            La demanda estimada se calcula usando el promedio histórico de viajes por hora y día de semana. Mayor demanda indica mayor necesidad de bicicletas disponibles.
          </div>
        </div>
      )}
    </div>
  )
}
