'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Phone, Mail, CreditCard, Save, LogOut, CheckCircle, AlertCircle } from 'lucide-react'

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
        setForm({ nombre: data.nombre, correo: data.correo ?? '' })
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
      setTimeout(() => setMensaje(null), 3000)
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

  const iniciales = perfil?.nombre
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

      {/* Avatar header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white text-center">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
          {iniciales}
        </div>
        <h1 className="text-lg font-bold">{perfil?.nombre}</h1>
        <span className="inline-block mt-1 text-xs bg-white/20 px-3 py-1 rounded-full capitalize">{perfil?.rol}</span>
      </div>

      {/* Info de solo lectura */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
            <CreditCard size={15} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400">Documento</p>
            <p className="text-sm font-medium text-gray-900">{perfil?.documento}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
            <Phone size={15} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400">Celular</p>
            <p className="text-sm font-medium text-gray-900">+51 {perfil?.celular}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${perfil?.estado === 'activo' ? 'bg-green-50' : 'bg-gray-50'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${perfil?.estado === 'activo' ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400">Estado de cuenta</p>
            <p className={`text-sm font-medium capitalize ${perfil?.estado === 'activo' ? 'text-green-700' : 'text-gray-500'}`}>{perfil?.estado}</p>
          </div>
        </div>
      </div>

      {/* Formulario editable */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Datos personales</h2>

        {mensaje && (
          <div className={`flex items-center gap-2 text-sm p-3 rounded-lg mb-4 ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {mensaje.tipo === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <User size={12} className="inline mr-1" />Nombre completo
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <Mail size={12} className="inline mr-1" />Correo electrónico
            </label>
            <input
              type="email"
              value={form.correo}
              onChange={e => setForm(p => ({ ...p, correo: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            <Save size={15} />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      {/* Cerrar sesión */}
      <button
        onClick={cerrarSesion}
        className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
      >
        <LogOut size={15} />
        Cerrar sesión
      </button>
    </div>
  )
}
