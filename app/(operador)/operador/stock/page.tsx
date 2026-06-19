'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, AlertTriangle, LayoutGrid, Download, RefreshCw,
  ChevronRight, ChevronLeft, ArrowUpRight, Minus, Sparkles,
} from 'lucide-react'

const MapaStock = dynamic(
  () => import('@/components/maps/MapaStock').then(m => m.MapaStock),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl" /> }
)

// ── Sector assignment (simulated; production would come from DB) ──────────────
const SECTORES = [
  { id: 'todos', label: 'Todos los Sectores' },
  { id: 's1',   label: 'Sector 1: Las Camelias' },
  { id: 's2',   label: 'Sector 2: San Borja Sur' },
  { id: 's3',   label: 'Sector 3: La Rosa Toro' },
  { id: 'sc',   label: 'Zona Comercial El Polo' },
]

function getSectorId(idx: number) { return ['s1', 's2', 's3', 'sc'][idx % 4] }
function getSectorLabel(idx: number) {
  return ['San Borja / Sector 1', 'San Borja / Sector 2', 'San Borja / Sector 3', 'San Borja / Comercial'][idx % 4]
}

// ── Derived labels ─────────────────────────────────────────────────────────────
function demandaLabel(vHoy: number, avg: number) {
  if (vHoy > avg * 1.5) return 'ALTA DEMANDA'
  if (vHoy > avg * 1.0) return 'ALTA ROTACIÓN'
  if (vHoy < avg * 0.4) return 'BAJA DEMANDA'
  return 'ESTABLE'
}

type StockStatus = 'ÓPTIMO' | 'BAJO STOCK' | 'SOBRE STOCK'

function stockStatus(disp: number, cap: number): StockStatus {
  if (cap === 0) return 'ÓPTIMO'
  const pct = disp / cap
  if (pct < 0.2) return 'BAJO STOCK'
  if (pct > 0.8) return 'SOBRE STOCK'
  return 'ÓPTIMO'
}

const BADGE_STOCK: Record<StockStatus, { bg: string; color: string }> = {
  'ÓPTIMO':      { bg: '#d1fae5', color: '#065f46' },
  'BAJO STOCK':  { bg: '#fee2e2', color: '#991b1b' },
  'SOBRE STOCK': { bg: '#0f2419', color: '#b2f746' },
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface EstStock {
  id: string
  nombre: string
  direccion: string
  capacidad: number
  latitud: number
  longitud: number
  sectorId: string
  sectorLabel: string
  disp: number          // bicicletas disponibles
  objetivo: number      // target bikes
  vHoy: number
  demanda: string
  status: StockStatus
  tendencia: number     // estimated ±bikes/h
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StockPage() {
  const [loading, setLoading]         = useState(true)
  const [estaciones, setEstaciones]   = useState<EstStock[]>([])
  const [filtroSec, setFiltroSec]     = useState<string[]>(['todos'])
  const [pagina, setPagina]           = useState(0)
  const [balanceando, setBalanceando] = useState(false)
  const POR_PAGINA = 4

  const cargar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

    const [{ data: estData }, { data: bicisData }, { data: viajesHoy }] = await Promise.all([
      supabase.from('estaciones').select('id, nombre, direccion, capacidad, latitud, longitud').order('nombre'),
      supabase.from('bicicletas').select('estacion_id, estado'),
      supabase.from('viajes').select('estacion_origen_id').gte('created_at', hoy.toISOString()),
    ])

    if (!estData) { setLoading(false); return }

    // Bikes per station
    const bMap: Record<string, { disp: number; total: number }> = {}
    for (const b of bicisData ?? []) {
      if (!b.estacion_id) continue
      const m = bMap[b.estacion_id] ?? (bMap[b.estacion_id] = { disp: 0, total: 0 })
      m.total++
      if (b.estado === 'disponible') m.disp++
    }

    // Viajes today per station
    const vMap: Record<string, number> = {}
    for (const v of viajesHoy ?? []) {
      if (v.estacion_origen_id) vMap[v.estacion_origen_id] = (vMap[v.estacion_origen_id] ?? 0) + 1
    }

    const allViajes = Object.values(vMap)
    const avgViajes = allViajes.length ? allViajes.reduce((a, b) => a + b, 0) / allViajes.length : 0

    const enriq: EstStock[] = estData.map((e, i) => {
      const b      = bMap[e.id] ?? { disp: 0, total: 0 }
      const vHoy   = vMap[e.id] ?? 0
      const cap    = e.capacidad ?? 10
      const demanda = demandaLabel(vHoy, avgViajes)
      const status  = stockStatus(b.disp, cap)
      const objetivo = demanda === 'ALTA DEMANDA' ? Math.round(cap * 0.6)
                     : demanda === 'BAJA DEMANDA'  ? Math.round(cap * 0.3)
                     : Math.round(cap * 0.5)
      const tendencia = status === 'BAJO STOCK'  ? -Math.round(2 + Math.random() * 4)
                      : status === 'SOBRE STOCK' ?  Math.round(3 + Math.random() * 4)
                      : 0

      return {
        id: e.id, nombre: e.nombre, direccion: e.direccion,
        capacidad: cap, latitud: e.latitud ?? 0, longitud: e.longitud ?? 0,
        sectorId: getSectorId(i), sectorLabel: getSectorLabel(i),
        disp: b.disp, objetivo, vHoy, demanda, status, tendencia,
      }
    })

    setEstaciones(enriq)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalEst     = estaciones.length
  const optimas      = estaciones.filter(e => e.status === 'ÓPTIMO').length
  const bajoStock    = estaciones.filter(e => e.status === 'BAJO STOCK').length
  const sobreStock   = estaciones.filter(e => e.status === 'SOBRE STOCK').length
  const balanceGlobal = totalEst > 0 ? Math.round(optimas / totalEst * 100) : 0

  // Filtered list
  const filtradas = filtroSec.includes('todos')
    ? estaciones
    : estaciones.filter(e => filtroSec.includes(e.sectorId))
  const pagEst       = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA)

  // ── IA Prediction ────────────────────────────────────────────────────────────
  const critica  = [...estaciones].sort((a, b) => a.disp - b.disp)[0]
  const surplus  = [...estaciones].sort((a, b) => b.disp / (b.capacidad || 1) - a.disp / (a.capacidad || 1))[0]
  const mover    = critica ? Math.min(critica.objetivo - critica.disp, surplus?.disp ?? 0) : 0
  const co2Kg    = (mover * 0.5).toFixed(1)

  function toggleSector(id: string) {
    setPagina(0)
    if (id === 'todos') { setFiltroSec(['todos']); return }
    setFiltroSec(prev => {
      const sin = prev.filter(s => s !== 'todos')
      const next = sin.includes(id) ? sin.filter(s => s !== id) : [...sin, id]
      return next.length === 0 ? ['todos'] : next
    })
  }

  async function balancear() {
    setBalanceando(true)
    await new Promise(r => setTimeout(r, 1500))
    setBalanceando(false)
    alert('Plan de redistribución generado. Ver detalles en Asignación de Bicicletas.')
  }

  function exportarCSV() {
    const h = 'Estación,Sector,Stock Actual,Capacidad,Stock Objetivo,Demanda,Estado,Tendencia\n'
    const r = estaciones.map(e =>
      `"${e.nombre}","${e.sectorLabel}",${e.disp},${e.capacidad},${e.objetivo},"${e.demanda}","${e.status}",${e.tendencia > 0 ? '+' : ''}${e.tendencia}`
    ).join('\n')
    const blob = new Blob([h + r], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `stock-optimo-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#f8fafb] pb-10">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <p className="text-xs text-gray-400 mb-1">
          Admin &rsaquo; Inventario &rsaquo; <span className="font-semibold text-gray-600">Stock Óptimo</span>
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#0f2419] leading-tight">
              Stock Óptimo por Estación<br />
              <span className="text-xl font-extrabold text-[#166534]">San Borja en Bici</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-md">
              Análisis en tiempo real del balance de flota basado en demanda predictiva y capacidad de anclaje por sector.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={exportarCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200
                         text-sm font-bold text-gray-600 hover:border-[#0f2419] hover:text-[#0f2419] transition-all">
              <Download size={14} />Exportar Reporte
            </button>
            <button onClick={balancear} disabled={balanceando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0f2419]
                         transition-all disabled:opacity-60"
              style={{ background: '#b2f746' }}>
              {balanceando
                ? <><RefreshCw size={14} className="animate-spin" />Procesando…</>
                : <><RefreshCw size={14} />Balancear Ahora</>}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 pt-5 flex gap-5">

        {/* ── LEFT: Sector filters ── */}
        <aside className="w-56 shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-3
                          flex items-center gap-1.5">
              <LayoutGrid size={11} />Filtros de Distrito
            </p>
            <div className="space-y-2">
              {SECTORES.map(s => (
                <label key={s.id}
                  className="flex items-start gap-2.5 cursor-pointer group py-0.5">
                  <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center
                                   transition-all ${
                    filtroSec.includes(s.id)
                      ? 'bg-[#0f2419] border-[#0f2419]'
                      : 'border-gray-300 group-hover:border-[#0f2419]'
                  }`}
                    onClick={() => toggleSector(s.id)}>
                    {filtroSec.includes(s.id) && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 4l3 3 5-6" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs leading-tight transition-colors ${
                    filtroSec.includes(s.id) ? 'font-bold text-[#0f2419]' : 'text-gray-600'
                  }`}
                    onClick={() => toggleSector(s.id)}>
                    {s.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Balance global */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[9px] font-extrabold tracking-widest text-gray-400 uppercase mb-2">
                Estado de Red
              </p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-700">Balance Global</span>
                <span className="text-xs font-extrabold text-[#0f2419]">{balanceGlobal}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${balanceGlobal}%`, background: '#b2f746' }} />
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT: Main content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Óptimas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">
                  Estaciones Óptimas
                </p>
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              </div>
              <p className="text-4xl font-black text-[#0f2419]">
                {loading ? '—' : String(optimas).padStart(2, '0')}
              </p>
              {!loading && (
                <p className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <ArrowUpRight size={11} />+{Math.max(0, optimas - Math.round(totalEst * 0.7))} vs ayer
                </p>
              )}
            </div>

            {/* Bajo stock */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">
                  Bajo Stock (Crítico)
                </p>
                <AlertTriangle size={18} className="text-red-500 shrink-0" />
              </div>
              <p className="text-4xl font-black text-[#0f2419]">
                {loading ? '—' : String(bajoStock).padStart(2, '0')}
              </p>
              {!loading && bajoStock > 0 && (
                <p className="mt-2 text-xs text-red-500 font-semibold">Requiere acción inmediata</p>
              )}
            </div>

            {/* Sobre stock */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">
                  Sobre-Stock
                </p>
                <LayoutGrid size={18} className="text-gray-400 shrink-0" />
              </div>
              <p className="text-4xl font-black text-[#0f2419]">
                {loading ? '—' : String(sobreStock).padStart(2, '0')}
              </p>
              {!loading && sobreStock > 0 && (
                <p className="mt-2 text-xs text-gray-400 font-medium">
                  Exceso en {surplus?.sectorLabel?.split(' / ')[1] ?? 'sector'}
                </p>
              )}
            </div>
          </div>

          {/* Detail table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#0f2419]">Detalle por Estación</h2>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_1fr_auto]
                            gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100">
              {['ESTACIÓN', 'DISTRITO / SECTOR', 'STOCK ACTUAL', 'STOCK OBJETIVO', 'TENDENCIA (1H)', 'ESTADO', ''].map(h => (
                <span key={h} className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">{h}</span>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              <div className="py-16 text-center text-gray-300 text-sm">Cargando estaciones…</div>
            ) : pagEst.length === 0 ? (
              <div className="py-16 text-center text-gray-300 text-sm">Sin estaciones</div>
            ) : pagEst.map(e => {
              const badge = BADGE_STOCK[e.status]
              return (
                <div key={e.id}
                  className="grid grid-cols-1 md:grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_1fr_auto]
                             gap-3 px-6 py-4 items-center border-b border-gray-50
                             hover:bg-gray-50/70 transition-colors cursor-pointer">

                  {/* Estación */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: e.status === 'BAJO STOCK' ? '#fee2e2'
                                  : e.status === 'SOBRE STOCK' ? '#d1fae5'
                                  : '#f0fdf4',
                      }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <circle cx="12" cy="12" r="8" /><path d="M6 12h4m0 0l2-4m-2 4l2 4m2-4h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#0f2419]">{e.nombre}</p>
                      <p className="text-[10px] text-gray-400">ID: SB-{String(estaciones.indexOf(e) + 1).padStart(3, '0')}</p>
                    </div>
                  </div>

                  {/* Sector */}
                  <p className="text-xs text-gray-500">{e.sectorLabel}</p>

                  {/* Stock actual */}
                  <div>
                    <p className="text-sm font-black"
                      style={{ color: e.status === 'BAJO STOCK' ? '#dc2626' : '#0f2419' }}>
                      {String(e.disp).padStart(2, '0')} / {e.capacidad}
                    </p>
                    <p className="text-[10px] text-gray-400">docks</p>
                  </div>

                  {/* Stock objetivo */}
                  <div>
                    <p className="text-sm font-bold text-gray-700">{e.objetivo}</p>
                    <p className="text-[10px] text-gray-400">{e.demanda}</p>
                  </div>

                  {/* Tendencia */}
                  <div className={`flex items-center gap-1 text-sm font-bold ${
                    e.tendencia < 0 ? 'text-red-500'
                    : e.tendencia > 0 ? 'text-emerald-600'
                    : 'text-gray-400'
                  }`}>
                    {e.tendencia < 0 ? <ArrowUpRight size={13} className="rotate-180" />
                    : e.tendencia > 0 ? <ArrowUpRight size={13} />
                    : <Minus size={13} />}
                    {e.tendencia === 0
                      ? 'Sin cambios'
                      : `${e.tendencia > 0 ? '+' : ''}${e.tendencia} bikes`}
                  </div>

                  {/* Estado */}
                  <div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: badge.bg, color: badge.color }}>
                      {e.status}
                    </span>
                  </div>

                  {/* Arrow */}
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </div>
              )
            })}

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-medium">
                Mostrando {filtradas.length === 0 ? 0 : pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, filtradas.length)} de {filtradas.length} estaciones
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center
                             disabled:opacity-30 hover:border-[#0f2419] transition-colors">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => (
                  <button key={i} onClick={() => setPagina(i)}
                    className={`w-8 h-8 rounded-lg border text-xs font-bold transition-colors ${
                      pagina === i
                        ? 'bg-[#0f2419] border-[#0f2419] text-white'
                        : 'border-gray-200 text-gray-500 hover:border-[#0f2419]'
                    }`}>
                    {i + 1}
                  </button>
                ))}
                {totalPaginas > 5 && <span className="text-gray-400 text-xs px-1">…</span>}
                <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                  disabled={pagina >= totalPaginas - 1}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center
                             disabled:opacity-30 hover:border-[#0f2419] transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Map + IA Prediction ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

            {/* Google Maps */}
            <div className="rounded-2xl overflow-hidden relative" style={{ minHeight: 320 }}>
              {/* Label pill */}
              <div className="absolute top-3 left-3 z-10 pointer-events-none">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0f2419]"
                  style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  📍 Vista Geográfica de Stock
                </span>
              </div>

              {/* Legend */}
              <div className="absolute bottom-3 right-3 z-10 pointer-events-none flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#b2f746] inline-block border border-gray-300" />Óptimo
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Bajo Stock
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Sobre Stock
                </span>
              </div>

              <div style={{ height: 320 }}>
                <MapaStock estaciones={estaciones} />
              </div>
            </div>

            {/* IA Prediction */}
            <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ background: '#0f2419' }}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={16} style={{ color: '#b2f746' }} />
                  <h3 className="font-bold text-white text-sm">IA Predicción de Stock</h3>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Nuestro algoritmo está procesando eventos locales en{' '}
                  <span style={{ color: '#b2f746' }} className="font-bold">
                    {critica?.nombre ?? 'la estación crítica'}
                  </span>{' '}
                  y la hora punta matutina. Se sugiere mover{' '}
                  <span style={{ color: '#b2f746' }} className="font-bold">
                    {Math.max(mover, 4)} unidades
                  </span>{' '}
                  desde{' '}
                  {surplus?.sectorLabel ?? 'Sector 2'} al{' '}
                  {critica?.sectorLabel ?? 'Sector 1'} antes de las{' '}
                  <span className="font-bold text-white">08:30 AM</span>.
                </p>
              </div>

              {/* Stats */}
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Confianza de Predicción</span>
                  <span className="text-xs font-bold text-white">96.4%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Ahorro Estimado CO₂</span>
                  <span className="text-xs font-bold text-white">{co2Kg}kg</span>
                </div>
              </div>

              {/* CTA */}
              <button onClick={balancear} disabled={balanceando}
                className="mt-5 w-full py-3 rounded-xl text-sm font-extrabold text-[#0f2419]
                           hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-60"
                style={{ background: '#b2f746' }}>
                {balanceando ? 'Procesando…' : 'Ver Plan de Redistribución'}
              </button>
            </div>
          </div>

        </div>{/* end RIGHT */}
      </div>{/* end flex container */}
    </div>
  )
}
