'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { MapPin, Bike, RefreshCw, Search, QrCode, X, Navigation, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-on-surface animate-pulse flex items-center justify-center">
        <div className="text-white/40 text-sm">Cargando mapa...</div>
      </div>
    ),
  }
)

export default function MapaCiudadanoPage() {
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [filtradas, setFiltradas] = useState<EstacionConDisponibilidad[]>([])
  const [seleccionada, setSeleccionada] = useState<EstacionConDisponibilidad | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [ultimaAct, setUltimaAct] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id, estado)')
      .eq('estado', 'activa')
      .order('nombre')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EstacionConDisponibilidad[] = (data as any[]).map(est => ({
        ...est,
        bicicletas_disponibles: Array.isArray(est.bicicletas)
          ? est.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      }))
      const sorted = mapped.sort((a, b) => b.bicicletas_disponibles - a.bicicletas_disponibles)
      setEstaciones(sorted)
      setFiltradas(sorted)
      setUltimaAct(new Date())
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    cargar()
    const ch = supabase.channel('mapa-ciudadano-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar, supabase])

  useEffect(() => {
    if (!busqueda.trim()) { setFiltradas(estaciones); return }
    const q = busqueda.toLowerCase()
    setFiltradas(estaciones.filter(e =>
      e.nombre.toLowerCase().includes(q) || e.direccion.toLowerCase().includes(q)
    ))
  }, [busqueda, estaciones])

  function handleEstacionClick(est: EstacionConDisponibilidad) {
    setSeleccionada(est)
    setPanelAbierto(false)
  }

  const pct = (est: EstacionConDisponibilidad) =>
    est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0

  const dotColor = (est: EstacionConDisponibilidad) =>
    pct(est) === 0 ? 'bg-error' : pct(est) < 0.2 ? 'bg-amber-400' : 'bg-[#b2f746]'

  const chipClass = (est: EstacionConDisponibilidad) =>
    pct(est) === 0
      ? 'bg-[#ffdad6] text-error border-error/20'
      : pct(est) < 0.2
        ? 'bg-[#fef9c3] text-[#854d0e] border-[#fde68a]'
        : 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]'

  const totalLibres = estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] md:h-[calc(100vh-3.5rem)] relative">

      {/* ── MAPA (full-screen base) ── */}
      <div className="absolute inset-0 lg:relative lg:flex-1">
        {loading
          ? <div className="w-full h-full bg-on-surface animate-pulse" />
          : <MapaEstaciones estaciones={estaciones} onEstacionClick={handleEstacionClick} focusEstacion={seleccionada} />
        }

        {/* Barra superior: búsqueda + actualización */}
        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 z-10">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/90 backdrop-blur-md border border-white/50 text-sm text-on-surface placeholder-outline shadow-md focus:outline-none focus:ring-2 focus:ring-primary-container/30"
              placeholder="Buscar estación..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-white/90 backdrop-blur-md border border-white/50 shadow-md text-xs text-outline whitespace-nowrap">
            <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
            {ultimaAct.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Mini stats flotantes */}
        <div className="absolute top-16 left-3 flex flex-col gap-2 z-10">
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/50 shadow-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#b2f746]" />
            <span className="text-xs font-bold text-on-surface">{totalLibres} bicis libres</span>
          </div>
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/50 shadow-md flex items-center gap-2">
            <MapPin size={11} className="text-primary-container" />
            <span className="text-xs font-bold text-on-surface">{estaciones.length} estaciones</span>
          </div>
        </div>

        {/* Panel lateral estaciones — mobile toggle */}
        <button
          onClick={() => setPanelAbierto(true)}
          className="lg:hidden absolute bottom-24 right-3 z-10 flex items-center gap-2 h-11 px-4 rounded-xl shadow-lg font-bold text-sm"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <MapPin size={15} className="text-primary-container" />
          <span className="text-on-surface">Estaciones</span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">{estaciones.length}</span>
        </button>

        {/* FAB Escanear QR */}
        <Link
          href="/ciudadano/escanear"
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5 h-14 px-6 rounded-2xl shadow-xl font-extrabold text-sm transition-all active:scale-[.96] lg:hidden"
          style={{
            background: '#b2f746',
            color: '#002117',
            boxShadow: '0 8px 32px rgba(178,247,70,0.4)',
          }}>
          <QrCode size={20} />
          Escanear bicicleta
        </Link>

        {/* Popup estación seleccionada */}
        {seleccionada && (
          <div className="absolute bottom-3 left-3 right-3 z-20 lg:hidden">
            <div className="glass-panel rounded-2xl border border-white/60 shadow-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    pct(seleccionada) === 0 ? 'bg-[#ffdad6]' : pct(seleccionada) < 0.2 ? 'bg-[#fef9c3]' : 'bg-[#dcfce7]'
                  }`}>
                    <Bike size={18} className={
                      pct(seleccionada) === 0 ? 'text-error' : pct(seleccionada) < 0.2 ? 'text-[#854d0e]' : 'text-[#166534]'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-on-surface text-sm truncate">{seleccionada.nombre}</h3>
                    <p className="text-xs text-outline truncate flex items-center gap-1">
                      <MapPin size={10} /> {seleccionada.direccion}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSeleccionada(null)}
                  className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                  <X size={14} className="text-outline" />
                </button>
              </div>

              {/* Disponibilidad */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-outline">Disponibilidad</span>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${chipClass(seleccionada)}`}>
                    {seleccionada.bicicletas_disponibles} / {seleccionada.capacidad} bicis
                  </span>
                </div>
                <div className="h-2 rounded-full bg-outline-variant/20 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, pct(seleccionada) * 100)}%`,
                      background: pct(seleccionada) === 0 ? '#ba1a1a' : pct(seleccionada) < 0.2 ? '#f59e0b' : '#b2f746',
                    }} />
                </div>
              </div>

              {/* Acción */}
              <div className="mt-3 flex gap-2">
                <Link href="/ciudadano/escanear"
                  className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.97]"
                  style={{ background: '#b2f746', color: '#002117' }}>
                  <QrCode size={15} /> Escanear QR
                </Link>
                <button
                  onClick={() => router.push(`/ciudadano/mapa?nav=${seleccionada.latitud},${seleccionada.longitud}`)}
                  className="h-11 w-11 rounded-xl border border-outline-variant/30 bg-white flex items-center justify-center hover:bg-surface-container-low transition-colors">
                  <Navigation size={16} className="text-primary-container" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL DERECHO — desktop siempre visible / mobile drawer ── */}
      {/* Overlay mobile */}
      {panelAbierto && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-30 backdrop-blur-sm"
          onClick={() => setPanelAbierto(false)} />
      )}

      <div className={`
        lg:relative lg:w-80 lg:flex lg:flex-col
        fixed bottom-0 left-0 right-0 z-40
        bg-white border-t lg:border-t-0 lg:border-l border-outline-variant/20
        transition-transform duration-300 ease-out
        ${panelAbierto ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        max-h-[75vh] lg:max-h-none lg:h-full
      `}>
        {/* Handle mobile */}
        <div className="lg:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-outline-variant/40" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-outline-variant/15 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-sm text-on-surface">Estaciones activas</h2>
            <p className="text-[10px] text-outline mt-0.5">{filtradas.length} estaciones · {totalLibres} bicis libres</p>
          </div>
          <button className="lg:hidden w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center"
            onClick={() => setPanelAbierto(false)}>
            <X size={14} className="text-outline" />
          </button>
        </div>

        {/* Búsqueda desktop */}
        <div className="hidden lg:block px-3 py-3 border-b border-outline-variant/10">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary-container/30"
              placeholder="Buscar estación..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
          {filtradas.length === 0 && !loading && (
            <div className="p-8 text-center text-outline text-xs">Sin estaciones</div>
          )}
          {loading && Array(5).fill(0).map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-surface-container-low animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 rounded bg-surface-container-low animate-pulse w-3/4" />
                <div className="h-2 rounded bg-surface-container-low animate-pulse w-1/2" />
              </div>
            </div>
          ))}
          {filtradas.map(est => (
            <button key={est.id} onClick={() => { handleEstacionClick(est); setPanelAbierto(false) }}
              className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-surface-container-low/70 transition-colors ${
                seleccionada?.id === est.id ? 'bg-surface-container-low border-l-2 border-primary-container' : ''
              }`}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor(est)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate">{est.nombre}</p>
                <p className="text-[10px] text-outline truncate mt-0.5 flex items-center gap-1">
                  <MapPin size={9} className="shrink-0" /> {est.direccion}
                </p>
                {/* Barra de disponibilidad */}
                <div className="mt-1.5 h-1 rounded-full bg-outline-variant/15 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pct(est) * 100)}%`,
                      background: pct(est) === 0 ? '#ba1a1a' : pct(est) < 0.2 ? '#f59e0b' : '#b2f746',
                    }} />
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0 gap-1">
                <span className="font-extrabold text-xs text-on-surface">
                  {est.bicicletas_disponibles}
                  <span className="text-outline font-normal">/{est.capacidad}</span>
                </span>
                <ChevronRight size={11} className="text-outline" />
              </div>
            </button>
          ))}
        </div>

        {/* FAB escanear — desktop */}
        <div className="hidden lg:block p-3 border-t border-outline-variant/10">
          <Link href="/ciudadano/escanear"
            className="flex items-center justify-center gap-2 h-11 w-full rounded-xl font-bold text-sm transition-all active:scale-[.97]"
            style={{ background: '#b2f746', color: '#002117' }}>
            <QrCode size={17} /> Escanear QR bicicleta
          </Link>
        </div>
      </div>
    </div>
  )
}
