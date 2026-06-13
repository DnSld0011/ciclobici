'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Phone } from 'lucide-react'

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
    if (data) {
      const parsed = JSON.parse(data)
      setCelular(parsed.celular)
    }
  }, [])

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const telefono = `+51${celular}`

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: telefono,
        token: otp,
        type: 'sms',
      })
      if (verifyError) throw verifyError
      if (!data.user) throw new Error('Verificación fallida')

      if (modoRegistro) {
        const regData = localStorage.getItem('ciclobici_registro')
        if (regData) {
          const { nombre, documento, correo, celular: cel } = JSON.parse(regData)
          const { error: insertError } = await supabase.from('usuarios').upsert({
            id: data.user.id,
            nombre,
            documento,
            correo,
            celular: cel,
            estado: 'activo',
            rol: 'ciudadano',
          })
          if (insertError) throw insertError
          localStorage.removeItem('ciclobici_registro')
        }
      } else {
        await supabase.from('usuarios').update({ estado: 'activo' }).eq('id', data.user.id)
      }

      setExito(true)
      setTimeout(() => router.push('/ciudadano/mapa'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código incorrecto o expirado')
    } finally {
      setLoading(false)
    }
  }

  if (exito) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-6">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
          <h2 className="text-xl font-bold mb-2">¡Celular Verificado!</h2>
          <p className="text-gray-600">Tu cuenta está activa. Redirigiendo...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verificar Celular</CardTitle>
        <CardDescription>
          {modoRegistro
            ? 'Ingresa el código enviado para activar tu cuenta'
            : 'Tu cuenta está pendiente de verificación. Ingresa el código OTP.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!celular && (
          <Alert variant="warning" className="mb-4">
            <AlertDescription>
              No se encontró información de registro. Por favor{' '}
              <a href="/registro" className="underline">regístrate nuevamente</a>.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={verificar} className="space-y-4">
          <div className="space-y-2">
            <Label>Código OTP de 6 dígitos</Label>
            <Input
              type="text"
              placeholder="123456"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
            />
            {celular && <p className="text-xs text-gray-500">Código enviado a +51{celular}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading || otp.length !== 6 || !celular}>
            {loading ? 'Verificando...' : 'Verificar Código'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function VerificacionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-full mb-3">
            <Phone className="text-blue-700" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">CicloBici</h1>
        </div>
        <Suspense fallback={<div className="text-white text-center">Cargando...</div>}>
          <VerificacionContent />
        </Suspense>
      </div>
    </div>
  )
}
