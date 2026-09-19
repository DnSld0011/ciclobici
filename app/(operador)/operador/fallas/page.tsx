'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  AlertTriangle, RefreshCw, TrendingUp, ArrowRight, Gauge, ListChecks, CheckCircle2,
} from 'lucide-react'

interface Alerta {
  id: string
  tipo: string
  tipoLabel: string
  descripcion: string | null
  estado: 'pendiente' | 'en_revision'
  horasActiva: number
  urgencia: 'alta' | 'media' | 'baja'
  bicicleta: { codigo: string; marca: string | null; modelo: string | null } | null
  estacion: { nombre: string } | null
}

interface FallasData {
  pctFlotaAfectada: number
  totalAlertas: number
  alertasUrgentes: number
  resumenDiagnostico: { tipo: string; cantidad: number }[]
  alertas: Alerta[]
}

const URGENCIA_UI: Record<Alerta['urgencia'], { label: string; bg: string; text: string }> = {
  alta:  { label: 'Urgente',      bg: 'bg-[#ffdad6]', text: 'text-error' },
  media: { label: 'Prioritaria',  bg: 'bg-[#fef9c3]', text: 'text-amber-700' },
  baja:  { label: 'Monitoreo',    bg: 'bg-[#e5eeff]', text: 'text-primary-container' },
}

function tiempoActivo(horas: number) {
  if (horas < 1) return '<1h'
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d`
}

export default function FallasMecanicasPage() {
  const [data, setData]       = useState<FallasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState<'todas' | Alerta['urgencia']>('todas')

  const cargar = useCallback(async () => {
    try {
      const res  = await fetch('/api/operador/fallas')
      const json = await res.json()
      if (res.ok) setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('fallas-mecanicas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  async function marcarEnRevision(id: string) {
    const supabase = createClient()
    await supabase.from('incidencias').update({ estado: 'en_revision' }).eq('id', id)
  }

  const visibles = (data?.alertas ?? []).filter(a => filtro === 'todas' || a.urgencia === filtro)

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container flex items-center gap-2">
            <AlertTriangle size={20} /> Alertas de Fallas Mecánicas
          </h1>
          <p className="text-sm text-outline mt-0.5">Estado crítico de flota · San Borja en Bici</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/operador/fallas/tendencias"
            className="flex items-center gap-1.5 text-xs font-semibold text-outline border border-outline-variant/30 bg-white px-3 py-2 rounded-full hover:bg-surface-container-low transition-colors">
            <TrendingUp size={12} /> Ver tendencias
          </Link>
          <button onClick={cargar}
            className="flex items-center gap-1.5 text-xs font-semibold text-outline border border-outline-variant/30 bg-white px-3 py-2 rounded-full hover:bg-surface-container-low transition-colors">
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-surface-container-low rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Resumen rápido */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ffdad6] rounded-xl flex items-center justify-center shrink-0">
                <Gauge size={18} className="text-error" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-error">{data.pctFlotaAfectada}%</p>
                <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Flota con fallas</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#fef9c3] rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-amber-600">{data.alertasUrgentes}</p>
                <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Alertas urgentes</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#e5eeff] rounded-xl flex items-center justify-center shrink-0">
                <ListChecks size={18} className="text-primary-container" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary-container">{data.totalAlertas}</p>
                <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Total activas</p>
              </div>
            </div>
          </div>

          {/* Resumen de diagnóstico */}
          {data.resumenDiagnostico.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-extrabold text-on-surface uppercase tracking-wide mb-3">Resumen de Diagnóstico</p>
              <div className="space-y-2">
                {data.resumenDiagnostico.slice(0, 5).map(r => {
                  const pct = Math.round((r.cantidad / data.totalAlertas) * 100)
                  return (
                    <div key={r.tipo} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-on-surface-variant w-24 shrink-0 truncate">{r.tipo}</span>
                      <div className="flex-1 h-2 rounded-full bg-surface-container-low overflow-hidden">
                        <div className="h-full bg-primary-container rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-on-surface w-10 text-right shrink-0">{r.cantidad}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filtro por urgencia */}
          <div className="flex gap-1.5">
            {(['todas', 'alta', 'media', 'baja'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors
                  ${filtro === f ? 'bg-primary-container text-white' : 'bg-white border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}>
                {f === 'todas' ? 'Todas' : URGENCIA_UI[f].label}
              </button>
            ))}
          </div>

          {/* Lista de atención inmediata */}
          <div className="card divide-y divide-outline-variant/10">
            {visibles.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={28} className="text-[#166534] mx-auto mb-2" />
                <p className="text-sm font-semibold text-on-surface">Sin fallas activas en esta categoría</p>
              </div>
            ) : visibles.map(a => {
              const u = URGENCIA_UI[a.urgencia]
              return (
                <div key={a.id} className="p-4 flex items-center gap-3">
                  <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full shrink-0 ${u.bg} ${u.text}`}>
                    {u.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {a.tipoLabel}{a.bicicleta ? ` · ${a.bicicleta.codigo}` : ''}
                      {a.bicicleta?.modelo ? ` (${[a.bicicleta.marca, a.bicicleta.modelo].filter(Boolean).join(' ')})` : ''}
                    </p>
                    <p className="text-xs text-outline truncate">
                      {a.estacion?.nombre ?? 'Sin estación'} · activa hace {tiempoActivo(a.horasActiva)}
                      {a.descripcion ? ` · ${a.descripcion}` : ''}
                    </p>
                  </div>
                  {a.estado === 'pendiente' ? (
                    <button onClick={() => marcarEnRevision(a.id)}
                      className="text-xs font-bold text-primary-container border border-primary-container/30 px-3 py-1.5 rounded-lg hover:bg-primary-container/10 transition-colors shrink-0 flex items-center gap-1">
                      Asignar técnico <ArrowRight size={12} />
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-outline shrink-0">En revisión</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
