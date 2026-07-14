'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamicImport from 'next/dynamic'
import {
  History, Search, Download, ChevronLeft, ChevronRight, X, Star,
  User, Bike, MapPin, Clock, Route,
} from 'lucide-react'
import { exportarCsv } from '@/lib/utils/exportCsv'

const MapaResumenViaje = dynamicImport(
  () => import('@/components/maps/MapaResumenViaje').then(m => m.MapaResumenViaje),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded-xl" /> }
)

interface ViajeHist {
  id: string
  inicio_at: string
  fin_at: string | null
  duracion_min: number | null
  distancia_km: number | null
  calificacion: number | null
  usuario:   { id: string; nombre: string; correo: string } | null
  bicicleta: { id: string; codigo: string; tipo: string } | null
  origen:    { id: string; nombre: string; latitud: number; longitud: number } | null
  destino:   { id: string; nombre: string; latitud: number; longitud: number } | null
}

type Tab = 'viajes' | 'usuarios' | 'bicicletas'

const POR_PAGINA = 12

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export default function HistorialViajesPage() {
  const [tab, setTab]           = useState<Tab>('viajes')
  const [viajes, setViajes]     = useState<ViajeHist[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [fDesde, setFDesde]     = useState('')
  const [fHasta, setFHasta]     = useState('')
  const [pagina, setPagina]     = useState(0)
  const [detalle, setDetalle]   = useState<ViajeHist | null>(null)
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>([])
  const [wpLoading, setWpLoading] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)  // usuario/bici expandido

  useEffect(() => {
    fetch('/api/operador/historial')
      .then(r => r.json())
      .then(json => { if (json.viajes) setViajes(json.viajes) })
      .finally(() => setLoading(false))
  }, [])

  // Abrir detalle: cargar waypoints del viaje
  useEffect(() => {
    if (!detalle) { setWaypoints([]); return }
    setWpLoading(true)
    fetch(`/api/operador/historial?viaje_id=${detalle.id}`)
      .then(r => r.json())
      .then(json => setWaypoints((json.waypoints ?? []).map((w: { lat: number; lng: number }) => ({ lat: w.lat, lng: w.lng }))))
      .finally(() => setWpLoading(false))
  }, [detalle])

  /* ── filtro común ── */
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return viajes.filter(v => {
      if (fDesde && v.inicio_at.slice(0, 10) < fDesde) return false
      if (fHasta && v.inicio_at.slice(0, 10) > fHasta) return false
      if (!q) return true
      return (
        (v.usuario?.nombre ?? '').toLowerCase().includes(q) ||
        (v.usuario?.correo ?? '').toLowerCase().includes(q) ||
        (v.bicicleta?.codigo ?? '').toLowerCase().includes(q) ||
        (v.origen?.nombre ?? '').toLowerCase().includes(q) ||
        (v.destino?.nombre ?? '').toLowerCase().includes(q)
      )
    })
  }, [viajes, busqueda, fDesde, fHasta])

  /* ── agrupados por usuario ── */
  const porUsuario = useMemo(() => {
    const map: Record<string, { nombre: string; correo: string; viajes: ViajeHist[]; km: number; min: number }> = {}
    for (const v of filtrados) {
      if (!v.usuario) continue
      const m = map[v.usuario.id] ?? (map[v.usuario.id] = {
        nombre: v.usuario.nombre, correo: v.usuario.correo, viajes: [], km: 0, min: 0,
      })
      m.viajes.push(v)
      m.km  += v.distancia_km ?? 0
      m.min += v.duracion_min ?? 0
    }
    return Object.entries(map)
      .map(([id, m]) => ({ id, ...m, km: Math.round(m.km * 10) / 10 }))
      .sort((a, b) => b.viajes.length - a.viajes.length)
  }, [filtrados])

  /* ── agrupados por bicicleta ── */
  const porBici = useMemo(() => {
    const map: Record<string, { codigo: string; tipo: string; viajes: ViajeHist[]; km: number; min: number }> = {}
    for (const v of filtrados) {
      if (!v.bicicleta) continue
      const m = map[v.bicicleta.id] ?? (map[v.bicicleta.id] = {
        codigo: v.bicicleta.codigo, tipo: v.bicicleta.tipo, viajes: [], km: 0, min: 0,
      })
      m.viajes.push(v)
      m.km  += v.distancia_km ?? 0
      m.min += v.duracion_min ?? 0
    }
    return Object.entries(map)
      .map(([id, m]) => ({ id, ...m, km: Math.round(m.km * 10) / 10 }))
      .sort((a, b) => b.viajes.length - a.viajes.length)
  }, [filtrados])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const pagViajes    = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)

  function exportar() {
    exportarCsv(filtrados.map(v => ({
      Fecha: fmtFecha(v.inicio_at), Hora: fmtHora(v.inicio_at),
      Usuario: v.usuario?.nombre ?? '', Bicicleta: v.bicicleta?.codigo ?? '',
      Origen: v.origen?.nombre ?? '', Destino: v.destino?.nombre ?? '',
      'Duración (min)': v.duracion_min ?? '', 'Distancia (km)': v.distancia_km ?? '',
      Calificación: v.calificacion ?? '',
    })), 'historial-viajes-sanborja')
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'viajes',     label: 'Viajes',        count: filtrados.length },
    { id: 'usuarios',   label: 'Por usuario',   count: porUsuario.length },
    { id: 'bicicletas', label: 'Por bicicleta', count: porBici.length },
  ]

  /* ── fila de viaje reutilizable ── */
  const FilaViaje = ({ v, compact = false }: { v: ViajeHist; compact?: boolean }) => (
    <button onClick={() => setDetalle(v)}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors grid gap-2 items-center"
      style={{ gridTemplateColumns: compact ? '1.2fr 2fr 0.8fr 0.6fr' : '1.2fr 1.4fr 1fr 2fr 0.8fr 0.7fr 0.6fr' }}>
      <div>
        <p className="text-xs font-bold text-gray-800">{fmtFecha(v.inicio_at)}</p>
        <p className="text-[10px] text-gray-400">{fmtHora(v.inicio_at)}{v.fin_at ? ` – ${fmtHora(v.fin_at)}` : ''}</p>
      </div>
      {!compact && (
        <p className="text-xs font-semibold text-gray-700 truncate">{v.usuario?.nombre ?? '—'}</p>
      )}
      {!compact && (
        <p className="text-xs text-gray-500 truncate">{v.bicicleta?.codigo ?? '—'}</p>
      )}
      <p className="text-xs text-gray-600 truncate">
        {v.origen?.nombre ?? '—'} <span className="text-gray-300">→</span> {v.destino?.nombre ?? '—'}
      </p>
      <p className="text-xs text-gray-500">{v.duracion_min ?? '—'} min · {v.distancia_km ?? '—'} km</p>
      <div className="flex items-center gap-0.5">
        {v.calificacion
          ? <><Star size={11} className="text-amber-400 fill-amber-400" /><span className="text-xs font-bold text-gray-600">{v.calificacion}</span></>
          : <span className="text-[10px] text-gray-300">—</span>}
      </div>
      <span className="text-[10px] font-bold text-[#1a56db] text-right">Ver ruta</span>
    </button>
  )

  return (
    <div className="min-h-screen bg-[#f8fafb] pb-10">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[#0f2419] flex items-center gap-2.5">
            <History size={22} className="text-[#16a34a]" />
            Historial de Viajes
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Todos los viajes finalizados · consulta por usuario, bicicleta o estación y revisa cada recorrido
          </p>
        </div>
        <button onClick={exportar}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white
                     text-sm font-bold text-gray-600 hover:border-[#0f2419] hover:text-[#0f2419] transition-all">
          <Download size={14} />Exportar CSV
        </button>
      </div>

      <div className="px-8 pt-5 space-y-4">

        {/* ── Filtros ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-1.5">Buscar</p>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 h-10">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
                placeholder="Usuario, bicicleta o estación…"
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-300" />
              {busqueda && (
                <button onClick={() => setBusqueda('')}><X size={13} className="text-gray-400" /></button>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-1.5">Desde</p>
            <input type="date" value={fDesde} onChange={e => { setFDesde(e.target.value); setPagina(0) }}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-[#0f2419]" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase mb-1.5">Hasta</p>
            <input type="date" value={fHasta} onChange={e => { setFHasta(e.target.value); setPagina(0) }}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-[#0f2419]" />
          </div>
          {(fDesde || fHasta || busqueda) && (
            <button onClick={() => { setBusqueda(''); setFDesde(''); setFHasta(''); setPagina(0) }}
              className="h-10 px-3 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setPagina(0); setExpandido(null) }}
              className={`px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-2 ${
                tab === t.id ? 'bg-[#0f2419] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                tab === t.id ? 'bg-white/15 text-[#b2f746]' : 'bg-gray-100 text-gray-400'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── Contenido ── */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center text-gray-300 text-sm">
            Cargando historial…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center">
            <p className="text-sm font-semibold text-gray-400">Sin viajes que coincidan</p>
            <p className="text-xs text-gray-300 mt-1">Prueba con otros filtros</p>
          </div>
        ) : tab === 'viajes' ? (

          /* ═══ TAB: todos los viajes ═══ */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="hidden lg:grid gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100"
              style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 2fr 0.8fr 0.7fr 0.6fr' }}>
              {['FECHA', 'USUARIO', 'BICICLETA', 'RUTA', 'DURACIÓN', 'CALIF.', ''].map((h, i) => (
                <span key={i} className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-gray-50">
              {pagViajes.map(v => <FilaViaje key={v.id} v={v} />)}
            </div>
            {/* Paginación */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-medium">
                {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, filtrados.length)} de {filtrados.length} viajes
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:border-[#0f2419] transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-bold text-gray-500 px-2">{pagina + 1} / {totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:border-[#0f2419] transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

        ) : tab === 'usuarios' ? (

          /* ═══ TAB: por usuario ═══ */
          <div className="space-y-3">
            {porUsuario.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setExpandido(expandido === u.id ? null : u.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center shrink-0">
                    <User size={17} className="text-[#1a56db]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{u.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{u.correo}</p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-center">
                    <div>
                      <p className="text-lg font-black text-[#0f2419]">{u.viajes.length}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Viajes</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-lg font-black text-[#0f2419]">{u.km}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Km</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-lg font-black text-[#0f2419]">{Math.round(u.min / 60)}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Horas</p>
                    </div>
                    <div className="hidden md:block text-right">
                      <p className="text-xs font-bold text-gray-600">{fmtFecha(u.viajes[0].inicio_at)}</p>
                      <p className="text-[10px] text-gray-400">Último viaje</p>
                    </div>
                    <ChevronRight size={16}
                      className={`text-gray-300 transition-transform ${expandido === u.id ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                {expandido === u.id && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-80 overflow-y-auto">
                    {u.viajes.map(v => <FilaViaje key={v.id} v={v} compact />)}
                  </div>
                )}
              </div>
            ))}
          </div>

        ) : (

          /* ═══ TAB: por bicicleta ═══ */
          <div className="space-y-3">
            {porBici.map(b => (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setExpandido(expandido === b.id ? null : b.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] flex items-center justify-center shrink-0">
                    <Bike size={17} className="text-[#16a34a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{b.codigo}</p>
                    <p className="text-xs text-gray-400 capitalize">{b.tipo}</p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-center">
                    <div>
                      <p className="text-lg font-black text-[#0f2419]">{b.viajes.length}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Viajes</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-lg font-black text-[#0f2419]">{b.km}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Km acum.</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-lg font-black text-[#0f2419]">{Math.round(b.min / 60)}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Horas uso</p>
                    </div>
                    <div className="hidden md:block text-right">
                      <p className="text-xs font-bold text-gray-600">{b.viajes[0].destino?.nombre ?? '—'}</p>
                      <p className="text-[10px] text-gray-400">Última estación</p>
                    </div>
                    <ChevronRight size={16}
                      className={`text-gray-300 transition-transform ${expandido === b.id ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                {expandido === b.id && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-80 overflow-y-auto">
                    {b.viajes.map(v => <FilaViaje key={v.id} v={v} compact />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Modal detalle de viaje ══ */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,36,25,0.45)' }}
          onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-black text-[#0f2419]">Detalle del viaje</h3>
                <p className="text-xs text-gray-400">
                  {fmtFecha(detalle.inicio_at)} · {fmtHora(detalle.inicio_at)}
                  {detalle.fin_at ? ` – ${fmtHora(detalle.fin_at)}` : ''}
                </p>
              </div>
              <button onClick={() => setDetalle(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Mapa recorrido */}
            <div style={{ height: 280 }}>
              {wpLoading ? (
                <div className="w-full h-full bg-gray-50 animate-pulse" />
              ) : detalle.origen ? (
                <MapaResumenViaje
                  origen={{ lat: detalle.origen.latitud, lng: detalle.origen.longitud }}
                  destino={detalle.destino ? { lat: detalle.destino.latitud, lng: detalle.destino.longitud } : null}
                  waypoints={waypoints}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-300">Sin coordenadas</div>
              )}
            </div>

            {/* Datos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-6">
              {[
                { Icon: User,    label: 'Usuario',    value: detalle.usuario?.nombre ?? '—' },
                { Icon: Bike,    label: 'Bicicleta',  value: detalle.bicicleta ? `${detalle.bicicleta.codigo} · ${detalle.bicicleta.tipo}` : '—' },
                { Icon: MapPin,  label: 'Ruta',       value: `${detalle.origen?.nombre ?? '—'} → ${detalle.destino?.nombre ?? '—'}` },
                { Icon: Clock,   label: 'Duración',   value: `${detalle.duracion_min ?? '—'} min` },
                { Icon: Route,   label: 'Distancia',  value: `${detalle.distancia_km ?? '—'} km` },
                { Icon: Star,    label: 'Calificación', value: detalle.calificacion ? `${detalle.calificacion} / 5 ★` : 'Sin calificar' },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">{label}</p>
                    <p className="text-xs font-bold text-gray-700 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
