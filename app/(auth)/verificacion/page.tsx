'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bike, CheckCircle, KeyRound, ArrowLeft, Mail, RefreshCw } from 'lucide-react'
import Link from 'next/link'

function VerificacionContent() {
  const [otp, setOtp]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [exito, setExito]     = useState(false)
  const [correo, setCorreo]   = useState('')
  const [countdown, setCountdown] = useState(0)

  const router       = useRouter()
  const searchParams = useSearchParams()
  const modoRegistro = searchParams.get('modo') === 'registro'

  useEffect(() => {
    const raw = localStorage.getItem('ciclobici_registro')
    if (raw) {
      const parsed = JSON.parse(raw)
      setCorreo(parsed.correo ?? parsed.email ?? '')
    }
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    if (!correo) { setError('No se encontró el correo. Vuelve a iniciar el proceso.'); return }
    setError(''); setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: correo.toLowerCase().trim(),
        token: otp.trim(),
        type: 'email',
      })
      if (verifyError) throw verifyError
      if (!data.user) throw new Error('Verificación fallida')

      if (modoRegistro) {
        const raw = localStorage.getItem('ciclobici_registro')
        if (raw) {
          const { nombre, documento, correo: correoReg, celular } = JSON.parse(raw)
          const { error: insertError } = await supabase.from('usuarios').upsert({
            id:        data.user.id,
            nombre,
            documento,
            correo:    correoReg,
            celular,
            estado:   'activo',
            rol:      'ciudadano',
          }, { onConflict: 'id' })
          if (insertError) throw insertError
          localStorage.removeItem('ciclobici_registro')
        }
      } else {
        await supabase
          .from('usuarios')
          .update({ estado: 'activo' })
          .eq('id', data.user.id)
      }

      setExito(true)
      setTimeout(() => router.replace('/ciudadano'), 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Código incorrecto o expirado'
      if (msg.includes('expired') || msg.includes('invalid')) {
        setError('El código expiró o es incorrecto. Solicita uno nuevo.')
      } else {
        setError(msg)
      }
    } finally { setLoading(false) }
  }

  async function reenviar() {
    if (!correo || countdown > 0) return
    setError(''); setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: correo.toLowerCase().trim(),
        options: { shouldCreateUser: modoRegistro },
      })
      if (error) throw error
      setCountdown(60)
      setOtp('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al reenviar')
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-sm space-y-7">

      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#003527' }}>
          <Bike size={20} className="text-white" />
        </div>
        <span className="text-lg font-extrabold text-primary-container">San Borja en Bici</span>
      </div>

      {exito ? (
        <div className="text-center space-y-5 py-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #dcfce7, #b2f746)' }}>
            <CheckCircle size={40} className="text-[#166534]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-on-surface">
              {modoRegistro ? '¡Cuenta creada!' : '¡Verificado!'}
            </h2>
            <p className="text-sm text-outline mt-2">
              {modoRegistro
                ? 'Tu cuenta está activa. Bienvenido a San Borja en Bici.'
                : 'Sesión iniciada correctamente.'}
            </p>
          </div>
          <p className="text-xs text-outline animate-pulse">Redirigiendo...</p>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-extrabold text-on-surface">
              {modoRegistro ? 'Confirma tu correo' : 'Verificar acceso'}
            </h2>
            <p className="text-sm text-outline mt-1">
              Ingresa el código de 6 dígitos que enviamos a tu correo
            </p>
          </div>

          {/* Correo info */}
          {correo ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div className="w-8 h-8 rounded-lg bg-[#e5eeff] flex items-center justify-center shrink-0">
                <Mail size={15} className="text-primary-container" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-outline uppercase font-semibold">Código enviado a</p>
                <p className="text-sm font-bold text-on-surface truncate">{correo}</p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-[#fef9c3] text-[#854d0e] text-sm border border-[#fde68a]">
              No se encontró información de registro.{' '}
              <Link href="/registro" className="font-bold underline">Regístrate nuevamente</Link>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">
              {error}
            </div>
          )}

          <form onSubmit={verificar} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">
                Código de 8 dígitos
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                className="w-full h-16 px-4 rounded-xl border border-outline-variant/40 bg-white text-center text-2xl tracking-[0.35em] font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required maxLength={8} autoFocus
              />
              <p className="text-[10px] text-outline mt-1.5">
                Revisa también la carpeta de spam · Válido por 10 minutos
              </p>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
              style={{ background: '#b2f746', color: '#002117' }}
              disabled={loading || otp.length !== 8 || !correo}>
              <KeyRound size={16} />
              {loading ? 'Verificando...' : modoRegistro ? 'Confirmar y crear cuenta' : 'Verificar'}
            </button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <button
              onClick={reenviar}
              disabled={countdown > 0 || loading || !correo}
              className="flex items-center gap-1.5 text-primary-container font-semibold disabled:text-outline transition-colors hover:underline">
              <RefreshCw size={13} />
              {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
            </button>
            <Link href="/login"
              className="text-outline font-semibold flex items-center gap-1 hover:text-on-surface transition-colors">
              <ArrowLeft size={13} /> Volver
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default function VerificacionPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <Suspense fallback={
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <VerificacionContent />
      </Suspense>
    </div>
  )
}
