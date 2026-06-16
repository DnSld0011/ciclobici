'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bike, Leaf, Map, SlidersHorizontal, LogOut, CheckCircle, AlertCircle } from 'lucide-react'

interface Perfil {
  id: string
  nombre: string
  documento: string
  correo: string
  celular: string
  rol: string
  estado: string
}

interface ViajeHistorial {
  id: string
  inicio_at: string
  fin_at: string | null
  distancia_km: number | null
  duracion_min: number | null
  estacion_origen: { nombre: string } | null
  estacion_destino: { nombre: string } | null
}

function duracionStr(inicio: string, fin: string | null, duracion_min: number | null): string {
  if (!fin) return 'En curso'
  if (duracion_min != null) return `${duracion_min} min`
  const mins = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

function fechaRelativa(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hora} hrs`
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora} hrs`
  const dia = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
  return `${dia}, ${hora} hrs`
}

export default function PerfilCiudadanoPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [viajes, setViajes] = useState<ViajeHistorial[]>([])
  const [distanciaTotal, setDistanciaTotal] = useState(0)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nombre: '', correo: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: perfilData }, { data: viajesData }] = await Promise.all([
        supabase.from('usuarios').select('*').eq('id', user.id).single(),
        supabase
          .from('viajes')
          .select(`
            id, inicio_at, fin_at, distancia_km, duracion_min,
            estacion_origen:estacion_origen_id(nombre),
            estacion_destino:estacion_destino_id(nombre)
          `)
          .eq('usuario_id', user.id)
          .eq('estado', 'finalizado')
          .order('inicio_at', { ascending: false })
          .limit(20),
      ])

      if (perfilData) {
        setPerfil(perfilData)
        setForm({ nombre: perfilData.nombre, correo: perfilData.correo ?? '' })
      }
      if (viajesData) {
        setViajes(viajesData as unknown as ViajeHistorial[])
        const total = viajesData.reduce((s, v) => s + (v.distancia_km ?? 0), 0)
        setDistanciaTotal(Math.round(total * 10) / 10)
      }
      setLoading(false)
    }
    cargar()
  }, [router])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMensaje(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: form.nombre, correo: form.correo })
      .eq('id', perfil!.id)

    if (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    } else {
      setMensaje({ tipo: 'ok', texto: 'Datos actualizados' })
      setPerfil(prev => prev ? { ...prev, ...form } : prev)
      setTimeout(() => { setMensaje(null); setEditando(false) }, 2000)
    }
    setSaving(false)
  }

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const iniciales = perfil?.nombre
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  const co2 = Math.round(distanciaTotal * 0.21 * 10) / 10

  if (loading) return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl animate-pulse" style={{ height: i === 0 ? 200 : 120 }} />
      ))}
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">

      {/* Tarjeta de perfil */}
      <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-extrabold text-white"
          style={{ background: '#003527' }}
        >
          {iniciales}
        </div>
        <h1 className="text-xl font-extrabold" style={{ color: '#003527' }}>
          {perfil?.nombre}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
          Ciudadano Bicicleter@
        </p>

        {!editando ? (
          <button
            onClick={() => setEditando(true)}
            className="mt-5 w-full h-12 rounded-full font-bold text-sm transition-all active:scale-[.98]"
            style={{ background: '#b2f746', color: '#002117' }}
          >
            Editar Perfil
          </button>
        ) : (
          <div className="mt-5 text-left space-y-3">
            {mensaje && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${mensaje.tipo === 'ok' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-red-50 text-red-700'}`}>
                {mensaje.tipo === 'ok' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                {mensaje.texto}
              </div>
            )}
            <form onSubmit={guardar} className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold tracking-widest uppercase mb-1.5" style={{ color: '#6b7280' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  required
                  className="w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: '#e5e7eb' }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold tracking-widest uppercase mb-1.5" style={{ color: '#6b7280' }}>
                  Correo
                </label>
                <input
                  type="email"
                  value={form.correo}
                  onChange={e => setForm(p => ({ ...p, correo: e.target.value }))}
                  className="w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: '#e5e7eb' }}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setEditando(false); setMensaje(null) }}
                  className="flex-1 h-11 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-11 rounded-xl font-bold text-sm disabled:opacity-50"
                  style={{ background: '#b2f746', color: '#002117' }}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <Bike size={26} className="mx-auto mb-2" style={{ color: '#003527' }} />
          <p className="text-xs" style={{ color: '#6b7280' }}>Distancia</p>
          <p className="text-2xl font-extrabold mt-1" style={{ color: '#003527' }}>{distanciaTotal} km</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <Leaf size={26} className="mx-auto mb-2" style={{ color: '#003527' }} />
          <p className="text-xs" style={{ color: '#6b7280' }}>CO2 Evitado</p>
          <p className="text-2xl font-extrabold mt-1" style={{ color: '#003527' }}>{co2} kg</p>
        </div>
      </div>

      {/* Historial */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold" style={{ color: '#002117' }}>
            Historial de Recorridos
          </h2>
          <button className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#6b7280' }}>
            Filtrar <SlidersHorizontal size={14} />
          </button>
        </div>

        {viajes.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <Bike size={32} className="mx-auto mb-3" style={{ color: '#9ca3af' }} />
            <p className="font-semibold text-sm" style={{ color: '#6b7280' }}>Aún no tienes recorridos</p>
            <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Cuando uses una bicicleta, aparecerá aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {viajes.map(v => (
              <div
                key={v.id}
                className="bg-white rounded-2xl p-4 shadow-sm border-l-4"
                style={{ borderLeftColor: '#003527' }}
              >
                <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>
                  {fechaRelativa(v.inicio_at)}
                </p>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: '#f3f4f6' }}
                  >
                    <Map size={18} style={{ color: '#6b7280' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-sm font-bold leading-tight" style={{ color: '#111827' }}>
                        {v.estacion_origen?.nombre ?? '—'}
                      </p>
                      <span className="text-xs pt-0.5 shrink-0" style={{ color: '#9ca3af' }}>→</span>
                      <p className="text-sm font-bold leading-tight" style={{ color: '#111827' }}>
                        {v.estacion_destino?.nombre ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-extrabold" style={{ color: '#002117' }}>
                        {v.distancia_km != null ? `${v.distancia_km} km` : '—'}
                      </span>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>
                        {duracionStr(v.inicio_at, v.fin_at, v.duracion_min)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cerrar sesión */}
      <button
        onClick={cerrarSesion}
        className="w-full flex items-center justify-center gap-2 font-medium py-3 px-4 rounded-2xl text-sm transition-colors"
        style={{ border: '1px solid #fecaca', color: '#dc2626' }}
      >
        <LogOut size={15} />
        Cerrar sesión
      </button>

    </div>
  )
}
