'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mantenimiento } from '@/types'
import { CalendarDays, Wrench, TrendingUp, BarChart2, CheckCircle2, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'

interface IncidenciaResumen {
  estado: string
}

export default function TecnicoHistorialPage() {
  const [registros, setRegistros]       = useState<Mantenimiento[]>([])
  const [incidencias, setIncidencias]   = useState<IncidenciaResumen[]>([])
  const [loading, setLoading]           = useState(true)
  const [nombre, setNombre]             = useState('')
  const [userId, setUserId]             = useState('')

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data: perfil } = await supabase.from('usuarios').select('nombre').eq('id', user.id).single()
    if (!perfil?.nombre) { setLoading(false); return }
    setNombre(perfil.nombre)

    const [{ data: mants }, { data: incs }] = await Promise.all([
      supabase.from('mantenimientos')
        .select('*, bicicleta:bicicletas(codigo, tipo)')
        .eq('responsable', perfil.nombre)
        .order('fecha', { ascending: false }),
      supabase.from('incidencias')
        .select('estado')
        .in('estado', ['resuelta', 'descartada', 'en_revision', 'pendiente']),
    ])

    if (mants) setRegistros(mants)
    if (incs) setIncidencias(incs)
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('tecnico-historial-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mantenimientos' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  /* ── Cálculos estadísticos ── */
  const porMes: Record<string, Mantenimiento[]> = {}
  registros.forEach(r => {
    const key = new Date(r.fecha).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
    if (!porMes[key]) porMes[key] = []
    porMes[key].push(r)
  })

  const tiposConteo: Record<string, number> = {}
  registros.forEach(r => { tiposConteo[r.tipo_intervencion] = (tiposConteo[r.tipo_intervencion] ?? 0) + 1 })
  const topTipo = Object.entries(tiposConteo).sort((a, b) => b[1] - a[1])[0]

  const mesesActivos = Object.keys(porMes).length
  const promedioPorMes = mesesActivos > 0 ? Math.round(registros.length / mesesActivos * 10) / 10 : 0

  const resueltas   = incidencias.filter(i => i.estado === 'resuelta').length
  const tasaResolucion = incidencias.length > 0 ? Math.round((resueltas / incidencias.length) * 100) : 0

  /* ── Datos para gráfico de actividad (últimos 6 meses) ── */
  const graficoDatos = (() => {
    const meses: { mes: string; cantidad: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
      const label = d.toLocaleDateString('es-PE', { month: 'short' })
      meses.push({ mes: label, cantidad: porMes[key]?.length ?? 0 })
    }
    return meses
  })()

  const maxGrafico = Math.max(...graficoDatos.map(d => d.cantidad), 1)

  return (
    <div className="p-4 md:p-6 pt-16 md:pt-6 space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-extrabold text-primary-container">Mi historial</h1>
        <p className="text-xs text-outline mt-0.5">{nombre ? `Técnico: ${nombre}` : 'Cargando...'}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Total intervenciones', value: registros.length, icon: Wrench },
          { label: 'Promedio / mes',        value: promedioPorMes,  icon: BarChart2 },
          { label: 'Meses activo',           value: mesesActivos,   icon: CalendarDays },
          { label: 'Tipo más frecuente',     value: topTipo ? topTipo[1] : 0, sub: topTipo?.[0] ?? '—', icon: TrendingUp },
          { label: 'Incidencias resueltas',  value: resueltas,      icon: CheckCircle2 },
          { label: 'Tasa de resolución',     value: `${tasaResolucion}%`, icon: Clock, highlight: tasaResolucion >= 70 },
        ].map(({ label, value, sub, icon: Icon, highlight }) => (
          <div key={label} className={`card p-5 flex items-start justify-between ${highlight ? 'border border-[#b2f746]' : ''}`}>
            <div>
              <p className={`text-2xl font-extrabold ${highlight ? 'text-[#003527]' : 'text-on-surface'}`}>
                {loading ? '—' : value}
              </p>
              <p className="text-xs text-outline mt-0.5">{label}</p>
              {sub && <p className="text-[10px] text-primary-container font-semibold mt-1 truncate max-w-[120px]">{sub}</p>}
            </div>
            <Icon size={20} className={`shrink-0 ${highlight ? 'text-[#003527]' : 'text-outline-variant'}`} />
          </div>
        ))}
      </div>

      {/* Gráfico de actividad mensual */}
      {!loading && registros.length > 0 && (
        <div className="card p-5 space-y-3">
          <div>
            <h3 className="font-extrabold text-sm text-on-surface">Actividad mensual</h3>
            <p className="text-xs text-outline mt-0.5">Últimos 6 meses</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={graficoDatos} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12 }}
                formatter={(v) => [v, 'Intervenciones']}
              />
              <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {graficoDatos.map((d, i) => (
                  <Cell key={i} fill={d.cantidad === maxGrafico ? '#003527' : '#b2f746'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline por mes */}
      {loading && <div className="card p-12 text-center text-outline text-sm">Cargando historial...</div>}
      {!loading && registros.length === 0 && (
        <div className="card p-12 text-center">
          <Wrench size={32} className="text-outline-variant mx-auto mb-3" />
          <p className="text-sm text-outline">Aún no tienes intervenciones registradas.</p>
        </div>
      )}

      {Object.entries(porMes).map(([mes, items]) => (
        <div key={mes} className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-extrabold tracking-widest text-outline uppercase">{mes}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-outline border border-outline-variant/20">
              {items.length} intervención{items.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div className="card divide-y divide-outline-variant/10 overflow-hidden">
            {items.map(m => {
              const bici = m.bicicleta as unknown as { codigo: string; tipo: string } | null
              return (
                <div key={m.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-container-low/50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                    <Wrench size={14} className="text-outline" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-on-surface">{m.tipo_intervencion}</p>
                    <p className="text-xs text-outline truncate">
                      {bici?.codigo} · {bici?.tipo}
                      {m.descripcion ? ` — ${m.descripcion}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-outline whitespace-nowrap shrink-0">
                    {new Date(m.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
