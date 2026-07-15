'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Truck, ArrowRight, Bike, User, CheckCircle2, Clock, XCircle,
  RefreshCw, MapPin,
} from 'lucide-react'

interface Orden {
  id: string
  estacion_origen_id: string | null
  estacion_destino_id: string
  cantidad: number
  bicis_trasladadas: number
  tecnico_id: string | null
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'
  notas: string | null
  fecha_objetivo: string | null
  created_at: string
  completada_at: string | null
  origen_nombre: string
  destino_nombre: string
  tecnico_nombre: string | null
}

type Filtro = 'activas' | 'completadas' | 'todas'

const ESTADO_UI: Record<Orden['estado'], { label: string; bg: string; color: string }> = {
  pendiente:  { label: 'Pendiente',  bg: '#fef9ec', color: '#d97706' },
  en_proceso: { label: 'En proceso', bg: '#eff6ff', color: '#2563eb' },
  completada: { label: 'Completada', bg: '#f0fdf4', color: '#16a34a' },
  cancelada:  { label: 'Cancelada',  bg: '#f3f4f6', color: '#6b7280' },
}

export default function TrasladosPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState<Filtro>('activas')

  const cargar = useCallback(async () => {
    try {
      const res  = await fetch('/api/operador/traslados')
      const json = await res.json()
      if (json.ordenes) setOrdenes(json.ordenes)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('traslados-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_traslado' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  async function cancelar(id: string) {
    await fetch('/api/operador/traslados', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, accion: 'cancelar' }),
    })
    cargar()
  }

  const pendientes  = ordenes.filter(o => o.estado === 'pendiente').length
  const enProceso   = ordenes.filter(o => o.estado === 'en_proceso').length
  const completadas = ordenes.filter(o => o.estado === 'completada').length
  const bicisEnMovimiento = ordenes
    .filter(o => o.estado === 'pendiente' || o.estado === 'en_proceso')
    .reduce((s, o) => s + (o.cantidad - o.bicis_trasladadas), 0)

  const visibles = ordenes.filter(o =>
    filtro === 'todas' ? true :
    filtro === 'activas' ? (o.estado === 'pendiente' || o.estado === 'en_proceso') :
    (o.estado === 'completada' || o.estado === 'cancelada'))

  return (
    <div className="min-h-screen bg-[#f8fafb] pb-10">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[#0f2419] flex items-center gap-2.5">
            <Truck size={22} className="text-[#16a34a]" />
            Traslados de Bicicletas
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Órdenes designadas a técnicos · el progreso se actualiza en tiempo real cuando escanean las bicis
          </p>
        </div>
        <button onClick={() => { setLoading(true); cargar() }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white
                     text-sm font-bold text-gray-600 hover:border-[#0f2419] hover:text-[#0f2419] transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Actualizar
        </button>
      </div>

      <div className="px-8 pt-5 space-y-4">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pendientes',          value: pendientes,        Icon: Clock,        bg: '#fef9ec', ic: '#d97706' },
            { label: 'En proceso',           value: enProceso,         Icon: Truck,        bg: '#eff6ff', ic: '#2563eb' },
            { label: 'Completadas',          value: completadas,       Icon: CheckCircle2, bg: '#f0fdf4', ic: '#16a34a' },
            { label: 'Bicis por trasladar',  value: bicisEnMovimiento, Icon: Bike,         bg: '#f3f4f6', ic: '#374151' },
          ].map(({ label, value, Icon, bg, ic }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={18} style={{ color: ic }} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">{label}</p>
                <p className="text-2xl font-black text-[#0f2419]">{loading ? '—' : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white w-fit">
          {([
            { id: 'activas',     label: 'Activas' },
            { id: 'completadas', label: 'Finalizadas' },
            { id: 'todas',       label: 'Todas' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setFiltro(t.id)}
              className={`px-5 py-2.5 text-xs font-bold transition-all ${
                filtro === t.id ? 'bg-[#0f2419] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>{t.label}</button>
          ))}
        </div>

        {/* ── Lista de órdenes ── */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center text-gray-300 text-sm">
            Cargando órdenes…
          </div>
        ) : visibles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center">
            <Truck size={28} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">Sin órdenes {filtro === 'activas' ? 'activas' : ''}</p>
            <p className="text-xs text-gray-300 mt-1">
              Genera un plan de traslados desde el módulo de Predicción
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibles.map(o => {
              const ui = ESTADO_UI[o.estado]
              const pct = Math.round((o.bicis_trasladadas / o.cantidad) * 100)
              return (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-4 flex-wrap">

                    {/* Ruta */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] flex items-center justify-center shrink-0">
                        <MapPin size={16} className="text-[#16a34a]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 flex-wrap">
                          {o.origen_nombre}
                          <ArrowRight size={13} className="text-gray-300 shrink-0" />
                          {o.destino_nombre}
                        </p>
                        <p className="text-xs text-gray-400">
                          Creada {new Date(o.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                          {' · '}{new Date(o.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          {o.fecha_objetivo && <> · para el {new Date(`${o.fecha_objetivo}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</>}
                        </p>
                      </div>
                    </div>

                    {/* Técnico */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-[#e5eeff] flex items-center justify-center">
                        <User size={14} className="text-[#1a56db]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700">{o.tecnico_nombre ?? 'Sin asignar'}</p>
                        <p className="text-[10px] text-gray-400">Técnico</p>
                      </div>
                    </div>

                    {/* Progreso */}
                    <div className="shrink-0 w-40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase">Progreso</span>
                        <span className="text-xs font-black text-[#0f2419]">
                          {o.bicis_trasladadas}/{o.cantidad} bicis
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: o.estado === 'completada' ? '#16a34a' : '#b2f746' }} />
                      </div>
                    </div>

                    {/* Estado + acciones */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-full uppercase"
                        style={{ background: ui.bg, color: ui.color }}>
                        {ui.label}
                      </span>
                      {(o.estado === 'pendiente' || o.estado === 'en_proceso') && (
                        <button onClick={() => cancelar(o.id)}
                          title="Cancelar orden"
                          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center
                                     text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {o.notas && (
                    <p className="text-xs text-gray-400 mt-3 pl-14">{o.notas}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
