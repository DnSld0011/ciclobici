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
import { validarCelularColombiano, validarDocumento } from '@/lib/utils/codigos'
import { Bike, CheckCircle } from 'lucide-react'

export default function RegistroPage() {
  const [form, setForm] = useState({
    nombre: '', documento: '', correo: '', celular: '',
  })
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
    if (!validarCelularColombiano(form.celular))
      return 'Celular inválido (debe ser colombiano: 10 dígitos, empieza por 3)'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validar()
    if (err) { setError(err); return }
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const telefono = `+57${form.celular}`

      // Create auth user via OTP
      const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
        phone: telefono,
        options: { shouldCreateUser: true },
      })
      if (authError) throw authError

      // Store registration data in localStorage to complete after OTP
      localStorage.setItem('ciclobici_registro', JSON.stringify({
        nombre: form.nombre.trim(),
        documento: form.documento,
        correo: form.correo,
        celular: form.celular,
      }))

      setExito(true)
      setTimeout(() => router.push('/verificacion?modo=registro'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
            <h2 className="text-xl font-bold mb-2">¡Registro Iniciado!</h2>
            <p className="text-gray-600">Te enviamos un código OTP al celular <strong>+57{form.celular}</strong>.</p>
            <p className="text-gray-500 text-sm mt-2">Redirigiendo a verificación...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-full mb-3">
            <Bike className="text-blue-700" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">CicloBici</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Crear Cuenta</CardTitle>
            <CardDescription>Regístrate para usar el sistema de bicicletas compartidas</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input id="nombre" name="nombre" placeholder="Juan García López" value={form.nombre} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documento">Número de Documento</Label>
                <Input id="documento" name="documento" placeholder="1234567890" value={form.documento}
                  onChange={e => setForm(p => ({ ...p, documento: e.target.value.replace(/\D/g, '') }))}
                  required maxLength={12} />
                <p className="text-xs text-gray-500">Solo números, sin puntos ni guiones</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="correo">Correo Electrónico</Label>
                <Input id="correo" name="correo" type="email" placeholder="usuario@correo.com" value={form.correo} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="celular">Celular Colombiano</Label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm">+57</span>
                  <Input id="celular" name="celular" type="tel" placeholder="3001234567"
                    value={form.celular}
                    onChange={e => setForm(p => ({ ...p, celular: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    required maxLength={10} />
                </div>
                <p className="text-xs text-gray-500">10 dígitos, empieza por 3</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Registrando...' : 'Crear Cuenta'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-gray-500">¿Ya tienes cuenta?</span>{' '}
              <Link href="/login" className="text-blue-700 hover:underline font-medium">Iniciar Sesión</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
