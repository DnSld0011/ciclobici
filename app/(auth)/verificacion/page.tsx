'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bike, CheckCircle, KeyRound, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function VerificacionContent() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)
  const [celular, setCelular] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const modoRegistro = searchParams.get('modo') === 'registro'

  useEffect(() => {
    const data = localStorage.getItem('ciclobici_registro')
    if (data) setCelular(JSON.parse(data).celular)
  }, [])

  async function verificar(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: `+51${celular}`, token: otp, type: 'sms',
      })
      if (verifyError) throw verifyError
      if (!data.user) throw new Error('Verificación fallida')

      if (modoRegistro) {
        const regData = localStorage.getItem('ciclobici_registro')
        if (regData) {
          const { nombre, documento, correo, celular: cel } = JSON.parse(regData)
          const { error: insertError } = await supabase.from('usuarios').upsert({
            id: data.user.id, nombre, documento, correo,
            celular: cel, estado: 'activo', rol: 'ciudadano',
          })
          if (insertError) throw insertError
          localStorage.removeItem('ciclobici_registro')
        }
      } else {
        await supabase.from('usuarios').update({ estado: 'activo' }).eq('id', data.user.id)
      }

      setExito(true)
      setTimeout(() => router.push('/ciudadano'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código incorrecto o expirado')
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
            <h2 className="text-xl font-extrabold text-on-surface">¡Celular verificado!</h2>
            <p className="text-sm text-outline mt-2">Tu cuenta está activa. Redirigiendo...</p>
          </div>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-extrabold text-on-surface">Verificar celular</h2>
            <p className="text-sm text-outline mt-1">
              {modoRegistro
                ? 'Ingresa el código enviado para activar tu cuenta'
                : 'Tu cuenta está pendiente. Ingresa el código OTP.'}
            </p>
          </div>

          {!celular && (
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

          {celular && (
            <div className="px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-outline">
              Código enviado a <span className="font-bold text-on-surface">+51 {celular}</span>
            </div>
          )}

          <form onSubmit={verificar} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">
                Código de 6 dígitos
              </label>
              <input type="text" placeholder="123 456"
                className="w-full h-16 px-4 rounded-xl border border-outline-variant/40 bg-white text-center text-3xl tracking-[0.6em] font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required maxLength={6} autoFocus />
            </div>

            <button type="submit"
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50"
              style={{ background: '#b2f746', color: '#002117' }}
              disabled={loading || otp.length !== 6 || !celular}>
              <KeyRound size={16} />
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
          </form>

          <Link href="/login"
            className="w-full h-10 rounded-xl text-sm text-outline font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-low transition-colors">
            <ArrowLeft size={14} /> Volver al inicio
          </Link>
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
