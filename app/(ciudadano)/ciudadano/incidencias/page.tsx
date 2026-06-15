'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Bike, CheckCircle, ChevronDown } from 'lucide-react'
import { IncidenciaTipo } from '@/types'

const TIPOS: { value: IncidenciaTipo; label: string; icon: string }[] = [
  { value: 'frenos',       label: 'Frenos',            icon: '🛑' },
  { value: 'llanta',       label: 'Llanta/Neumático',  icon: '🔴' },
  { value: 'cadena',       label: 'Cadena/Transmisión',icon: '⛓️' },
  { value: 'manillar',     label: 'Manillar',           icon: '🚲' },
  { value: 'asiento',      label: 'Asiento',            icon: '💺' },
  { value: 'iluminacion',  label: 'Iluminación',        icon: '💡' },
  { value: 'electrico',    label: 'Sistema eléctrico',  icon: '⚡' },
  { value: 'estructura',   label: 'Estructura/Marco',   icon: '🔧' },
  { value: 'otro',         label: 'Otro problema',      icon: '❓' },
]

interface BiciOpcion { id: string; codigo: string; estacion: { nombre: string } | null }
interface EstOpcion   { id: string; nombre: string }

export default function ReportarIncidenciaPage() {
  const [bicis, setBicis] = useState<BiciOpcion[]>([])
  const [estaciones, setEstaciones] = useState<EstOpcion[]>([])
  const [form, setForm] = useState({
    bicicleta_id: '',
    estacion_id: '',
    tipo: '' as IncidenciaTipo | '',
    descripcion: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: bs }, { data: es }] = await Promise.all([
        supabase.from('bicicletas')
          .select('id, codigo, estacion:estacion_id(nombre)')
          .in('estado', ['disponible', 'en_viaje'])
          .order('codigo'),
        supabase.from('estaciones')
          .select('id, nombre')
          .eq('estado', 'activa')
          .order('nombre'),
      ])
      if (bs) setBicis(bs as unknown as BiciOpcion[])
      if (es) setEstaciones(es as EstOpcion[])
    }
    cargar()
  }, [router, supabase])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo) { setError('Selecciona el tipo de problema'); return }
    setEnviando(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('incidencias').insert({
      usuario_id:   user.id,
      bicicleta_id: form.bicicleta_id || null,
      estacion_id:  form.estacion_id  || null,
      tipo:         form.tipo,
      descripcion:  form.descripcion  || null,
    })

    if (err) { setError(err.message); setEnviando(false); return }
    setExito(true)
  }

  if (exito) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-surface text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-[#dcfce7] flex items-center justify-center">
        <CheckCircle size={36} className="text-[#166534]" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-on-surface">Reporte enviado</h2>
        <p className="text-sm text-on-surface-variant mt-1">El equipo técnico revisará la incidencia pronto. ¡Gracias por ayudarnos!</p>
      </div>
      <button
        onClick={() => router.push('/ciudadano')}
        className="bg-primary-container text-white font-bold px-8 py-3 rounded-2xl text-sm shadow-md"
      >
        Volver al inicio
      </button>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#fef9c3] rounded-xl flex items-center justify-center">
          <AlertTriangle size={20} className="text-[#854d0e]" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-on-surface">Reportar incidencia</h1>
          <p className="text-xs text-on-surface-variant">Ayúdanos a mantener la flota en buen estado</p>
        </div>
      </div>

      <form onSubmit={enviar} className="space-y-4">

        {/* Tipo de problema */}
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2">Tipo de problema *</p>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                className={`p-3 rounded-xl border text-left transition-all text-xs
                  ${form.tipo === t.value
                    ? 'border-primary-container bg-[#e5eeff] text-primary-container font-bold'
                    : 'border-outline-variant bg-white text-on-surface-variant hover:border-primary-container/40'}`}
              >
                <span className="text-lg block mb-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bicicleta */}
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Bike size={12} /> Bicicleta afectada
          </label>
          <div className="relative">
            <select
              value={form.bicicleta_id}
              onChange={e => setForm(f => ({ ...f, bicicleta_id: e.target.value }))}
              className="w-full appearance-none px-3 py-2.5 text-sm border border-outline-variant rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container pr-8"
            >
              <option value="">— No sé el código —</option>
              {bicis.map(b => (
                <option key={b.id} value={b.id}>
                  {b.codigo}{b.estacion ? ` · ${b.estacion.nombre}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
          </div>
        </div>

        {/* Estación */}
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Estación donde ocurrió</label>
          <div className="relative">
            <select
              value={form.estacion_id}
              onChange={e => setForm(f => ({ ...f, estacion_id: e.target.value }))}
              className="w-full appearance-none px-3 py-2.5 text-sm border border-outline-variant rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container pr-8"
            >
              <option value="">— Seleccionar estación —</option>
              {estaciones.map(es => (
                <option key={es.id} value={es.id}>{es.nombre}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Descripción adicional</label>
          <textarea
            rows={3}
            value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            placeholder="Describe el problema con más detalle..."
            className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-error bg-error-container px-3 py-2 rounded-xl">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando || !form.tipo}
          className="w-full bg-primary-container disabled:bg-outline-variant text-white font-bold py-4 rounded-2xl text-sm shadow-md active:scale-[0.98] transition-all"
        >
          {enviando ? 'Enviando...' : 'Enviar reporte'}
        </button>
      </form>
    </div>
  )
}
