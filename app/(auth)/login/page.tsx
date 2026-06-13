'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Phone, KeyRound, Bike, FlaskConical } from 'lucide-react'
import { Suspense } from 'react'

type Paso = 'celular' | 'otp'

const DEMO_USERS = [
  { label: 'Operador',  phone: '51900100001', desc: 'Admin / gestión' },
  { label: 'Técnico',   phone: '51900100002', desc: 'Mantenimiento' },
  { label: 'Ciudadano', phone: '51900100003', desc: 'Usuario normal' },
]

function LoginContent() {
  const [paso, setPaso] = useState<Paso>('celular')
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
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/demo?phone=${phone}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const supabase = createClient()
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (signInError) throw signInError

      const { data: perfil } = await supabase
        .from('usuarios').select('rol').eq('id', authData.user.id).single()

      if (perfil?.rol === 'operador')     router.replace('/operador/mapa')
      else if (perfil?.rol === 'tecnico') router.replace('/tecnico/mantenimiento')
      else                                router.replace('/ciudadano/mapa')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error en acceso demo')
    } finally {
      setLoading(false)
    }
  }

  async function enviarOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const telefono = `+51${celular}`
      const { error } = await supabase.auth.signInWithOtp({ phone: telefono })
      if (error) throw error
      setPaso('otp')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar código')
    } finally {
      setLoading(false)
    }
  }

  async function verificarOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const telefono = `+51${celular}`
      const { data, error } = await supabase.auth.verifyOtp({
        phone: telefono,
        token: otp,
        type: 'sms',
      })
      if (error) throw error
      if (!data.user) throw new Error('No se pudo verificar')

      // Check user profile
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol, estado')
        .eq('id', data.user.id)
        .single()

      if (!perfil) {
        router.push('/registro')
        return
      }

      if (perfil.estado === 'pendiente') {
        router.push('/verificacion')
        return
      }

      if (perfil.rol === 'ciudadano') router.push('/ciudadano/mapa')
      else if (perfil.rol === 'operador') router.push('/operador/mapa')
      else if (perfil.rol === 'tecnico') router.push('/tecnico/mantenimiento')
      else router.push('/login')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código incorrecto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Bike className="text-blue-700" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">CicloBici</h1>
          <p className="text-blue-200 mt-1">Sistema Municipal de Bicicletas Compartidas</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>
              {paso === 'celular'
                ? 'Ingresa tu número de celular para recibir un código'
                : 'Ingresa el código enviado a tu celular'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {paso === 'celular' ? (
              <form onSubmit={enviarOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="celular">Celular</Label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm">+51</span>
                    <Input
                      id="celular"
                      type="tel"
                      placeholder="987654321"
                      value={celular}
                      onChange={e => setCelular(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      required
                      maxLength={10}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || celular.length !== 9}>
                  <Phone size={16} />
                  {loading ? 'Enviando...' : 'Enviar Código OTP'}
                </Button>
              </form>
            ) : (
              <form onSubmit={verificarOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Código de 6 dígitos</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                  <p className="text-xs text-gray-500">
                    Código enviado a +51{celular}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  <KeyRound size={16} />
                  {loading ? 'Verificando...' : 'Verificar Código'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => { setPaso('celular'); setOtp('') }}
                >
                  Cambiar número
                </Button>
              </form>
            )}

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-500">¿No tienes cuenta?</span>{' '}
              <Link href="/registro" className="text-blue-700 hover:underline font-medium">
                Regístrate
              </Link>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                <FlaskConical size={12} /> Acceso rápido demo
              </p>
              <div className="flex flex-col gap-2">
                {DEMO_USERS.map(u => (
                  <button
                    key={u.phone}
                    onClick={() => demoLogin(u.phone)}
                    disabled={loading}
                    className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-left disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-gray-700">{u.label}</span>
                    <span className="text-xs text-gray-400">{u.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
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
