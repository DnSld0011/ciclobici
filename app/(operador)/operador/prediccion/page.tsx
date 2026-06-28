'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { TrendingUp, Calendar, Clock, AlertTriangle, CheckCircle2, ArrowUp, ArrowDown, Info } from 'lucide-react'

interface EstPrediccion {
  id: string
  nombre: string
  capacidad: number
  bicis_actuales: number
  demanda_predicha: number
  diferencia: number
  accion: 'deficit' | 'surplus' | 'ok'
  confianza: 'alta' | 'media' | 'baja'
}

interface Metadatos {
  total_viajes: number
  meses_historial: number
  fecha_prediccion: string
  hora_prediccion: number
  dia_semana: string
}

// Tick personalizado para nombres de estación (rotado -40°)
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

export default function PrediccionPage() {
  const [modo, setModo]         = useState<'horas' | 'fecha'>('horas')
  const [intervalo, setIntervalo] = useState(4)
  const [fecha, setFecha]       = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
  })
  const [hora, setHora]         = useState(8)
  const [loading, setLoading]   = useState(false)
  const [datos, setDatos]       = useState<EstPrediccion[]>([])
  const [meta, setMeta]         = useState<Metadatos | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const consultar = useCallback(async () => {
    setLoading(true)
    try {
      const qs = modo === 'horas' ? `intervalo=${intervalo}` : `fecha=${fecha}&hora=${hora}`
      const res  = await fetch(`/api/prediccion/todas?${qs}`)
      const json = await res.json()
      setDatos(json.estaciones ?? [])
      setMeta(json.metadatos ?? null)
    } finally {
      setLoading(false)
    }
  }, [modo, intervalo, fecha, hora])

  useEffect(() => { consultar() }, [consultar])

  const deficit = datos.filter(e => e.accion === 'deficit').length
  const surplus = datos.filter(e => e.accion === 'surplus').length
  const ok      = datos.filter(e => e.accion === 'ok').length

  const fechaLabel = meta
    ? new Date(meta.fecha_prediccion).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  // Etiqueta de acción encima de la barra de predicción
  const renderAccionLabel = (props: { x?: string | number; y?: string | number; width?: string | number; index?: number }) => {
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

  const chartData = datos.map(e => ({
    nombre:     e.nombre,
    prediccion: e.demanda_predicha,
    actuales:   e.bicis_actuales,
    diferencia: e.diferencia,
    accion:     e.accion,
  }))

  return (
    <div className="min-h-screen bg-[#f8fafb]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-black text-[#0f2419]">Predicción de Demanda</h1>
        <p className="text-xs text-gray-400 mt-1">
          Anticipa cuántas bicicletas necesitará cada estación y planifica la redistribución con antelación
        </p>
      </div>

      <div className="px-8 py-5 space-y-5">

        {/* ── Controles ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-wrap gap-4 items-end">

            {/* Tabs modo */}
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-2">Modo de consulta</p>
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {([
                  { id: 'horas', label: 'Próximas horas',    Icon: Clock    },
                  { id: 'fecha', label: 'Fecha y hora',      Icon: Calendar },
                ] as const).map(m => (
                  <button key={m.id} onClick={() => setModo(m.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all ${
                      modo === m.id ? 'bg-[#0f2419] text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}>
                    <m.Icon size={13} />{m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Horizonte (modo horas) */}
            {modo === 'horas' && (
              <div>
                <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-2">Horizonte</p>
                <div className="flex gap-2">
                  {[1, 2, 4, 6].map(h => (
                    <button key={h} onClick={() => setIntervalo(h)}
                      className={`w-14 h-10 rounded-xl text-sm font-bold border transition-all ${
                        intervalo === h
                          ? 'bg-[#0f2419] text-white border-[#0f2419]'
                          : 'border-gray-200 text-gray-600 hover:border-[#0f2419]'
                      }`}>{h}h
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fecha + Hora */}
            {modo === 'fecha' && (
              <>
                <div>
                  <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-2">Fecha</p>
                  <input type="date" min={today} value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-700
                               focus:outline-none focus:border-[#0f2419] focus:ring-1 focus:ring-[#0f2419]/20" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-2">Hora</p>
                  <select value={hora} onChange={e => setHora(Number(e.target.value))}
                    className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-700
                               focus:outline-none focus:border-[#0f2419] focus:ring-1 focus:ring-[#0f2419]/20">
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── KPIs ── */}
        {datos.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Necesitan más bicis', value: deficit, icon: ArrowUp,       bg: '#fef2f2', ic: '#dc2626' },
              { label: 'Tienen exceso',        value: surplus, icon: ArrowDown,    bg: '#fffbeb', ic: '#d97706' },
              { label: 'Balanceadas',          value: ok,      icon: CheckCircle2, bg: '#f0fdf4', ic: '#16a34a' },
            ].map(({ label, value, icon: Icon, bg, ic }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                  <Icon size={18} style={{ color: ic }} />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">{label}</p>
                  <p className="text-2xl font-black text-[#0f2419]">
                    {value} <span className="text-sm font-normal text-gray-400">estaciones</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Gráfico principal ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Cabecera gráfico */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <h2 className="font-bold text-[#0f2419] flex items-center gap-2 text-sm">
                <TrendingUp size={16} className="text-[#16a34a]" />
                Demanda predicha por estación
              </h2>

              {/* Badge fecha/hora exacta */}
              {meta && (
                <div className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-[#b2f746] bg-[#f0fdf4]">
                  <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">
                    <Calendar size={11} />Fecha
                  </span>
                  <span className="text-sm font-bold text-[#0f2419]">{fechaLabel}</span>
                  <span className="w-px h-4 bg-gray-200" />
                  <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">
                    <Clock size={11} />Hora
                  </span>
                  <span className="text-sm font-bold text-[#0f2419]">
                    {modo === 'horas'
                      ? `${String(new Date(meta.fecha_prediccion).getHours()).padStart(2, '0')}:00 — ${String(new Date(meta.fecha_prediccion).getHours() + intervalo - 1).padStart(2, '0')}:59`
                      : `${String(hora).padStart(2, '0')}:00 — ${String(hora).padStart(2, '0')}:59`
                    }
                  </span>
                  {modo === 'horas' && (
                    <>
                      <span className="w-px h-4 bg-gray-200" />
                      <span className="text-[10px] font-bold text-[#16a34a]">Próximas {intervalo}h</span>
                    </>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400">
                Etiqueta encima de cada barra: <span className="text-red-600 font-bold">+N faltan</span> · <span className="text-amber-600 font-bold">-N sobran</span> · <span className="text-green-600 font-bold">✓ OK</span>
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs shrink-0">
              <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#0f2419]" />Predicción necesaria
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#b2f746]" />Actuales en estación
              </span>
            </div>
          </div>

          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f2419]" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3 text-gray-400">
              <AlertTriangle size={28} />
              <p className="text-sm">No hay datos disponibles</p>
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
                      name === 'prediccion' ? '🎯 Predicción necesaria' : '🚲 Disponibles ahora',
                    ]}
                    labelFormatter={(label) => `📍 ${label}`}
                  />

                  {/* Barra predicción (coloreada por estado) */}
                  <Bar dataKey="prediccion" name="prediccion" radius={[5, 5, 0, 0]} maxBarSize={30}>
                    {chartData.map((d, i) => (
                      <Cell key={i}
                        fill={d.accion === 'deficit' ? '#dc2626' : d.accion === 'surplus' ? '#d97706' : '#0f2419'}
                        fillOpacity={0.88}
                      />
                    ))}
                    <LabelList content={renderAccionLabel} />
                  </Bar>

                  {/* Barra actuales (verde lima) */}
                  <Bar dataKey="actuales" name="actuales" fill="#b2f746" radius={[5, 5, 0, 0]}
                    maxBarSize={30} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Mensaje informativo */}
          {meta && (
            <div className="mx-6 mb-5 mt-1 px-4 py-3 rounded-xl flex items-start gap-3"
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Info size={14} className="text-[#16a34a] shrink-0 mt-0.5" />
              <p className="text-xs text-[#166534] leading-relaxed">
                Predicción calculada con{' '}
                <strong>{meta.total_viajes.toLocaleString('es-PE')} viajes</strong> registrados
                durante los últimos{' '}
                <strong>{meta.meses_historial} {meta.meses_historial === 1 ? 'mes' : 'meses'}</strong>.
                {' '}Los resultados son orientativos y mejoran cuanto más historial de uso existe.
                {meta.meses_historial < 3 && (
                  <span className="text-amber-700"> Se recomiendan al menos 3 meses para mayor precisión.</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ── Plan de acción ── */}
        {!loading && datos.some(e => e.accion !== 'ok') && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-[#0f2419] mb-1">Plan de acción recomendado</h3>
            <p className="text-xs text-gray-400 mb-4">
              Preparar estos traslados antes de que comience el período predicho
            </p>
            <div className="space-y-2">
              {datos
                .filter(e => e.accion !== 'ok')
                .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
                .map(e => {
                  const isDeficit = e.accion === 'deficit'
                  const cantidad  = Math.abs(e.diferencia)
                  return (
                    <div key={e.id}
                      className="flex items-center gap-3 p-3.5 rounded-xl"
                      style={{ background: isDeficit ? '#fef2f2' : '#fffbeb' }}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isDeficit ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">
                          <strong>{e.nombre}</strong>
                          {isDeficit
                            ? <> — llevar <strong>{cantidad} {cantidad === 1 ? 'bicicleta' : 'bicicletas'}</strong> · tiene {e.bicis_actuales}, necesita {e.demanda_predicha}</>
                            : <> — retirar <strong>{cantidad} {cantidad === 1 ? 'bicicleta' : 'bicicletas'}</strong> · tiene {e.bicis_actuales}, necesita {e.demanda_predicha}</>
                          }
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                        isDeficit ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isDeficit ? `Faltan ${cantidad}` : `Sobran ${cantidad}`}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
