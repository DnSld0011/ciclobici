'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bike, CheckCircle, User, CreditCard, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react'

const inputCls = 'w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all placeholder-outline'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const strength = checks.filter(Boolean).length
  const labels = ['Muy débil', 'Débil', 'Media', 'Fuerte', 'Muy fuerte']
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500']

  if (!password) return null
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < strength ? colors[strength] : 'bg-outline-variant/30'}`} />
        ))}
      </div>
      <p className={`text-[10px] font-semibold ${strength < 2 ? 'text-error' : strength < 3 ? 'text-outline' : 'text-green-700'}`}>
        {labels[strength]}
      </p>
    </div>
  )
}

function RegistroContent() {
  const searchParams   = useSearchParams()
  const correoParam    = searchParams.get('correo')
  const completandoPerfil = !!correoParam

  const [form, setForm]       = useState({
    nombre: '', documento: '', correo: correoParam ? decodeURIComponent(correoParam) : '',
    celular: '', password: '', confirmPassword: '',
  })
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [emailSent, setEmailSent]     = useState(false)
  const router = useRouter()

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function validar(): string | null {
    if (!form.nombre.trim() || form.nombre.trim().split(' ').length < 2)
      return 'Ingresa nombre y apellido completos'
    if (!/^\d{6,12}$/.test(form.documento))
      return 'Documento inválido (solo números, 6-12 dígitos)'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      return 'Correo electrónico inválido'
    if (!/^9\d{8}$/.test(form.celular))
      return 'Celular inválido (9 dígitos, debe empezar por 9)'
    if (!completandoPerfil) {
      if (form.password.length < 8)
        return 'La contraseña debe tener al menos 8 caracteres'
      if (form.password !== form.confirmPassword)
        return 'Las contraseñas no coinciden'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validar()
    if (err) { setError(err); return }
    setError(''); setLoading(true)

    try {
      const supabase = createClient()

      if (completandoPerfil) {
        // Usuario ya autenticado (viene de login sin perfil) — solo crear el registro
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Sesión expirada. Inicia sesión nuevamente.')

        const { error: insertError } = await supabase.from('usuarios').upsert({
          id:        user.id,
          nombre:    form.nombre.trim(),
          documento: form.documento.trim(),
          correo:    form.correo.trim().toLowerCase(),
          celular:   form.celular.trim(),
          estado:   'activo',
          rol:      'ciudadano',
        }, { onConflict: 'id' })

        if (insertError) throw insertError
        router.replace('/ciudadano')
        return
      }

      // Registro nuevo con contraseña
      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    form.correo.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            nombre:    form.nombre.trim(),
            documento: form.documento.trim(),
            celular:   form.celular.trim(),
          },
        },
      })
      if (signUpError) {
        const msg = signUpError.message ?? ''
        if (msg.includes('already registered') || msg.includes('User already') || signUpError.status === 422)
          throw new Error('Ya existe una cuenta con ese correo. ¿Quieres iniciar sesión?')
        if (msg.includes('Email rate limit') || msg.includes('over_email_send_rate_limit'))
          throw new Error('Demasiados intentos. Espera unos minutos antes de volver a intentarlo.')
        if (msg.includes('Password should') || msg.includes('password'))
          throw new Error('La contraseña no cumple los requisitos mínimos de Supabase.')
        if (msg.includes('Invalid email') || msg.includes('valid email') || msg.includes('email_address_invalid'))
          throw new Error('El correo electrónico no tiene un formato válido.')
        if (msg.includes('Signups not allowed') || msg.includes('signup_disabled'))
          throw new Error('El registro está desactivado temporalmente. Contacta al administrador.')
        throw new Error(msg || 'Error al crear la cuenta. Intenta de nuevo.')
      }

      if (data.session) {
        // Email confirmation desactivado — sesión activa de inmediato
        await supabase.from('usuarios').upsert({
          id:        data.user!.id,
          nombre:    form.nombre.trim(),
          documento: form.documento.trim(),
          correo:    form.correo.trim().toLowerCase(),
          celular:   form.celular.trim(),
          estado:   'activo',
          rol:      'ciudadano',
        }, { onConflict: 'id' })
        router.replace('/ciudadano')
      } else {
        // Email confirmation activado — usuario debe confirmar su correo
        setEmailSent(true)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('rate limit') || msg.includes('429') || msg.includes('over_email_send_rate_limit'))
        setError('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.')
      else setError(msg || 'Error inesperado. Intenta de nuevo.')
    } finally { setLoading(false) }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #dcfce7, #b2f746)' }}>
            <Mail size={40} className="text-[#166534]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-on-surface">¡Confirma tu correo!</h2>
            <p className="text-sm text-outline mt-2">
              Enviamos un enlace de activación a<br />
              <strong className="text-on-surface">{form.correo}</strong>
            </p>
            <p className="text-xs text-outline mt-3">
              Revisa tu bandeja de entrada (y spam). Una vez que confirmes, podrás iniciar sesión.
            </p>
          </div>
          <Link href="/login" className="inline-block mt-2 text-sm font-bold text-primary-container hover:underline">
            Ir a Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Hero ── */}
      <div className="relative hidden md:flex md:w-5/12 flex-col justify-center p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #003527 0%, #064e3b 60%, #002117 100%)' }}>
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #b2f746 0%, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-8 border border-white/20">
            <Bike size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-4">
            Únete a la red verde<br />de San Borja
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Crea tu cuenta y empieza a usar las bicicletas compartidas. Tu ciudad, tu ritmo.
          </p>
          <div className="mt-8 space-y-3">
            {['Sin costo de membresía', 'Disponible 24/7', 'Tracking en tiempo real'].map(b => (
              <div key={b} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#b2f746' }}>
                  <CheckCircle size={12} style={{ color: '#002117' }} />
                </div>
                <span className="text-white/70 text-sm">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulario ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface overflow-y-auto">
        <div className="w-full max-w-sm space-y-5 py-8">

          {/* Logo mobile */}
          <div className="md:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#003527' }}>
              <Bike size={20} className="text-white" />
            </div>
            <span className="text-lg font-extrabold text-primary-container">San Borja en Bici</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-on-surface">
              {completandoPerfil ? 'Completa tu perfil' : 'Crear cuenta'}
            </h2>
            <p className="text-sm text-outline mt-1">
              {completandoPerfil ? 'Ya tienes sesión activa. Solo necesitamos tus datos.' : 'Registro rápido, empieza en segundos'}
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20 flex flex-col gap-1">
              {error}
              {error.includes('iniciar sesión') && (
                <Link href="/login" className="text-primary-container underline text-xs">Ir a Iniciar Sesión →</Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <label className={labelCls}><User size={10} className="inline mr-1" />Nombre completo</label>
              <input className={inputCls} placeholder="Juan García López" value={form.nombre} onChange={set('nombre')} required />
              <p className="text-[10px] text-outline mt-1">Nombre y apellidos como en tu documento</p>
            </div>

            {/* Documento */}
            <div>
              <label className={labelCls}><CreditCard size={10} className="inline mr-1" />DNI / Documento</label>
              <input
                className={inputCls} placeholder="12345678" value={form.documento}
                onChange={e => setForm(p => ({ ...p, documento: e.target.value.replace(/\D/g, '') }))}
                required maxLength={12}
              />
            </div>

            {/* Correo */}
            <div>
              <label className={labelCls}><Mail size={10} className="inline mr-1" />Correo electrónico</label>
              <input
                type="email" className={inputCls} placeholder="tu@correo.com"
                value={form.correo} onChange={set('correo')}
                required autoComplete="email" readOnly={!!completandoPerfil}
              />
            </div>

            {/* Celular */}
            <div>
              <label className={labelCls}><Phone size={10} className="inline mr-1" />Celular peruano</label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 h-12 rounded-xl border border-outline-variant/40 bg-surface-container-low text-outline text-sm font-semibold shrink-0">+51</span>
                <input
                  type="tel" placeholder="987 654 321"
                  className="flex-1 h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                  value={form.celular}
                  onChange={e => setForm(p => ({ ...p, celular: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                  required maxLength={9}
                />
              </div>
              <p className="text-[10px] text-outline mt-1">9 dígitos, empieza por 9</p>
            </div>

            {/* Contraseña (solo en registro nuevo) */}
            {!completandoPerfil && (
              <>
                <div>
                  <label className={labelCls}><Lock size={10} className="inline mr-1" />Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'} className={`${inputCls} pr-11`}
                      placeholder="Mínimo 8 caracteres" value={form.password} onChange={set('password')}
                      required autoComplete="new-password"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
                      {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <PasswordStrength password={form.password} />
                </div>

                <div>
                  <label className={labelCls}><Lock size={10} className="inline mr-1" />Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'} className={`${inputCls} pr-11`}
                      placeholder="Repite tu contraseña" value={form.confirmPassword} onChange={set('confirmPassword')}
                      required autoComplete="new-password"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-[10px] text-error mt-1 font-semibold">Las contraseñas no coinciden</p>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50 mt-2"
              style={{ background: '#b2f746', color: '#002117' }}
              disabled={loading}>
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#002117]/30 border-t-[#002117] rounded-full animate-spin" />{completandoPerfil ? 'Guardando...' : 'Creando cuenta...'}</span>
                : completandoPerfil ? 'Guardar y entrar' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-outline">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-bold text-primary-container hover:underline">
              Iniciar sesión
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroContent />
    </Suspense>
  )
}
