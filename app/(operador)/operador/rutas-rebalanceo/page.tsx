'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { calcularMovimientos, type Movimiento } from '@/lib/utils/rebalanceo'
import { EstacionConDisponibilidad } from '@/types'
import {
  Route, ArrowRight, Bike, RefreshCw, Truck, Users, CheckCircle2, MapPin,
} from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container-low animate-pulse rounded-xl" /> }
)

interface EstStock {
  id: string
  nombre: string
  capacidad: number
  bicis_actuales: number
  demanda_predicha: number
  diferencia: number
  accion: 'deficit' | 'surplus' | 'ok'
}

type Prioridad = 'alta' | 'media' | 'baja'

interface Tecnico { id: string; nombre: string; correo: string }
interface Orden { tecnico_id: string | null; estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada' }

const PRIORIDAD_UI: Record<Prioridad, { label: string; bg: string; text: string; dot: string }> = {
  alta:  { label: 'Crítica', bg: 'bg-[#ffdad6]', text: 'text-error',       dot: 'bg-error' },
  media: { label: 'Media',   bg: 'bg-[#fef9c3]', text: 'text-amber-700',   dot: 'bg-amber-500' },
  baja:  { label: 'Baja',    bg: 'bg-[#e5eeff]', text: 'text-primary-container', dot: 'bg-primary-container' },
}

function prioridadDestino(est: EstStock | undefined): Prioridad {
  if (!est) return 'baja'
  if (est.bicis_actuales === 0) return 'alta'
  const pct = est.capacidad > 0 ? est.bicis_actuales / est.capacidad : 0
  return pct <= 0.2 ? 'media' : 'baja'
}

function estadoTecnico(tecnicoId: string, ordenes: Orden[]): { label: string; color: string } {
  const activas = ordenes.filter(o => o.tecnico_id === tecnicoId && (o.estado === 'pendiente' || o.estado === 'en_proceso'))
  if (activas.some(o => o.estado === 'en_proceso')) return { label: 'En ruta', color: '#1d4ed8' }
  if (activas.length > 0) return { label: 'Asignado', color: '#92400e' }
  return { label: 'Disponible', color: '#166534' }
}

export default function RutasRebalanceoPage() {
  const [datos, setDatos]           = useState<EstStock[]>([])
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [tecnicos, setTecnicos]     = useState<Tecnico[]>([])
  const [ordenes, setOrdenes]       = useState<Orden[]>([])
  const [asignaciones, setAsignaciones] = useState<Record<number, string>>({})
  const [loading, setLoading]       = useState(true)
  const [creando, setCreando]       = useState(false)
  const [exito, setExito]           = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setExito(false)
    try {
      const [predRes, trasladosRes] = await Promise.all([
        fetch('/api/prediccion/todas?intervalo=2'),
        fetch('/api/operador/traslados'),
      ])
      const predJson = await predRes.json()
      const trasladosJson = await trasladosRes.json()
      setDatos(predJson.estaciones ?? [])
      setTecnicos(trasladosJson.tecnicos ?? [])
      setOrdenes(trasladosJson.ordenes ?? [])

      const supabase = createClient()
      const [{ data: ests }, { data: bicis }] = await Promise.all([
        supabase.from('estaciones').select('*').eq('estado', 'activa'),
        supabase.from('bicicletas').select('estacion_id, estado'),
      ])
      if (ests) {
        setEstaciones(ests.map(e => ({
          ...e,
          bicicletas_disponibles: (bicis ?? []).filter(b => b.estacion_id === e.id && b.estado === 'disponible').length,
        })))
      }
    } finally {
      setLoading(false)
      setAsignaciones({})
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const estMap = Object.fromEntries(datos.map(e => [e.id, e]))

  const movimientos: Movimiento[] = calcularMovimientos(
    datos.filter(e => e.accion === 'surplus').map(e => ({ id: e.id, nombre: e.nombre, disponible: Math.abs(e.diferencia) })),
    datos.filter(e => e.accion === 'deficit').map(e => ({ id: e.id, nombre: e.nombre, necesita: Math.abs(e.diferencia) })),
    { permitirDeposito: true }
  )

  const rutas = movimientos
    .map((m, i) => ({ ...m, idx: i, prioridad: prioridadDestino(estMap[m.destino.id]) }))
    .sort((a, b) => (a.prioridad === b.prioridad ? 0 : a.prioridad === 'alta' ? -1 : b.prioridad === 'alta' ? 1 : a.prioridad === 'media' ? -1 : 1))

  const totalMover     = movimientos.reduce((s, m) => s + m.cantidad, 0)
  const bicisLibres     = datos.reduce((s, e) => s + Math.max(0, e.bicis_actuales), 0)
  const todasAsignadas  = movimientos.length > 0 && movimientos.every((_, i) => asignaciones[i])

  async function asignarFlotaCompleta() {
    if (!todasAsignadas) return
    setCreando(true)
    try {
      const res = await fetch('/api/operador/traslados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordenes: movimientos.map((m, i) => ({
            origen_id:  m.origen?.id ?? null,
            destino_id: m.destino.id,
            cantidad:   m.cantidad,
            tecnico_id: asignaciones[i],
            notas: 'Generado desde rutas de rebalanceo sugeridas',
          })),
        }),
      })
      if (res.ok) { setExito(true); await cargar() }
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container flex items-center gap-2">
            <Route size={20} /> Rutas de Rebalanceo Sugeridas
          </h1>
          <p className="text-sm text-outline mt-0.5">Optimización logística basada en demanda predictiva · San Borja en Bici</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar}
            className="flex items-center gap-1.5 text-xs font-semibold text-outline border border-outline-variant/30 bg-white px-3 py-2 rounded-full hover:bg-surface-container-low transition-colors">
            <RefreshCw size={12} /> Recalcular algoritmo
          </button>
          <button onClick={asignarFlotaCompleta} disabled={!todasAsignadas || creando}
            className="flex items-center gap-1.5 text-xs font-extrabold text-[#002117] px-4 py-2 rounded-full disabled:opacity-40 transition-all"
            style={{ background: '#b2f746' }}>
            <Truck size={12} /> {creando ? 'Asignando…' : 'Asignar flota completa'}
          </button>
        </div>
      </div>

      {exito && (
        <div className="card p-4 flex items-center gap-3 bg-[#f0fdf4] border-[#16a34a]/30">
          <CheckCircle2 size={20} className="text-[#16a34a] shrink-0" />
          <p className="text-sm font-semibold text-[#166534]">Órdenes de traslado creadas — los técnicos ya las ven en su sesión.</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-surface-container-low rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Columna izquierda: stats + mapa */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#e5eeff] rounded-xl flex items-center justify-center shrink-0">
                  <Bike size={18} className="text-primary-container" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-primary-container">{bicisLibres}</p>
                  <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Bicis libres</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#dcfce7] rounded-xl flex items-center justify-center shrink-0">
                  <Route size={18} className="text-[#166534]" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#166534]">{rutas.length}</p>
                  <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">Rutas sugeridas · {totalMover} bicis</p>
                </div>
              </div>
            </div>

            <div className="card overflow-hidden h-80">
              {estaciones.length > 0 ? (
                <MapaEstaciones estaciones={estaciones} modoOperador />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-outline">
                  <MapPin size={14} className="mr-1.5" /> Sin estaciones para mostrar
                </div>
              )}
            </div>

            {/* Disponibilidad de equipos (técnicos) */}
            <div className="card p-4">
              <p className="text-xs font-extrabold text-on-surface uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users size={13} /> Disponibilidad de Equipos Logísticos
              </p>
              {tecnicos.length === 0 ? (
                <p className="text-xs text-outline">Sin técnicos activos registrados</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {tecnicos.map(t => {
                    const est = estadoTecnico(t.id, ordenes)
                    return (
                      <div key={t.id} className="p-2.5 rounded-xl border border-outline-variant/15 bg-surface-container-low">
                        <p className="text-xs font-bold text-on-surface truncate">{t.nombre}</p>
                        <p className="text-[10px] font-semibold mt-0.5" style={{ color: est.color }}>{est.label}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha: prioridad de despacho */}
          <div className="card p-4">
            <p className="text-xs font-extrabold text-on-surface uppercase tracking-wide mb-3">Prioridad de Despacho</p>
            {rutas.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 size={24} className="text-[#166534] mx-auto mb-2" />
                <p className="text-xs font-semibold text-on-surface">Flota balanceada, sin traslados necesarios</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rutas.map(r => {
                  const p = PRIORIDAD_UI[r.prioridad]
                  return (
                    <div key={r.idx} className="rounded-xl border border-outline-variant/15 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${p.bg} ${p.text}`}>{p.label}</span>
                        <span className="text-[11px] font-bold text-on-surface flex items-center gap-1"><Bike size={11} />{r.cantidad}</span>
                      </div>
                      <div className="text-xs">
                        <p className="text-outline">Pickup <span className="font-semibold text-on-surface">{r.origen?.nombre ?? '🏭 Depósito central'}</span></p>
                        <p className="text-outline flex items-center gap-1">
                          <ArrowRight size={10} className="inline" /> Drop-off <span className="font-semibold text-on-surface">{r.destino.nombre}</span>
                        </p>
                      </div>
                      <select
                        value={asignaciones[r.idx] ?? ''}
                        onChange={e => setAsignaciones(prev => ({ ...prev, [r.idx]: e.target.value }))}
                        className={`w-full h-8 px-2 rounded-lg border text-xs font-semibold
                          focus:outline-none focus:border-primary-container ${
                          asignaciones[r.idx] ? 'border-outline-variant/30 text-on-surface' : 'border-amber-300 text-amber-600 bg-amber-50'
                        }`}>
                        <option value="">Elegir equipo…</option>
                        {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
