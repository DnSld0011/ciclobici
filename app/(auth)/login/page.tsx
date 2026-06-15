'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, KeyRound, Bike, ArrowLeft, RefreshCw } from 'lucide-react'

const inputCls = 'w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface placeholder-outline focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5'

function LoginContent() {
  const [paso, setPaso]     = useState<'email' | 'otp'>('email')
  const [correo, setCorreo] = useState('')
  const [otp, setOtp]       = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) setError(decodeURIComponent(urlError))
  }, [searchParams])

  // Countdown para reenvío
  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  async function enviarOtp(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: correo.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      })
      if (error) throw error
      setPaso('otp')
      setCountdown(60)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar código'
      // Usuario no existe → invitarle a registrarse
      if (msg.includes('not found') || msg.includes('User not found') || msg.includes('Invalid login')) {
        setError('No encontramos una cuenta con ese correo. ¿Quieres registrarte?')
      } else {
        setError(msg)
      }
    } finally { setLoading(false) }
  }

  async function verificarOtp(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: correo.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      })
      if (error) throw error
      if (!data.user) throw new Error('No se pudo verificar la sesión')

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol, estado')
        .eq('id', data.user.id)
        .single()

      if (!perfil)                           { router.push('/registro'); return }
      if (perfil.estado === 'pendiente')     { router.push('/verificacion'); return }
      if (perfil.rol === 'operador')         router.replace('/operador')
      else if (perfil.rol === 'tecnico')     router.replace('/tecnico/mantenimiento')
      else                                   router.replace('/ciudadano')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código incorrecto o expirado')
    } finally { setLoading(false) }
  }

  async function reenviar() {
    if (countdown > 0) return
    setError(''); setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: correo.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      })
      if (error) throw error
      setCountdown(60)
      setOtp('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al reenviar')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Hero panel ── */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #003527 0%, #064e3b 60%, #002117 100%)' }}>
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #b2f746 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #95d3ba 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-8 border border-white/20">
            <Bike size={24} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-3">
            San Borja<br />en Bici
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-xs">
            Movilidad urbana sostenible. Accede a cientos de bicicletas en toda la ciudad.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { n: '2,400+', label: 'Viajes este mes' },
            { n: '18',     label: 'Estaciones activas' },
            { n: '120 kg', label: 'CO₂ ahorrado hoy' },
          ].map(({ n, label }) => (
            <div key={label} className="flex items-baseline gap-3">
              <span className="text-2xl font-extrabold" style={{ color: '#b2f746' }}>{n}</span>
              <span className="text-white/50 text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Formulario ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface min-h-screen md:min-h-0">
        <div className="w-full max-w-sm space-y-7">

          {/* Logo mobile */}
          <div className="md:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#003527' }}>
              <Bike size={20} className="text-white" />
            </div>
            <span className="text-lg font-extrabold text-primary-container">San Borja en Bici</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-on-surface">
              {paso === 'email' ? 'Bienvenido de vuelta' : 'Revisa tu correo'}
            </h2>
            <p className="text-sm text-outline mt-1">
              {paso === 'email'
                ? 'Ingresa tu correo para recibir un código de acceso'
                : `Enviamos un código de 6 dígitos a ${correo}`}
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20 flex flex-col gap-1">
              {error}
              {error.includes('registrarte') && (
                <Link href="/registro" className="text-primary-container underline text-xs">
                  Crear una cuenta →
                </Link>
              )}
            </div>
          )}

          {paso === 'email' ? (
            <form onSubmit={enviarOtp} className="space-y-4">
              <div>
                <label className={labelCls}>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  className={inputCls}
                  value={correo}
                  onChange={e => setCorreo(e.target.value)}
                  required autoFocus autoComplete="email"
                />
              </div>
              <button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
                style={{ background: '#b2f746', color: '#002117' }}
                disabled={loading || !correo.includes('@')}>
                <Mail size={16} />
                {loading ? 'Enviando código...' : 'Enviar código'}
              </button>
            </form>
          ) : (
            <form onSubmit={verificarOtp} className="space-y-4">
              {/* Info correo */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div className="w-8 h-8 rounded-lg bg-[#e5eeff] flex items-center justify-center shrink-0">
                  <Mail size={15} className="text-primary-container" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-outline uppercase font-semibold">Código enviado a</p>
                  <p className="text-sm font-bold text-on-surface truncate">{correo}</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>Código de 8 dígitos</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  className="w-full h-16 px-4 rounded-xl border border-outline-variant/40 bg-white text-center text-2xl tracking-[0.4em] font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  required maxLength={8} autoFocus
                />
                <p className="text-[10px] text-outline mt-1.5">Revisa también la carpeta de spam</p>
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
                style={{ background: '#b2f746', color: '#002117' }}
                disabled={loading || otp.length !== 8}>
                <KeyRound size={16} />
                {loading ? 'Verificando...' : 'Entrar'}
              </button>

              {/* Reenviar + cambiar correo */}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={reenviar}
                  disabled={countdown > 0 || loading}
                  className="flex items-center gap-1.5 text-primary-container font-semibold disabled:text-outline transition-colors hover:underline">
                  <RefreshCw size={13} />
                  {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
                </button>
                <button
                  type="button"
                  className="text-outline font-semibold flex items-center gap-1 hover:text-on-surface transition-colors"
                  onClick={() => { setPaso('email'); setOtp(''); setError('') }}>
                  <ArrowLeft size={13} /> Cambiar correo
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-outline">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="font-bold text-primary-container hover:underline">
              Regístrate gratis
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
