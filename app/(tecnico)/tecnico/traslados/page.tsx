'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Truck, ArrowRight, Bike, CheckCircle2, Clock, MapPin, QrCode,
  Keyboard, X, AlertTriangle, PartyPopper,
} from 'lucide-react'

interface Orden {
  id: string
  estacion_origen_id: string | null
  estacion_destino_id: string
  cantidad: number
  bicis_trasladadas: number
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'
  notas: string | null
  fecha_objetivo: string | null
  created_at: string
  origen_nombre: string
  origen_direccion: string
  destino_nombre: string
  destino_direccion: string
}

const ESTADO_UI: Record<Orden['estado'], { label: string; bg: string; color: string }> = {
  pendiente:  { label: 'Pendiente',  bg: '#fef9ec', color: '#d97706' },
  en_proceso: { label: 'En proceso', bg: '#eff6ff', color: '#2563eb' },
  completada: { label: 'Completada', bg: '#f0fdf4', color: '#16a34a' },
  cancelada:  { label: 'Cancelada',  bg: '#f3f4f6', color: '#6b7280' },
}

export default function TrasladosTecnicoPage() {
  const [ordenes, setOrdenes]   = useState<Orden[]>([])
  const [loading, setLoading]   = useState(true)
  const [activa, setActiva]     = useState<Orden | null>(null)   // orden en ejecución (escáner abierto)
  const [modoManual, setModoManual] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'error' | 'fin'; texto: string } | null>(null)

  const scannerRef     = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const scannerStarted = useRef(false)
  const bloqueado      = useRef(false)   // evita procesar el mismo QR dos veces seguidas

  const cargar = useCallback(async () => {
    try {
      const res  = await fetch('/api/tecnico/traslados')
      const json = await res.json()
      if (json.ordenes) {
        setOrdenes(json.ordenes)
        // Mantener la orden activa sincronizada
        setActiva(prev => prev ? (json.ordenes.find((o: Orden) => o.id === prev.id) ?? null) : null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('tecnico-traslados-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_traslado' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  /* ── Escáner QR ── */
  useEffect(() => {
    if (!activa || modoManual || feedback?.tipo === 'fin') return
    let stopped = false

    async function iniciar() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (stopped || scannerStarted.current) return
      try {
        scannerRef.current = new Html5Qrcode('qr-reader-traslado')
        scannerStarted.current = true
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => { if (!stopped) procesarCodigo(decoded) },
          () => {}
        )
      } catch {
        if (!stopped) setModoManual(true)
      }
    }

    iniciar()
    return () => {
      stopped = true
      detenerScanner()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, modoManual, feedback?.tipo])

  async function detenerScanner() {
    if (scannerRef.current && scannerStarted.current) {
      await scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
      scannerStarted.current = false
    }
  }

  async function procesarCodigo(codigo: string) {
    if (!activa || procesando || bloqueado.current) return
    bloqueado.current = true
    setProcesando(true)
    setFeedback(null)

    try {
      const res  = await fetch('/api/tecnico/traslados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden_id: activa.id, codigo: codigo.trim() }),
      })
      const json = await res.json()

      if (!res.ok) {
        setFeedback({ tipo: 'error', texto: json.error ?? 'Error al registrar la bici' })
      } else if (json.completada) {
        setFeedback({ tipo: 'fin', texto: `¡Traslado completado! ${json.orden.cantidad} bicis en ${activa.destino_nombre}` })
        await detenerScanner()
      } else {
        setFeedback({
          tipo: 'ok',
          texto: `✓ ${json.bici.codigo} registrada — van ${json.orden.bicis_trasladadas} de ${json.orden.cantidad}`,
        })
      }
      cargar()
    } catch {
      setFeedback({ tipo: 'error', texto: 'Error de conexión — intenta de nuevo' })
    } finally {
      setProcesando(false)
      setCodigoManual('')
      // Pausa breve para no re-leer el mismo QR al instante
      setTimeout(() => { bloqueado.current = false }, 2000)
    }
  }

  async function cerrarEjecucion() {
    await detenerScanner()
    setActiva(null)
    setModoManual(false)
    setFeedback(null)
    setCodigoManual('')
    bloqueado.current = false
  }

  const activas     = ordenes.filter(o => o.estado === 'pendiente' || o.estado === 'en_proceso')
  const finalizadas = ordenes.filter(o => o.estado === 'completada' || o.estado === 'cancelada')

  /* ══ Vista de ejecución (escáner) ══ */
  if (activa) {
    const pct = Math.round((activa.bicis_trasladadas / activa.cantidad) * 100)
    return (
      <div className="min-h-screen bg-[#f8fafb] pb-10">
        <div className="bg-white border-b border-gray-100 pl-16 md:pl-5 pr-5 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-base font-black text-[#0f2419] flex items-center gap-2 truncate">
              <Truck size={17} className="text-[#16a34a] shrink-0" />
              {activa.origen_nombre} <ArrowRight size={13} className="text-gray-300 shrink-0" /> {activa.destino_nombre}
            </h1>
            <p className="text-xs text-gray-400">Escanea el QR de cada bicicleta que traslades</p>
          </div>
          <button onClick={cerrarEjecucion}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center shrink-0 ml-3">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="max-w-md mx-auto px-5 pt-5 space-y-4">

          {/* Progreso */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Progreso del traslado</span>
              <span className="text-lg font-black text-[#0f2419]">{activa.bicis_trasladadas}/{activa.cantidad}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : '#b2f746' }} />
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`rounded-2xl p-4 flex items-start gap-3 border ${
              feedback.tipo === 'ok'    ? 'bg-[#f0fdf4] border-[#bbf7d0]' :
              feedback.tipo === 'fin'   ? 'bg-[#0f2419] border-[#0f2419]' :
                                          'bg-red-50 border-red-100'
            }`}>
              {feedback.tipo === 'ok'  && <CheckCircle2 size={18} className="text-[#16a34a] shrink-0 mt-0.5" />}
              {feedback.tipo === 'fin' && <PartyPopper size={18} style={{ color: '#b2f746' }} className="shrink-0 mt-0.5" />}
              {feedback.tipo === 'error' && <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />}
              <p className={`text-sm font-bold ${
                feedback.tipo === 'fin' ? 'text-white' : feedback.tipo === 'ok' ? 'text-[#166534]' : 'text-red-700'
              }`}>{feedback.texto}</p>
            </div>
          )}

          {feedback?.tipo === 'fin' ? (
            <button onClick={cerrarEjecucion}
              className="w-full py-3.5 rounded-xl text-sm font-black text-[#0f2419]"
              style={{ background: '#b2f746' }}>
              Volver a mis traslados
            </button>
          ) : (
            <>
              {/* Escáner o modo manual */}
              {!modoManual ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div id="qr-reader-traslado" className="w-full" />
                  <button onClick={async () => { await detenerScanner(); setModoManual(true) }}
                    className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-gray-500 hover:bg-gray-50 border-t border-gray-100">
                    <Keyboard size={13} />Ingresar código manualmente
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Código de la bicicleta</p>
                  <input
                    value={codigoManual}
                    onChange={e => setCodigoManual(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && codigoManual.trim()) procesarCodigo(codigoManual) }}
                    placeholder="BC-20260714-0012"
                    className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm font-mono
                               focus:outline-none focus:border-[#0f2419]"
                    autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => procesarCodigo(codigoManual)}
                      disabled={!codigoManual.trim() || procesando}
                      className="flex-1 py-3 rounded-xl text-sm font-black text-[#0f2419] disabled:opacity-40"
                      style={{ background: '#b2f746' }}>
                      {procesando ? 'Registrando…' : 'Registrar bici'}
                    </button>
                    <button onClick={() => setModoManual(false)}
                      className="px-4 py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-500">
                      <QrCode size={15} />
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                Al escanear, la bicicleta se mueve automáticamente a <strong>{activa.destino_nombre}</strong> en el sistema.
                {activa.estacion_origen_id && <> Solo se aceptan bicis que estén en <strong>{activa.origen_nombre}</strong>.</>}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ══ Lista de órdenes ══ */
  return (
    <div className="min-h-screen bg-[#f8fafb] pb-10">
      <div className="bg-white border-b border-gray-100 pl-16 md:pl-8 pr-5 md:pr-8 py-5">
        <h1 className="text-2xl font-black text-[#0f2419] flex items-center gap-2.5">
          <Truck size={22} className="text-[#16a34a]" />
          Mis Traslados
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Órdenes asignadas por el operador · escanea las bicis para registrar cada traslado
        </p>
      </div>

      <div className="px-5 md:px-8 pt-5 space-y-5 max-w-3xl">

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center text-gray-300 text-sm">
            Cargando…
          </div>
        ) : (
          <>
            {/* Activas */}
            <div>
              <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
                Por ejecutar ({activas.length})
              </h2>
              {activas.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center">
                  <CheckCircle2 size={26} className="mx-auto text-[#b2f746] mb-2" />
                  <p className="text-sm font-semibold text-gray-500">Sin traslados pendientes</p>
                  <p className="text-xs text-gray-300 mt-1">Cuando el operador te asigne uno, aparecerá aquí</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activas.map(o => {
                    const ui  = ESTADO_UI[o.estado]
                    const pct = Math.round((o.bicis_trasladadas / o.cantidad) * 100)
                    return (
                      <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-800 flex items-center gap-1.5 flex-wrap">
                              <MapPin size={13} className="text-[#16a34a] shrink-0" />
                              {o.origen_nombre}
                              <ArrowRight size={13} className="text-gray-300 shrink-0" />
                              {o.destino_nombre}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {o.destino_direccion && <>{o.destino_direccion} · </>}
                              {o.fecha_objetivo && <>para el {new Date(`${o.fecha_objetivo}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</>}
                            </p>
                          </div>
                          <span className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-full uppercase shrink-0"
                            style={{ background: ui.bg, color: ui.color }}>
                            {ui.label}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-extrabold text-gray-400 uppercase flex items-center gap-1">
                                <Bike size={10} />Bicis trasladadas
                              </span>
                              <span className="text-xs font-black text-[#0f2419]">{o.bicis_trasladadas}/{o.cantidad}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: '#b2f746' }} />
                            </div>
                          </div>
                          <button onClick={() => { setFeedback(null); setActiva(o) }}
                            className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black text-[#0f2419]"
                            style={{ background: '#b2f746' }}>
                            <QrCode size={15} />
                            Escanear
                          </button>
                        </div>

                        {o.notas && <p className="text-[11px] text-gray-400 mt-3">{o.notas}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Finalizadas */}
            {finalizadas.length > 0 && (
              <div>
                <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
                  Finalizadas ({finalizadas.length})
                </h2>
                <div className="space-y-2">
                  {finalizadas.slice(0, 10).map(o => {
                    const ui = ESTADO_UI[o.estado]
                    return (
                      <div key={o.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                        <Clock size={14} className="text-gray-300 shrink-0" />
                        <p className="text-xs text-gray-600 flex-1 min-w-0 truncate">
                          <strong>{o.origen_nombre}</strong> → <strong>{o.destino_nombre}</strong>
                          {' '}· {o.bicis_trasladadas}/{o.cantidad} bicis
                        </p>
                        <span className="text-[9px] font-extrabold px-2 py-1 rounded-full uppercase shrink-0"
                          style={{ background: ui.bg, color: ui.color }}>
                          {ui.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
