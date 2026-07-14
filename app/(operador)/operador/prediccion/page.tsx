'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, Calendar, AlertTriangle, CheckCircle2, Info, Bike,
  Clock, ChevronRight, Flame,
} from 'lucide-react'

interface EstDia {
  id: string
  nombre: string
  capacidad: number
  bicis_actuales: number
  demanda_dia: number
  demanda_restante: number
  faltan: number
  hora_pico: number
  hora_agotamiento: number | null
  por_hora: { hora: number; demanda: number }[]
  confianza: 'alta' | 'media' | 'baja'
}

interface Metadatos {
  total_viajes: number
  meses_historial: number
  fecha_prediccion: string
  dia_semana: string
  muestras_entreno?: number
  estimadores?: number
  es_dia_futuro?: boolean
  hora_actual?: number
}

const HORAS_DIA = Array.from({ length: 18 }, (_, i) => i + 5)  // 05:00–22:00

function hh(h: number) { return `${String(h).padStart(2, '0')}:00` }

function fechaLima(offsetDias: number) {
  const d = new Date(Date.now() - 5 * 3600000 + offsetDias * 86400000)
  return d.toISOString().slice(0, 10)
}

export default function PrediccionPage() {
  const [dia, setDia]           = useState(() => fechaLima(0))
  const [horaSel, setHoraSel]   = useState<number | null>(null)  // null = todo el día
  const [loading, setLoading]   = useState(true)
  const [datos, setDatos]       = useState<EstDia[]>([])
  const [meta, setMeta]         = useState<Metadatos | null>(null)
  const [selId, setSelId]       = useState<string | null>(null)

  const hoy    = fechaLima(0)
  const manana = fechaLima(1)
  const esFuturo = meta?.es_dia_futuro ?? false

  const consultar = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/prediccion/todas?dia=${dia}`)
      const json = await res.json()
      setDatos(json.estaciones ?? [])
      setMeta(json.metadatos ?? null)
    } finally {
      setLoading(false)
    }
  }, [dia])

  useEffect(() => { consultar() }, [consultar])

  /* ── valores según vista: todo el día o una hora específica ── */
  const demandaDe = useCallback((e: EstDia) => {
    if (horaSel === null) return e.demanda_dia
    const d = e.por_hora.find(x => x.hora === horaSel)?.demanda ?? 0
    return Math.round(d * 10) / 10
  }, [horaSel])

  const faltanDe = useCallback((e: EstDia) => {
    if (horaSel === null) return e.faltan
    const d = Math.ceil(e.por_hora.find(x => x.hora === horaSel)?.demanda ?? 0)
    return esFuturo ? d : Math.max(0, d - e.bicis_actuales)
  }, [horaSel, esFuturo])

  const ordenados = [...datos].sort((a, b) => demandaDe(b) - demandaDe(a))
  const enRiesgo  = ordenados.filter(e => faltanDe(e) > 0)
  const demandaTotal = Math.round(ordenados.reduce((s, e) => s + demandaDe(e), 0) * 10) / 10
  const bicisNecesarias = enRiesgo.reduce((s, e) => s + faltanDe(e), 0)
  const conDemanda = ordenados.filter(e => demandaDe(e) > 0).length

  const sel = datos.find(e => e.id === selId) ?? ordenados[0] ?? null
  const maxDemanda = Math.max(...ordenados.map(e => demandaDe(e)), 0.1)

  const fechaLabel = meta
    ? new Date(meta.fecha_prediccion).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  /* Mensaje en lenguaje natural por estación */
  function mensaje(e: EstDia): { texto: string; tipo: 'critico' | 'ok' | 'futuro' } {
    const faltan = faltanDe(e)
    const demanda = demandaDe(e)

    if (horaSel !== null) {
      const dTxt = demanda < 1 && demanda > 0 ? 'menos de 1 viaje' : `≈ ${Math.ceil(demanda)} ${Math.ceil(demanda) === 1 ? 'viaje' : 'viajes'}`
      if (demanda === 0) return { texto: `Sin demanda prevista a las ${hh(horaSel)}.`, tipo: 'ok' }
      if (esFuturo) return {
        texto: `A las ${hh(horaSel)} se prevé ${dTxt} — tener al menos ${Math.max(1, faltan)} ${faltan === 1 ? 'bici' : 'bicis'} colocada${faltan === 1 ? '' : 's'} antes de esa hora.`,
        tipo: 'futuro',
      }
      if (faltan > 0) return {
        texto: `A las ${hh(horaSel)} se prevé ${dTxt} y solo tiene ${e.bicis_actuales} en stock — faltan ${faltan}.`,
        tipo: 'critico',
      }
      return { texto: `A las ${hh(horaSel)}: ${dTxt} previsto${demanda >= 2 ? 's' : ''}, stock suficiente (${e.bicis_actuales} bicis).`, tipo: 'ok' }
    }

    if (esFuturo) {
      if (demanda === 0) return { texto: 'Sin demanda prevista para este día.', tipo: 'ok' }
      return {
        texto: `Colocar ${e.faltan} ${e.faltan === 1 ? 'bicicleta' : 'bicicletas'} a primera hora — se prevén ${demanda} viajes en el día, con pico a las ${hh(e.hora_pico)}.`,
        tipo: 'futuro',
      }
    }
    if (e.faltan > 0) {
      return {
        texto: `Necesita ${e.faltan} ${e.faltan === 1 ? 'bicicleta' : 'bicicletas'} — quedan ${e.demanda_restante} viajes previstos hoy y solo tiene ${e.bicis_actuales} en stock.${
          e.hora_agotamiento !== null ? ` Se quedaría sin bicis ≈ ${hh(e.hora_agotamiento)}.` : ''}`,
        tipo: 'critico',
      }
    }
    if (demanda === 0) return { texto: 'Sin demanda prevista para hoy.', tipo: 'ok' }
    return {
      texto: `Stock suficiente — quedan ${e.demanda_restante} viajes previstos y tiene ${e.bicis_actuales} bicis disponibles.`,
      tipo: 'ok',
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafb] pb-10">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-black text-[#0f2419]">Predicción de Demanda</h1>
        <p className="text-xs text-gray-400 mt-1">
          Qué estaciones tendrán más demanda y cuántas bicicletas necesitan para no quedarse sin stock
        </p>
      </div>

      <div className="px-8 py-5 space-y-5">

        {/* ── Selector de día y hora ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mr-1">Predecir para</p>
          <button onClick={() => setDia(hoy)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              dia === hoy ? 'bg-[#0f2419] text-white border-[#0f2419]' : 'border-gray-200 text-gray-600 hover:border-[#0f2419]'
            }`}>Hoy</button>
          <button onClick={() => setDia(manana)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              dia === manana ? 'bg-[#0f2419] text-white border-[#0f2419]' : 'border-gray-200 text-gray-600 hover:border-[#0f2419]'
            }`}>Mañana</button>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" min={hoy} value={dia}
              onChange={e => e.target.value && setDia(e.target.value)}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:border-[#0f2419]" />
          </div>

          {/* Hora */}
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <select value={horaSel === null ? 'dia' : horaSel}
              onChange={e => setHoraSel(e.target.value === 'dia' ? null : Number(e.target.value))}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:border-[#0f2419]">
              <option value="dia">Todo el día</option>
              {HORAS_DIA.map(h => (
                <option key={h} value={h}>{hh(h)}</option>
              ))}
            </select>
          </div>

          {meta && (
            <span className="ml-auto text-xs font-bold text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-2 rounded-xl">
              {fechaLabel}{horaSel !== null ? ` · ${hh(horaSel)}` : ''}{esFuturo ? ' · día futuro' : ''}
            </span>
          )}
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: horaSel === null ? 'Demanda prevista del día' : `Demanda a las ${hh(horaSel)}`,
              value: loading ? '—' : demandaTotal, unit: 'viajes',
              Icon: TrendingUp, bg: '#f0fdf4', ic: '#16a34a' },
            { label: esFuturo ? 'Estaciones con demanda' : 'Estaciones en riesgo',
              value: loading ? '—' : (esFuturo ? conDemanda : enRiesgo.length),
              unit: `de ${datos.length}`, Icon: AlertTriangle, bg: '#fef2f2', ic: '#dc2626' },
            { label: esFuturo ? 'Bicis a colocar' : 'Bicis que faltan llevar',
              value: loading ? '—' : bicisNecesarias, unit: 'bicicletas',
              Icon: Bike, bg: '#fef9ec', ic: '#d97706' },
          ].map(({ label, value, unit, Icon, bg, ic }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={18} style={{ color: ic }} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">{label}</p>
                <p className="text-2xl font-black text-[#0f2419]">
                  {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

          {/* ── Ranking de estaciones ── */}
          <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#0f2419] text-sm flex items-center gap-2">
                <Flame size={15} className="text-[#d97706]" />
                Estaciones por demanda {horaSel !== null ? `a las ${hh(horaSel)}` : esFuturo ? 'prevista' : 'de hoy'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Ordenadas de mayor a menor demanda · clic para ver su curva horaria
              </p>
            </div>

            {loading ? (
              <div className="py-24 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f2419]" />
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
                {ordenados.map((e, i) => {
                  const m = mensaje(e)
                  const activo = sel?.id === e.id
                  const faltan = faltanDe(e)
                  return (
                    <button key={e.id} onClick={() => setSelId(e.id)}
                      className={`w-full text-left px-5 py-4 transition-colors ${activo ? 'bg-[#f0fdf4]' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          i === 0 ? 'text-[#0f2419]' : i < 3 ? 'bg-[#0f2419] text-white' : 'bg-gray-100 text-gray-500'
                        }`} style={i === 0 ? { background: '#b2f746' } : {}}>
                          {i + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-800">{e.nombre}</p>
                            {m.tipo === 'critico' && (
                              <span className="text-[9px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase">
                                Faltan {faltan}
                              </span>
                            )}
                            {m.tipo === 'futuro' && faltan > 0 && (
                              <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                                Colocar {faltan}
                              </span>
                            )}
                            {m.tipo === 'ok' && demandaDe(e) > 0 && (
                              <span className="text-[9px] font-extrabold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">
                                ✓ OK
                              </span>
                            )}
                            {e.confianza === 'baja' && (
                              <span className="text-[9px] text-amber-600 font-bold">pocos datos</span>
                            )}
                          </div>

                          <p className={`text-xs mt-1 leading-snug ${
                            m.tipo === 'critico' ? 'text-red-700' : m.tipo === 'futuro' ? 'text-blue-700' : 'text-gray-500'
                          }`}>
                            {m.texto}
                          </p>

                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.round((demandaDe(e) / maxDemanda) * 100)}%`,
                                  background: m.tipo === 'critico' ? '#dc2626' : '#b2f746',
                                }} />
                            </div>
                            <span className="text-[10px] font-black text-gray-600 shrink-0 w-16 text-right">
                              {demandaDe(e)} {demandaDe(e) === 1 ? 'viaje' : 'viajes'}
                            </span>
                          </div>
                        </div>

                        <ChevronRight size={15} className={`shrink-0 ${activo ? 'text-[#16a34a]' : 'text-gray-200'}`} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Curva horaria de la estación seleccionada ── */}
          <div className="xl:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-[#0f2419] text-sm flex items-center gap-2">
                  <Clock size={15} className="text-[#16a34a]" />
                  {sel ? `Demanda por hora — ${sel.nombre}` : 'Demanda por hora'}
                </h2>
                {sel && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Hora pico: <strong className="text-gray-600">{hh(sel.hora_pico)}</strong>
                    {!esFuturo && sel.hora_agotamiento !== null && (
                      <> · <span className="text-red-600 font-bold">stock se agota ≈ {hh(sel.hora_agotamiento)}</span></>
                    )}
                  </p>
                )}
              </div>

              {loading || !sel ? (
                <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
                  {loading ? 'Cargando…' : 'Selecciona una estación'}
                </div>
              ) : (
                <div className="px-3 pt-5 pb-2">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={sel.por_hora} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="hora" tickFormatter={h => `${h}h`}
                        tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={2} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                        formatter={(v) => [`${v} viajes estimados`, 'Demanda']}
                        labelFormatter={(h) => `${hh(Number(h))}`}
                      />
                      {!esFuturo && meta?.hora_actual !== undefined && meta.hora_actual >= 5 && meta.hora_actual <= 22 && (
                        <ReferenceLine x={meta.hora_actual} stroke="#2563eb" strokeDasharray="4 3"
                          label={{ value: 'ahora', position: 'top', fontSize: 9, fill: '#2563eb', fontWeight: 800 }} />
                      )}
                      <Bar dataKey="demanda" radius={[4, 4, 0, 0]} maxBarSize={22}>
                        {sel.por_hora.map((x, i) => (
                          <Cell key={i}
                            fill={horaSel !== null && x.hora === horaSel ? '#2563eb'
                              : x.hora === sel.hora_pico ? '#0f2419' : '#b2f746'}
                            fillOpacity={!esFuturo && meta?.hora_actual !== undefined && x.hora < meta.hora_actual ? 0.35 : 0.9}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {sel && (
                <div className="grid grid-cols-3 gap-2 px-5 pb-5">
                  {[
                    { label: 'Demanda día', value: `${sel.demanda_dia}` },
                    { label: esFuturo ? 'A colocar' : 'Stock actual', value: esFuturo ? `${sel.faltan}` : `${sel.bicis_actuales}` },
                    { label: 'Capacidad', value: `${sel.capacidad}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
                      <p className="text-lg font-black text-[#0f2419]">{value}</p>
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Resumen de acciones ── */}
            {!loading && bicisNecesarias > 0 && (
              <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#0f2419' }}>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <CheckCircle2 size={15} style={{ color: '#b2f746' }} />
                  {esFuturo ? 'Preparación para el día' : 'Acciones para hoy'}
                </h3>
                <div className="mt-3 space-y-2">
                  {enRiesgo.slice(0, 5).map(e => (
                    <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <p className="text-xs text-white/80 truncate">
                        {esFuturo ? 'Colocar en' : 'Llevar a'} <strong className="text-white">{e.nombre}</strong>
                      </p>
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full text-[#0f2419]"
                        style={{ background: '#b2f746' }}>
                        <Bike size={10} />{faltanDe(e)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Mensaje informativo del modelo ── */}
        {meta && (
          <div className="px-4 py-3 rounded-xl flex items-start gap-3 bg-white border border-gray-100 shadow-sm">
            <Info size={14} className="text-[#16a34a] shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Predicción elaborada con <strong className="text-[#0f2419]">Gradient Boosting</strong> (mismo
              algoritmo base que XGBoost/LightGBM) · entrenado con{' '}
              <strong>{meta.muestras_entreno?.toLocaleString('es-PE')} muestras</strong> de{' '}
              <strong>{meta.total_viajes.toLocaleString('es-PE')} viajes</strong> de los últimos{' '}
              <strong>{meta.meses_historial} {meta.meses_historial === 1 ? 'mes' : 'meses'}</strong>.
              Las últimas semanas pesan más en el modelo, así la predicción refleja la demanda real más reciente
              y varía según el día de la semana.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
