'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bicicleta, BicicletaEstado, Estacion } from '@/types'
import { Plus, Search, QrCode, Download, Bike, X, FileText } from 'lucide-react'
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
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modalNueva, setModalNueva] = useState(false)
  const [modalQr, setModalQr] = useState<Bicicleta | null>(null)
  const [form, setForm] = useState<FormBici>(formVacio)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [{ data: bicis }, { data: ests }] = await Promise.all([
      supabase.from('bicicletas').select('*, estacion:estaciones(nombre)').order('created_at', { ascending: false }),
      supabase.from('estaciones').select('*').eq('estado', 'activa').order('nombre'),
    ])
    if (bicis) setBicicletas(bicis)
    if (ests) setEstaciones(ests)
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

  const filtradas = bicicletas.filter(b =>
    b.codigo.toLowerCase().includes(filtro.toLowerCase()) &&
    (filtroEstado === 'todos' || b.estado === filtroEstado)
  )

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
      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
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
                  <button className={btnOutline + ' text-xs px-3 h-8'} onClick={() => abrirQr(b)}>
                    <QrCode size={13} /> QR
                  </button>
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
              <div>
                <label className={labelCls}>Estación inicial</label>
                <select className={inputCls} value={form.estacion_id} onChange={e => setForm(p => ({ ...p, estacion_id: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
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
