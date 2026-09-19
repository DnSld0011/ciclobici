'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { ArrowLeft, TrendingUp, RefreshCw } from 'lucide-react'

interface TendenciasData {
  mesesHistorial: number
  totalFallas: number
  distribucionTipo: { tipo: string; cantidad: number }[]
  tasaPorModelo: { modelo: string; fallas: number }[]
  problemasRecurrentes: {
    tipo: string
    modelo: string
    frecuencia: number
    prioridad: 'critica' | 'alta' | 'media'
    estado: 'pendiente' | 'en_progreso' | 'resuelto'
  }[]
}

const COLORES = ['#003527', '#166534', '#b2f746', '#1d4ed8', '#f59e0b', '#ef4444', '#7c3aed', '#0891b2', '#6b7280']

const PRIORIDAD_UI: Record<string, { label: string; bg: string; text: string }> = {
  critica: { label: 'Crítica', bg: 'bg-[#ffdad6]', text: 'text-error' },
  alta:    { label: 'Alta',    bg: 'bg-[#fef9c3]', text: 'text-amber-700' },
  media:   { label: 'Media',   bg: 'bg-[#e5eeff]', text: 'text-primary-container' },
}

const ESTADO_UI: Record<string, { label: string; bg: string; text: string }> = {
  pendiente:    { label: 'Pendiente',    bg: 'bg-[#f1f5f9]', text: 'text-outline' },
  en_progreso:  { label: 'En progreso',  bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]' },
  resuelto:     { label: 'Resuelto',     bg: 'bg-[#dcfce7]', text: 'text-[#166534]' },
}

export default function TendenciasFallasPage() {
  const [data, setData]       = useState<TendenciasData | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/operador/fallas/tendencias')
      const json = await res.json()
      if (res.ok) setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/operador/fallas"
            className="flex items-center gap-1.5 text-xs text-outline hover:text-on-surface transition-colors mb-2 w-fit">
            <ArrowLeft size={12} /> Volver a fallas mecánicas
          </Link>
          <h1 className="text-xl font-extrabold text-primary-container flex items-center gap-2">
            <TrendingUp size={20} /> Tendencias de Fallas
          </h1>
          <p className="text-sm text-outline mt-0.5">
            {data ? `Últimos ${data.mesesHistorial} meses · ${data.totalFallas} incidencias` : 'Análisis histórico · San Borja en Bici'}
          </p>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-1.5 text-xs font-semibold text-outline border border-outline-variant/30 bg-white px-3 py-2 rounded-full hover:bg-surface-container-low transition-colors h-fit">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {loading || !data ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-48 bg-surface-container-low rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {/* Tasa de falla por modelo */}
            <div className="card p-4">
              <p className="text-xs font-extrabold text-on-surface uppercase tracking-wide mb-3">Tasa de Falla por Modelo</p>
              {data.tasaPorModelo.length === 0 ? (
                <p className="text-xs text-outline py-8 text-center">Sin datos suficientes</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.tasaPorModelo} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="modelo" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="fallas" fill="#003527" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Distribución por tipo de componente */}
            <div className="card p-4">
              <p className="text-xs font-extrabold text-on-surface uppercase tracking-wide mb-3">Tipo de Componente</p>
              {data.distribucionTipo.length === 0 ? (
                <p className="text-xs text-outline py-8 text-center">Sin datos suficientes</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.distribucionTipo} dataKey="cantidad" nameKey="tipo" cx="50%" cy="50%" outerRadius={70}>
                      {data.distribucionTipo.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Problemas recurrentes y prioridades */}
          <div className="card overflow-hidden">
            <p className="text-xs font-extrabold text-on-surface uppercase tracking-wide p-4 pb-0">
              Problemas Recurrentes y Prioridades
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-outline font-semibold border-b border-outline-variant/15">
                    <th className="px-4 py-2">Componente</th>
                    <th className="px-4 py-2">Modelo</th>
                    <th className="px-4 py-2">Frecuencia</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Prioridad</th>
                  </tr>
                </thead>
                <tbody>
                  {data.problemasRecurrentes.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-outline">Sin problemas recurrentes en el período</td></tr>
                  ) : data.problemasRecurrentes.map((p, i) => {
                    const prio = PRIORIDAD_UI[p.prioridad]
                    const est  = ESTADO_UI[p.estado]
                    return (
                      <tr key={i} className="border-b border-outline-variant/10 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-on-surface">{p.tipo}</td>
                        <td className="px-4 py-2.5 text-on-surface-variant">{p.modelo}</td>
                        <td className="px-4 py-2.5 font-bold">{p.frecuencia}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${est.bg} ${est.text}`}>{est.label}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${prio.bg} ${prio.text}`}>{prio.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
