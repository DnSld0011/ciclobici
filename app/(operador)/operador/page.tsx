'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad, Alerta } from '@/types'
import {
  TrendingUp, TrendingDown, Bell, Leaf, RefreshCw, ChevronRight,
  AlertTriangle, CheckCircle, Info, Search, HelpCircle, Sun,
  CalendarDays, Sparkles, ArrowRightLeft, Bike, Route, Timer, MapPin, History,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container-low animate-pulse rounded-xl" /> }
)

interface ViajeAnual {
  inicio_at: string
  estacion_origen_id: string | null
  distancia_km: number | null
  duracion_min: number | null
}

interface KPIs {
  bicisDisponibles: number
  bicisTotal: number
  bicisEnViaje: number
  viajesHoy: number
  viajesAyer: number
  viajesActivos: number
  estacionesActivas: number
  co2Ahorrado: number
}

/* ── componente alerta ── */
function AlertaCard({ a }: { a: Alerta }) {
  const conf = {
    critica: { bg: '#fff0ee', border: '#ef4444', text: '#93000a', icon: AlertTriangle },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#854d0e', icon: AlertTriangle },
    info:    { bg: '#f0fff4', border: '#22c55e', text: '#166534', icon: CheckCircle },
  }[a.nivel] ?? { bg: '#f0fff4', border: '#22c55e', text: '#166534', icon: Info }
  const Icon = conf.icon
  const hace = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 60000)
  const tiempoStr = hace < 60 ? `${hace}m` : `${Math.floor(hace / 60)}h`

  return (
    <div className="rounded-xl p-3.5 flex gap-3 border-l-4" style={{ background: conf.bg, borderLeftColor: conf.border }}>
      <Icon size={16} className="shrink-0 mt-0.5" style={{ color: conf.border }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight" style={{ color: conf.text }}>{a.titulo}</p>
        {a.mensaje && (
          <p className="text-xs leading-snug mt-0.5 line-clamp-2 opacity-80" style={{ color: conf.text }}>{a.mensaje}</p>
        )}
      </div>
      <span className="text-[10px] text-outline shrink-0 mt-0.5">{tiempoStr}</span>
    </div>
  )
}

export default function DashboardOperadorPage() {
  const [kpis, setKpis] = useState<KPIs>({
    bicisDisponibles: 0, bicisTotal: 0, bicisEnViaje: 0,
    viajesHoy: 0, viajesAyer: 0, viajesActivos: 0,
    estacionesActivas: 0, co2Ahorrado: 0,
  })
  const [estaciones, setEstaciones]     = useState<EstacionConDisponibilidad[]>([])
  const [alertas, setAlertas]           = useState<Alerta[]>([])
  const [viajesAnio, setViajesAnio]     = useState<ViajeAnual[]>([])
  const [demandaPorHora, setDemandaPorHora] = useState<{ hora: number; viajes: number }[]>([])
  const [ultimaAct, setUltimaAct]       = useState<Date | null>(null)
  const [loading, setLoading]           = useState(true)
  const [tabPred, setTabPred]           = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [busqueda, setBusqueda]         = useState('')
  const router = useRouter()

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)

    const [
      { data: bicis },
      { data: ests },
      { count: viajesHoy },
      { count: viajesAyer },
      { count: viajesActivos },
      { data: alertasData },
      { data: viajesKm },
      { data: perfil },
      { data: viajesHoraData },
    ] = await Promise.all([
      supabase.from('bicicletas').select('id, estado'),
      supabase.from('estaciones').select('*, bicicletas(id,estado)').order('nombre'),
      supabase.from('viajes').select('*', { count: 'exact', head: true })
        .gte('inicio_at', hoy.toISOString()).eq('estado', 'finalizado'),
      supabase.from('viajes').select('*', { count: 'exact', head: true })
        .gte('inicio_at', ayer.toISOString()).lt('inicio_at', hoy.toISOString()).eq('estado', 'finalizado'),
      supabase.from('viajes').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('alertas').select('*').eq('resuelta', false).order('created_at', { ascending: false }).limit(6),
      supabase.from('viajes').select('distancia_km').eq('estado', 'finalizado').not('distancia_km', 'is', null),
      supabase.from('usuarios').select('nombre, rol').eq('id', user.id).single(),
      supabase.from('viajes').select('inicio_at').gte('inicio_at', hoy.toISOString()),
    ])

    if (viajesHoraData) {
      const conteo: Record<number, number> = {}
      for (let h = 0; h < 24; h++) conteo[h] = 0
      for (const v of viajesHoraData) {
        const h = new Date(v.inicio_at).getHours()
        conteo[h] = (conteo[h] ?? 0) + 1
      }
      setDemandaPorHora(Array.from({ length: 24 }, (_, h) => ({ hora: h, viajes: conteo[h] })))
    }

    if (bicis) {
      const disponibles = bicis.filter(b => b.estado === 'disponible').length
      const enViaje    = bicis.filter(b => b.estado === 'en_viaje').length
      setKpis(prev => ({ ...prev, bicisDisponibles: disponibles, bicisTotal: bicis.length, bicisEnViaje: enViaje }))
    }
    if (viajesKm) {
      const co2 = viajesKm.reduce((s, v) => s + ((v.distancia_km ?? 0) * 0.21), 0)
      setKpis(prev => ({ ...prev, co2Ahorrado: Math.round(co2 * 10) / 10 }))
    }
    setKpis(prev => ({
      ...prev,
      viajesHoy:       viajesHoy ?? 0,
      viajesAyer:      viajesAyer ?? 0,
      viajesActivos:   viajesActivos ?? 0,
      estacionesActivas: ests?.filter(e => e.estado === 'activa').length ?? 0,
    }))
    if (ests) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEstaciones((ests as any[]).map(e => ({
        ...e,
        bicicletas_disponibles: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      })))
    }
    if (alertasData) setAlertas(alertasData as Alerta[])
    if (perfil) setNombreUsuario(perfil.nombre ?? '')
    setUltimaAct(new Date())
    setLoading(false)
  }, [router])

  // Historial anual: se carga una sola vez vía API (adminClient evita RLS)
  useEffect(() => {
    fetch('/api/dashboard/historico')
      .then(res => res.json())
      .then(json => { if (json.viajes) setViajesAnio(json.viajes as ViajeAnual[]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('operador-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  /* ── métricas derivadas ── */
  const pctDisp    = kpis.bicisTotal > 0 ? Math.round((kpis.bicisDisponibles / kpis.bicisTotal) * 100) : 0
  const eficiencia = kpis.bicisTotal > 0
    ? Math.round(((kpis.bicisDisponibles + kpis.bicisEnViaje) / kpis.bicisTotal) * 100) : 0
  const viajesDelta = kpis.viajesAyer > 0
    ? Math.round(((kpis.viajesHoy - kpis.viajesAyer) / kpis.viajesAyer) * 100) : 0
  const co2TN = (kpis.co2Ahorrado / 1000).toFixed(1)
  const alertasCriticas = alertas.filter(a => a.nivel === 'critica').length
  const esPicoUso = viajesDelta > 10

  /* ── estaciones con problema para redistribución ── */
  const estSaturada = estaciones.find(e => e.bicicletas_disponibles > (e.capacidad ?? 10) * 0.9)
  const estVacia    = estaciones.find(e => e.bicicletas_disponibles === 0 && e.estado === 'activa')
  const needsRedist = !!(estSaturada && estVacia)

  /* ── datos para el gráfico 24h (datos reales de BD) ── */
  const demandaData = demandaPorHora.length > 0
    ? demandaPorHora.map(d => ({ hora: d.hora, demanda: d.viajes }))
    : Array.from({ length: 24 }, (_, h) => ({ hora: h, demanda: 0 }))
  const horaActual  = new Date().getHours()

  /* ── filtro búsqueda de estaciones ── */
  const estacionesFiltradas = busqueda
    ? estaciones.filter(e => e.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : []

  /* ── día laboral ── */
  const hoy = new Date()
  const esLaboral = hoy.getDay() >= 1 && hoy.getDay() <= 5
  const mesActual = hoy.getMonth() // 0-11

  /* ── Histórico anual (12 meses) ─────────────────────────────── */
  const MESES  = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const DIAS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const anual = useMemo(() => {
    // Últimos 12 meses en orden cronológico
    const meses: { key: string; label: string; viajes: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      meses.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        viajes: 0,
      })
    }
    const mesIdx = Object.fromEntries(meses.map((m, i) => [m.key, i]))

    const porDia   = DIAS.map(d => ({ dia: d, viajes: 0 }))
    const porEst: Record<string, number> = {}
    const porHora: Record<number, number> = {}
    let km = 0, durTotal = 0, conDur = 0

    for (const v of viajesAnio) {
      const t = new Date(v.inicio_at)
      const mk = `${t.getFullYear()}-${t.getMonth()}`
      if (mesIdx[mk] !== undefined) meses[mesIdx[mk]].viajes++
      porDia[t.getDay()].viajes++
      porHora[t.getHours()] = (porHora[t.getHours()] ?? 0) + 1
      if (v.estacion_origen_id) porEst[v.estacion_origen_id] = (porEst[v.estacion_origen_id] ?? 0) + 1
      km += v.distancia_km ?? 0
      if (v.duracion_min) { durTotal += v.duracion_min; conDur++ }
    }

    // Top 5 estaciones de origen (con nombre)
    const nombreEst = Object.fromEntries(estaciones.map(e => [e.id, e.nombre]))
    const topEst = Object.entries(porEst)
      .map(([id, viajes]) => ({ nombre: nombreEst[id] ?? 'Estación', viajes }))
      .sort((a, b) => b.viajes - a.viajes)
      .slice(0, 5)

    // Reordenar días empezando en Lunes
    const porDiaLun = [...porDia.slice(1), porDia[0]]

    const mesPico = meses.reduce((top, m) => m.viajes > top.viajes ? m : top, meses[0])
    const diaPico = porDiaLun.reduce((top, d) => d.viajes > top.viajes ? d : top, porDiaLun[0])
    const horaPicoNum = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0]?.[0]

    return {
      total:    viajesAnio.length,
      km:       Math.round(km),
      co2:      Math.round(km * 0.21 * 10) / 10,   // kg CO2
      durProm:  conDur ? Math.round(durTotal / conDur) : 0,
      porMes:   meses,
      porDia:   porDiaLun,
      topEst,
      mesPico,
      diaPico,
      horaPico: horaPicoNum !== undefined ? `${String(horaPicoNum).padStart(2, '0')}:00` : '—',
      viajesPorDia: viajesAnio.length ? Math.round(viajesAnio.length / 365 * 10) / 10 : 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajesAnio, estaciones])

  const maxMes    = Math.max(...anual.porMes.map(m => m.viajes), 1)
  const maxDia    = Math.max(...anual.porDia.map(d => d.viajes), 1)
  const maxTopEst = anual.topEst[0]?.viajes ?? 1

  /* ── datos del gráfico Analítica Predictiva según pestaña ───── */
  const predChart = useMemo(() => {
    if (tabPred === 'hoy') {
      return demandaData.map(d => ({ label: `${d.hora}:00`, demanda: d.demanda, esActual: d.hora === horaActual }))
    }
    const dias = tabPred === 'semana' ? 7 : 30
    const buckets: { label: string; demanda: number; esActual: boolean }[] = []
    const idx: Record<string, number> = {}
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const key = d.toDateString()
      idx[key] = buckets.length
      buckets.push({
        label: tabPred === 'semana' ? `${DIAS[d.getDay()]} ${d.getDate()}` : `${d.getDate()}/${d.getMonth() + 1}`,
        demanda: 0,
        esActual: i === 0,
      })
    }
    const desde = new Date(hoy); desde.setDate(desde.getDate() - (dias - 1)); desde.setHours(0, 0, 0, 0)
    for (const v of viajesAnio) {
      const t = new Date(v.inicio_at)
      if (t < desde) continue
      const key = new Date(t.getFullYear(), t.getMonth(), t.getDate()).toDateString()
      if (idx[key] !== undefined) buckets[idx[key]].demanda++
    }
    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabPred, demandaData, viajesAnio, horaActual])

  const picoPred = Math.max(...predChart.map(d => d.demanda), 1)

  return (
    <div className="min-h-screen" style={{ background: '#f4f6f5' }}>

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <h1 className="text-sm font-black text-gray-800 tracking-[0.12em] uppercase">
          Centro de Control Inteligente
        </h1>
        <div className="flex items-center gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar estaciones..."
                className="bg-transparent text-sm outline-none w-44 text-gray-600 placeholder-gray-400"
              />
            </div>
            {busqueda && estacionesFiltradas.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg z-30 overflow-hidden">
                {estacionesFiltradas.slice(0, 5).map(e => (
                  <Link key={e.id} href="/operador/estaciones"
                    onClick={() => setBusqueda('')}
                    className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                    <span className="font-medium text-gray-800">{e.nombre}</span>
                    <span className="text-xs text-gray-400">{e.bicicletas_disponibles} bicis</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <HelpCircle size={15} className="text-gray-500" />
          </button>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shadow-sm cursor-pointer">
            <span className="text-white text-sm font-extrabold">
              {nombreUsuario ? nombreUsuario[0].toUpperCase() : 'O'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-[1440px]">

        {/* ── Actualización ── */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium">
            Última actualización: {ultimaAct?.toLocaleTimeString('es-PE') ?? '—'}
          </p>
          <button onClick={cargar}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Disponibilidad Operativa */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Disponibilidad Operativa</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-gray-900">{loading ? '—' : `${pctDisp}%`}</span>
              <span className={`text-xs font-bold flex items-center gap-0.5 mb-1.5 px-2 py-0.5 rounded-full ${pctDisp >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {pctDisp >= 70 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {pctDisp >= 70 ? `+${Math.round((pctDisp - 70))}%` : `${pctDisp - 70}%`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-100">
              <div className="h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${pctDisp}%`, background: pctDisp >= 70 ? '#b2f746' : '#ef4444' }} />
            </div>
            <p className="text-[10px] text-gray-400">
              {kpis.bicisDisponibles} de {kpis.bicisTotal} bicis disponibles
            </p>
          </div>

          {/* Eficiencia de Recursos */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Eficiencia de Recursos</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-gray-900">{loading ? '—' : `${eficiencia}%`}</span>
              {eficiencia >= 80 && (
                <span className="text-xs font-bold flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  <CheckCircle size={10} /> Óptimo
                </span>
              )}
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-100">
              <div className="h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${eficiencia}%`, background: '#b2f746' }} />
            </div>
            <p className="text-[10px] text-gray-400">Distribución de flota en tiempo real</p>
          </div>

          {/* Viajes Activos */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Viajes Activos</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-gray-900">
                {loading ? '—' : kpis.viajesHoy.toLocaleString('es-PE')}
              </span>
              {!loading && esPicoUso && (
                <span className="text-xs font-bold flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  ⚡ Pico de uso
                </span>
              )}
            </div>
            {/* Mini bar chart — datos reales por hora */}
            <div className="flex items-end gap-0.5 h-7">
              {demandaData.slice(6, 22).map((d, i) => {
                const maxH = Math.max(...demandaData.slice(6, 22).map(x => x.demanda), 1)
                return (
                  <div key={i}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: `${Math.round((d.demanda / maxH) * 100)}%`,
                      minHeight: 2,
                      background: i + 6 === horaActual ? '#003527' : '#b2f746',
                      opacity: i + 6 <= horaActual ? 1 : 0.4,
                    }}
                  />
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400">
              {kpis.viajesActivos > 0 ? `${kpis.viajesActivos} en curso ahora` : `vs ${kpis.viajesAyer} ayer`}
            </p>
          </div>

          {/* Carbono Ahorrado */}
          <div className="rounded-2xl p-5 flex flex-col gap-3 shadow-sm" style={{ background: '#0f2419' }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(178,247,70,0.6)' }}>
              Carbono Ahorrado
            </p>
            <span className="text-4xl font-black text-white">{loading ? '—' : `${co2TN} TN`}</span>
            <div className="flex items-center gap-1.5 mt-auto">
              <Leaf size={14} style={{ color: '#b2f746' }} />
              <span className="text-xs font-bold" style={{ color: '#b2f746' }}>Impacto Ecológico SB</span>
            </div>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Estimado total histórico</p>
          </div>
        </div>

        {/* ── Mapa + Alertas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Mapa en vivo */}
          <div className="lg:col-span-7 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative" style={{ height: 440 }}>
            {/* Pills */}
            <div className="absolute top-3 left-3 z-10 flex gap-2">
              <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-white/50">
                <span className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse" />
                <span className="text-xs font-bold text-gray-800">Mapa en vivo</span>
              </div>
              {ultimaAct && (
                <div className="flex items-center bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-white/40">
                  <span className="text-xs text-gray-500 font-medium">
                    Actualizado hace {Math.floor((Date.now() - ultimaAct.getTime()) / 1000)}s
                  </span>
                </div>
              )}
            </div>

            {loading
              ? <div className="w-full h-full bg-gray-50 animate-pulse" />
              : <MapaEstaciones estaciones={estaciones} modoOperador />
            }

            {/* Leyenda */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-2.5 rounded-xl shadow-md border border-white/60 flex flex-col gap-1.5">
              {[
                { color: '#b2f746', label: 'Disponible (>5 bicis)' },
                { color: '#f59e0b', label: 'Riesgo / Saturado' },
                { color: '#ef4444', label: 'Vacío / Crítico' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[10px] font-semibold text-gray-700">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas Inteligentes */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-500" />
                <h3 className="font-black text-gray-800 text-sm">Alertas Inteligentes</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black tracking-wider"
                style={{ background: '#e5eeff', color: '#1a56db' }}>
                <Sparkles size={10} />
                IA ACTIVA
              </div>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {loading
                ? Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)
                : alertas.length === 0
                  ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
                      <CheckCircle size={28} className="text-[#b2f746]" />
                      <p className="text-sm font-semibold text-gray-500">Sin alertas activas</p>
                      <p className="text-xs text-gray-400">Todo está funcionando correctamente</p>
                    </div>
                  )
                  : alertas.map(a => <AlertaCard key={a.id} a={a} />)
              }
            </div>

            <Link href="/operador/alertas"
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors">
              Ver historial completo <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* ── Nueva Orden de Redistribución (solo si hay necesidad) ── */}
        {needsRedist && (
          <div className="rounded-2xl p-5 shadow-md flex items-center justify-between gap-4" style={{ background: '#0f2419' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(178,247,70,0.15)' }}>
                <ArrowRightLeft size={18} style={{ color: '#b2f746' }} />
              </div>
              <div>
                <p className="font-black text-white text-sm">Nueva Orden de Redistribución</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {estSaturada?.nombre} → {estVacia?.nombre} · Intervención recomendada
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-center">
                <p className="text-lg font-black" style={{ color: '#b2f746' }}>
                  +{estSaturada ? Math.round(((estSaturada.bicicletas_disponibles ?? 0) / (estSaturada.capacidad ?? 10)) * 100) : 0}%
                </p>
                <p className="text-[10px] text-white/40">Saturación</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-white">{kpis.viajesActivos}</p>
                <p className="text-[10px] text-white/40">En curso</p>
              </div>
              <Link href="/operador/mapa"
                className="px-4 py-2 rounded-xl text-xs font-black text-[#0f2419] flex items-center gap-1.5"
                style={{ background: '#b2f746' }}>
                Ver en mapa <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        )}

        {/* ── Analítica Predictiva ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Gráfico demanda 24h */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-black text-gray-800 text-base">Analítica Predictiva</h3>
                <p className="text-xs text-gray-400 mt-0.5">Viajes reales del día · Actualización automática</p>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 text-xs font-bold">
                {(['hoy', 'semana', 'mes'] as const).map(t => (
                  <button key={t} onClick={() => setTabPred(t)}
                    className={`px-3 py-1.5 capitalize transition-colors ${tabPred === t ? 'bg-[#003527] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {t === 'hoy' ? 'Hoy' : t === 'semana' ? 'Semana' : 'Mes'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              {tabPred === 'hoy'    && 'Viajes iniciados hoy · Por hora'}
              {tabPred === 'semana' && 'Viajes finalizados · Últimos 7 días'}
              {tabPred === 'mes'    && 'Viajes finalizados · Últimos 30 días'}
            </p>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={predChart} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  interval={tabPred === 'hoy' ? 3 : tabPred === 'mes' ? 4 : 0} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [v, tabPred === 'hoy' ? 'Viajes iniciados' : 'Viajes finalizados']}
                />
                {picoPred > 1 && (
                  <ReferenceLine y={picoPred}
                    stroke="#003527" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: `PICO: ${picoPred.toLocaleString()}`, position: 'insideTopLeft', fontSize: 10, fill: '#003527', fontWeight: 800 }}
                  />
                )}
                <Bar dataKey="demanda" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {predChart.map((d, i) => (
                    <Cell key={i}
                      fill={d.demanda === picoPred ? '#003527' : i % 2 === 0 ? '#b2f746' : '#c5f768'}
                      opacity={d.esActual ? 1 : tabPred === 'hoy' && i > horaActual ? 0.5 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Factores externos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
            <div>
              <h3 className="font-black text-gray-800 text-base">Factores Externos</h3>
              <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider font-bold">
                Condiciones actuales
              </p>
            </div>

            {/* Clima */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#fef9c3' }}>
                  <Sun size={18} style={{ color: '#854d0e' }} />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-800">
                    {mesActual >= 11 || mesActual <= 2 ? '28°C Soleado' : mesActual >= 6 && mesActual <= 8 ? '17°C Nublado' : '22°C Parcial'}
                  </p>
                  <p className="text-[10px] text-gray-400">Impacto en demanda: +{mesActual >= 11 || mesActual <= 2 ? 18 : 10}%</p>
                </div>
              </div>
              <TrendingUp size={14} className="text-green-500" />
            </div>

            {/* Día */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#e5eeff' }}>
                  <CalendarDays size={18} style={{ color: '#1a56db' }} />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-800">{esLaboral ? 'Día Laboral' : 'Fin de Semana'}</p>
                  <p className="text-[10px] text-gray-400">
                    {esLaboral ? 'Corredor Empresarial SB' : 'Uso recreativo esperado'}
                  </p>
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <span className="text-[10px] font-black text-blue-600">
                  {esLaboral ? '👔' : '🏖️'}
                </span>
              </div>
            </div>

            {/* Insight IA */}
            <div className="flex-1 p-3.5 rounded-xl border border-gray-100" style={{ background: '#f9fafb' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} style={{ color: '#1a56db' }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#1a56db' }}>Predicción IA</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed italic">
                &ldquo;{esLaboral
                  ? `La IA predice mayor demanda en el corredor empresarial de San Borja entre las ${horaActual < 9 ? '08:00 y 09:30' : horaActual < 14 ? '17:00 y 19:00' : '08:00 y 09:30'}. Se recomienda redistribución preventiva.`
                  : 'Mayor actividad esperada en parques y zonas recreativas durante el fin de semana. Demanda sostenida hasta las 20:00.'
                }&rdquo;
              </p>
            </div>

            {/* Enlace a predicción */}
            <Link href="/operador/prediccion"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
              Ver predicción completa <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        {/* ══ HISTÓRICO ANUAL ══════════════════════════════════════ */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#0f2419' }}>
            <History size={16} style={{ color: '#b2f746' }} />
          </div>
          <div>
            <h2 className="font-black text-gray-800 text-base leading-tight">Histórico Anual</h2>
            <p className="text-xs text-gray-400">Últimos 12 meses de operación · {anual.total.toLocaleString('es-PE')} viajes registrados</p>
          </div>
        </div>

        {/* ── KPIs del año ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Viajes en el año',   value: anual.total.toLocaleString('es-PE'),          sub: `≈ ${anual.viajesPorDia} viajes/día`,        Icon: Bike,  bg: '#f0fdf4', ic: '#16a34a' },
            { label: 'Km recorridos',      value: `${anual.km.toLocaleString('es-PE')} km`,     sub: 'Distancia total acumulada',                  Icon: Route, bg: '#eff6ff', ic: '#2563eb' },
            { label: 'CO₂ evitado',        value: `${anual.co2.toLocaleString('es-PE')} kg`,    sub: 'vs. mismo trayecto en auto',                 Icon: Leaf,  bg: '#f0fdf4', ic: '#16a34a' },
            { label: 'Duración promedio',  value: `${anual.durProm} min`,                        sub: 'Por viaje finalizado',                       Icon: Timer, bg: '#fef9ec', ic: '#d97706' },
          ].map(({ label, value, sub, Icon, bg, ic }) => (
            <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={18} style={{ color: ic }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-2xl font-black text-gray-900 leading-tight">{loading && anual.total === 0 ? '—' : value}</p>
                <p className="text-[10px] text-gray-400">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Gráfico mensual + Top estaciones ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Viajes por mes */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-black text-gray-800 text-sm">Viajes por mes</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Mes pico: <strong className="text-gray-600">{anual.mesPico?.label}</strong> con {anual.mesPico?.viajes.toLocaleString('es-PE')} viajes
                </p>
              </div>
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                style={{ background: '#f0fdf4', color: '#16a34a' }}>
                12 meses
              </span>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={anual.porMes} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [`${v} viajes`, 'Total del mes']}
                />
                <Bar dataKey="viajes" radius={[5, 5, 0, 0]} maxBarSize={40}>
                  {anual.porMes.map((m, i) => (
                    <Cell key={i} fill={m.viajes === maxMes ? '#003527' : '#b2f746'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 estaciones */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={15} className="text-[#16a34a]" />
              <h3 className="font-black text-gray-800 text-sm">Estaciones más usadas</h3>
            </div>
            <p className="text-xs text-gray-400 mb-5">Por viajes de origen en el año</p>

            <div className="flex-1 space-y-4">
              {anual.topEst.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">Sin datos aún</p>
              )}
              {anual.topEst.map((e, i) => (
                <div key={e.nombre}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                        i === 0 ? 'text-[#0f2419]' : 'text-gray-500 bg-gray-100'
                      }`} style={i === 0 ? { background: '#b2f746' } : {}}>
                        {i + 1}
                      </span>
                      <span className="text-xs font-bold text-gray-700 truncate">{e.nombre}</span>
                    </div>
                    <span className="text-xs font-black text-gray-800 shrink-0 ml-2">{e.viajes.toLocaleString('es-PE')}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${Math.round((e.viajes / maxTopEst) * 100)}%`, background: i === 0 ? '#003527' : '#b2f746' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Distribución semanal + Datos clave ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Por día de semana */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-800 text-sm">Uso por día de la semana</h3>
            <p className="text-xs text-gray-400 mt-0.5 mb-5">
              Día más activo: <strong className="text-gray-600">{anual.diaPico?.dia}</strong> · acumulado de los últimos 12 meses
            </p>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={anual.porDia} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [`${v} viajes`, 'Total acumulado']}
                />
                <Bar dataKey="viajes" radius={[5, 5, 0, 0]} maxBarSize={54}>
                  {anual.porDia.map((d, i) => (
                    <Cell key={i} fill={d.viajes === maxDia ? '#003527' : '#b2f746'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Datos clave del año */}
          <div className="rounded-2xl p-6 shadow-sm flex flex-col gap-4" style={{ background: '#0f2419' }}>
            <div>
              <h3 className="font-black text-white text-sm">Datos clave del año</h3>
              <p className="text-[10px] uppercase tracking-widest font-bold mt-0.5" style={{ color: 'rgba(178,247,70,0.6)' }}>
                Resumen operativo
              </p>
            </div>

            <div className="flex-1 space-y-3">
              {[
                { label: 'Mes con más viajes',   value: anual.mesPico?.label ?? '—',  extra: `${anual.mesPico?.viajes ?? 0} viajes` },
                { label: 'Día más activo',        value: anual.diaPico?.dia ?? '—',    extra: `${anual.diaPico?.viajes ?? 0} viajes acumulados` },
                { label: 'Hora punta del año',    value: anual.horaPico,               extra: 'Mayor concentración de salidas' },
                { label: 'Estación líder',        value: anual.topEst[0]?.nombre ?? '—', extra: `${anual.topEst[0]?.viajes ?? 0} viajes de origen` },
              ].map(({ label, value, extra }) => (
                <div key={label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                  <p className="text-base font-black truncate" style={{ color: '#b2f746' }}>{value}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{extra}</p>
                </div>
              ))}
            </div>

            <Link href="/operador/kpis"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black text-[#0f2419]"
              style={{ background: '#b2f746' }}>
              Ver KPIs completos <ChevronRight size={13} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
