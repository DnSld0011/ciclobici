'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Phone, KeyRound, Bike, FlaskConical, ArrowLeft } from 'lucide-react'

const DEMO_USERS = [
  { label: 'Operador',  phone: '51900100001', desc: 'Admin / gestión',   color: 'bg-[#e5eeff] text-primary-container border-[#c7d7ff]' },
  { label: 'Técnico',   phone: '51900100002', desc: 'Mantenimiento',     color: 'bg-[#fef9c3] text-[#854d0e] border-[#fde68a]' },
  { label: 'Ciudadano', phone: '51900100003', desc: 'Usuario normal',    color: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]' },
]

const inputCls = 'w-full h-12 px-4 rounded-xl border border-white/30 bg-white/60 backdrop-blur-sm text-on-surface placeholder-outline text-sm focus:outline-none focus:ring-2 focus:ring-secondary-container/60 focus:border-secondary-container transition-all'

function LoginContent() {
  const [paso, setPaso] = useState<'celular' | 'otp'>('celular')
  const [celular, setCelular] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) setError(decodeURIComponent(urlError))
  }, [searchParams])

  async function demoLogin(phone: string) {
    setError(''); setLoading(true)
    try {
      const res = await fetch(`/api/auth/demo?phone=${phone}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email, password: data.password,
      })
      if (signInError) throw signInError
      const { data: perfil } = await supabase
        .from('usuarios').select('rol').eq('id', authData.user.id).single()
      if (perfil?.rol === 'operador')     router.replace('/operador')
      else if (perfil?.rol === 'tecnico') router.replace('/tecnico/mantenimiento')
      else                                router.replace('/ciudadano')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error en acceso demo')
    } finally { setLoading(false) }
  }

  async function enviarOtp(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: `+51${celular}` })
      if (error) throw error
      setPaso('otp')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar código')
    } finally { setLoading(false) }
  }

  async function verificarOtp(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+51${celular}`, token: otp, type: 'sms',
      })
      if (error) throw error
      if (!data.user) throw new Error('No se pudo verificar')
      const { data: perfil } = await supabase
        .from('usuarios').select('rol, estado').eq('id', data.user.id).single()
      if (!perfil) { router.push('/registro'); return }
      if (perfil.estado === 'pendiente') { router.push('/verificacion'); return }
      if (perfil.rol === 'ciudadano')     router.push('/ciudadano')
      else if (perfil.rol === 'operador') router.push('/operador')
      else if (perfil.rol === 'tecnico')  router.push('/tecnico/mantenimiento')
      else router.push('/login')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código incorrecto')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* Panel izquierdo — hero */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #003527 0%, #064e3b 60%, #002117 100%)' }}>
        {/* Orbes decorativos */}
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

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface min-h-screen md:min-h-0">
        <div className="w-full max-w-sm space-y-7">

          {/* Logo mobile */}
          <div className="md:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#003527' }}>
              <Bike size={20} className="text-white" />
            </div>
            <span className="text-lg font-extrabold text-primary-container">San Borja en Bici</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-on-surface">
              {paso === 'celular' ? 'Bienvenido' : 'Código enviado'}
            </h2>
            <p className="text-sm text-outline mt-1">
              {paso === 'celular'
                ? 'Ingresa tu número para recibir un código'
                : `Ingresa el código enviado a +51 ${celular}`}
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">
              {error}
            </div>
          )}

          {paso === 'celular' ? (
            <form onSubmit={enviarOtp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">
                  Celular
                </label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 h-12 rounded-xl border border-outline-variant/40 bg-white text-outline text-sm font-semibold shrink-0">
                    +51
                  </span>
                  <input type="tel" placeholder="987 654 321"
                    className="flex-1 h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                    value={celular}
                    onChange={e => setCelular(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    required maxLength={9} />
                </div>
              </div>
              <button type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
                style={{ background: '#b2f746', color: '#002117' }}
                disabled={loading || celular.length !== 9}>
                <Phone size={16} />
                {loading ? 'Enviando...' : 'Enviar código OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={verificarOtp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">
                  Código de 6 dígitos
                </label>
                <input type="text" placeholder="123456"
                  className="w-full h-14 px-4 rounded-xl border border-outline-variant/40 bg-white text-center text-2xl tracking-[0.5em] font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required maxLength={6} autoFocus />
              </div>
              <button type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
                style={{ background: '#b2f746', color: '#002117' }}
                disabled={loading || otp.length !== 6}>
                <KeyRound size={16} />
                {loading ? 'Verificando...' : 'Verificar código'}
              </button>
              <button type="button"
                className="w-full h-10 rounded-xl text-sm text-outline font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-low transition-colors"
                onClick={() => { setPaso('celular'); setOtp('') }}>
                <ArrowLeft size={14} /> Cambiar número
              </button>
            </form>
          )}

          <div className="text-center text-sm">
            <span className="text-outline">¿No tienes cuenta? </span>
            <Link href="/registro" className="font-bold text-primary-container hover:underline">
              Regístrate
            </Link>
          </div>

          {/* Demo */}
          <div className="pt-4 border-t border-outline-variant/20">
            <p className="text-[10px] font-extrabold tracking-widest text-outline uppercase mb-3 flex items-center gap-1.5">
              <FlaskConical size={11} /> Acceso rápido demo
            </p>
            <div className="space-y-2">
              {DEMO_USERS.map(u => (
                <button key={u.phone} onClick={() => demoLogin(u.phone)} disabled={loading}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-semibold hover:opacity-80 active:scale-[.98] transition-all disabled:opacity-50 ${u.color}`}>
                  <span>{u.label}</span>
                  <span className="text-xs font-normal opacity-60">{u.desc}</span>
                </button>
              ))}
            </div>
          </div>

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
