'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bicicleta, Estacion } from '@/types'
import { QrCode, CheckCircle, AlertTriangle, Bike, MapPin, ArrowLeft, Keyboard } from 'lucide-react'
import Link from 'next/link'

type Estado = 'scanning' | 'found' | 'loading' | 'success' | 'error'

interface BikeInfo {
  bicicleta: Bicicleta & { estacion?: Estacion | null }
}

export default function EscanearPage() {
  const [estado, setEstado] = useState<Estado>('scanning')
  const [bikeInfo, setBikeInfo] = useState<BikeInfo | null>(null)
  const [error, setError] = useState('')
  const [modoManual, setModoManual] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const scannerStarted = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (modoManual || estado !== 'scanning') return
    let stopped = false

    async function iniciarScanner() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (stopped || scannerStarted.current) return
      try {
        scannerRef.current = new Html5Qrcode('qr-reader')
        scannerStarted.current = true
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => { if (!stopped) procesarCodigo(decoded) },
          () => {}
        )
      } catch {
        if (!stopped) {
          setError('No se pudo acceder a la cámara. Usa el modo manual.')
          setModoManual(true)
        }
      }
    }

    iniciarScanner()
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
  }, [modoManual, estado])

  async function procesarCodigo(codigo: string) {
    if (estado !== 'scanning') return
    setEstado('loading')

    // Detener cámara
    if (scannerRef.current && scannerStarted.current) {
      await scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
      scannerStarted.current = false
    }

    try {
      const supabase = createClient()
      const { data: bici, error: errBici } = await supabase
        .from('bicicletas')
        .select('*, estacion:estaciones(*)')
        .or(`codigo.eq.${codigo},qr_code.eq.${codigo}`)
        .maybeSingle()

      if (errBici || !bici) {
        setError(`No se encontró una bicicleta con código "${codigo}"`)
        setEstado('error')
        return
      }
      setBikeInfo({ bicicleta: bici })
      setEstado('found')
    } catch {
      setError('Error al buscar la bicicleta.')
      setEstado('error')
    }
  }

  async function iniciarViaje() {
    if (!bikeInfo) return
    const { bicicleta } = bikeInfo
    if (bicicleta.estado !== 'disponible') {
      setError('Esta bicicleta no está disponible en este momento.')
      setEstado('error')
      return
    }
    if (!bicicleta.estacion_id) {
      setError('Esta bicicleta no está anclada en ninguna estación.')
      setEstado('error')
      return
    }
    setEstado('loading')
    try {
      const res = await fetch('/api/viajes/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bicicleta_id: bicicleta.id,
          estacion_origen_id: bicicleta.estacion_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEstado('success')
      setTimeout(() => router.push('/ciudadano/viaje-activo'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el viaje')
      setEstado('error')
    }
  }

  const bici = bikeInfo?.bicicleta
  const estacion = bici?.estacion as unknown as Estacion | null
  const disponible = bici?.estado === 'disponible'

  return (
    <div className="min-h-screen bg-on-surface flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 pt-safe">
        <Link href="/ciudadano/mapa"
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </Link>
        <div>
          <h1 className="font-extrabold text-white text-base">Escanear bicicleta</h1>
          <p className="text-white/50 text-xs">Apunta al código QR de la bici</p>
        </div>
      </div>

      {/* Scanner area */}
      {estado === 'scanning' && !modoManual && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 space-y-6">
          {/* Viewfinder */}
          <div className="relative w-72 h-72">
            <div id="qr-reader" className="w-full h-full rounded-2xl overflow-hidden" />
            {/* Corners */}
            {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 ${cls}`}
                style={{ borderColor: '#b2f746' }} />
            ))}
            {/* Scan line */}
            <div className="absolute inset-x-4 h-0.5 top-1/2 animate-scan-line"
              style={{ background: 'linear-gradient(90deg, transparent, #b2f746, transparent)' }} />
          </div>

          <p className="text-white/60 text-sm text-center">
            Centra el código QR de la bicicleta<br />dentro del recuadro
          </p>

          <button onClick={() => setModoManual(true)}
            className="flex items-center gap-2 text-white/50 text-sm hover:text-white/80 transition-colors">
            <Keyboard size={14} /> Ingresar código manualmente
          </button>
        </div>
      )}

      {/* Modo manual */}
      {modoManual && estado === 'scanning' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
            <Keyboard size={36} className="text-white/60" />
          </div>
          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold tracking-widest text-white/50 uppercase mb-1.5">
                Código de bicicleta
              </label>
              <input
                className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#b2f746]/40 focus:border-[#b2f746]/60 transition-all"
                placeholder="BC-20241115-0001"
                value={codigoManual}
                onChange={e => setCodigoManual(e.target.value.toUpperCase())}
              />
            </div>
            <button
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
              style={{ background: '#b2f746', color: '#002117' }}
              onClick={() => procesarCodigo(codigoManual)}
              disabled={codigoManual.length < 5}>
              <QrCode size={16} /> Buscar bicicleta
            </button>
            <button onClick={() => setModoManual(false)}
              className="w-full text-white/40 text-sm hover:text-white/70 transition-colors">
              Volver a la cámara
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {estado === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-2 border-white/20 border-t-[#b2f746] rounded-full animate-spin mx-auto" />
            <p className="text-white/60 text-sm">Buscando bicicleta...</p>
          </div>
        </div>
      )}

      {/* Bici encontrada */}
      {estado === 'found' && bici && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-5">
          <div className="w-full max-w-sm space-y-4">
            {/* Bike card */}
            <div className="rounded-2xl border overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: disponible ? '#b2f746' : 'rgba(186,26,26,0.3)' }}>
                    <Bike size={28} style={{ color: disponible ? '#002117' : '#ffdad6' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-white text-lg font-mono">{bici.codigo}</p>
                    <p className="text-white/60 text-sm">{bici.tipo}{bici.marca ? ` · ${bici.marca}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                    disponible
                      ? 'bg-[#b2f746]/20 text-[#b2f746] border-[#b2f746]/30'
                      : 'bg-error/20 text-error border-error/30'
                  }`}>
                    {disponible ? 'Disponible' : bici.estado}
                  </span>
                </div>

                {estacion && (
                  <div className="mt-4 flex items-center gap-2 text-white/50 text-xs">
                    <MapPin size={12} className="shrink-0" />
                    <span>{estacion.nombre}</span>
                  </div>
                )}
              </div>
            </div>

            {disponible ? (
              <button onClick={iniciarViaje}
                className="w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition-all active:scale-[.98] shadow-lg"
                style={{ background: '#b2f746', color: '#002117', boxShadow: '0 8px 32px rgba(178,247,70,0.25)' }}>
                <Bike size={20} /> Iniciar viaje
              </button>
            ) : (
              <div className="w-full px-4 py-3 rounded-xl flex items-center gap-3"
                style={{ background: 'rgba(186,26,26,0.15)', border: '1px solid rgba(186,26,26,0.3)' }}>
                <AlertTriangle size={18} className="text-error shrink-0" />
                <p className="text-error text-sm">Esta bicicleta no está disponible</p>
              </div>
            )}

            <button onClick={() => { setEstado('scanning'); setBikeInfo(null); setError('') }}
              className="w-full text-white/40 text-sm py-2 hover:text-white/70 transition-colors">
              Escanear otra bicicleta
            </button>
          </div>
        </div>
      )}

      {/* Éxito */}
      {estado === 'success' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5">
            <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #b2f746, #98da27)', boxShadow: '0 8px 32px rgba(178,247,70,0.3)' }}>
              <CheckCircle size={48} style={{ color: '#002117' }} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">¡Viaje iniciado!</h2>
              <p className="text-white/50 text-sm mt-1">Redirigiendo al mapa de viaje...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {estado === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(186,26,26,0.2)' }}>
            <AlertTriangle size={36} className="text-error" />
          </div>
          <div className="text-center">
            <h2 className="font-extrabold text-white text-lg">Algo salió mal</h2>
            <p className="text-white/50 text-sm mt-2 max-w-xs">{error}</p>
          </div>
          <button onClick={() => { setEstado('scanning'); setError(''); setBikeInfo(null) }}
            className="h-12 px-8 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]"
            style={{ background: '#b2f746', color: '#002117' }}>
            Intentar nuevamente
          </button>
        </div>
      )}

      <style jsx global>{`
        #qr-reader video { object-fit: cover; width: 100% !important; height: 100% !important; }
        #qr-reader { border: none !important; }
        #qr-reader__scan_region { border: none !important; }
        #qr-reader__dashboard { display: none !important; }
        @keyframes scan-line {
          0% { top: 20%; }
          50% { top: 80%; }
          100% { top: 20%; }
        }
        .animate-scan-line { animation: scan-line 2s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
