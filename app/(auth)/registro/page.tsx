'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bike, CheckCircle, ArrowLeft, User, CreditCard, Mail, Phone } from 'lucide-react'

const inputCls = 'w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all placeholder-outline'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5'

function validarDocumento(doc: string) { return /^\d{6,12}$/.test(doc) }
function validarCelular(cel: string)   { return /^9\d{8}$/.test(cel) }

export default function RegistroPage() {
  const [form, setForm] = useState({ nombre: '', documento: '', correo: '', celular: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [exito, setExito]   = useState(false)
  const router = useRouter()

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function validar(): string | null {
    if (!form.nombre.trim() || form.nombre.trim().split(' ').length < 2)
      return 'Ingresa nombre y apellido completos'
    if (!validarDocumento(form.documento))
      return 'Documento inválido (solo números, 6-12 dígitos)'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      return 'Correo electrónico inválido'
    if (!validarCelular(form.celular))
      return 'Celular inválido (9 dígitos, debe empezar por 9)'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validar()
    if (err) { setError(err); return }
    setError(''); setLoading(true)

    try {
      const supabase = createClient()

      // Verificar que el correo no está ya registrado intentando login
      // (si ya existe, signInWithOtp igualmente enviará código)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: form.correo.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      })

      if (otpError) {
        // Rate limit u otro error de Supabase
        throw otpError
      }

      // Guardar datos de perfil en localStorage para usarlos después de verificar
      localStorage.setItem('ciclobici_registro', JSON.stringify({
        nombre:    form.nombre.trim(),
        documento: form.documento.trim(),
        correo:    form.correo.trim().toLowerCase(),
        celular:   form.celular.trim(),
      }))

      setExito(true)
      setTimeout(() => router.push('/verificacion?modo=registro'), 1800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar'
      if (msg.toLowerCase().includes('rate limit') || msg.includes('429')) {
        setError('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.')
      } else {
        setError(msg)
      }
    } finally { setLoading(false) }
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #dcfce7, #b2f746)' }}>
            <CheckCircle size={40} className="text-[#166534]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-on-surface">¡Código enviado!</h2>
            <p className="text-sm text-outline mt-2">
              Revisa tu correo <strong className="text-on-surface">{form.correo}</strong>
              <br />e ingresa el código de 6 dígitos.
            </p>
          </div>
          <p className="text-xs text-outline">Redirigiendo a verificación...</p>
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
            Crea tu cuenta gratis y empieza a usar las bicicletas compartidas. Tu ciudad, tu ritmo.
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
      <div className="flex-1 flex items-center justify-center p-6 bg-surface">
        <div className="w-full max-w-sm space-y-6">

          {/* Logo mobile */}
          <div className="md:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#003527' }}>
              <Bike size={20} className="text-white" />
            </div>
            <span className="text-lg font-extrabold text-primary-container">San Borja en Bici</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-on-surface">Crear cuenta</h2>
            <p className="text-sm text-outline mt-1">
              Recibirás un código en tu correo para confirmar el registro
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <label className={labelCls}>
                <User size={10} className="inline mr-1" />Nombre completo
              </label>
              <input
                className={inputCls} name="nombre"
                placeholder="Juan García López"
                value={form.nombre} onChange={set('nombre')} required
              />
              <p className="text-[10px] text-outline mt-1">Nombre y apellidos como en tu documento</p>
            </div>

            {/* Documento */}
            <div>
              <label className={labelCls}>
                <CreditCard size={10} className="inline mr-1" />DNI / Documento
              </label>
              <input
                className={inputCls} name="documento"
                placeholder="12345678"
                value={form.documento}
                onChange={e => setForm(p => ({ ...p, documento: e.target.value.replace(/\D/g, '') }))}
                required maxLength={12}
              />
            </div>

            {/* Correo */}
            <div>
              <label className={labelCls}>
                <Mail size={10} className="inline mr-1" />Correo electrónico
              </label>
              <input
                type="email" className={inputCls} name="correo"
                placeholder="tu@correo.com"
                value={form.correo} onChange={set('correo')}
                required autoComplete="email"
              />
              <p className="text-[10px] text-outline mt-1">Aquí recibirás el código de verificación</p>
            </div>

            {/* Celular */}
            <div>
              <label className={labelCls}>
                <Phone size={10} className="inline mr-1" />Celular peruano
              </label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 h-12 rounded-xl border border-outline-variant/40 bg-surface-container-low text-outline text-sm font-semibold shrink-0">
                  +51
                </span>
                <input
                  type="tel" name="celular"
                  placeholder="987 654 321"
                  className="flex-1 h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                  value={form.celular}
                  onChange={e => setForm(p => ({ ...p, celular: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                  required maxLength={9}
                />
              </div>
              <p className="text-[10px] text-outline mt-1">9 dígitos, empieza por 9</p>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50 mt-2"
              style={{ background: '#b2f746', color: '#002117' }}
              disabled={loading}>
              <Mail size={16} />
              {loading ? 'Enviando código...' : 'Crear cuenta y recibir código'}
            </button>
          </form>

          <p className="text-center text-sm text-outline">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-bold text-primary-container hover:underline">
              <ArrowLeft size={12} className="inline" /> Iniciar sesión
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
