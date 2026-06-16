'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { IncidenciaTipo } from '@/types'
import {
  AlertTriangle, QrCode, Keyboard, CheckCircle,
  Bike, MapPin, Camera, X, ArrowLeft, ImagePlus,
} from 'lucide-react'

/* ── tipos de problema ── */
const TIPOS: { value: IncidenciaTipo; label: string; icon: string }[] = [
  { value: 'frenos',      label: 'Frenos',      icon: '🛑' },
  { value: 'llanta',      label: 'Llanta',      icon: '🔴' },
  { value: 'cadena',      label: 'Cadena',      icon: '⛓️' },
  { value: 'manillar',    label: 'Manillar',    icon: '🚲' },
  { value: 'asiento',     label: 'Asiento',     icon: '💺' },
  { value: 'iluminacion', label: 'Iluminación', icon: '💡' },
  { value: 'electrico',   label: 'Eléctrico',   icon: '⚡' },
  { value: 'estructura',  label: 'Estructura',  icon: '🔧' },
  { value: 'otro',        label: 'Otro',        icon: '❓' },
]

type Paso = 'scanner' | 'formulario'

interface BiciEscaneada {
  id: string
  codigo: string
  estacion_id: string | null
  estacion_nombre: string | null
}

/* Tab switcher — "Mis reportes" navega a la página dedicada */
function TabSwitcher({ dark }: { dark?: boolean }) {
  const base = dark
    ? 'flex rounded-xl overflow-hidden border border-white/15 text-xs font-bold'
    : 'flex rounded-xl overflow-hidden border border-outline-variant/30 text-xs font-bold'
  return (
    <div className={base}>
      <span className={`px-4 py-2 ${dark ? 'bg-[#b2f746] text-[#002117]' : 'bg-[#003527] text-white'}`}>
        Reportar
      </span>
      <Link
        href="/ciudadano/incidencias/historial"
        className={`px-4 py-2 ${dark ? 'text-white/50' : 'text-outline'}`}
      >
        Mis reportes
      </Link>
    </div>
  )
}

export default function ReportarIncidenciaPage() {
  const [paso, setPaso]             = useState<Paso>('scanner')
  const [modoManual, setModoManual] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
  const [buscando, setBuscando]     = useState(false)
  const [errorQr, setErrorQr]       = useState('')

  const [bici, setBici]             = useState<BiciEscaneada | null>(null)
  const [tipo, setTipo]             = useState<IncidenciaTipo | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [foto, setFoto]             = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  const [enviando, setEnviando]     = useState(false)
  const [exito, setExito]           = useState(false)
  const [errorForm, setErrorForm]   = useState<string | null>(null)

  const scannerRef      = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const scannerStarted  = useRef(false)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const router          = useRouter()

  /* ── cámara QR ── */
  useEffect(() => {
    if (paso !== 'scanner' || modoManual) return
    let stopped = false

    async function iniciar() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (stopped || scannerStarted.current) return
      try {
        scannerRef.current = new Html5Qrcode('qr-reader-report')
        scannerStarted.current = true
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => { if (!stopped) buscarBici(decoded) },
          () => {}
        )
      } catch {
        if (!stopped) { setErrorQr('No se pudo acceder a la cámara.'); setModoManual(true) }
      }
    }
    iniciar()

    return () => {
      stopped = true
      if (scannerRef.current && scannerStarted.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current = null
          scannerStarted.current = false
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, modoManual])

  async function detenerCamara() {
    if (scannerRef.current && scannerStarted.current) {
      await scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
      scannerStarted.current = false
    }
  }

  async function buscarBici(codigo: string) {
    if (buscando) return
    setBuscando(true)
    await detenerCamara()

    const supabase = createClient()
    const { data } = await supabase
      .from('bicicletas')
      .select('id, codigo, estacion_id, estacion:estaciones(nombre)')
      .or(`codigo.eq.${codigo},qr_code.eq.${codigo}`)
      .maybeSingle()

    if (!data) {
      setErrorQr(`No se encontró bicicleta con código "${codigo}"`)
      setBuscando(false)
      return
    }

    const est = data.estacion as unknown as { nombre: string } | null
    setBici({
      id: data.id,
      codigo: data.codigo,
      estacion_id: data.estacion_id,
      estacion_nombre: est?.nombre ?? null,
    })
    setBuscando(false)
    setPaso('formulario')
  }

  function seleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    const reader = new FileReader()
    reader.onload = ev => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function quitarFoto() {
    setFoto(null)
    setFotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!tipo) { setErrorForm('Selecciona el tipo de problema'); return }
    setEnviando(true)
    setErrorForm(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    let foto_url: string | null = null
    if (foto) {
      const ext = foto.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('evidencias')
        .upload(path, foto, { contentType: foto.type })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(path)
        foto_url = publicUrl
      }
    }

    const { error: err } = await supabase.from('incidencias').insert({
      usuario_id:   user.id,
      bicicleta_id: bici?.id ?? null,
      estacion_id:  bici?.estacion_id ?? null,
      tipo,
      descripcion:  descripcion || null,
      foto_url,
    })

    if (err) { setErrorForm(err.message); setEnviando(false); return }
    setExito(true)
  }

  /* ── pantalla éxito ── */
  if (exito) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="w-20 h-20 rounded-full bg-[#dcfce7] flex items-center justify-center">
        <CheckCircle size={40} className="text-[#166534]" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-on-surface">Reporte enviado</h2>
        <p className="text-sm text-on-surface-variant mt-1 max-w-xs">
          El equipo técnico revisará la incidencia pronto. ¡Gracias por ayudarnos!
        </p>
      </div>
      <Link
        href="/ciudadano/incidencias/historial"
        className="h-12 px-8 rounded-2xl font-bold text-sm flex items-center"
        style={{ background: '#b2f746', color: '#002117' }}
      >
        Ver mis reportes
      </Link>
      <button
        onClick={() => router.push('/ciudadano')}
        className="text-sm text-outline font-semibold"
      >
        Volver al inicio
      </button>
    </div>
  )

  /* ── paso 1: scanner QR ── */
  if (paso === 'scanner') return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1f18' }}>

      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex-1">
          <TabSwitcher dark />
        </div>
      </div>

      {buscando && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 border-2 border-white/20 border-t-[#b2f746] rounded-full animate-spin mx-auto" />
            <p className="text-white/60 text-sm">Buscando bicicleta...</p>
          </div>
        </div>
      )}

      {!buscando && !modoManual && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 space-y-6">
          <div className="relative w-64 h-64">
            <div id="qr-reader-report" className="w-full h-full rounded-2xl overflow-hidden" />
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#b2f746' }} />
            ))}
            <div className="absolute inset-x-4 h-0.5 top-1/2 animate-scan-line"
              style={{ background: 'linear-gradient(90deg, transparent, #b2f746, transparent)' }} />
          </div>

          {errorQr && <p className="text-red-400 text-sm text-center max-w-xs">{errorQr}</p>}

          <p className="text-white/50 text-sm text-center">
            Centra el código QR de la bicicleta<br />dentro del recuadro
          </p>

          <button
            onClick={() => setModoManual(true)}
            className="flex items-center gap-2 text-white/40 text-sm"
          >
            <Keyboard size={14} /> Ingresar código manualmente
          </button>
        </div>
      )}

      {!buscando && modoManual && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <QrCode size={38} className="text-white/50" />
          </div>
          <div className="w-full max-w-sm space-y-4">
            {errorQr && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded-xl">
                <AlertTriangle size={14} />
                {errorQr}
              </div>
            )}
            <div>
              <label className="block text-[10px] font-extrabold tracking-widest text-white/40 uppercase mb-1.5">
                Código de bicicleta
              </label>
              <input
                className="w-full h-12 px-4 rounded-xl text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:ring-2 transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                placeholder="BC-001"
                value={codigoManual}
                onChange={e => setCodigoManual(e.target.value.toUpperCase())}
              />
            </div>
            <button
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#b2f746', color: '#002117' }}
              onClick={() => { setErrorQr(''); buscarBici(codigoManual) }}
              disabled={codigoManual.length < 2}
            >
              <QrCode size={16} /> Buscar bicicleta
            </button>
            <button
              onClick={() => { setModoManual(false); setErrorQr('') }}
              className="w-full text-white/40 text-sm py-1"
            >
              Volver a la cámara
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        #qr-reader-report video { object-fit: cover; width: 100% !important; height: 100% !important; }
        #qr-reader-report { border: none !important; }
        #qr-reader-report__scan_region { border: none !important; }
        #qr-reader-report__dashboard { display: none !important; }
        @keyframes scan-line { 0% { top: 20%; } 50% { top: 80%; } 100% { top: 20%; } }
        .animate-scan-line { animation: scan-line 2s ease-in-out infinite; }
      `}</style>
    </div>
  )

  /* ── paso 2: formulario ── */
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      <div className="flex items-center gap-3">
        <button
          onClick={() => { setPaso('scanner'); setModoManual(false); setErrorQr('') }}
          className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </button>
        <div className="flex-1">
          <TabSwitcher />
        </div>
      </div>

      <form onSubmit={enviar} className="space-y-5">

        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#dcfce7' }}>
            <Bike size={22} style={{ color: '#003527' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-extrabold tracking-widest text-outline uppercase mb-0.5">
              Bicicleta afectada
            </p>
            <p className="font-extrabold text-on-surface font-mono">{bici?.codigo}</p>
            {bici?.estacion_nombre && (
              <p className="text-xs text-outline flex items-center gap-1 mt-0.5">
                <MapPin size={11} />{bici.estacion_nombre}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setPaso('scanner'); setModoManual(false); setErrorQr('') }}
            className="text-xs text-primary-container font-semibold shrink-0"
          >
            Cambiar
          </button>
        </div>

        <div>
          <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2.5">
            Tipo de problema *
          </p>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`p-3 rounded-xl border text-left transition-all text-xs
                  ${tipo === t.value
                    ? 'border-primary-container bg-[#e5eeff] text-primary-container font-bold'
                    : 'border-outline-variant/50 bg-white text-on-surface-variant'}`}
              >
                <span className="text-lg block mb-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2">
            Descripción adicional
          </label>
          <textarea
            rows={3}
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Describe el problema con más detalle (opcional)..."
            className="w-full px-4 py-3 text-sm border border-outline-variant/50 rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container"
          />
        </div>

        <div>
          <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2">
            Evidencia fotográfica
          </p>
          {fotoPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-outline-variant/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoPreview} alt="Evidencia" className="w-full max-h-56 object-cover" />
              <button
                type="button"
                onClick={quitarFoto}
                className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
                style={{ background: 'rgba(0,0,0,0.6)' }}
              >
                <X size={16} className="text-white" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
                {foto?.name}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute('capture', 'environment')
                    fileInputRef.current.click()
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-outline-variant/50 bg-white text-on-surface-variant"
              >
                <Camera size={24} className="text-outline" />
                <span className="text-xs font-semibold">Tomar foto</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture')
                    fileInputRef.current.click()
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-outline-variant/50 bg-white text-on-surface-variant"
              >
                <ImagePlus size={24} className="text-outline" />
                <span className="text-xs font-semibold">Adjuntar foto</span>
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={seleccionarFoto} />
          <p className="text-[10px] text-outline mt-1.5">Opcional — máx. 10 MB</p>
        </div>

        {errorForm && (
          <div className="flex items-center gap-2 text-sm text-error bg-[#ffdad6] px-3 py-2.5 rounded-xl">
            <AlertTriangle size={14} />
            {errorForm}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando || !tipo}
          className="w-full h-14 rounded-2xl font-bold text-sm transition-all active:scale-[.98] disabled:opacity-40 shadow-sm"
          style={{ background: !tipo ? undefined : '#b2f746', color: '#002117' }}
        >
          {enviando ? 'Enviando reporte...' : 'Enviar reporte'}
        </button>

      </form>
    </div>
  )
}
