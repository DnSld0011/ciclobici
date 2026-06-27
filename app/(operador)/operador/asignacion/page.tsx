'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Estacion, Bicicleta } from '@/types'
import {
  Search, ArrowLeft, AlertTriangle, CheckCircle,
  Bike, Zap, Filter, Lock, Bell,
} from 'lucide-react'

/* ── tipos locales ── */
interface EstacionConBicis extends Estacion {
  bicis_actuales: number
}

interface BiciConAlerta extends Bicicleta {
  tiene_incidencia: boolean
}

function badgeEstacion(estado: string) {
  if (estado === 'activa')       return { label: 'Operativa',          bg: '#dcfce7', color: '#166534' }
  if (estado === 'mantenimiento') return { label: 'Mantenimiento Parcial', bg: '#fef9c3', color: '#854d0e' }
  return                                 { label: 'Inactiva',           bg: '#f3f4f6', color: '#6b7280' }
}

function estId(index: number) { return `ST-${String(index + 1).padStart(3, '0')}` }

export default function AsignacionPage() {
  const [estaciones, setEstaciones]       = useState<EstacionConBicis[]>([])
  const [bicisDisp, setBicisDisp]         = useState<BiciConAlerta[]>([])
  const [estSelec, setEstSelec]           = useState<EstacionConBicis | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [filtroTipo, setFiltroTipo]       = useState<'todas' | 'mecanica' | 'electrica'>('todas')
  const [busqueda, setBusqueda]           = useState('')
  const [loading, setLoading]             = useState(true)
  const [guardando, setGuardando]         = useState(false)
  const [exito, setExito]                 = useState(false)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [
      { data: ests },
      { data: bicis },
      { data: incs },
    ] = await Promise.all([
      supabase.from('estaciones')
        .select('*, bicicletas(id, estado)')
        .order('nombre'),
      supabase.from('bicicletas')
        .select('*')
        .eq('estado', 'disponible')
        .order('codigo'),
      supabase.from('incidencias')
        .select('bicicleta_id')
        .in('estado', ['pendiente', 'en_proceso']),
    ])

    if (ests) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EstacionConBicis[] = (ests as any[]).map(e => ({
        ...e,
        bicis_actuales: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) =>
              b.estado === 'disponible' || b.estado === 'en_viaje').length
          : 0,
      }))
      setEstaciones(mapped)
      if (!estSelec && mapped.length > 0) setEstSelec(mapped[0])
    }

    if (bicis) {
      const biciConInc = (incs ?? []).map(i => i.bicicleta_id)
      setBicisDisp((bicis as Bicicleta[]).map(b => ({
        ...b,
        tiene_incidencia: biciConInc.includes(b.id),
      })))
    }

    setLoading(false)
  }, [estSelec])

  useEffect(() => {
    const supabase = createClient()
    cargar()
    const ch = supabase.channel('asig-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function guardar() {
    if (!estSelec || seleccionadas.size === 0) return
    const espaciosLibres = (estSelec.capacidad ?? 0) - estSelec.bicis_actuales
    if (seleccionadas.size > espaciosLibres) return
    setGuardando(true)
    const supabase = createClient()
    await supabase.from('bicicletas')
      .update({ estacion_id: estSelec.id })
      .in('id', Array.from(seleccionadas))
    setSeleccionadas(new Set())
    setExito(true)
    setTimeout(() => setExito(false), 3000)
    setGuardando(false)
    await cargar()
  }

  function toggleBici(id: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function seleccionarEstacion(e: EstacionConBicis) {
    setEstSelec(e)
    setSeleccionadas(new Set())
    setExito(false)
  }

  /* ── datos derivados ── */
  const espaciosLibres    = estSelec ? (estSelec.capacidad ?? 0) - estSelec.bicis_actuales : 0
  const proyectado        = estSelec ? estSelec.bicis_actuales + seleccionadas.size : 0
  const sobrecupo         = !!estSelec && proyectado > (estSelec.capacidad ?? 0)
  const pctActual         = estSelec && estSelec.capacidad
    ? Math.min(100, Math.round((estSelec.bicis_actuales / estSelec.capacidad) * 100)) : 0
  const pctProyectado     = estSelec && estSelec.capacidad
    ? Math.min(100, Math.round((proyectado / estSelec.capacidad) * 100)) : 0

  const estFiltradas = estaciones.filter(e =>
    !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const bisFiltradas = bicisDisp
    .filter(b => b.estacion_id !== estSelec?.id)
    .filter(b => filtroTipo === 'todas' || b.tipo?.toLowerCase().includes(
      filtroTipo === 'mecanica' ? 'mecani' : 'electri'
    ))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f6f5' }}>

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <h1 className="text-base font-black text-gray-800">Gestión Operativa</h1>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
            <Bell size={15} className="text-gray-500" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-extrabold">AD</span>
          </div>
        </div>
      </div>

      {/* ── Breadcrumb + Título ── */}
      <div className="px-8 pt-6 pb-2">
        <Link href="/operador/estaciones"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3 w-fit">
          <ArrowLeft size={14} /> Volver a Operaciones
        </Link>
        <h2 className="text-2xl font-black text-gray-900">Asignación de Bicicletas a Estaciones</h2>
        <p className="text-sm text-gray-500 mt-1">
          Seleccione una estación de la red para asignar nuevas unidades de la flota disponible.
        </p>
      </div>

      {/* ── Layout dos paneles ── */}
      <div className="flex flex-1 gap-5 px-8 pb-8 pt-4 overflow-hidden min-h-0">

        {/* ── Panel Izquierdo: Estaciones ── */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estaciones Activas</p>

          {/* Búsqueda */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por ID o nombre..."
              className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-400"
            />
          </div>

          {/* Lista de estaciones */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {loading ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-gray-100" />
            )) : estFiltradas.map((e, idx) => {
              const badge    = badgeEstacion(e.estado)
              const activo   = estSelec?.id === e.id
              const pct      = e.capacidad ? Math.round((e.bicis_actuales / e.capacidad) * 100) : 0
              const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#003527'
              return (
                <button
                  key={e.id}
                  onClick={() => seleccionarEstacion(e)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    activo
                      ? 'border-gray-800 bg-white shadow-md ring-1 ring-gray-800'
                      : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[10px] font-black text-gray-400">{estId(idx)}</p>
                      <p className="text-sm font-bold text-gray-800 leading-tight mt-0.5">{e.nombre}</p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full shrink-0"
                      style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100 mb-1.5">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                  </div>
                  <div className="flex justify-end">
                    <span className={`text-xs font-black ${pct >= 100 ? 'text-red-500' : 'text-gray-500'}`}>
                      {e.bicis_actuales} / {e.capacidad ?? '—'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Panel Derecho: Detalle + Asignación ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto">

          {!estSelec ? (
            <div className="flex-1 flex items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto">
                  <Bike size={28} className="text-gray-300" />
                </div>
                <p className="font-bold text-gray-400">Selecciona una estación</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Header estación seleccionada ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estación Seleccionada</p>
                    <h3 className="text-xl font-black text-gray-900 mt-1">
                      {estSelec.nombre}
                      <span className="text-gray-400 font-semibold ml-2 text-base">
                        ({estId(estaciones.findIndex(e => e.id === estSelec.id))})
                      </span>
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Capacidad Disponible</p>
                    <p className="text-3xl font-black text-gray-900 mt-1">
                      {Math.max(0, espaciosLibres - seleccionadas.size)}
                      <span className="text-base font-semibold text-gray-400 ml-1">espacios</span>
                    </p>
                  </div>
                </div>

                {/* Barra de capacidad */}
                <div className="space-y-1.5">
                  <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    {/* barra base (actual) */}
                    <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctActual}%`, background: '#003527' }} />
                    {/* barra proyectada */}
                    {seleccionadas.size > 0 && (
                      <div className="absolute top-0 h-full rounded-full transition-all duration-300"
                        style={{
                          left: `${pctActual}%`,
                          width: `${Math.min(pctProyectado - pctActual, 100 - pctActual)}%`,
                          background: sobrecupo ? '#ef4444' : '#b2f746',
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">0</span>
                    {sobrecupo && (
                      <span className="flex items-center gap-1 text-red-500 font-bold">
                        <AlertTriangle size={11} /> Sobrecupo proyectado
                      </span>
                    )}
                    <span className="text-gray-400">Max: {estSelec.capacidad}</span>
                  </div>
                </div>

                {/* Banner de error capacidad */}
                {sobrecupo && (
                  <div className="mt-4 flex gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={13} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-red-700">Límite de Capacidad Excedido</p>
                      <p className="text-xs text-red-600 mt-1 leading-relaxed">
                        La estación tiene una capacidad máxima de {estSelec.capacidad} espacios y actualmente
                        cuenta con {estSelec.bicis_actuales} bicicletas. Estás intentando asignar {seleccionadas.size} bicicletas
                        nuevas, lo que excede el límite permitido. Por favor, deselecciona al menos {seleccionadas.size - espaciosLibres} bicicleta{seleccionadas.size - espaciosLibres > 1 ? 's' : ''} para continuar.
                      </p>
                    </div>
                  </div>
                )}

                {/* Banner de éxito */}
                {exito && (
                  <div className="mt-4 flex items-center gap-2 p-3.5 rounded-xl border border-green-200 bg-green-50">
                    <CheckCircle size={16} className="text-green-600 shrink-0" />
                    <p className="text-sm font-bold text-green-700">Bicicletas asignadas correctamente.</p>
                  </div>
                )}
              </div>

              {/* ── Flota disponible ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Flota Disponible para Asignación
                  </p>
                  {/* Filtro tipo */}
                  <div className="flex items-center gap-1 border border-gray-200 rounded-xl overflow-hidden text-xs font-black">
                    <button
                      onClick={() => setFiltroTipo('todas')}
                      className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                        filtroTipo === 'todas' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Filter size={11} /> Todas
                    </button>
                    <button
                      onClick={() => setFiltroTipo('mecanica')}
                      className={`flex items-center gap-1.5 px-3 py-2 transition-colors border-l border-gray-200 ${
                        filtroTipo === 'mecanica' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Bike size={11} /> Mecánicas
                    </button>
                    <button
                      onClick={() => setFiltroTipo('electrica')}
                      className={`flex items-center gap-1.5 px-3 py-2 transition-colors border-l border-gray-200 ${
                        filtroTipo === 'electrica' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Zap size={11} /> Eléctricas
                    </button>
                  </div>
                </div>

                {bisFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <CheckCircle size={32} className="text-green-400" />
                    <p className="text-gray-400 font-semibold">No hay bicicletas disponibles para asignar</p>
                    <p className="text-xs text-gray-400">Todas las bicicletas están asignadas o en uso</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {bisFiltradas.map(b => {
                      const selec = seleccionadas.has(b.id)
                      const esElec = b.tipo?.toLowerCase().includes('electri')
                      return (
                        <button
                          key={b.id}
                          onClick={() => toggleBici(b.id)}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                            selec
                              ? 'border-gray-800 bg-gray-50'
                              : 'border-gray-150 bg-white hover:border-gray-300'
                          }`}
                          style={{ borderColor: selec ? '#003527' : undefined }}
                        >
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all ${
                            selec
                              ? 'border-[#003527] bg-[#003527]'
                              : 'border-gray-300 bg-white'
                          }`}>
                            {selec && <CheckCircle size={13} className="text-white" strokeWidth={3} />}
                          </div>

                          {/* Ícono bici */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            esElec ? 'bg-green-50' : 'bg-gray-100'
                          }`}>
                            {esElec
                              ? <Zap size={17} className="text-green-600" />
                              : <Bike size={17} className="text-gray-500" />
                            }
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-800 text-sm font-mono">{b.codigo}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {esElec ? 'Eléctrica' : 'Mecánica'} · {esElec ? 'Eléctrica' : 'Batería N/A'}
                            </p>
                          </div>

                          {/* Estado icon */}
                          <div className="shrink-0">
                            {b.tiene_incidencia
                              ? <AlertTriangle size={16} className="text-red-500" />
                              : <CheckCircle size={16} className="text-gray-300" />
                            }
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Footer de acción ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Bicicletas seleccionadas</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className={`text-2xl font-black ${sobrecupo ? 'text-red-500' : 'text-gray-900'}`}>
                      {seleccionadas.size}
                    </span>
                    <span className="text-sm text-gray-400">/ max {espaciosLibres}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSeleccionadas(new Set())}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardar}
                    disabled={seleccionadas.size === 0 || sobrecupo || guardando}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-sm transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: sobrecupo || seleccionadas.size === 0 ? '#9ca3af' : '#003527' }}
                  >
                    {sobrecupo && <Lock size={14} />}
                    {guardando ? 'Asignando...' : 'Asignar y Guardar'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
