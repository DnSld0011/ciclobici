'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad, Alerta } from '@/types'
import { TrendingUp, TrendingDown, Bike, MapPin, Bell, Leaf, RefreshCw, ChevronRight, AlertTriangle, CheckCircle, Info } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container-low animate-pulse rounded-xl" /> }
)

interface KPIs {
  bicisDisponibles: number
  bicisTotal: number
  viajesHoy: number
  viajesAyer: number
  estacionesActivas: number
  co2Ahorrado: number
}

function AlertaCard({ a }: { a: Alerta }) {
  const conf = {
    critica:  { bg: 'bg-[#ffdad6]', border: 'border-l-error', text: 'text-[#93000a]', icon: AlertTriangle, dot: 'bg-error' },
    warning:  { bg: 'bg-[#fef9c3]', border: 'border-l-amber-500', text: 'text-[#854d0e]', icon: AlertTriangle, dot: 'bg-amber-500' },
    info:     { bg: 'bg-[#e5eeff]', border: 'border-l-primary-container', text: 'text-primary-container', icon: Info, dot: 'bg-primary-container' },
  }[a.nivel]
  const Icon = conf.icon
  const t = new Date(a.created_at)
  const hace = Math.floor((Date.now() - t.getTime()) / 60000)
  const tiempoStr = hace < 60 ? `${hace}m` : `${Math.floor(hace / 60)}h`

  return (
    <div className={`${conf.bg} border-l-4 ${conf.border} rounded-xl p-4 flex gap-3`}>
      <Icon size={16} className={`${conf.text} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${conf.text} leading-tight`}>{a.titulo}</p>
        {a.mensaje && <p className={`text-xs ${conf.text} opacity-80 mt-0.5 leading-relaxed line-clamp-2`}>{a.mensaje}</p>}
      </div>
      <span className="text-[10px] text-outline shrink-0 mt-0.5">{tiempoStr}</span>
    </div>
  )
}

export default function DashboardOperadorPage() {
  const [kpis, setKpis] = useState<KPIs>({ bicisDisponibles: 0, bicisTotal: 0, viajesHoy: 0, viajesAyer: 0, estacionesActivas: 0, co2Ahorrado: 0 })
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [ultimaAct, setUltimaAct] = useState<Date | null>(null)
  const barHeights = useState(() => Array(7).fill(0).map(() => 20 + Math.floor(Math.random() * 24)))[0]
  const [loading, setLoading] = useState(true)
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
      { data: alertasData },
      { data: viajesKm },
    ] = await Promise.all([
      supabase.from('bicicletas').select('id, estado, estacion_id'),
      supabase.from('estaciones').select('*, bicicletas(id,estado)').order('nombre'),
      supabase.from('viajes').select('*', { count: 'exact', head: true })
        .gte('inicio_at', hoy.toISOString()).eq('estado', 'finalizado'),
      supabase.from('viajes').select('*', { count: 'exact', head: true })
        .gte('inicio_at', ayer.toISOString()).lt('inicio_at', hoy.toISOString()).eq('estado', 'finalizado'),
      supabase.from('alertas').select('*').eq('resuelta', false).order('created_at', { ascending: false }).limit(8),
      supabase.from('viajes').select('distancia_km').eq('estado', 'finalizado').not('distancia_km', 'is', null),
    ])

    if (bicis) {
      const disponibles = bicis.filter(b => b.estado === 'disponible').length
      setKpis(prev => ({ ...prev, bicisDisponibles: disponibles, bicisTotal: bicis.length }))
    }
    if (viajesKm) {
      const co2 = viajesKm.reduce((s, v) => s + ((v.distancia_km ?? 0) * 0.21), 0)
      setKpis(prev => ({ ...prev, co2Ahorrado: Math.round(co2 * 10) / 10 }))
    }
    setKpis(prev => ({
      ...prev,
      viajesHoy: viajesHoy ?? 0,
      viajesAyer: viajesAyer ?? 0,
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
    setUltimaAct(new Date())
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('operador-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  const pctDisp = kpis.bicisTotal > 0 ? Math.round((kpis.bicisDisponibles / kpis.bicisTotal) * 100) : 0
  const viajesDelta = kpis.viajesAyer > 0 ? Math.round(((kpis.viajesHoy - kpis.viajesAyer) / kpis.viajesAyer) * 100) : 0
  const alertasCriticas = alertas.filter(a => a.nivel === 'critica').length

  return (
    <div className="p-6 space-y-6 max-w-[1440px]">

      {/* TopBar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container tracking-tight">Centro de Control Inteligente</h1>
          <p className="text-xs text-outline mt-0.5">San Borja en Bici · Tiempo real</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-outline bg-white border border-outline-variant/30 px-3 py-1.5 rounded-full shadow-sm">
          <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
          {ultimaAct?.toLocaleTimeString('es-PE') ?? '—'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Disponibilidad */}
        <div className="card p-5 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Disponibilidad</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-on-surface">{pctDisp}%</span>
            <span className={`text-xs font-bold flex items-center gap-0.5 mb-1 ${pctDisp >= 70 ? 'text-[#166534]' : 'text-error'}`}>
              {pctDisp >= 70 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {pctDisp >= 70 ? 'Óptimo' : 'Bajo'}
            </span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full">
            <div className="bg-[#b2f746] h-1.5 rounded-full transition-all" style={{ width: `${pctDisp}%` }} />
          </div>
          <p className="text-[10px] text-outline">{kpis.bicisDisponibles} de {kpis.bicisTotal} bicis disponibles</p>
        </div>

        {/* Viajes hoy */}
        <div className="card p-5 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Viajes hoy</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-on-surface">{loading ? '—' : kpis.viajesHoy.toLocaleString()}</span>
            {!loading && kpis.viajesAyer > 0 && (
              <span className={`text-xs font-bold flex items-center gap-0.5 mb-1 ${viajesDelta >= 0 ? 'text-[#166534]' : 'text-error'}`}>
                {viajesDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {viajesDelta >= 0 ? '+' : ''}{viajesDelta}%
              </span>
            )}
          </div>
          <div className="flex gap-0.5 mt-1">
            {barHeights.map((h, i) => (
              <div key={i} className="flex-1 bg-surface-container-low rounded-sm" style={{ height: `${h}px` }} />
            ))}
          </div>
          <p className="text-[10px] text-outline">vs {kpis.viajesAyer} ayer</p>
        </div>

        {/* Estaciones */}
        <div className="card p-5 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Estaciones activas</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-on-surface">{kpis.estacionesActivas}</span>
            {alertasCriticas > 0 && (
              <span className="text-xs font-bold text-error flex items-center gap-0.5 mb-1">
                <AlertTriangle size={12} /> {alertasCriticas} alertas
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            {[...Array(kpis.estacionesActivas)].map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#b2f746]" />
            ))}
          </div>
          <p className="text-[10px] text-outline">San Borja · {kpis.bicisTotal} bicis en flota</p>
        </div>

        {/* CO₂ Ahorrado */}
        <div className="bg-primary-container text-white p-5 rounded-xl flex flex-col gap-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-primary-container opacity-60">CO₂ Ahorrado</p>
          <span className="text-3xl font-extrabold">{kpis.co2Ahorrado} kg</span>
          <div className="flex items-center gap-1.5 text-[#b2f746] mt-1">
            <Leaf size={14} />
            <span className="text-xs font-bold">Impacto Ecológico SB</span>
          </div>
          <p className="text-[10px] text-on-primary-container opacity-50">Estimado total histórico</p>
        </div>
      </div>

      {/* Main grid: Mapa + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Mapa */}
        <div className="lg:col-span-8 card overflow-hidden relative" style={{ height: 500 }}>
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <div className="glass-panel px-3 py-1.5 rounded-full border border-white/50 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse" />
              <span className="text-xs font-bold text-on-surface">Mapa en vivo</span>
            </div>
          </div>
          {loading
            ? <div className="w-full h-full bg-surface-container-low animate-pulse" />
            : <MapaEstaciones estaciones={estaciones} modoOperador />
          }
          <div className="absolute bottom-3 left-3 glass-panel px-3 py-2 rounded-xl border border-white/50 shadow-md flex flex-col gap-1.5">
            {[
              { color: 'bg-[#b2f746]', label: 'Disponible (>20%)' },
              { color: 'bg-amber-400',  label: 'Stock bajo (<20%)' },
              { color: 'bg-error',      label: 'Vacía / Crítica' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-[10px] font-semibold text-on-surface">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="lg:col-span-4 card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-on-surface flex items-center gap-2">
              <Bell size={16} className="text-amber-500" />
              Alertas Operativas
            </h3>
            <span className="text-[10px] font-bold bg-surface-container-high px-2 py-0.5 rounded text-outline uppercase tracking-wide">
              {alertas.filter(a => !a.leida).length} sin leer
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[380px] pr-1">
            {loading
              ? Array(4).fill(0).map((_, i) => <div key={i} className="h-14 bg-surface-container-low rounded-xl animate-pulse" />)
              : alertas.length === 0
                ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
                    <CheckCircle size={28} className="text-[#b2f746]" />
                    <p className="text-sm font-semibold text-on-surface-variant">Sin alertas activas</p>
                  </div>
                )
                : alertas.map(a => <AlertaCard key={a.id} a={a} />)
            }
          </div>

          <Link
            href="/operador/alertas"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            Ver historial completo <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/operador/estaciones', icon: MapPin,     label: 'Estaciones',   sub: `${kpis.estacionesActivas} activas`,   color: 'bg-[#e5eeff] text-primary-container' },
          { href: '/operador/bicicletas', icon: Bike,       label: 'Bicicletas',   sub: `${kpis.bicisTotal} en flota`,         color: 'bg-[#dcfce7] text-[#166534]' },
          { href: '/operador/prediccion', icon: TrendingUp, label: 'Predicción',   sub: 'Demanda 24h',                         color: 'bg-[#fef9c3] text-[#854d0e]' },
          { href: '/operador/alertas',    icon: Bell,       label: 'Alertas',      sub: `${alertasCriticas} críticas`,         color: `${alertasCriticas > 0 ? 'bg-[#ffdad6] text-error' : 'bg-[#e5eeff] text-primary-container'}` },
        ].map(({ href, icon: Icon, label, sub, color }) => (
          <Link key={href} href={href} className="card p-4 flex items-center gap-3 hover:border-primary-container/30 hover:shadow-md transition-all">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-on-surface">{label}</p>
              <p className="text-xs text-outline truncate">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
