'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bicicleta, BicicletaEstado, Estacion } from '@/types'

interface EstacionConBicis extends Estacion {
  bicicletas?: { estado: string }[]
}
import { Plus, Search, QrCode, Download, Bike, X, FileText, ChevronDown, Pencil, Trash2, MapPin } from 'lucide-react'
import { generarCodigoBicicleta } from '@/lib/utils/codigos'
import { exportarCsv } from '@/lib/utils/exportCsv'
import { exportarPdf } from '@/lib/utils/exportPdf'

type FormBici = { tipo: string; marca: string; modelo: string; estacion_id: string; estado: BicicletaEstado }
const formVacio: FormBici = { tipo: '', marca: '', modelo: '', estacion_id: '', estado: 'disponible' }

const ESTADO_CHIP: Record<BicicletaEstado, string> = {
  disponible: 'chip-disponible', en_viaje: 'chip-en-uso',
  mantenimiento: 'chip-mantenimiento', baja: 'chip-baja',
}
const ESTADO_LABEL: Record<BicicletaEstado, string> = {
  disponible: 'Disponible', en_viaje: 'En viaje', mantenimiento: 'Mantenimiento', baja: 'Baja',
}

const inputCls = 'w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1'
const btnPrimary = 'inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary-container text-white text-sm font-bold shadow-sm hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50'
const btnOutline = 'inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-outline-variant/40 bg-white text-on-surface text-sm font-semibold hover:bg-surface-container-low active:scale-[.98] transition-all'

export default function BicicletasPage() {
  const [bicicletas, setBicicletas] = useState<Bicicleta[]>([])
  const [estaciones, setEstaciones] = useState<EstacionConBicis[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroEstacion, setFiltroEstacion] = useState('todas')
  const [modalNueva, setModalNueva] = useState(false)
  const [modalQr, setModalQr] = useState<Bicicleta | null>(null)
  const [form, setForm] = useState<FormBici>(formVacio)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [dropdownEst, setDropdownEst] = useState(false)
  const [modalEditar, setModalEditar] = useState<Bicicleta | null>(null)
  const [formEdit, setFormEdit] = useState<FormBici>(formVacio)
  const [dropdownEstEdit, setDropdownEstEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState('')
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [modalEliminar, setModalEliminar] = useState<Bicicleta | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [{ data: bicis }, { data: ests }] = await Promise.all([
      supabase.from('bicicletas').select('*, estacion:estaciones(nombre)').order('created_at', { ascending: false }),
      supabase.from('estaciones').select('*, bicicletas(estado)').eq('estado', 'activa').order('nombre'),
    ])
    if (bicis) setBicicletas(bicis)
    if (ests) setEstaciones(ests as EstacionConBicis[])
  }, [])

  useEffect(() => {
    cargar()
    // Tiempo real: cuando un ciudadano escanea/inicia/finaliza un viaje, la bici
    // cambia de estado (disponible → en_viaje → disponible) — sin esto, esta
    // página solo se actualizaba al recargar manualmente.
    const supabase = createClient()
    const ch = supabase.channel('bicicletas-admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  async function generarQR(codigo: string): Promise<string> {
    const QRCode = (await import('qrcode')).default
    return QRCode.toDataURL(codigo, { width: 256, margin: 2 })
  }

  async function abrirQr(bici: Bicicleta) {
    setModalQr(bici)
    const url = bici.qr_url ?? await generarQR(bici.codigo)
    setQrDataUrl(url)
  }

  function descargarQr() {
    if (!modalQr || !qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-${modalQr.codigo}.png`
    a.click()
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.tipo.trim()) { setError('El tipo es requerido'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { count } = await supabase.from('bicicletas').select('*', { count: 'exact', head: true })
      const codigo = generarCodigoBicicleta((count ?? 0) + 1)
      const qrUrl = await generarQR(codigo)

      const res = await fetch('/api/bicicletas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo, tipo: form.tipo.trim(), marca: form.marca || null,
          modelo: form.modelo || null, qr_url: qrUrl,
          estado: form.estado, estacion_id: form.estacion_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')

      setModalNueva(false)
      setForm(formVacio)
      await cargar()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(id: string, estado: BicicletaEstado) {
    const supabase = createClient()
    await supabase.from('bicicletas').update({ estado }).eq('id', id)
    await cargar()
  }

  function abrirEditar(b: Bicicleta) {
    setModalEditar(b)
    setFormEdit({ tipo: b.tipo, marca: b.marca ?? '', modelo: b.modelo ?? '', estacion_id: b.estacion_id ?? '', estado: b.estado })
    setErrorEdit('')
    setDropdownEstEdit(false)
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault()
    if (!modalEditar) return
    if (!formEdit.tipo.trim()) { setErrorEdit('El tipo es requerido'); return }
    setLoadingEdit(true)
    try {
      const res = await fetch(`/api/bicicletas/${modalEditar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: formEdit.tipo, marca: formEdit.marca || null, modelo: formEdit.modelo || null, estado: formEdit.estado, estacion_id: formEdit.estacion_id || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setModalEditar(null)
      await cargar()
    } catch (err: unknown) {
      setErrorEdit(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoadingEdit(false)
    }
  }

  async function ejecutarEliminar() {
    if (!modalEliminar) return
    setLoadingDelete(true)
    try {
      const res = await fetch(`/api/bicicletas/${modalEliminar.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar')
      setModalEliminar(null)
      await cargar()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setLoadingDelete(false)
    }
  }

  const filtradas = bicicletas.filter(b => {
    if (!b.codigo.toLowerCase().includes(filtro.toLowerCase())) return false
    if (filtroEstado !== 'todos' && b.estado !== filtroEstado) return false
    if (filtroEstacion === 'sin_asignar') return !b.estacion_id
    if (filtroEstacion !== 'todas') return b.estacion_id === filtroEstacion
    return true
  })

  return (
    <div className="p-6 space-y-5 max-w-[1300px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-primary-container">Bicicletas</h1>
          <p className="text-xs text-outline mt-0.5">Gestión de flota · QR automático</p>
        </div>
        <div className="flex gap-2">
          <button className={btnOutline} onClick={() => exportarCsv(bicicletas.map(b => {
            const est = b.estacion as unknown as { nombre: string } | null
            return { Código: b.codigo, Tipo: b.tipo, Marca: b.marca ?? '', Modelo: b.modelo ?? '', Estado: b.estado, Estación: est?.nombre ?? '' }
          }), 'bicicletas-sanborja')}>
            <Download size={14} /> CSV
          </button>
          <button className={btnOutline} onClick={() => exportarPdf({
            titulo: 'Reporte de Bicicletas',
            subtitulo: `Flota completa · San Borja en Bici`,
            columnas: ['Código', 'Tipo', 'Marca', 'Modelo', 'Estado', 'Estación'],
            filas: bicicletas.map(b => {
              const est = b.estacion as unknown as { nombre: string } | null
              return [b.codigo, b.tipo, b.marca ?? '', b.modelo ?? '', b.estado, est?.nombre ?? '—']
            }),
            nombreArchivo: 'bicicletas-sanborja',
          })}>
            <FileText size={14} /> PDF
          </button>
          <button className={btnPrimary} onClick={() => { setForm(formVacio); setError(''); setModalNueva(true) }}>
            <Plus size={16} /> Nueva Bicicleta
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['disponible', 'en_viaje', 'mantenimiento', 'baja'] as BicicletaEstado[]).map(e => (
          <div key={e} className={`card p-4 cursor-pointer transition-all ${filtroEstado === e ? 'ring-2 ring-primary-container' : ''}`}
            onClick={() => setFiltroEstado(filtroEstado === e ? 'todos' : e)}>
            <p className="text-2xl font-extrabold text-on-surface">{bicicletas.filter(b => b.estado === e).length}</p>
            <span className={`mt-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_CHIP[e]}`}>{ESTADO_LABEL[e]}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-3 text-outline" size={14} />
          <input placeholder="Buscar por código..." className={`${inputCls} pl-9`}
            value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        <select className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none"
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="en_viaje">En viaje</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="baja">Baja</option>
        </select>
        <select className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none max-w-[220px]"
          value={filtroEstacion} onChange={e => setFiltroEstacion(e.target.value)}>
          <option value="todas">Todas las estaciones</option>
          <option value="sin_asignar">— Sin asignar</option>
          {estaciones.map(e => {
            const ancladas = (e.bicicletas ?? []).length
            return (
              <option key={e.id} value={e.id}>
                {e.nombre} ({ancladas}/{e.capacidad})
              </option>
            )
          })}
        </select>
        {(filtroEstado !== 'todos' || filtroEstacion !== 'todas' || filtro) && (
          <button
            onClick={() => { setFiltro(''); setFiltroEstado('todos'); setFiltroEstacion('todas') }}
            className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-xs text-outline hover:bg-surface-container-low transition-colors flex items-center gap-1.5">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container-low">
              <th className="text-left px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase">Código</th>
              <th className="text-left px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase">Tipo / Marca</th>
              <th className="text-left px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase">Estado</th>
              <th className="text-left px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase">Estación</th>
              <th className="text-right px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filtradas.length === 0 && (
              <tr><td colSpan={5} className="text-center text-outline py-12 text-sm">Sin bicicletas</td></tr>
            )}
            {filtradas.map(b => (
              <tr key={b.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="px-5 py-3">
                  <span className="font-mono font-bold text-primary-container text-xs tracking-wide">{b.codigo}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Bike size={13} className="text-outline shrink-0" />
                    <span className="text-on-surface">{b.tipo}{b.marca ? ` · ${b.marca}` : ''}{b.modelo ? ` ${b.modelo}` : ''}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <select value={b.estado}
                    onChange={e => cambiarEstado(b.id, e.target.value as BicicletaEstado)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer bg-transparent focus:outline-none ${ESTADO_CHIP[b.estado]}`}>
                    {(['disponible', 'en_viaje', 'mantenimiento', 'baja'] as BicicletaEstado[]).map(e => (
                      <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3 text-outline text-xs">
                  {(b.estacion as unknown as { nombre?: string })?.nombre ?? '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => abrirQr(b)} title="Ver QR"
                      className="w-8 h-8 rounded-xl border border-outline-variant/40 bg-white hover:bg-surface-container-low flex items-center justify-center transition-all active:scale-95 text-outline hover:text-on-surface">
                      <QrCode size={14} />
                    </button>
                    <button onClick={() => abrirEditar(b)} title="Editar bicicleta"
                      className="w-8 h-8 rounded-xl border border-primary-container/30 bg-[#e5eeff] hover:bg-[#d0dcff] flex items-center justify-center transition-all active:scale-95 text-primary-container">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setModalEliminar(b)} title="Eliminar bicicleta"
                      className="w-8 h-8 rounded-xl border border-[#ffdad6] bg-[#fff0ef] hover:bg-[#ffdad6] flex items-center justify-center transition-all active:scale-95 text-error">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nueva Bicicleta */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <h2 className="font-extrabold text-on-surface">Nueva Bicicleta</h2>
              <button onClick={() => setModalNueva(false)} className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container transition-colors">
                <X size={16} className="text-outline" />
              </button>
            </div>
            {error && <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold">{error}</div>}
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Tipo *</label>
                <input className={inputCls} placeholder="Urbana, MTB, Eléctrica..."
                  value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Marca</label>
                  <input className={inputCls} placeholder="Trek, Giant..."
                    value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Modelo</label>
                  <input className={inputCls} placeholder="FX3, 2024..."
                    value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} />
                </div>
              </div>
              <div className="relative">
                <label className={labelCls}>Estación inicial</label>
                {/* Dropdown custom con capacidad en tiempo real */}
                <button type="button"
                  onClick={() => setDropdownEst(v => !v)}
                  className={inputCls + ' flex items-center justify-between text-left'}
                >
                  <span className={form.estacion_id ? 'text-on-surface' : 'text-outline'}>
                    {form.estacion_id
                      ? estaciones.find(e => e.id === form.estacion_id)?.nombre ?? 'Sin asignar'
                      : 'Sin asignar'}
                  </span>
                  <ChevronDown size={14} className={`text-outline transition-transform ${dropdownEst ? 'rotate-180' : ''}`} />
                </button>

                {dropdownEst && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-outline-variant/30 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {/* Sin asignar */}
                    <button type="button"
                      onClick={() => { setForm(p => ({ ...p, estacion_id: '' })); setDropdownEst(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-surface-container-low transition-colors ${!form.estacion_id ? 'bg-primary-container/10 font-semibold' : ''}`}
                    >
                      Sin asignar
                    </button>
                    <div className="border-t border-outline-variant/10" />
                    {estaciones.map(est => {
                      const ancladas = (est.bicicletas ?? []).length
                      const disponibles = (est.bicicletas ?? []).filter(b => b.estado === 'disponible').length
                      const llena = ancladas >= est.capacidad
                      const casiLlena = ancladas >= est.capacidad * 0.8
                      const badgeBg = llena ? '#ffdad6' : casiLlena ? '#fef3c7' : '#dcfce7'
                      const badgeText = llena ? '#ba1a1a' : casiLlena ? '#92400e' : '#166534'
                      const seleccionada = form.estacion_id === est.id
                      return (
                        <button type="button" key={est.id}
                          onClick={() => { setForm(p => ({ ...p, estacion_id: est.id })); setDropdownEst(false) }}
                          className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors ${seleccionada ? 'bg-primary-container/10' : ''}`}
                        >
                          <span className={`text-sm text-left ${seleccionada ? 'font-semibold text-on-surface' : 'text-on-surface'}`}>
                            {est.nombre}
                          </span>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-[10px] text-outline">{disponibles} disp.</span>
                            <span style={{ background: badgeBg, color: badgeText }}
                              className="text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                              {ancladas}/{est.capacidad}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Info card de la estación seleccionada */}
                {form.estacion_id && (() => {
                  const est = estaciones.find(e => e.id === form.estacion_id)
                  if (!est) return null
                  const ancladas = (est.bicicletas ?? []).length
                  const disponibles = (est.bicicletas ?? []).filter(b => b.estado === 'disponible').length
                  const libre = est.capacidad - ancladas
                  const pct = est.capacidad > 0 ? ancladas / est.capacidad : 0
                  const barColor = pct >= 0.9 ? '#ba1a1a' : pct >= 0.6 ? '#d97706' : '#16a34a'
                  return (
                    <div className="mt-2 px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-outline">Ocupación</span>
                        <span className="font-bold text-on-surface">{ancladas} / {est.capacidad} docks</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-outline-variant/20 overflow-hidden">
                        <div style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} className="h-full rounded-full" />
                      </div>
                      <div className="flex gap-3 text-[11px]">
                        <span className="text-[#166534]">✓ {disponibles} disponibles</span>
                        <span className="text-outline">· {libre} dock{libre !== 1 ? 's' : ''} libre{libre !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="px-4 py-3 rounded-xl bg-surface-container-low text-xs text-outline border border-outline-variant/20">
                El código (BC-YYYYMMDD-XXXX) y el QR se generarán automáticamente.
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className={btnOutline + ' flex-1'} onClick={() => setModalNueva(false)}>Cancelar</button>
                <button type="submit" className={btnPrimary + ' flex-1 justify-center'} disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Bicicleta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Bicicleta */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <div>
                <h2 className="font-extrabold text-on-surface">Editar Bicicleta</h2>
                <p className="font-mono text-xs text-outline mt-0.5">{modalEditar.codigo}</p>
              </div>
              <button onClick={() => setModalEditar(null)} className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container transition-colors">
                <X size={16} className="text-outline" />
              </button>
            </div>
            {errorEdit && <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold">{errorEdit}</div>}
            <form onSubmit={guardarEdicion} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Tipo *</label>
                <input className={inputCls} placeholder="Urbana, MTB, Eléctrica..."
                  value={formEdit.tipo} onChange={e => setFormEdit(p => ({ ...p, tipo: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Marca</label>
                  <input className={inputCls} placeholder="Trek, Giant..."
                    value={formEdit.marca} onChange={e => setFormEdit(p => ({ ...p, marca: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Modelo</label>
                  <input className={inputCls} placeholder="FX3, 2024..."
                    value={formEdit.modelo} onChange={e => setFormEdit(p => ({ ...p, modelo: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={formEdit.estado} onChange={e => setFormEdit(p => ({ ...p, estado: e.target.value as BicicletaEstado }))}>
                  {(['disponible', 'en_viaje', 'mantenimiento', 'baja'] as BicicletaEstado[]).map(e => (
                    <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                  ))}
                </select>
              </div>
              {/* Dropdown estación con capacidad */}
              <div className="relative">
                <label className={labelCls}>Estación asignada</label>
                <button type="button"
                  onClick={() => setDropdownEstEdit(v => !v)}
                  className={inputCls + ' flex items-center justify-between text-left'}
                >
                  <span className={formEdit.estacion_id ? 'text-on-surface' : 'text-outline'}>
                    {formEdit.estacion_id
                      ? estaciones.find(e => e.id === formEdit.estacion_id)?.nombre ?? 'Sin asignar'
                      : 'Sin asignar'}
                  </span>
                  <ChevronDown size={14} className={`text-outline transition-transform ${dropdownEstEdit ? 'rotate-180' : ''}`} />
                </button>
                {dropdownEstEdit && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-outline-variant/30 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    <button type="button"
                      onClick={() => { setFormEdit(p => ({ ...p, estacion_id: '' })); setDropdownEstEdit(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-surface-container-low transition-colors ${!formEdit.estacion_id ? 'bg-primary-container/10 font-semibold' : ''}`}>
                      Sin asignar
                    </button>
                    <div className="border-t border-outline-variant/10" />
                    {estaciones.map(est => {
                      const ancladas = (est.bicicletas ?? []).length
                      const disponibles = (est.bicicletas ?? []).filter(b => b.estado === 'disponible').length
                      const llena = ancladas >= est.capacidad
                      const casiLlena = ancladas >= est.capacidad * 0.8
                      const badgeBg = llena ? '#ffdad6' : casiLlena ? '#fef3c7' : '#dcfce7'
                      const badgeText = llena ? '#ba1a1a' : casiLlena ? '#92400e' : '#166534'
                      const seleccionada = formEdit.estacion_id === est.id
                      return (
                        <button type="button" key={est.id}
                          onClick={() => { setFormEdit(p => ({ ...p, estacion_id: est.id })); setDropdownEstEdit(false) }}
                          className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors ${seleccionada ? 'bg-primary-container/10' : ''}`}>
                          <span className={`text-sm text-left ${seleccionada ? 'font-semibold text-on-surface' : 'text-on-surface'}`}>{est.nombre}</span>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-[10px] text-outline">{disponibles} disp.</span>
                            <span style={{ background: badgeBg, color: badgeText }} className="text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                              {ancladas}/{est.capacidad}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                {formEdit.estacion_id && (() => {
                  const est = estaciones.find(e => e.id === formEdit.estacion_id)
                  if (!est) return null
                  const ancladas = (est.bicicletas ?? []).length
                  const libre = est.capacidad - ancladas
                  const pct = est.capacidad > 0 ? ancladas / est.capacidad : 0
                  const barColor = pct >= 0.9 ? '#ba1a1a' : pct >= 0.6 ? '#d97706' : '#16a34a'
                  return (
                    <div className="mt-2 px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-outline flex items-center gap-1"><MapPin size={10} /> {est.direccion}</span>
                        <span className="font-bold text-on-surface">{ancladas}/{est.capacidad} docks</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-outline-variant/20 overflow-hidden">
                        <div style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} className="h-full rounded-full" />
                      </div>
                      <span className="text-outline">{libre} dock{libre !== 1 ? 's' : ''} libre{libre !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })()}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className={btnOutline + ' flex-1'} onClick={() => setModalEditar(null)}>Cancelar</button>
                <button type="submit" className={btnPrimary + ' flex-1 justify-center'} disabled={loadingEdit}>
                  {loadingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {modalEliminar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              {/* Icono de alerta */}
              <div className="w-14 h-14 rounded-2xl bg-[#fff0ef] border-2 border-[#ffdad6] flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-error" />
              </div>
              <h2 className="text-center font-extrabold text-on-surface text-lg mb-1">¿Eliminar bicicleta?</h2>
              <p className="text-center text-sm text-outline mb-1">
                Vas a eliminar permanentemente
              </p>
              <p className="text-center font-mono font-bold text-primary-container text-base mb-4">
                {modalEliminar.codigo}
              </p>
              {modalEliminar.estado === 'en_viaje' && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[#fff0ef] border border-[#ffdad6] text-error text-xs font-semibold text-center">
                  Esta bicicleta está en viaje activo y no puede eliminarse.
                </div>
              )}
              <div className="flex gap-3">
                <button className={btnOutline + ' flex-1 justify-center'} onClick={() => setModalEliminar(null)}>
                  Cancelar
                </button>
                <button
                  disabled={loadingDelete || modalEliminar.estado === 'en_viaje'}
                  onClick={ejecutarEliminar}
                  className="flex-1 h-10 rounded-xl bg-error text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-40">
                  {loadingDelete ? 'Eliminando...' : <><Trash2 size={14} /> Eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR */}
      {modalQr && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <h2 className="font-extrabold text-on-surface">Código QR</h2>
              <button onClick={() => setModalQr(null)} className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container transition-colors">
                <X size={16} className="text-outline" />
              </button>
            </div>
            <div className="p-6 text-center space-y-4">
              <p className="font-mono font-bold text-primary-container text-lg">{modalQr.codigo}</p>
              {qrDataUrl && <img src={qrDataUrl} alt="QR" className="mx-auto rounded-xl border border-outline-variant/20" width={220} height={220} />}
              <button className={btnPrimary + ' w-full justify-center'} onClick={descargarQr}>
                <Download size={16} /> Descargar QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
