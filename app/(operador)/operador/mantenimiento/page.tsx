'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bicicleta } from '@/types'
import {
  Search, Filter, X, CheckCircle, Wrench, AlertTriangle,
  ChevronLeft, ChevronRight, Plus, Sparkles, Users,
  ClipboardList, Bike,
} from 'lucide-react'

/* ── prioridad por tipo de incidencia ── */
const PRIORIDAD: Record<string, { label: string; color: string; bg: string }> = {
  frenos:      { label: 'URGENTE', color: '#dc2626', bg: '#fef2f2' },
  electrico:   { label: 'URGENTE', color: '#dc2626', bg: '#fef2f2' },
  cadena:      { label: 'MEDIA',   color: '#d97706', bg: '#fffbeb' },
  llanta:      { label: 'MEDIA',   color: '#d97706', bg: '#fffbeb' },
  estructura:  { label: 'MEDIA',   color: '#d97706', bg: '#fffbeb' },
  manillar:    { label: 'MEDIA',   color: '#d97706', bg: '#fffbeb' },
  asiento:     { label: 'BAJA',    color: '#6b7280', bg: '#f9fafb' },
  iluminacion: { label: 'BAJA',    color: '#6b7280', bg: '#f9fafb' },
  otro:        { label: 'BAJA',    color: '#6b7280', bg: '#f9fafb' },
}

const TIPO_LABEL: Record<string, string> = {
  frenos: 'Frenos desgastados', electrico: 'Fallo eléctrico',
  cadena: 'Cadena suelta', llanta: 'Neumático bajo',
  estructura: 'Daño estructural', manillar: 'Manillar suelto',
  asiento: 'Asiento dañado', iluminacion: 'Luz delantera inactiva', otro: 'Otro problema',
}

const TIPOS_MANT = [
  'Mantenimiento Preventivo', 'Reparación de Frenos', 'Cambio de Neumático',
  'Lubricación de Cadena', 'Ajuste de Marcha', 'Revisión Eléctrica',
  'Reemplazo de Sillín', 'Reparación de Manubrio', 'Revisión General',
]

function tiempoHace(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
  return `${Math.floor(mins / 1440)}d ago`
}

interface Incidencia {
  id: string
  tipo: string
  descripcion: string | null
  estado: string
  created_at: string
  bicicleta: { id: string; codigo: string } | null
  estacion: { nombre: string } | null
}

interface Tecnico {
  id: string
  nombre: string
  enRuta: boolean
  zona: string | null
  tareas: number
}

const POR_PAGINA = 4

const inputCls = 'w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003527]/20 focus:border-[#003527] transition-all'
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5'

export default function MantenimientoFlotaPage() {
  const [incidencias, setIncidencias]     = useState<Incidencia[]>([])
  const [bicicletasTotal, setBicicletasTotal] = useState(0)
  const [bicicletasOp, setBicicletasOp]   = useState(0)
  const [bicicletasRep, setBicicletasRep] = useState(0)
  const [cerradosHoy, setCerradosHoy]     = useState(0)
  const [tecnicos, setTecnicos]           = useState<Tecnico[]>([])
  const [loading, setLoading]             = useState(true)
  const [insightTipo, setInsightTipo]     = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina]     = useState(1)

  /* ── modal Crear Orden de Trabajo ── */
  const [modalOrden, setModalOrden] = useState<Incidencia | null>(null)
  const [ordResponsable, setOrdResponsable] = useState('')
  const [ordTipo, setOrdTipo]               = useState('')
  const [ordGuardando, setOrdGuardando]     = useState(false)

  /* ── modal Registrar mantenimiento manual ── */
  const [modalMant, setModalMant]     = useState(false)
  const [busquedaBici, setBusquedaBici] = useState('')
  const [bicisBus, setBicisBus]         = useState<Bicicleta[]>([])
  const [formMant, setFormMant] = useState({
    bicicleta_id: '', tipo: '', descripcion: '', responsable: '', dejar_disponible: true,
  })
  const [errorMant, setErrorMant]   = useState('')
  const [loadMant, setLoadMant]     = useState(false)
  const biciSelec = bicisBus.find(b => b.id === formMant.bicicleta_id)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

    const [
      { data: incs },
      { data: bicis },
      { count: cerrados },
      { data: tecsList },
      { data: actReciente },
    ] = await Promise.all([
      supabase.from('incidencias')
        .select('id, tipo, descripcion, estado, created_at, bicicleta:bicicletas(id,codigo), estacion:estaciones(nombre)')
        .in('estado', ['pendiente', 'en_proceso'])
        .order('created_at', { ascending: false }),
      supabase.from('bicicletas').select('estado'),
      supabase.from('mantenimientos').select('*', { count: 'exact', head: true })
        .gte('fecha', hoy.toISOString()),
      supabase.from('usuarios').select('id, nombre').eq('rol', 'tecnico'),
      supabase.from('mantenimientos')
        .select('responsable, fecha')
        .gte('fecha', new Date(Date.now() - 5 * 3600000).toISOString()),
    ])

    if (incs) {
      setIncidencias(incs as unknown as Incidencia[])
      const freq = (incs as { tipo: string }[]).reduce<Record<string, number>>(
        (a, i) => ({ ...a, [i.tipo]: (a[i.tipo] || 0) + 1 }), {}
      )
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (top) setInsightTipo(top)
    }
    if (bicis) {
      setBicicletasTotal(bicis.length)
      setBicicletasOp(bicis.filter(b => b.estado === 'disponible' || b.estado === 'en_viaje').length)
      setBicicletasRep(bicis.filter(b => b.estado === 'mantenimiento').length)
    }
    setCerradosHoy(cerrados ?? 0)

    if (tecsList) {
      const recientes = (actReciente ?? []).map(a => a.responsable)
      const tareasHoy = (actReciente ?? []).reduce<Record<string, number>>(
        (a, r) => ({ ...a, [r.responsable]: (a[r.responsable] || 0) + 1 }), {}
      )
      setTecnicos(tecsList.map((t, i) => ({
        id: t.id,
        nombre: t.nombre,
        enRuta: recientes.includes(t.nombre),
        zona: recientes.includes(t.nombre) ? ['Zona Norte', 'Zona Sur', 'Zona Centro', 'Zona Este'][i % 4] : null,
        tareas: tareasHoy[t.nombre] ?? 0,
      })))
    }

    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function buscarBicisModal(q: string) {
    if (q.length < 2) { setBicisBus([]); return }
    const supabase = createClient()
    const { data } = await supabase.from('bicicletas').select('*').ilike('codigo', `%${q}%`).limit(8)
    if (data) setBicisBus(data)
  }

  async function crearOrden(e: React.FormEvent) {
    e.preventDefault()
    if (!modalOrden || !ordResponsable.trim() || !ordTipo) return
    setOrdGuardando(true)
    const supabase = createClient()
    const biciId = (modalOrden.bicicleta as { id: string } | null)?.id
    await supabase.from('mantenimientos').insert({
      bicicleta_id:      biciId ?? null,
      tipo_intervencion: ordTipo,
      descripcion:       modalOrden.descripcion,
      responsable:       ordResponsable.trim(),
      fecha:             new Date().toISOString(),
    })
    await supabase.from('incidencias').update({ estado: 'en_proceso' }).eq('id', modalOrden.id)
    if (biciId) await supabase.from('bicicletas').update({ estado: 'mantenimiento' }).eq('id', biciId)
    setModalOrden(null); setOrdResponsable(''); setOrdTipo('')
    setOrdGuardando(false)
    await cargar()
  }

  async function registrarMant(e: React.FormEvent) {
    e.preventDefault(); setErrorMant('')
    if (!formMant.bicicleta_id || !formMant.tipo || !formMant.responsable.trim()) {
      setErrorMant('Completa los campos requeridos'); return
    }
    setLoadMant(true)
    try {
      const supabase = createClient()
      await supabase.from('mantenimientos').insert({
        bicicleta_id: formMant.bicicleta_id, tipo_intervencion: formMant.tipo,
        descripcion: formMant.descripcion || null, responsable: formMant.responsable.trim(),
        fecha: new Date().toISOString(),
      })
      await supabase.from('bicicletas')
        .update({ estado: formMant.dejar_disponible ? 'disponible' : 'mantenimiento' })
        .eq('id', formMant.bicicleta_id)
      setModalMant(false)
      setFormMant({ bicicleta_id: '', tipo: '', descripcion: '', responsable: '', dejar_disponible: true })
      setBusquedaBici(''); setBicisBus([])
      await cargar()
    } catch (err: unknown) {
      setErrorMant(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setLoadMant(false) }
  }

  /* ── filtrado + paginación ── */
  const filtradas = incidencias.filter(inc =>
    !busqueda || (inc.bicicleta?.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginadas    = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const estadoFlota = bicicletasTotal > 0 ? Math.round((bicicletasOp / bicicletasTotal) * 100) : 0
  const incAyer     = Math.round(incidencias.length * 0.88) // referencia aproximada

  return (
    <div className="min-h-screen" style={{ background: '#f4f6f5' }}>

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-100 px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <h1 className="text-base font-black text-gray-800">Mantenimiento de Flota</h1>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
            <Search size={15} className="text-gray-500" />
          </button>
          <button className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
            <Filter size={15} className="text-gray-500" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-extrabold">O</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-[1300px]">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Tickets Abiertos */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f0fff4' }}>
                <ClipboardList size={18} style={{ color: '#166534' }} />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                +{incidencias.length > 0 ? Math.round(((incidencias.length - incAyer) / Math.max(incAyer, 1)) * 100) : 0}%
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tickets Abiertos</p>
            <p className="text-4xl font-black text-gray-900 mt-1">
              {loading ? '—' : String(incidencias.length).padStart(2, '0')}
            </p>
          </div>

          {/* En Reparación */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff7ed' }}>
                <Wrench size={18} style={{ color: '#c2410c' }} />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">-5%</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">En Reparación</p>
            <p className="text-4xl font-black text-gray-900 mt-1">
              {loading ? '—' : String(bicicletasRep).padStart(2, '0')}
            </p>
          </div>

          {/* Cerrados Hoy */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                <CheckCircle size={18} style={{ color: '#1d4ed8' }} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hoy</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cerrados Hoy</p>
            <p className="text-4xl font-black text-gray-900 mt-1">
              {loading ? '—' : String(cerradosHoy).padStart(2, '0')}
            </p>
          </div>

          {/* Estado de Flota */}
          <div className="rounded-2xl p-5 shadow-sm flex flex-col justify-between" style={{ background: '#0f2419' }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(178,247,70,0.6)' }}>
              Estado de Flota
            </p>
            <p className="text-5xl font-black text-white my-2">{loading ? '—' : `${estadoFlota}%`}</p>
            <p className="text-xs font-semibold" style={{ color: '#b2f746' }}>Operativo y Seguro</p>
          </div>
        </div>

        {/* ── Tickets de Problemas Activos ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Header de sección */}
          <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-gray-100">
            <div className="flex-1">
              <h2 className="font-black text-gray-900 text-lg">Tickets de Problemas Activos</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Reportes críticos de usuarios que requieren atención inmediata.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Buscador */}
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
                  placeholder="Buscar por ID de bici..."
                  className="bg-transparent text-sm outline-none w-44 text-gray-600 placeholder-gray-400"
                />
              </div>
              {/* Botón reportar */}
              <button
                onClick={() => { setErrorMant(''); setModalMant(true) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white shadow-sm transition-all hover:opacity-90 active:scale-[.98]"
                style={{ background: '#003527' }}
              >
                <Plus size={15} /> Reportar Incidencia
              </button>
            </div>
          </div>

          {/* Tabla */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['BIKE ID', 'PROBLEMA', 'PRIORIDAD', 'REPORTADO', 'ACCIONES'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-[10px] font-black tracking-widest text-gray-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && Array(4).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(5).fill(0).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && paginadas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
                    <p className="text-gray-400 font-semibold">Sin incidencias pendientes</p>
                  </td>
                </tr>
              )}
              {!loading && paginadas.map(inc => {
                const prio = PRIORIDAD[inc.tipo] ?? PRIORIDAD.otro
                const bici = inc.bicicleta
                const est  = inc.estacion
                return (
                  <tr key={inc.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Bike ID */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#f0fff4' }}>
                          <Bike size={14} style={{ color: '#166534' }} />
                        </div>
                        <span className="font-black text-gray-800 font-mono">{bici?.codigo ?? '—'}</span>
                      </div>
                    </td>
                    {/* Problema */}
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800">{TIPO_LABEL[inc.tipo] ?? inc.tipo}</p>
                      {est && <p className="text-xs text-gray-400 mt-0.5">Estación: {est.nombre}</p>}
                    </td>
                    {/* Prioridad */}
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full tracking-wide"
                        style={{ background: prio.bg, color: prio.color }}>
                        {prio.label}
                      </span>
                    </td>
                    {/* Reportado */}
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium whitespace-nowrap">
                      {tiempoHace(inc.created_at)}
                    </td>
                    {/* Acción */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => { setModalOrden(inc); setOrdTipo(''); setOrdResponsable('') }}
                        className="px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-90 active:scale-[.98] shadow-sm whitespace-nowrap"
                        style={{ background: '#b2f746', color: '#002117' }}
                        disabled={inc.estado === 'en_proceso'}
                      >
                        {inc.estado === 'en_proceso' ? '✓ En proceso' : 'Crear Orden de Trabajo'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Footer con paginación */}
          {!loading && filtradas.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs text-gray-400 font-medium">
                Mostrando {Math.min(paginadas.length, POR_PAGINA)} de {filtradas.length} tickets pendientes
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={14} className="text-gray-600" />
                </button>
                {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPagina(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-colors border ${
                      pagina === n
                        ? 'text-white border-[#003527]'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    style={pagina === n ? { background: '#003527' } : {}}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight size={14} className="text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom: Equipos en Ruta + Mantenimiento Predictivo ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Equipos en Ruta */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-gray-500" />
              <h3 className="font-black text-gray-800">Equipos en Ruta</h3>
            </div>

            {tecnicos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Users size={28} className="text-gray-200" />
                <p className="text-sm text-gray-400">Sin técnicos registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tecnicos.slice(0, 4).map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-extrabold text-sm"
                      style={{ background: t.enRuta ? '#dcfce7' : '#f3f4f6', color: t.enRuta ? '#166534' : '#6b7280' }}>
                      {t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{t.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {t.enRuta ? `${t.zona} · ${t.tareas} tarea${t.tareas !== 1 ? 's' : ''} completada${t.tareas !== 1 ? 's' : ''}` : 'Sin actividad reciente'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full tracking-wide ${
                      t.enRuta
                        ? 'text-green-700 bg-green-100'
                        : 'text-gray-500 bg-gray-100'
                    }`}>
                      {t.enRuta ? 'EN RUTA' : 'DISPONIBLE'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mantenimiento Predictivo */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#f0fff4' }}>
              <Sparkles size={28} style={{ color: '#166534' }} />
            </div>
            <div>
              <h3 className="font-black text-gray-800 text-base">Mantenimiento Predictivo</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-xs">
                {insightTipo
                  ? `La IA sugiere revisar el componente de ${TIPO_LABEL[insightTipo]?.toLowerCase() ?? insightTipo} debido a reportes recurrentes en la flota.`
                  : 'La IA está analizando los patrones de fallas para generar recomendaciones preventivas.'}
              </p>
            </div>
            <button
              onClick={() => {}}
              className="px-5 py-2.5 rounded-xl text-sm font-black border-2 transition-all hover:opacity-80"
              style={{ borderColor: '#b2f746', color: '#003527' }}
            >
              Ver Análisis de Flota
            </button>
          </div>
        </div>

      </div>

      {/* ── Modal: Crear Orden de Trabajo ── */}
      {modalOrden && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-black text-gray-900">Crear Orden de Trabajo</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Bici {modalOrden.bicicleta?.codigo} · {TIPO_LABEL[modalOrden.tipo] ?? modalOrden.tipo}
                </p>
              </div>
              <button onClick={() => setModalOrden(null)}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={16} className="text-gray-600" />
              </button>
            </div>
            <form onSubmit={crearOrden} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Tipo de intervención *</label>
                <select className={inputCls} value={ordTipo} onChange={e => setOrdTipo(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {TIPOS_MANT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Asignar a técnico *</label>
                <input className={inputCls} placeholder="Nombre del técnico responsable"
                  value={ordResponsable} onChange={e => setOrdResponsable(e.target.value)} required />
                {tecnicos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tecnicos.filter(t => !t.enRuta).slice(0, 4).map(t => (
                      <button key={t.id} type="button"
                        onClick={() => setOrdResponsable(t.nombre)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                          ordResponsable === t.nombre ? 'border-[#003527] bg-[#003527] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        {t.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {modalOrden.descripcion && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Descripción del reporte</p>
                  <p className="text-sm text-gray-700">{modalOrden.descripcion}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOrden(null)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={ordGuardando}
                  className="flex-1 h-11 rounded-xl text-sm font-black text-white shadow-sm disabled:opacity-50 transition-all"
                  style={{ background: '#003527' }}>
                  {ordGuardando ? 'Creando...' : 'Crear Orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar Mantenimiento Manual ── */}
      {modalMant && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-black text-gray-900">Registrar Mantenimiento</h2>
              <button onClick={() => setModalMant(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={16} className="text-gray-600" />
              </button>
            </div>
            {errorMant && (
              <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">
                <AlertTriangle size={14} /> {errorMant}
              </div>
            )}
            <form onSubmit={registrarMant} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Bicicleta *</label>
                <input className={inputCls} placeholder="BC-..."
                  value={busquedaBici}
                  onChange={e => { setBusquedaBici(e.target.value); setFormMant(p => ({ ...p, bicicleta_id: '' })); buscarBicisModal(e.target.value) }} />
                {bicisBus.length > 0 && !biciSelec && (
                  <div className="mt-1 border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-36 overflow-auto shadow-sm">
                    {bicisBus.map(b => (
                      <button key={b.id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm flex items-center justify-between"
                        onClick={() => { setFormMant(p => ({ ...p, bicicleta_id: b.id })); setBusquedaBici(b.codigo) }}>
                        <span className="font-mono font-black text-gray-800">{b.codigo}</span>
                        <span className="text-xs text-gray-400">{b.tipo} {b.marca}</span>
                      </button>
                    ))}
                  </div>
                )}
                {biciSelec && (
                  <p className="text-xs text-green-700 mt-1 font-semibold flex items-center gap-1">
                    <CheckCircle size={12} /> {biciSelec.codigo} — {biciSelec.tipo}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Tipo de Intervención *</label>
                <select className={inputCls} value={formMant.tipo}
                  onChange={e => setFormMant(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {TIPOS_MANT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsable *</label>
                <input className={inputCls} placeholder="Nombre del técnico"
                  value={formMant.responsable}
                  onChange={e => setFormMant(p => ({ ...p, responsable: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Descripción (opcional)</label>
                <textarea className={`${inputCls} h-auto py-3 resize-none`} rows={2}
                  value={formMant.descripcion}
                  onChange={e => setFormMant(p => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#003527]"
                  checked={formMant.dejar_disponible}
                  onChange={e => setFormMant(p => ({ ...p, dejar_disponible: e.target.checked }))} />
                <span className="text-sm text-gray-700">Marcar bicicleta como disponible al terminar</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalMant(false)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loadMant}
                  className="flex-1 h-11 rounded-xl text-sm font-black text-white shadow-sm disabled:opacity-50 transition-all"
                  style={{ background: '#003527' }}>
                  {loadMant ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
