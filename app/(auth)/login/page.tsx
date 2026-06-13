'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Phone, KeyRound, Bike } from 'lucide-react'

type Paso = 'celular' | 'otp'

export default function LoginPage() {
  const [paso, setPaso] = useState<Paso>('celular')
  const [celular, setCelular] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function enviarOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const telefono = `+57${celular}`
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
      const telefono = `+57${celular}`
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
                    <span className="flex items-center px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm">+57</span>
                    <Input
                      id="celular"
                      type="tel"
                      placeholder="3001234567"
                      value={celular}
                      onChange={e => setCelular(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      maxLength={10}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || celular.length !== 10}>
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
                    Código enviado a +57{celular}
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
