'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mantenimiento, Bicicleta } from '@/types'
import { Plus, Search, Wrench, CheckCircle, X, CalendarDays } from 'lucide-react'

const TIPOS = [
  'Mantenimiento Preventivo', 'Reparación de Frenos', 'Cambio de Neumático',
  'Lubricación de Cadena', 'Ajuste de Marcha', 'Revisión Eléctrica',
  'Reemplazo de Sillín', 'Reparación de Manubrio', 'Revisión General',
]

const inputCls = 'w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1'
const btnPrimary = 'inline-flex items-center gap-2 px-4 h-10 rounded-xl font-bold text-sm shadow-sm active:scale-[.98] transition-all disabled:opacity-50'

export default function TecnicoMantenimientoPage() {
  const [registros, setRegistros] = useState<Mantenimiento[]>([])
  const [bicicletas, setBicicletas] = useState<Bicicleta[]>([])
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [busquedaBici, setBusquedaBici] = useState('')
  const [form, setForm] = useState({
    bicicleta_id: '', tipo_intervencion: '', descripcion: '',
    responsable: '', fecha: new Date().toISOString().slice(0, 16),
    dejar_disponible: true,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: perfil } = await supabase.from('usuarios').select('nombre').eq('id', user?.id ?? '').single()
    const { data } = await supabase
      .from('mantenimientos')
      .select('*, bicicleta:bicicletas(codigo, tipo, marca)')
      .eq('responsable', perfil?.nombre ?? '')
      .order('fecha', { ascending: false })
    if (data) setRegistros(data)
    if (perfil?.nombre) setForm(p => ({ ...p, responsable: perfil.nombre }))
  }, [])

  const cargarBicis = useCallback(async (busqueda: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('bicicletas').select('*').ilike('codigo', `%${busqueda}%`).limit(8)
    if (data) setBicicletas(data)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (busquedaBici.length >= 2) cargarBicis(busquedaBici) }, [busquedaBici, cargarBicis])

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!form.bicicleta_id) { setError('Selecciona una bicicleta'); return }
    if (!form.tipo_intervencion) { setError('Selecciona el tipo'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('mantenimientos').insert({
        bicicleta_id: form.bicicleta_id, tipo_intervencion: form.tipo_intervencion,
        descripcion: form.descripcion || null, responsable: form.responsable.trim(),
        fecha: new Date(form.fecha).toISOString(),
      })
      if (err) throw err
      await supabase.from('bicicletas')
        .update({ estado: form.dejar_disponible ? 'disponible' : 'mantenimiento' })
        .eq('id', form.bicicleta_id)
      setModalAbierto(false)
      setBusquedaBici('')
      setForm(p => ({ ...p, bicicleta_id: '', tipo_intervencion: '', descripcion: '' }))
      setBicicletas([])
      await cargar()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  const filtrados = registros.filter(m => {
    const bici = m.bicicleta as unknown as { codigo: string } | null
    return !filtroCodigo || (bici?.codigo ?? '').toLowerCase().includes(filtroCodigo.toLowerCase())
  })

  const bicicletaSeleccionada = bicicletas.find(b => b.id === form.bicicleta_id)
  const thisMonth = registros.filter(m => new Date(m.fecha).getMonth() === new Date().getMonth()).length

  return (
    <div className="p-4 md:p-6 pt-16 md:pt-6 space-y-5 max-w-[1000px]">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container">Mis Mantenimientos</h1>
          <p className="text-xs text-outline mt-0.5">Intervenciones registradas por ti</p>
        </div>
        <button className={`${btnPrimary} bg-primary-container text-white`}
          onClick={() => { setError(''); setModalAbierto(true) }}>
          <Plus size={16} /> Registrar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total intervenciones', value: registros.length, icon: Wrench },
          { label: 'Este mes', value: thisMonth, icon: CalendarDays },
          { label: 'Tipos distintos', value: [...new Set(registros.map(r => r.tipo_intervencion))].length, icon: CheckCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-on-surface">{value}</p>
              <p className="text-xs text-outline mt-0.5">{label}</p>
            </div>
            <Icon size={20} className="text-outline-variant" />
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-outline" size={14} />
          <input className={`${inputCls} pl-9`} placeholder="Filtrar por código de bicicleta..."
            value={filtroCodigo} onChange={e => setFiltroCodigo(e.target.value)} />
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container-low">
              {['Bicicleta', 'Tipo', 'Descripción', 'Fecha'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filtrados.length === 0 && (
              <tr><td colSpan={4} className="text-center text-outline py-12 text-sm">Sin registros</td></tr>
            )}
            {filtrados.map(m => {
              const bici = m.bicicleta as unknown as { codigo: string; tipo: string } | null
              return (
                <tr key={m.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Wrench size={13} className="text-outline shrink-0" />
                      <span className="font-mono font-bold text-primary-container text-xs">{bici?.codigo}</span>
                      <span className="text-outline text-xs">{bici?.tipo}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-on-surface">{m.tipo_intervencion}</td>
                  <td className="px-5 py-3 text-outline text-xs max-w-48 truncate">{m.descripcion ?? '—'}</td>
                  <td className="px-5 py-3 text-outline text-xs whitespace-nowrap">
                    {new Date(m.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <h2 className="font-extrabold text-on-surface">Registrar Mantenimiento</h2>
              <button onClick={() => setModalAbierto(false)} className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container transition-colors">
                <X size={16} className="text-outline" />
              </button>
            </div>
            {error && <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold">{error}</div>}
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Bicicleta</label>
                <input className={inputCls} placeholder="BC-..."
                  value={busquedaBici}
                  onChange={e => { setBusquedaBici(e.target.value); setForm(p => ({ ...p, bicicleta_id: '' })) }} />
                {bicicletas.length > 0 && !bicicletaSeleccionada && (
                  <div className="mt-1 border border-outline-variant/30 rounded-xl divide-y divide-outline-variant/10 max-h-40 overflow-auto shadow-sm">
                    {bicicletas.map(b => (
                      <button key={b.id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low text-sm flex items-center justify-between"
                        onClick={() => { setForm(p => ({ ...p, bicicleta_id: b.id })); setBusquedaBici(b.codigo) }}>
                        <span className="font-mono font-bold text-primary-container">{b.codigo}</span>
                        <span className="text-outline text-xs">{b.tipo} {b.marca}</span>
                      </button>
                    ))}
                  </div>
                )}
                {bicicletaSeleccionada && (
                  <p className="text-xs text-[#166534] mt-1 font-semibold flex items-center gap-1">
                    <CheckCircle size={12} /> {bicicletaSeleccionada.codigo} — {bicicletaSeleccionada.tipo}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Tipo de intervención</label>
                <select className={inputCls} value={form.tipo_intervencion}
                  onChange={e => setForm(p => ({ ...p, tipo_intervencion: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Descripción (opcional)</label>
                <textarea className={`${inputCls} h-auto py-3 resize-none`} rows={2}
                  placeholder="Detalles de la intervención..."
                  value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
              </div>

              <div>
                <label className={labelCls}>Fecha y hora</label>
                <input type="datetime-local" className={inputCls}
                  value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} required />
              </div>

              <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#003527]"
                  checked={form.dejar_disponible}
                  onChange={e => setForm(p => ({ ...p, dejar_disponible: e.target.checked }))} />
                <span className="text-sm text-on-surface">Marcar bicicleta como disponible al terminar</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button"
                  className="flex-1 h-10 rounded-xl border border-outline-variant/40 bg-white text-on-surface text-sm font-semibold hover:bg-surface-container-low transition-all"
                  onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" disabled={loading}
                  className={`${btnPrimary} flex-1 justify-center bg-primary-container text-white`}>
                  {loading ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
