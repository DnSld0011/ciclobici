'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validarCelularPeruano, validarDocumento } from '@/lib/utils/codigos'
import { Bike, CheckCircle, ArrowLeft } from 'lucide-react'

const inputCls = 'w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5'

export default function RegistroPage() {
  const [form, setForm] = useState({ nombre: '', documento: '', correo: '', celular: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function validar(): string | null {
    if (!form.nombre.trim() || form.nombre.trim().split(' ').length < 2)
      return 'Ingresa nombre y apellido completos'
    if (!validarDocumento(form.documento))
      return 'Documento inválido (solo números, 6-12 dígitos)'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      return 'Correo electrónico inválido'
    if (!validarCelularPeruano(form.celular))
      return 'Celular inválido (9 dígitos, empieza por 9)'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validar()
    if (err) { setError(err); return }
    setError(''); setLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        phone: `+51${form.celular}`,
        options: { shouldCreateUser: true },
      })
      if (authError) throw authError
      localStorage.setItem('ciclobici_registro', JSON.stringify({
        nombre: form.nombre.trim(), documento: form.documento,
        correo: form.correo, celular: form.celular,
      }))
      setExito(true)
      setTimeout(() => router.push('/verificacion?modo=registro'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
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
            <h2 className="text-xl font-extrabold text-on-surface">¡Registro iniciado!</h2>
            <p className="text-sm text-outline mt-2">
              Enviamos un código OTP al celular <strong className="text-on-surface">+51 {form.celular}</strong>
            </p>
          </div>
          <p className="text-xs text-outline">Redirigiendo a verificación...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* Hero panel */}
      <div className="relative hidden md:flex md:w-5/12 flex-col justify-center p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #003527 0%, #064e3b 60%, #002117 100%)' }}>
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #b2f746 0%, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-8 border border-white/20">
            <Bike size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-4">
            Únete a la red verde de San Borja
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

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface">
        <div className="w-full max-w-sm space-y-6">

          <div className="md:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#003527' }}>
              <Bike size={20} className="text-white" />
            </div>
            <span className="text-lg font-extrabold text-primary-container">San Borja en Bici</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-on-surface">Crear cuenta</h2>
            <p className="text-sm text-outline mt-1">Regístrate para usar el sistema de bicicletas compartidas</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Nombre completo</label>
              <input className={inputCls} name="nombre" placeholder="Juan García López"
                value={form.nombre} onChange={handleChange} required />
            </div>

            <div>
              <label className={labelCls}>Número de documento</label>
              <input className={inputCls} name="documento" placeholder="12345678"
                value={form.documento}
                onChange={e => setForm(p => ({ ...p, documento: e.target.value.replace(/\D/g, '') }))}
                required maxLength={12} />
              <p className="text-[10px] text-outline mt-1">Solo números, sin puntos ni guiones</p>
            </div>

            <div>
              <label className={labelCls}>Correo electrónico</label>
              <input type="email" className={inputCls} name="correo" placeholder="usuario@correo.com"
                value={form.correo} onChange={handleChange} required />
            </div>

            <div>
              <label className={labelCls}>Celular peruano</label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 h-12 rounded-xl border border-outline-variant/40 bg-white text-outline text-sm font-semibold shrink-0">
                  +51
                </span>
                <input type="tel" className="flex-1 h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                  name="celular" placeholder="987 654 321"
                  value={form.celular}
                  onChange={e => setForm(p => ({ ...p, celular: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                  required maxLength={9} />
              </div>
              <p className="text-[10px] text-outline mt-1">9 dígitos, empieza por 9</p>
            </div>

            <button type="submit"
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
              style={{ background: '#b2f746', color: '#002117' }}
              disabled={loading}>
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>
          </form>

          <div className="text-center text-sm">
            <span className="text-outline">¿Ya tienes cuenta? </span>
            <Link href="/login" className="font-bold text-primary-container hover:underline flex-inline items-center gap-1">
              <ArrowLeft size={12} className="inline" /> Iniciar sesión
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
