'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { CheckCircle2, AlertTriangle, ArrowRight, Download, RefreshCw, Bike } from 'lucide-react'

interface EstStock {
  id: string
  nombre: string
  capacidad: number
  bicis_actuales: number
  demanda_predicha: number
  diferencia: number
  accion: 'deficit' | 'surplus' | 'ok'
  confianza: 'alta' | 'media' | 'baja'
}

interface Movimiento {
  de: string
  a: string
  cantidad: number
}

function calcularMovimientos(estaciones: EstStock[]): Movimiento[] {
  const exceso   = estaciones
    .filter(e => e.accion === 'surplus')
    .map(e => ({ nombre: e.nombre, disponible: Math.abs(e.diferencia) }))
    .sort((a, b) => b.disponible - a.disponible)

  const deficit  = estaciones
    .filter(e => e.accion === 'deficit')
    .map(e => ({ nombre: e.nombre, necesita: e.diferencia }))
    .sort((a, b) => b.necesita - a.necesita)

  const movs: Movimiento[] = []
  let i = 0, j = 0

  while (i < exceso.length && j < deficit.length) {
    const cantidad = Math.min(exceso[i].disponible, deficit[j].necesita)
    if (cantidad > 0) {
      movs.push({ de: exceso[i].nombre, a: deficit[j].nombre, cantidad })
      exceso[i].disponible  -= cantidad
      deficit[j].necesita   -= cantidad
    }
    if (exceso[i].disponible <= 0)  i++
    if (deficit[j].necesita  <= 0)  j++
  }

  return movs
}

function TickEstacion({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const nombre = payload?.value ?? ''
  const short  = nombre.length > 12 ? nombre.slice(0, 11) + '…' : nombre
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="end" fill="#6b7280" fontSize={10} fontWeight={600}
        transform="rotate(-40)">{short}</text>
    </g>
  )
}

export default function StockPage() {
  const [loading, setLoading]   = useState(true)
  const [datos, setDatos]       = useState<EstStock[]>([])
  const [ultima, setUltima]     = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/prediccion/todas?intervalo=2')
      const json = await res.json()
      setDatos(json.estaciones ?? [])
      setUltima(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const optimas    = datos.filter(e => e.accion === 'ok').length
  const bajoStock  = datos.filter(e => e.accion === 'deficit').length
  const sobreStock = datos.filter(e => e.accion === 'surplus').length
  const movimientos = calcularMovimientos(datos)

  const renderLabel = (props: { x?: string | number; y?: string | number; width?: string | number; index?: number }) => {
    const x     = Number(props.x     ?? 0)
    const y     = Number(props.y     ?? 0)
    const width = Number(props.width ?? 0)
    const index = props.index ?? 0
    const d = datos[index]
    if (!d) return null
    const diff  = d.diferencia
    const text  = diff > 1 ? `+${diff}` : diff < -2 ? `${diff}` : '✓'
    const color = diff > 1 ? '#dc2626' : diff < -2 ? '#d97706' : '#16a34a'
    return (
      <text key={index} x={x + width / 2} y={y - 6}
        textAnchor="middle" fill={color} fontSize={10} fontWeight={800}>{text}</text>
    )
  }

  function exportarCSV() {
    const h = 'Estación,Bicis Actuales,Demanda Actual,Diferencia,Estado\n'
    const r = datos.map(e =>
      `"${e.nombre}",${e.bicis_actuales},${e.demanda_predicha},${e.diferencia},"${
        e.accion === 'deficit' ? 'Falta stock' : e.accion === 'surplus' ? 'Exceso' : 'Óptimo'
      }"`
    ).join('\n')
    const blob = new Blob([h + r], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `stock-${new Date().toISOString().slice(0, 10)}.csv`,
    })
    a.click()
  }

  const chartData = datos.map(e => ({
    nombre:    e.nombre,
    optimo:    e.demanda_predicha,
    actuales:  e.bicis_actuales,
    diferencia: e.diferencia,
    accion:    e.accion,
  }))

  return (
    <div className="min-h-screen bg-[#f8fafb]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-[#0f2419]">Stock Óptimo</h1>
            <p className="text-xs text-gray-400 mt-1">
              Estado actual de flota vs demanda estimada para las próximas 2 horas
              {ultima && <> · Actualizado a las <strong>{ultima}</strong></>}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={exportarCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200
                         text-sm font-bold text-gray-600 hover:border-[#0f2419] hover:text-[#0f2419] transition-all">
              <Download size={14} />Exportar CSV
            </button>
            <button onClick={cargar} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold
                         text-[#0f2419] transition-all disabled:opacity-60"
              style={{ background: '#b2f746' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-5 space-y-5">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Estaciones óptimas', value: optimas,    color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle2 },
            { label: 'Bajo stock',          value: bajoStock,  color: '#dc2626', bg: '#fef2f2', Icon: AlertTriangle },
            { label: 'Exceso de bicis',     value: sobreStock, color: '#d97706', bg: '#fffbeb', Icon: Bike },
          ].map(({ label, value, color, bg, Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">{label}</p>
                <p className="text-3xl font-black text-[#0f2419]">{loading ? '—' : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Gráfico ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-bold text-[#0f2419] text-sm">Balance de flota por estación — ahora</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="text-red-600 font-bold">+N faltan</span> ·{' '}
                <span className="text-amber-600 font-bold">-N sobran</span> ·{' '}
                <span className="text-green-600 font-bold">✓ OK</span>
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#0f2419]" />Stock óptimo
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#b2f746]" />Bicis actuales
              </span>
            </div>
          </div>

          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f2419]" />
            </div>
          ) : (
            <div className="px-4 pt-8 pb-2">
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={chartData} margin={{ top: 28, right: 16, left: 0, bottom: 72 }}
                  barGap={3} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="nombre" tick={<TickEstacion />}
                    axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    label={{ value: 'Bicis', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#9ca3af' } }} />
                  <Tooltip
                    contentStyle={{
                      background: '#fff', border: '1px solid #e5e7eb',
                      borderRadius: 12, fontSize: 12, boxShadow: '0 4px 24px rgba(0,0,0,.10)',
                    }}
                    formatter={(value, name) => [
                      `${value ?? 0} bicis`,
                      name === 'optimo' ? '🎯 Stock óptimo' : '🚲 Disponibles ahora',
                    ]}
                    labelFormatter={(label) => `📍 ${label}`}
                  />
                  <Bar dataKey="optimo" name="optimo" radius={[5, 5, 0, 0]} maxBarSize={30}>
                    {chartData.map((d, i) => (
                      <Cell key={i}
                        fill={d.accion === 'deficit' ? '#dc2626' : d.accion === 'surplus' ? '#d97706' : '#0f2419'}
                        fillOpacity={0.88}
                      />
                    ))}
                    <LabelList content={renderLabel} />
                  </Bar>
                  <Bar dataKey="actuales" name="actuales" fill="#b2f746" radius={[5, 5, 0, 0]}
                    maxBarSize={30} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Plan de redistribución ── */}
        {!loading && movimientos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-[#0f2419] mb-1">Plan de redistribución inmediato</h3>
            <p className="text-xs text-gray-400 mb-4">
              Traslados sugeridos para balancear la flota ahora mismo
            </p>
            <div className="space-y-2">
              {movimientos.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-[#f8fafb] border border-gray-100">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-700 truncate">{m.de}</span>
                    <ArrowRight size={14} className="text-gray-400 shrink-0 mx-1" />
                    <span className="text-sm font-semibold text-gray-700 truncate">{m.a}</span>
                  </div>
                  <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold text-[#0f2419]"
                    style={{ background: '#b2f746' }}>
                    <Bike size={11} />
                    {m.cantidad} {m.cantidad === 1 ? 'bici' : 'bicis'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado perfecto */}
        {!loading && movimientos.length === 0 && datos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] flex items-center justify-center shrink-0">
              <CheckCircle2 size={24} className="text-[#16a34a]" />
            </div>
            <div>
              <p className="font-bold text-[#0f2419]">Flota balanceada</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Todas las estaciones tienen el stock adecuado para la demanda actual. No se requieren traslados.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
