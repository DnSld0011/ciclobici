'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bike, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setError(''); setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.replace('/login'), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar contraseña')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#003527' }}>
            <Bike size={20} className="text-white" />
          </div>
          <span className="text-lg font-extrabold text-primary-container">San Borja en Bici</span>
        </div>

        {done ? (
          <div className="text-center space-y-5 py-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'linear-gradient(135deg, #dcfce7, #b2f746)' }}>
              <CheckCircle size={40} className="text-[#166534]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">¡Contraseña actualizada!</h2>
              <p className="text-sm text-outline mt-2">Redirigiendo al inicio de sesión...</p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Nueva contraseña</h2>
              <p className="text-sm text-outline mt-1">Elige una contraseña segura para tu cuenta</p>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">
                  <Lock size={10} className="inline mr-1" />Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full h-12 px-4 pr-11 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all placeholder-outline"
                    value={password} onChange={e => setPassword(e.target.value)} required autoFocus
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  placeholder="Repite tu contraseña"
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all placeholder-outline"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm transition-all active:scale-[.98] disabled:opacity-50"
                style={{ background: '#b2f746', color: '#002117' }}
                disabled={loading || !password || !confirm}>
                {loading ? 'Actualizando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
