'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Pencil, Trash2, X, CheckCircle2, Lock, Globe } from 'lucide-react'

/* ── Catálogo de vistas disponibles ── */
const VISTAS_CATALOG = [
  { grupo: 'Ciudadano', items: [
    { id: '/ciudadano',                       label: 'Dashboard ciudadano' },
    { id: '/ciudadano/mapa',                  label: 'Mapa de estaciones' },
    { id: '/ciudadano/viajes',                label: 'Mis viajes' },
    { id: '/ciudadano/escanear',              label: 'Escanear QR' },
    { id: '/ciudadano/viaje',                 label: 'Resumen de viaje' },
    { id: '/ciudadano/viaje-activo',          label: 'Viaje activo (GPS)' },
    { id: '/ciudadano/incidencias',           label: 'Reportar incidencia' },
    { id: '/ciudadano/incidencias/historial', label: 'Historial de reportes' },
    { id: '/ciudadano/perfil',                label: 'Mi perfil' },
  ]},
  { grupo: 'Operador', items: [
    { id: '/operador',                  label: 'Dashboard operador' },
    { id: '/operador/mapa',             label: 'Mapa en vivo' },
    { id: '/operador/viajes',           label: 'Historial de viajes' },
    { id: '/operador/alertas',          label: 'Alertas' },
    { id: '/operador/estaciones',       label: 'Estaciones' },
    { id: '/operador/bicicletas',       label: 'Bicicletas' },
    { id: '/operador/mantenimiento',    label: 'Mantenimiento de flota' },
    { id: '/operador/asignacion',       label: 'Asignación de bicicletas' },
    { id: '/operador/prediccion',       label: 'Predicción de demanda' },
  ]},
  { grupo: 'Administrador', items: [
    { id: '/operador/admin',    label: 'Panel de administración' },
    { id: '/operador/kpis',     label: 'KPIs estratégicos' },
    { id: '/operador/stock',    label: 'Stock óptimo por estación' },
    { id: '/operador/usuarios', label: 'Gestión de usuarios' },
    { id: '/operador/roles',    label: 'Gestión de roles' },
  ]},
  { grupo: 'Técnico', items: [
    { id: '/tecnico/mantenimiento', label: 'Mantenimiento técnico' },
    { id: '/tecnico/bicicletas',    label: 'Bicicletas técnico' },
    { id: '/tecnico/incidencias',   label: 'Incidencias' },
    { id: '/tecnico/historial',     label: 'Historial de trabajos' },
  ]},
]

const COLORES = [
  '#166534','#1d4ed8','#92400e','#6d28d9','#0f766e',
  '#b45309','#be185d','#0369a1','#374151','#dc2626',
]

interface Rol {
  id:          string
  nombre:      string
  descripcion: string
  color:       string
  vistas:      string[]
  es_sistema:  boolean
}

/* ── Modal crear / editar rol ── */
function ModalRol({ rol, onClose, onDone }: {
  rol: Rol | null; onClose: () => void; onDone: () => void
}) {
  const esNuevo = !rol
  const [form, setForm] = useState({
    id:          rol?.id ?? '',
    nombre:      rol?.nombre ?? '',
    descripcion: rol?.descripcion ?? '',
    color:       rol?.color ?? '#1d4ed8',
    vistas:      rol?.vistas ?? [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function toggleVista(vista: string) {
    setForm(p => ({
      ...p,
      vistas: p.vistas.includes(vista)
        ? p.vistas.filter(v => v !== vista)
        : [...p.vistas, vista],
    }))
  }

  function toggleGrupo(items: { id: string }[]) {
    const ids = items.map(i => i.id)
    const allSelected = ids.every(id => form.vistas.includes(id))
    if (allSelected) {
      setForm(p => ({ ...p, vistas: p.vistas.filter(v => !ids.includes(v)) }))
    } else {
      setForm(p => ({ ...p, vistas: [...new Set([...p.vistas, ...ids])] }))
    }
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true); setError('')
    try {
      const method = esNuevo ? 'POST' : 'PATCH'
      const body   = esNuevo ? form : { id: form.id, nombre: form.nombre, descripcion: form.descripcion, color: form.color, vistas: form.vistas }
      const res = await fetch('/api/admin/roles', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
  const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 shrink-0">
          <div>
            <h3 className="font-extrabold text-on-surface text-lg">{esNuevo ? 'Nuevo rol' : `Editar: ${rol?.nombre}`}</h3>
            <p className="text-xs text-outline mt-0.5">Define el nombre, color y vistas que tendrá este rol</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-low text-outline"><X size={18} /></button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && <div className="px-4 py-3 rounded-xl bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ID (solo creación) */}
            {esNuevo && (
              <div>
                <label className={labelCls}>ID del rol <span className="text-outline font-normal normal-case">(slug, sin espacios)</span></label>
                <input className={inputCls} placeholder="ej: supervisor"
                  value={form.id} onChange={e => setForm(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') }))} />
              </div>
            )}

            {/* Nombre */}
            <div className={esNuevo ? '' : 'sm:col-span-2'}>
              <label className={labelCls}>Nombre del rol</label>
              <input className={inputCls} placeholder="ej: Supervisor" value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
            </div>

            {/* Descripción */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Descripción</label>
              <input className={inputCls} placeholder="Descripción corta del rol" value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className={labelCls}>Color del rol</label>
            <div className="flex items-center gap-3 flex-wrap">
              {COLORES.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-black/20' : 'hover:scale-110'}`}
                  style={{ background: c }} />
              ))}
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-outline-variant/40" />
                <span className="text-xs text-outline">Personalizado</span>
              </div>
            </div>
          </div>

          {/* Vistas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={`${labelCls} mb-0`}>Vistas / módulos permitidos</label>
              <span className="text-xs text-outline">{form.vistas.length} seleccionadas</span>
            </div>

            <div className="space-y-4">
              {VISTAS_CATALOG.map(({ grupo, items }) => {
                const allSelected = items.every(i => form.vistas.includes(i.id))
                const someSelected = items.some(i => form.vistas.includes(i.id))
                return (
                  <div key={grupo} className="border border-outline-variant/20 rounded-xl overflow-hidden">
                    {/* Cabecera del grupo */}
                    <button onClick={() => toggleGrupo(items)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                          ${allSelected ? 'bg-primary-container border-primary-container' : someSelected ? 'bg-primary-container/30 border-primary-container' : 'border-outline-variant/40'}`}>
                          {allSelected && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                        <span className="text-sm font-extrabold text-on-surface">{grupo}</span>
                      </div>
                      <span className="text-xs text-outline">{items.filter(i => form.vistas.includes(i.id)).length}/{items.length}</span>
                    </button>
                    {/* Items */}
                    <div className="divide-y divide-outline-variant/10">
                      {items.map(item => {
                        const checked = form.vistas.includes(item.id)
                        return (
                          <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low/50 cursor-pointer">
                            <div onClick={() => toggleVista(item.id)}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer
                                ${checked ? 'bg-primary-container border-primary-container' : 'border-outline-variant/40'}`}>
                              {checked && <CheckCircle2 size={10} className="text-white" />}
                            </div>
                            <span className="text-sm text-on-surface flex-1">{item.label}</span>
                            <span className="text-[11px] text-outline font-mono">{item.id}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t border-outline-variant/20 shrink-0">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 h-11 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: form.color, color: 'white' }}>
            {loading ? 'Guardando...' : esNuevo ? 'Crear rol' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal confirmar eliminación ── */
function ModalEliminarRol({ rol, onClose, onDone }: { rol: Rol; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleDelete() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/roles?id=${rol.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div><h3 className="font-extrabold text-on-surface text-lg">Eliminar rol</h3><p className="text-sm text-outline mt-0.5">Esta acción no se puede deshacer</p></div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-outline"><X size={18} /></button>
        </div>
        <div className="px-4 py-3 rounded-xl border" style={{ background: rol.color + '15', borderColor: rol.color + '40' }}>
          <p className="text-sm font-bold" style={{ color: rol.color }}>{rol.nombre}</p>
          <p className="text-xs text-outline mt-0.5">{rol.descripcion}</p>
        </div>
        {error && <div className="px-3 py-2 rounded-lg bg-[#ffdad6] text-error text-sm font-semibold">{error}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 h-10 rounded-xl text-sm font-bold bg-error text-white disabled:opacity-50">
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Página principal ── */
export default function RolesPage() {
  const [roles, setRoles]           = useState<Rol[]>([])
  const [loading, setLoading]       = useState(true)
  const [modalRol, setModalRol]     = useState<Rol | null | 'nuevo'>('nuevo' as unknown as null)
  const [modalEliminar, setModalEliminar] = useState<Rol | null>(null)
  const [toast, setToast]           = useState('')

  // Fix: initialize properly
  const [showModal, setShowModal]   = useState(false)
  const [editandoRol, setEditandoRol] = useState<Rol | null>(null)

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const cargar = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/roles')
    const data = await res.json()
    if (data.roles) setRoles(data.roles)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const totalVistas = VISTAS_CATALOG.flatMap(g => g.items).length

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-5xl mx-auto w-full">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[300] px-4 py-3 bg-[#003527] text-white rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#b2f746]" />{toast}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <ModalRol
          rol={editandoRol}
          onClose={() => { setShowModal(false); setEditandoRol(null) }}
          onDone={() => { setShowModal(false); setEditandoRol(null); cargar(); mostrarToast(editandoRol ? 'Rol actualizado' : 'Rol creado') }}
        />
      )}

      {/* Modal eliminar */}
      {modalEliminar && (
        <ModalEliminarRol
          rol={modalEliminar}
          onClose={() => setModalEliminar(null)}
          onDone={() => { setRoles(prev => prev.filter(r => r.id !== modalEliminar.id)); setModalEliminar(null); mostrarToast('Rol eliminado') }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface flex items-center gap-2">
            <Shield size={24} className="text-primary-container" />Gestión de Roles
          </h1>
          <p className="text-sm text-outline mt-1">
            Define los roles del sistema y controla a qué vistas tiene acceso cada uno
          </p>
        </div>
        <button
          onClick={() => { setEditandoRol(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all active:scale-[.98] shrink-0"
          style={{ background: '#b2f746', color: '#002117' }}>
          <Plus size={16} /> Nuevo rol
        </button>
      </div>

      {/* Lista de roles */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(rol => (
            <div key={rol.id} className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
              {/* Color bar */}
              <div className="h-1.5" style={{ background: rol.color }} />

              <div className="p-5 space-y-4">
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: rol.color + '20' }}>
                      <Shield size={18} style={{ color: rol.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-on-surface text-base leading-none">{rol.nombre}</h3>
                        {rol.es_sistema && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-container text-outline">
                            <Lock size={9} /> Sistema
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-outline mt-0.5">{rol.descripcion || 'Sin descripción'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditandoRol(rol); setShowModal(true) }}
                      className="p-1.5 rounded-lg hover:bg-surface-container-low text-outline hover:text-on-surface transition-colors">
                      <Pencil size={15} />
                    </button>
                    {!rol.es_sistema && (
                      <button onClick={() => setModalEliminar(rol)}
                        className="p-1.5 rounded-lg hover:bg-[#fee2e2] text-outline hover:text-error transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Vistas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold tracking-widest text-outline uppercase flex items-center gap-1">
                      <Globe size={10} /> Vistas permitidas
                    </span>
                    <span className="text-[11px] font-bold" style={{ color: rol.color }}>
                      {rol.vistas?.length ?? 0}/{totalVistas}
                    </span>
                  </div>

                  {rol.vistas && rol.vistas.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {VISTAS_CATALOG.map(({ grupo, items }) => {
                        const vistaDelGrupo = items.filter(i => rol.vistas.includes(i.id))
                        if (vistaDelGrupo.length === 0) return null
                        return (
                          <div key={grupo} className="flex flex-wrap gap-1">
                            {vistaDelGrupo.map(v => (
                              <span key={v.id} className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ background: rol.color + '15', color: rol.color }}>
                                {v.label}
                              </span>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-outline italic">Sin vistas asignadas</p>
                  )}
                </div>

                {/* ID slug */}
                <div className="pt-1 border-t border-outline-variant/10">
                  <span className="text-[10px] text-outline font-mono">id: {rol.id}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20">
        <p className="text-xs text-outline leading-relaxed">
          <strong className="text-on-surface">Nota:</strong> Los roles del sistema (marcados con 🔒) no se pueden eliminar pero sí editar sus vistas.
          Los roles personalizados que crees aquí son completamente configurables. Las vistas asignadas controlan qué módulos
          aparecen disponibles para los usuarios con ese rol.
        </p>
      </div>
    </div>
  )
}
