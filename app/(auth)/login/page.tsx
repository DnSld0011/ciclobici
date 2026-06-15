'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Eye, EyeOff, Bike, CheckCircle } from 'lucide-react'
import { loginAction } from './actions'

const inputCls = 'w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface placeholder-outline focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5'

function LoginContent() {
  const [showPass, setShowPass]   = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const isEmail = identifier.includes('@')

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'suspendido')     setError('Tu cuenta está suspendida. Contacta al administrador.')
    else if (err === 'sin-sesion') setError('La sesión expiró. Vuelve a iniciar sesión.')
    else if (err)                  setError('Error al iniciar sesión. Intenta nuevamente.')
  }, [searchParams])

  async function handleSubmit(formData: FormData) {
    setError(''); setLoading(true)
    try {
      const result = await loginAction(formData)
      if (result?.error) setError(result.error)
    } catch (err: unknown) {
      // Next.js redirect() lanza un error interno — no mostrarlo como error de usuario
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('NEXT_REDIRECT')) {
        setError('Error inesperado al iniciar sesión. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!isEmail || !identifier.trim()) {
      setError('Ingresa tu correo electrónico para recuperar tu contraseña')
      return
    }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        identifier.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/reset-password` }
      )
      if (error) throw error
      setResetSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar correo')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Hero ── */}
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
            <h2 className="text-2xl font-extrabold text-on-surface">Bienvenido de vuelta</h2>
            <p className="text-sm text-outline mt-1">Ingresa con tu correo o número de celular</p>
          </div>

          {resetSent ? (
            <div className="px-4 py-4 rounded-xl bg-[#dcfce7] border border-[#bbf7d0] flex items-start gap-3">
              <CheckCircle size={18} className="text-[#166534] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#166534]">Correo enviado</p>
                <p className="text-xs text-[#166534]/80 mt-0.5">
                  Revisa tu bandeja de entrada y sigue las instrucciones.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-200">
              {error}
            </div>
          ) : null}

          <form action={handleSubmit} className="space-y-4">
            {/* Identificador */}
            <div>
              <label className={labelCls}>Correo o celular</label>
              <input
                name="identifier"
                type="text"
                placeholder="tu@correo.com  ó  987654321"
                className={inputCls}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required autoFocus autoComplete="username"
              />
              <p className="text-[10px] text-outline mt-1">
                {isEmail ? '✉ Correo electrónico'
                  : identifier.length > 3 ? '📱 Número de celular'
                  : 'Puedes usar tu correo o número de celular peruano'}
              </p>
            </div>

            {/* Contraseña */}
            <div>
              <label className={labelCls}>
                <Lock size={10} className="inline mr-1" />Contraseña
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  className={`${inputCls} pr-11`}
                  required autoComplete="current-password"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Olvidé contraseña */}
            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword} disabled={loading}
                className="text-xs text-primary-container font-semibold hover:underline disabled:opacity-50">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
              style={{ background: '#b2f746', color: '#002117' }}
              disabled={loading}>
              {loading
                ? <><span className="w-4 h-4 border-2 border-[#002117]/30 border-t-[#002117] rounded-full animate-spin" />Ingresando...</>
                : 'Ingresar'}
            </button>
          </form>

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
