'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { type CiclistaVivo } from '@/components/maps/MapaEstaciones'
import {
  RefreshCw, MapPin, Bike, AlertTriangle, Activity, User, Download, FileText, X, Crosshair,
} from 'lucide-react'
import { exportarCsv } from '@/lib/utils/exportCsv'
import { exportarPdf } from '@/lib/utils/exportPdf'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container-low animate-pulse rounded-xl" /> }
)

interface ViajeVivo {
  id: string
  inicio_at: string
  lat: number | null
  lng: number | null
  usuario: { nombre: string } | null
  bicicleta: { codigo: string; tipo: string } | null
  estacion_origen: { id: string; nombre: string } | null
}

function tiempoTranscurrido(inicioAt: string) {
  const seg = Math.floor((Date.now() - new Date(inicioAt).getTime()) / 1000)
  const mm  = String(Math.floor(seg / 60) % 60).padStart(2, '0')
  const ss  = String(seg % 60).padStart(2, '0')
  if (seg >= 3600) return `${String(Math.floor(seg / 3600)).padStart(2, '0')}:${mm}:${ss}`
  return `${mm}:${ss}`
}

function useTick(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [active])
}

export default function MapaOperadorPage() {
  const [estaciones, setEstaciones]     = useState<EstacionConDisponibilidad[]>([])
  const [viajes, setViajes]             = useState<ViajeVivo[]>([])
  const [seleccionada, setSeleccionada] = useState<EstacionConDisponibilidad | null>(null)
  const [ultimaAct, setUltimaAct]       = useState(new Date())
  const [loading, setLoading]           = useState(true)
  const [tabPanel, setTabPanel]         = useState<'estaciones' | 'viajes'>('estaciones')
  const [verCiclistas, setVerCiclistas] = useState(true)
  const [seguidoId, setSeguidoId]       = useState<string | null>(null)
  const [ruta, setRuta]                 = useState<{ lat: number; lng: number }[]>([])

  useTick(viajes.length > 0)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [{ data: estData }, viajesRes] = await Promise.all([
      supabase.from('estaciones').select('*, bicicletas(id, estado)').order('nombre'),
      // API con adminClient — el cliente del navegador no ve viajes ajenos (RLS)
      fetch('/api/operador/viajes-activos').then(r => r.json()).catch(() => null),
    ])
    if (estData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEstaciones((estData as any[]).map(e => ({
        ...e,
        bicicletas_disponibles: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      })))
    }
    if (viajesRes?.viajes) setViajes(viajesRes.viajes as ViajeVivo[])
    setUltimaAct(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    cargar()
    const ch = supabase.channel('mapa-op-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  const seguido = seguidoId ? viajes.find(v => v.id === seguidoId) ?? null : null

  // Recorrido punto por punto del viaje seguido: se refresca con cada
  // nueva posición (la tabla viajes dispara el canal realtime de arriba)
  useEffect(() => {
    if (!seguidoId) { setRuta([]); return }
    let cancelado = false
    fetch(`/api/operador/viajes-activos?viaje_id=${seguidoId}`)
      .then(r => r.json())
      .then(json => {
        if (!cancelado && json.waypoints) {
          setRuta(json.waypoints.map((w: { lat: number; lng: number }) => ({ lat: w.lat, lng: w.lng })))
        }
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [seguidoId, viajes])

  // Si el viaje seguido terminó (ya no está activo), soltar el seguimiento
  useEffect(() => {
    if (seguidoId && !loading && !viajes.some(v => v.id === seguidoId)) {
      setSeguidoId(null)
    }
  }, [viajes, seguidoId, loading])

  const activas  = estaciones.filter(e => e.estado === 'activa').length
  const criticas = estaciones.filter(e => e.bicicletas_disponibles === 0 && e.estado === 'activa').length
  const bicisDisp = estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)

  const ciclistas = verCiclistas
    ? viajes
        .filter((v): v is ViajeVivo & { lat: number; lng: number } => v.lat != null && v.lng != null)
        .map<CiclistaVivo>(v => ({
          id: v.id,
          nombre: v.usuario?.nombre ?? 'Ciclista',
          bicicleta: v.bicicleta?.codigo ?? '—',
          lat: v.lat,
          lng: v.lng,
        }))
    : []

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container">Mapa en Tiempo Real</h1>
          <p className="text-xs text-outline mt-0.5">Estaciones y viajes en curso · San Borja en Bici</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportarCsv(viajes.map(v => ({
            Usuario: v.usuario?.nombre ?? '', Bicicleta: v.bicicleta?.codigo ?? '',
            'Estación origen': v.estacion_origen?.nombre ?? '',
            Inicio: new Date(v.inicio_at).toLocaleString('es-PE'),
            'Minutos activo': Math.floor((Date.now() - new Date(v.inicio_at).getTime()) / 60000),
          })), 'viajes-vivo-sanborja')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/30 bg-white text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => exportarPdf({
            titulo: 'Reporte de Viajes en Curso',
            subtitulo: `Viajes activos al ${new Date().toLocaleString('es-PE')} · San Borja en Bici`,
            columnas: ['Usuario', 'Bicicleta', 'Tipo', 'Estación Origen', 'Inicio', 'Minutos'],
            filas: viajes.map(v => [
              v.usuario?.nombre ?? '', v.bicicleta?.codigo ?? '', v.bicicleta?.tipo ?? '',
              v.estacion_origen?.nombre ?? '',
              new Date(v.inicio_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
              Math.floor((Date.now() - new Date(v.inicio_at).getTime()) / 60000),
            ]),
            nombreArchivo: 'viajes-vivo-sanborja',
            orientacion: 'landscape',
          })}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/30 bg-white text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors">
            <FileText size={13} /> PDF
          </button>
          <div className="flex items-center gap-1.5 text-xs text-outline bg-white border border-outline-variant/30 px-3 py-2 rounded-full shadow-sm">
            <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
            {ultimaAct.toLocaleTimeString('es-PE')}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Activity,     label: 'Viajes en curso', value: viajes.length, color: 'text-primary-container bg-[#e5eeff]', pulse: viajes.length > 0 },
          { icon: MapPin,       label: 'Estaciones activas', value: activas,    color: 'text-[#166534] bg-[#dcfce7]', pulse: false },
          { icon: AlertTriangle,label: 'Vacías / críticas',  value: criticas,   color: 'text-error bg-[#ffdad6]', pulse: false },
          { icon: Bike,         label: 'Bicis disponibles',  value: bicisDisp,  color: 'text-[#854d0e] bg-[#fef9c3]', pulse: false },
        ].map(({ icon: Icon, label, value, color, pulse }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-xl font-extrabold text-on-surface flex items-center gap-1.5">
                {loading ? '—' : value}
                {pulse && <span className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse inline-block" />}
              </p>
              <p className="text-[10px] text-outline uppercase font-semibold tracking-wide">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mapa + Panel lateral */}
      <div className="flex flex-col lg:flex-row gap-4 lg:h-[540px]">

        {/* Mapa */}
        <div className="flex-1 card overflow-hidden relative h-[380px] lg:h-auto">
          {loading
            ? <div className="w-full h-full bg-surface-container-low animate-pulse" />
            : <MapaEstaciones
                estaciones={estaciones}
                modoOperador
                onEstacionClick={setSeleccionada}
                focusEstacion={seleccionada}
                ciclistas={ciclistas}
                rutaViaje={ruta}
                ciclistaSeguidoId={seguidoId}
              />
          }

          {/* Banner de seguimiento */}
          {seguido && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-full shadow-lg"
              style={{ background: '#0f2419' }}>
              <span className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse shrink-0" />
              <p className="text-xs font-bold text-white truncate max-w-[220px]">
                Siguiendo a {seguido.usuario?.nombre ?? 'ciclista'} · {seguido.bicicleta?.codigo ?? ''}
              </p>
              <span className="text-[10px] font-semibold shrink-0" style={{ color: '#b2f746' }}>
                {ruta.length} puntos
              </span>
              <button onClick={() => setSeguidoId(null)}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors">
                <X size={12} className="text-white" />
              </button>
            </div>
          )}

          {/* Toggle capa ciclistas */}
          <div className="absolute top-3 right-3 z-10">
            <button onClick={() => setVerCiclistas(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold shadow-md border transition-all ${
                verCiclistas
                  ? 'bg-[#0f2419] text-white border-[#0f2419]'
                  : 'bg-white/90 text-gray-500 border-white/60'
              }`}>
              <User size={12} />
              Ciclistas {verCiclistas ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Leyenda */}
          <div className="absolute bottom-4 left-4 glass-panel px-3 py-2.5 rounded-xl border border-white/50 shadow-md space-y-1.5">
            {[
              { color: 'bg-[#b2f746]',  text: 'Disponible (>20%)' },
              { color: 'bg-amber-400',   text: 'Stock bajo (<20%)' },
              { color: 'bg-error',       text: 'Vacía / Crítica' },
              { color: 'bg-outline-variant', text: 'Mantenimiento' },
            ].map(({ color, text }) => (
              <div key={text} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-[10px] font-semibold text-on-surface">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel lateral con pestañas */}
        <div className="w-full lg:w-80 h-[420px] lg:h-auto card flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-outline-variant/20">
            {([
              { id: 'estaciones', label: 'Estaciones', count: estaciones.length },
              { id: 'viajes',     label: 'Viajes activos', count: viajes.length },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTabPanel(t.id)}
                className={`flex-1 px-3 py-3 text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5 ${
                  tabPanel === t.id
                    ? 'text-primary-container border-b-2 border-[#0f2419] bg-surface-container-low/40'
                    : 'text-outline hover:bg-surface-container-low/40'
                }`}>
                {t.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  t.id === 'viajes' && t.count > 0 ? 'bg-[#b2f746] text-[#0f2419]' : 'bg-surface-container-low text-outline'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Lista estaciones */}
          {tabPanel === 'estaciones' && (
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
              {[...estaciones]
                .sort((a, b) => a.bicicletas_disponibles - b.bicicletas_disponibles)
                .map(est => {
                  const pct = est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0
                  const dot = pct === 0 ? 'bg-error' : pct < 0.2 ? 'bg-amber-400' : 'bg-[#b2f746]'
                  return (
                    <button key={est.id} onClick={() => setSeleccionada(est)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-container-low transition-colors ${seleccionada?.id === est.id ? 'bg-surface-container-low' : ''}`}>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-on-surface truncate">{est.nombre}</p>
                        <p className="text-[10px] text-outline truncate">{est.estado}</p>
                      </div>
                      <span className="text-xs font-bold text-on-surface shrink-0">
                        {est.bicicletas_disponibles}<span className="text-outline font-normal">/{est.capacidad}</span>
                      </span>
                    </button>
                  )
                })}
            </div>
          )}

          {/* Lista viajes activos */}
          {tabPanel === 'viajes' && (
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
              {viajes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                  <div className="w-14 h-14 bg-surface-container-low rounded-2xl flex items-center justify-center mb-3">
                    <Bike size={24} className="text-outline" />
                  </div>
                  <p className="font-semibold text-on-surface text-sm">Sin viajes activos</p>
                  <p className="text-xs text-outline mt-1">Cuando un ciudadano inicie un viaje aparecerá aquí</p>
                </div>
              ) : viajes.map(v => {
                const durMin = Math.floor((Date.now() - new Date(v.inicio_at).getTime()) / 60000)
                const urgent = durMin >= 60
                const activo = seguidoId === v.id
                const rastreable = v.lat != null && v.lng != null
                return (
                  <button key={v.id}
                    onClick={() => {
                      if (!rastreable) return
                      setSeleccionada(null)   // no competir con el foco de estación
                      setSeguidoId(activo ? null : v.id)
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      activo ? 'bg-[#f0fdf4]' : 'hover:bg-surface-container-low/50'
                    } ${rastreable ? 'cursor-pointer' : 'cursor-default'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        activo ? 'bg-[#b2f746]' : urgent ? 'bg-[#ffdad6]' : 'bg-[#e5eeff]'}`}>
                        <User size={15} className={activo ? 'text-[#0f2419]' : urgent ? 'text-error' : 'text-primary-container'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-on-surface truncate">{v.usuario?.nombre ?? 'Usuario'}</p>
                          {activo && <span className="text-[9px] font-bold bg-[#0f2419] text-[#b2f746] px-1.5 py-0.5 rounded-full shrink-0">Siguiendo</span>}
                          {urgent && <span className="text-[9px] font-bold bg-[#ffdad6] text-error px-1.5 py-0.5 rounded-full shrink-0">+1h</span>}
                        </div>
                        <p className="text-[10px] text-outline truncate flex items-center gap-1">
                          <Bike size={9} className="shrink-0" />{v.bicicleta?.codigo ?? '—'}
                        </p>
                        <p className="text-[10px] text-outline truncate flex items-center gap-1">
                          <MapPin size={9} className="shrink-0 text-primary-container" />{v.estacion_origen?.nombre ?? '—'}
                        </p>
                        {rastreable ? (
                          <p className="text-[9px] font-semibold flex items-center gap-1 mt-0.5" style={{ color: '#16a34a' }}>
                            <Crosshair size={8} className="shrink-0" />
                            {activo ? 'Clic para dejar de seguir' : 'Clic para seguir en el mapa'}
                          </p>
                        ) : (
                          <p className="text-[9px] text-outline mt-0.5">Sin señal GPS aún</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`font-mono text-xs font-extrabold tabular-nums ${urgent ? 'text-error' : 'text-primary-container'}`}>
                          {tiempoTranscurrido(v.inicio_at)}
                        </p>
                        <p className="text-[9px] text-outline mt-0.5">
                          {new Date(v.inicio_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
