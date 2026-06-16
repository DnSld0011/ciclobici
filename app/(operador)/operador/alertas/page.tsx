'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Alerta, AlertaNivel, AlertaTipo } from '@/types'
import { Bell, AlertTriangle, Info, CheckCircle, RefreshCw, Filter } from 'lucide-react'

const NIVEL_CONFIG: Record<AlertaNivel, { bg: string; border: string; text: string; badge: string }> = {
  critica: { bg: 'bg-[#ffdad6]', border: 'border-l-error', text: 'text-[#93000a]', badge: 'bg-error text-white' },
  warning: { bg: 'bg-[#fef9c3]', border: 'border-l-amber-500', text: 'text-[#854d0e]', badge: 'bg-amber-500 text-white' },
  info:    { bg: 'bg-[#e5eeff]', border: 'border-l-primary-container', text: 'text-primary-container', badge: 'bg-primary-container text-white' },
}

const TIPO_LABEL: Record<AlertaTipo, string> = {
  saturacion:          'Saturación',
  vacia:               'Estación vacía',
  mantenimiento_urgente: 'Mant. urgente',
  bici_sin_retornar:   'Bici sin retorno',
  stock_bajo:          'Stock bajo',
  sistema:             'Sistema',
}

function tiempoHace(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

export default function AlertasOperadorPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroNivel, setFiltroNivel] = useState<AlertaNivel | 'todos'>('todos')
  const [filtroLeida, setFiltroLeida] = useState<'pendiente' | 'leida' | 'todos'>('pendiente')
  const cargar = useCallback(async () => {
    const supabase = createClient()
    let q = supabase.from('alertas')
      .select('*, estacion:estacion_id(id, nombre), bicicleta:bicicleta_id(id, codigo)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtroNivel !== 'todos') q = q.eq('nivel', filtroNivel)
    if (filtroLeida === 'pendiente') q = q.eq('leida', false)
    if (filtroLeida === 'leida') q = q.eq('leida', true)

    const { data } = await q
    if (data) setAlertas(data as Alerta[])
    setLoading(false)
  }, [filtroNivel, filtroLeida])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('alertas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  async function marcarLeida(id: string) {
    const supabase = createClient()
    await supabase.from('alertas').update({ leida: true }).eq('id', id)
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a))
  }

  async function marcarResuelta(id: string) {
    const supabase = createClient()
    await supabase.from('alertas').update({ leida: true, resuelta: true }).eq('id', id)
    setAlertas(prev => prev.filter(a => a.id !== id))
  }

  async function marcarTodasLeidas() {
    const supabase = createClient()
    await supabase.from('alertas').update({ leida: true }).eq('leida', false)
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })))
  }

  const criticas = alertas.filter(a => a.nivel === 'critica' && !a.leida).length
  const warnings = alertas.filter(a => a.nivel === 'warning' && !a.leida).length

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container flex items-center gap-2">
            <Bell size={20} /> Panel de Alertas Operativas
          </h1>
          <p className="text-sm text-outline mt-0.5">Monitoreo en tiempo real · San Borja en Bici</p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-1.5 text-xs font-semibold text-outline border border-outline-variant/30 bg-white px-3 py-2 rounded-full hover:bg-surface-container-low transition-colors"
        >
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ffdad6] rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-error" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-error">{criticas}</p>
            <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Críticas sin leer</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#fef9c3] rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-amber-600">{warnings}</p>
            <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Avisos sin leer</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#dcfce7] rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-[#166534]" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#166534]">{alertas.filter(a => a.resuelta).length}</p>
            <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Resueltas</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-outline font-semibold">
          <Filter size={12} /> Filtrar:
        </div>
        <div className="flex gap-1.5">
          {(['todos', 'pendiente', 'leida'] as const).map(f => (
            <button key={f} onClick={() => setFiltroLeida(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                ${filtroLeida === f ? 'bg-primary-container text-white' : 'bg-white border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}>
              {f === 'todos' ? 'Todas' : f === 'pendiente' ? 'Sin leer' : 'Leídas'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-2">
          {(['todos', 'critica', 'warning', 'info'] as const).map(n => (
            <button key={n} onClick={() => setFiltroNivel(n as AlertaNivel | 'todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors
                ${filtroNivel === n
                  ? n === 'critica' ? 'bg-error text-white'
                  : n === 'warning' ? 'bg-amber-500 text-white'
                  : n === 'info'    ? 'bg-primary-container text-white'
                  : 'bg-primary-container text-white'
                  : 'bg-white border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}>
              {n === 'todos' ? 'Todos' : n === 'critica' ? 'Críticas' : n === 'warning' ? 'Avisos' : 'Info'}
            </button>
          ))}
        </div>

        {alertas.some(a => !a.leida) && (
          <button onClick={marcarTodasLeidas}
            className="ml-auto text-xs text-on-surface-variant underline hover:text-on-surface">
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Lista de alertas */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-slate-100" />)}
        </div>
      ) : alertas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CheckCircle size={32} className="text-[#b2f746]" />
          <p className="font-bold text-on-surface-variant">No hay alertas que mostrar</p>
          <p className="text-sm text-outline">Todo está funcionando correctamente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map(a => {
            const conf = NIVEL_CONFIG[a.nivel]
            return (
              <div
                key={a.id}
                className={`${conf.bg} border-l-4 ${conf.border} rounded-xl p-4 flex gap-3 ${a.leida ? 'opacity-60' : ''}`}
              >
                <div className="mt-0.5 shrink-0">
                  {a.nivel === 'critica' ? <AlertTriangle size={16} className="text-error" />
                    : a.nivel === 'warning' ? <AlertTriangle size={16} className="text-amber-500" />
                    : <Info size={16} className="text-primary-container" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`text-sm font-extrabold ${conf.text}`}>{a.titulo}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conf.badge}`}>
                        {TIPO_LABEL[a.tipo]}
                      </span>
                      <span className="text-[10px] text-outline">{tiempoHace(a.created_at)}</span>
                    </div>
                  </div>
                  {a.mensaje && <p className={`text-xs ${conf.text} opacity-80 leading-relaxed`}>{a.mensaje}</p>}
                  {(a.estacion || a.bicicleta) && (
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-outline font-semibold">
                      {a.estacion && <span>📍 {(a.estacion as { nombre: string }).nombre}</span>}
                      {a.bicicleta && <span>🚲 {(a.bicicleta as { codigo: string }).codigo}</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!a.leida && (
                    <button onClick={() => marcarLeida(a.id)}
                      className="text-[10px] font-bold bg-white/70 hover:bg-white px-2 py-1 rounded-lg border border-white/50 transition-colors text-on-surface-variant whitespace-nowrap">
                      Marcar leída
                    </button>
                  )}
                  {!a.resuelta && (
                    <button onClick={() => marcarResuelta(a.id)}
                      className="text-[10px] font-bold bg-[#003527] text-white hover:bg-[#064e3b] px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
