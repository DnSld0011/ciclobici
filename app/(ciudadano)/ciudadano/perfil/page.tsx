'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { User, Phone, Mail, CreditCard, Save, LogOut } from 'lucide-react'

interface Perfil {
  id: string
  nombre: string
  documento: string
  correo: string
  celular: string
  rol: string
  estado: string
}

export default function PerfilCiudadanoPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [form, setForm] = useState({ nombre: '', correo: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setPerfil(data)
        setForm({ nombre: data.nombre, correo: data.correo })
      }
      setLoading(false)
    }
    cargar()
  }, [router, supabase])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMensaje(null)
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: form.nombre, correo: form.correo })
      .eq('id', perfil!.id)

    if (error) setMensaje({ tipo: 'error', texto: error.message })
    else {
      setMensaje({ tipo: 'ok', texto: 'Datos actualizados correctamente' })
      setPerfil(prev => prev ? { ...prev, ...form } : prev)
    }
    setSaving(false)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto p-4 py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="text-blue-600" size={28} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{perfil?.nombre}</h1>
          <Badge variant="secondary" className="capitalize">{perfil?.rol}</Badge>
        </div>
      </div>

      {/* Datos de solo lectura */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información de cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <CreditCard size={16} className="text-gray-400 shrink-0" />
            <div>
              <p className="text-gray-500 text-xs">Documento</p>
              <p className="font-medium">{perfil?.documento}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone size={16} className="text-gray-400 shrink-0" />
            <div>
              <p className="text-gray-500 text-xs">Celular</p>
              <p className="font-medium">+51 {perfil?.celular}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className={`w-2 h-2 rounded-full shrink-0 ${perfil?.estado === 'activo' ? 'bg-green-500' : 'bg-gray-400'}`} />
            <div>
              <p className="text-gray-500 text-xs">Estado de cuenta</p>
              <p className="font-medium capitalize">{perfil?.estado}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario editable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editar datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          {mensaje && (
            <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'} className="mb-4">
              <AlertDescription>{mensaje.texto}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="correo">
                <Mail size={14} className="inline mr-1" />Correo electrónico
              </Label>
              <Input
                id="correo"
                type="email"
                value={form.correo}
                onChange={e => setForm(p => ({ ...p, correo: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Cerrar sesión */}
      <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={cerrarSesion}>
        <LogOut size={16} />
        Cerrar sesión
      </Button>
    </div>
  )
}
