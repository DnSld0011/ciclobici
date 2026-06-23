'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Estacion, EstacionEstado } from '@/types'
import { Plus, Search, Pencil, Trash2, Building2, MapPin, X, Download, FileText } from 'lucide-react'
import { validarCoordenadas } from '@/lib/utils/codigos'
import { exportarCsv } from '@/lib/utils/exportCsv'
import { exportarPdf } from '@/lib/utils/exportPdf'

const MapaPicker = dynamicImport(
  () => import('@/components/maps/MapaPicker').then(m => m.MapaPicker),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-container-low rounded-xl animate-pulse" /> }
)

type FormEstacion = {
  nombre: string; direccion: string; latitud: string
  longitud: string; capacidad: string; estado: EstacionEstado
}
const formVacio: FormEstacion = { nombre: '', direccion: '', latitud: '', longitud: '', capacidad: '', estado: 'activa' }

const ESTADO_CHIP: Record<EstacionEstado, string> = {
  activa: 'chip-disponible', inactiva: 'chip-baja', mantenimiento: 'chip-mantenimiento',
}
const ESTADO_LABEL: Record<EstacionEstado, string> = {
  activa: 'Activa', inactiva: 'Inactiva', mantenimiento: 'Mantenimiento',
}

const inputCls = 'w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1'
const btnPrimary = 'inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary-container text-white text-sm font-bold shadow-sm hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50'
const btnOutline = 'inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-outline-variant/40 bg-white text-on-surface text-sm font-semibold hover:bg-surface-container-low active:scale-[.98] transition-all'
const btnGhost = 'w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-container-low transition-colors'

interface EstacionConBicis extends Estacion {
  bicicletas?: { estado: string }[]
}

export default function EstacionesPage() {
  const [estaciones, setEstaciones] = useState<EstacionConBicis[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Estacion | null>(null)
  const [form, setForm] = useState<FormEstacion>(formVacio)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(estado)')
      .order('nombre')
    if (data) setEstaciones(data as EstacionConBicis[])
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('estaciones-admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  function abrirCrear() {
    setEditando(null); setForm(formVacio); setError(''); setModalAbierto(true)
  }

  function abrirEditar(est: Estacion) {
    setEditando(est)
    setForm({
      nombre: est.nombre, direccion: est.direccion,
      latitud: String(est.latitud), longitud: String(est.longitud),
      capacidad: String(est.capacidad), estado: est.estado,
    })
    setError(''); setModalAbierto(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError('')
    const lat = parseFloat(form.latitud), lng = parseFloat(form.longitud), cap = parseInt(form.capacidad)
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.latitud || !form.longitud) { setError('Selecciona la ubicación en el mapa'); return }
    if (!validarCoordenadas(lat, lng)) { setError('Coordenadas inválidas'); return }
    if (!cap || cap <= 0) { setError('La capacidad debe ser mayor a 0'); return }
    setLoading(true)
    const supabase = createClient()
    const payload = {
      nombre: form.nombre.trim(), direccion: form.direccion.trim(),
      latitud: lat, longitud: lng, capacidad: cap, estado: form.estado,
    }
    try {
      if (editando) {
        const { error: err } = await supabase.from('estaciones').update(payload).eq('id', editando.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('estaciones').insert(payload)
        if (err) throw err
      }
      setModalAbierto(false); await cargar()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta estación?')) return
    const supabase = createClient()
    await supabase.from('estaciones').delete().eq('id', id)
    await cargar()
  }

  async function toggleEstado(est: Estacion) {
    const nuevo = est.estado === 'activa' ? 'inactiva' : 'activa'
    const supabase = createClient()
    await supabase.from('estaciones').update({ estado: nuevo }).eq('id', est.id)
    await cargar()
  }

  const filtradas = estaciones.filter(e =>
    e.nombre.toLowerCase().includes(filtro.toLowerCase()) &&
    (filtroEstado === 'todos' || e.estado === filtroEstado)
  )

  const activas = estaciones.filter(e => e.estado === 'activa').length
  const mantenimiento = estaciones.filter(e => e.estado === 'mantenimiento').length
  const inactivas = estaciones.filter(e => e.estado === 'inactiva').length

  return (
    <div className="p-6 space-y-5 max-w-[1300px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container">Estaciones</h1>
          <p className="text-xs text-outline mt-0.5">Administración de estaciones · San Borja en Bici</p>
        </div>
        <div className="flex gap-2">
          <button className={btnOutline} onClick={() => exportarCsv(estaciones.map(e => ({
            Nombre: e.nombre, Dirección: e.direccion, Latitud: e.latitud,
            Longitud: e.longitud, Capacidad: e.capacidad, Estado: e.estado,
          })), 'estaciones-sanborja')}>
            <Download size={14} /> CSV
          </button>
          <button className={btnOutline} onClick={() => exportarPdf({
            titulo: 'Reporte de Estaciones',
            subtitulo: `Estado de las estaciones · San Borja en Bici`,
            columnas: ['Nombre', 'Dirección', 'Capacidad', 'Estado', 'Latitud', 'Longitud'],
            filas: estaciones.map(e => [e.nombre, e.direccion, e.capacidad, e.estado, e.latitud, e.longitud]),
            nombreArchivo: 'estaciones-sanborja',
            orientacion: 'landscape',
          })}>
            <FileText size={14} /> PDF
          </button>
          <button className={btnPrimary} onClick={abrirCrear}>
            <Plus size={16} /> Nueva Estación
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Activas', value: activas, chip: 'chip-disponible' },
          { label: 'Mantenimiento', value: mantenimiento, chip: 'chip-mantenimiento' },
          { label: 'Inactivas', value: inactivas, chip: 'chip-baja' },
        ].map(({ label, value, chip }) => (
          <div key={label} className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-on-surface">{value}</p>
              <p className="text-xs text-outline mt-0.5">{label}</p>
            </div>
            <Building2 size={20} className="text-outline-variant" />
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-outline" size={14} />
          <input placeholder="Buscar por nombre..." className={`${inputCls} pl-9`}
            value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        <select className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none"
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="activa">Activas</option>
          <option value="inactiva">Inactivas</option>
          <option value="mantenimiento">Mantenimiento</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container-low">
              {['Nombre', 'Dirección', 'Capacidad', 'Coordenadas', 'Estado', ''].map(h => (
                <th key={h} className={`px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase ${h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filtradas.length === 0 && (
              <tr><td colSpan={6} className="text-center text-outline py-12 text-sm">No se encontraron estaciones</td></tr>
            )}
            {filtradas.map(est => (
              <tr key={est.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 font-semibold text-on-surface">
                    <Building2 size={14} className="text-outline shrink-0" />
                    {est.nombre}
                  </div>
                </td>
                <td className="px-5 py-3 text-outline text-xs">
                  <div className="flex items-center gap-1">
                    <MapPin size={11} className="shrink-0" />
                    {est.direccion}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {(() => {
                    const bicis = est.bicicletas ?? []
                    const ancladas = bicis.length
                    const disponibles = bicis.filter(b => b.estado === 'disponible').length
                    const cap = est.capacidad
                    const pct = cap > 0 ? ancladas / cap : 0
                    const barColor = pct >= 0.9 ? '#ba1a1a' : pct >= 0.6 ? '#d97706' : '#16a34a'
                    return (
                      <div className="min-w-[90px]">
                        <div className="flex items-baseline gap-1">
                          <span className="font-extrabold text-sm text-on-surface">{ancladas}</span>
                          <span className="text-xs text-outline font-medium">/ {cap}</span>
                        </div>
                        {/* Barra de ocupación */}
                        <div className="mt-1 h-1.5 w-16 rounded-full bg-surface-container-low overflow-hidden">
                          <div style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} className="h-full rounded-full transition-all" />
                        </div>
                        <p className="text-[10px] text-outline mt-0.5">
                          {disponibles} disp.
                        </p>
                      </div>
                    )
                  })()}
                </td>
                <td className="px-5 py-3 font-mono text-[11px] text-outline">
                  {est.latitud.toFixed(4)}, {est.longitud.toFixed(4)}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ESTADO_CHIP[est.estado]}`}>
                    {ESTADO_LABEL[est.estado]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button className={btnOutline + ' text-xs px-3 h-8'}
                      onClick={() => toggleEstado(est)}>
                      {est.estado === 'activa' ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className={btnGhost} onClick={() => abrirEditar(est)}>
                      <Pencil size={14} className="text-outline" />
                    </button>
                    <button className={btnGhost} onClick={() => eliminar(est.id)}>
                      <Trash2 size={14} className="text-error" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <h2 className="font-extrabold text-on-surface">{editando ? 'Editar Estación' : 'Nueva Estación'}</h2>
              <button onClick={() => setModalAbierto(false)} className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container transition-colors">
                <X size={16} className="text-outline" />
              </button>
            </div>
            {error && <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold">{error}</div>}
            <form onSubmit={guardar} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className={labelCls}>Nombre</label>
                <input className={inputCls} value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Dirección</label>
                <input className={inputCls} value={form.direccion}
                  onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} required />
              </div>
              {/* Mapa picker */}
              <div>
                <label className={labelCls}>Ubicación en el mapa *</label>
                <div className="w-full h-52 rounded-xl overflow-hidden border border-outline-variant/40">
                  <MapaPicker
                    lat={form.latitud ? parseFloat(form.latitud) : null}
                    lng={form.longitud ? parseFloat(form.longitud) : null}
                    onChange={(lat, lng) => setForm(p => ({ ...p, latitud: String(lat), longitud: String(lng) }))}
                  />
                </div>
              </div>

              {/* Lat / Lng — solo lectura, se rellenan desde el mapa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Latitud</label>
                  <input
                    readOnly
                    tabIndex={-1}
                    className={inputCls + ' bg-surface-container-low cursor-not-allowed select-none text-outline'}
                    placeholder="Se obtiene del mapa"
                    value={form.latitud}
                  />
                </div>
                <div>
                  <label className={labelCls}>Longitud</label>
                  <input
                    readOnly
                    tabIndex={-1}
                    className={inputCls + ' bg-surface-container-low cursor-not-allowed select-none text-outline'}
                    placeholder="Se obtiene del mapa"
                    value={form.longitud}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Capacidad</label>
                  <input type="number" min="1" className={inputCls}
                    value={form.capacidad} onChange={e => setForm(p => ({ ...p, capacidad: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <select className={inputCls} value={form.estado}
                    onChange={e => setForm(p => ({ ...p, estado: e.target.value as EstacionEstado }))}>
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className={btnOutline + ' flex-1'} onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" className={btnPrimary + ' flex-1 justify-center'} disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
