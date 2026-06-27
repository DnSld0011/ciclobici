'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Search, Shield, Bike, Wrench, CheckCircle2, Crown,
  XCircle, Trash2, Key, ChevronDown, RefreshCw, X, Eye, EyeOff, Pencil,
} from 'lucide-react'

type Rol    = 'ciudadano' | 'operador' | 'tecnico' | 'administrador' | string
type Estado = 'activo' | 'suspendido'

interface Usuario {
  id:        string
  nombre:    string
  documento: string
  correo:    string
  celular:   string
  rol:       Rol
  estado:    Estado
}

const ROL_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ciudadano:     { label: 'Ciudadano',     color: '#166534', bg: '#dcfce7', icon: Bike },
  operador:      { label: 'Operador',      color: '#1d4ed8', bg: '#dbeafe', icon: Shield },
  tecnico:       { label: 'Técnico',       color: '#92400e', bg: '#fef3c7', icon: Wrench },
  administrador: { label: 'Administrador', color: '#6d28d9', bg: '#ede9fe', icon: Crown },
}
const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  activo:     { label: 'Activo',     color: '#166534', bg: '#dcfce7' },
  suspendido: { label: 'Suspendido', color: '#991b1b', bg: '#fee2e2' },
}

function RolChip({ rol }: { rol: Rol }) {
  const c = ROL_CONFIG[rol] ?? { label: rol, color: '#374151', bg: '#f3f4f6', icon: Shield }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ color: c.color, background: c.bg }}>
      <c.icon size={11} />{c.label}
    </span>
  )
}
function EstadoChip({ estado }: { estado: Estado }) {
  const c = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.activo
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ color: c.color, background: c.bg }}>
      {estado === 'activo' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {c.label}
    </span>
  )
}

/* ── Dropdown de rol con Portal para evitar overflow clipping ── */
function RolSelector({ usuario, roles, onUpdate }: {
  usuario: Usuario
  roles: { id: string; nombre: string; color: string }[]
  onUpdate: (id: string, campo: string, valor: string) => void
}) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [pos, setPos]       = useState({ top: 0, left: 0 })
  const btnRef              = useRef<HTMLButtonElement>(null)

  function handleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(v => !v)
  }

  async function cambiarRol(nuevoRol: string) {
    if (nuevoRol === usuario.rol) { setOpen(false); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: usuario.id, campo: 'rol', valor: nuevoRol }),
      })
      if (res.ok) onUpdate(usuario.id, 'rol', nuevoRol)
    } finally { setSaving(false); setOpen(false) }
  }

  const allRoles = roles.length > 0 ? roles : Object.entries(ROL_CONFIG).map(([id, c]) => ({ id, nombre: c.label, color: c.color }))

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} disabled={saving}
        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 hover:bg-surface-container-low transition-colors disabled:opacity-50 text-xs font-semibold text-on-surface-variant whitespace-nowrap">
        {saving
          ? <span className="w-3 h-3 border-2 border-outline/30 border-t-outline rounded-full animate-spin" />
          : <><ChevronDown size={12} /> Rol</>}
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div className="fixed z-[201] bg-white rounded-xl shadow-xl border border-outline-variant/30 overflow-hidden min-w-[160px] py-1"
            style={{ top: pos.top, left: pos.left }}>
            {allRoles.map(r => {
              const cfg = ROL_CONFIG[r.id]
              const Icon = cfg?.icon ?? Shield
              return (
                <button key={r.id} onClick={() => cambiarRol(r.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold hover:bg-surface-container-low transition-colors"
                  style={{ color: r.color || cfg?.color || '#374151' }}>
                  <Icon size={12} />
                  {r.nombre}
                  {r.id === usuario.rol && <span className="ml-auto text-outline">✓</span>}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

/* ── Modal editar usuario ── */
function ModalEditar({ usuario, onClose, onDone }: {
  usuario: Usuario; onClose: () => void; onDone: (updated: Partial<Usuario>) => void
}) {
  const [form, setForm]   = useState({ nombre: usuario.nombre, documento: usuario.documento, correo: usuario.correo, celular: usuario.celular })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(k: string) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function handleSave() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/usuarios/editar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: usuario.id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDone(form)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all'
  const labelCls = 'block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-extrabold text-on-surface text-lg">Editar usuario</h3>
            <p className="text-xs text-outline mt-0.5">{usuario.correo}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-outline"><X size={18} /></button>
        </div>

        {error && <div className="px-3 py-2 rounded-lg bg-[#ffdad6] text-error text-sm font-semibold">{error}</div>}

        <div className="space-y-3">
          <div><label className={labelCls}>Nombre completo</label><input className={inputCls} value={form.nombre} onChange={set('nombre')} /></div>
          <div><label className={labelCls}>DNI / Documento</label><input className={inputCls} value={form.documento} onChange={set('documento')} /></div>
          <div><label className={labelCls}>Correo electrónico</label><input type="email" className={inputCls} value={form.correo} onChange={set('correo')} /></div>
          <div>
            <label className={labelCls}>Celular</label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 h-11 rounded-xl border border-outline-variant/40 bg-surface-container-low text-outline text-sm font-semibold shrink-0">+51</span>
              <input className="flex-1 h-11 px-3 rounded-xl border border-outline-variant/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
                value={form.celular} onChange={set('celular')} maxLength={9} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 h-10 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#003527', color: 'white' }}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal reset password ── */
function ModalResetPassword({ usuario, onClose, onDone }: { usuario: Usuario; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleReset() {
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/usuarios/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: usuario.id, newPassword: password }),
      })
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
          <div>
            <h3 className="font-extrabold text-on-surface text-lg">Restablecer contraseña</h3>
            <p className="text-sm text-outline mt-0.5">{usuario.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-outline"><X size={18} /></button>
        </div>
        {error && <div className="px-3 py-2 rounded-lg bg-[#ffdad6] text-error text-sm font-semibold">{error}</div>}
        <div>
          <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">Nueva contraseña</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
              className="w-full h-11 px-3 pr-10 rounded-xl border border-outline-variant/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
              value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline">
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">Cancelar</button>
          <button onClick={handleReset} disabled={loading || password.length < 8}
            className="flex-1 h-10 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#003527', color: 'white' }}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal confirmar eliminación ── */
function ModalEliminar({ usuario, onClose, onDone }: { usuario: Usuario; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleDelete() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/usuarios?id=${usuario.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div><h3 className="font-extrabold text-on-surface text-lg">Eliminar usuario</h3><p className="text-sm text-outline mt-0.5">Esta acción no se puede deshacer</p></div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-outline"><X size={18} /></button>
        </div>
        <div className="px-4 py-3 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
          <p className="text-sm font-bold text-[#991b1b]">{usuario.nombre}</p>
          <p className="text-xs text-[#991b1b]/80">{usuario.correo}</p>
        </div>
        {error && <div className="px-3 py-2 rounded-lg bg-[#ffdad6] text-error text-sm font-semibold">{error}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 h-10 rounded-xl text-sm font-bold bg-error text-white disabled:opacity-50">
            {loading ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Página principal ── */
export default function UsuariosPage() {
  const [usuarios, setUsuarios]         = useState<Usuario[]>([])
  const [roles, setRoles]               = useState<{ id: string; nombre: string; color: string }[]>([])
  const [loading, setLoading]           = useState(true)
  const [busqueda, setBusqueda]         = useState('')
  const [filtroRol, setFiltroRol]       = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modalEditar, setModalEditar]   = useState<Usuario | null>(null)
  const [modalReset, setModalReset]     = useState<Usuario | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Usuario | null>(null)
  const [toast, setToast]               = useState('')

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const cargar = useCallback(async () => {
    setLoading(true)
    const [resU, resR] = await Promise.all([
      fetch('/api/admin/usuarios'),
      fetch('/api/admin/roles'),
    ])
    const [dataU, dataR] = await Promise.all([resU.json(), resR.json()])
    if (dataU.usuarios) setUsuarios(dataU.usuarios)
    if (dataR.roles) setRoles(dataR.roles.map((r: { id: string; nombre: string; color: string }) => ({ id: r.id, nombre: r.nombre, color: r.color })))
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const supabase = createClient()
    const ch = supabase.channel('usuarios-admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  function actualizarLocal(id: string, campo: string, valor: string) {
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, [campo]: valor } : u))
  }

  async function toggleEstado(usuario: Usuario) {
    const nuevo: Estado = usuario.estado === 'activo' ? 'suspendido' : 'activo'
    actualizarLocal(usuario.id, 'estado', nuevo)
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: usuario.id, campo: 'estado', valor: nuevo }),
    })
    if (!res.ok) { actualizarLocal(usuario.id, 'estado', usuario.estado); mostrarToast('Error al cambiar estado') }
    else mostrarToast(nuevo === 'activo' ? 'Usuario activado' : 'Usuario suspendido')
  }

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase()
    return (
      (!q || u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q) || u.celular.includes(q) || u.documento.includes(q)) &&
      (filtroRol === 'todos' || u.rol === filtroRol) &&
      (filtroEstado === 'todos' || u.estado === filtroEstado)
    )
  })

  const contarRol = (r: string) => usuarios.filter(u => u.rol === r).length
  const stats = {
    total:         usuarios.length,
    activos:       usuarios.filter(u => u.estado === 'activo').length,
    ciudadano:     contarRol('ciudadano'),
    operador:      contarRol('operador'),
    tecnico:       contarRol('tecnico'),
    administrador: contarRol('administrador'),
  }

  const rolesOptions = roles.length > 0
    ? roles
    : Object.entries(ROL_CONFIG).map(([id, c]) => ({ id, nombre: c.label, color: c.color }))

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[300] px-4 py-3 bg-[#003527] text-white rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#b2f746]" />{toast}
        </div>
      )}

      {modalEditar && (
        <ModalEditar usuario={modalEditar} onClose={() => setModalEditar(null)}
          onDone={updated => {
            setUsuarios(prev => prev.map(u => u.id === modalEditar.id ? { ...u, ...updated } : u))
            setModalEditar(null); mostrarToast('Usuario actualizado')
          }} />
      )}
      {modalReset && (
        <ModalResetPassword usuario={modalReset} onClose={() => setModalReset(null)}
          onDone={() => { setModalReset(null); mostrarToast('Contraseña actualizada') }} />
      )}
      {modalEliminar && (
        <ModalEliminar usuario={modalEliminar} onClose={() => setModalEliminar(null)}
          onDone={() => { setUsuarios(prev => prev.filter(u => u.id !== modalEliminar.id)); setModalEliminar(null); mostrarToast('Usuario eliminado') }} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface flex items-center gap-2">
            <Users size={24} className="text-primary-container" />Gestión de Usuarios
          </h1>
          <p className="text-sm text-outline mt-1">{stats.total} usuarios registrados</p>
        </div>
        <button onClick={cargar} disabled={loading}
          className="p-2 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low transition-colors text-outline disabled:opacity-50">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total',    value: stats.total,         color: '#003527', bg: '#f0fdf4' },
          { label: 'Activos',  value: stats.activos,       color: '#166534', bg: '#dcfce7' },
          { label: 'Ciudadanos', value: stats['ciudadano'] ?? 0, color: '#166534', bg: '#f0fdf4' },
          { label: 'Operadores', value: stats['operador']  ?? 0, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Técnicos',   value: stats['tecnico']   ?? 0, color: '#92400e', bg: '#fffbeb' },
          { label: 'Admin',      value: stats['administrador'] ?? 0, color: '#6d28d9', bg: '#ede9fe' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-2xl p-3 border border-outline-variant/20" style={{ background: bg }}>
            <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
            <p className="text-[11px] font-semibold text-outline mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" placeholder="Buscar por nombre, correo, celular o documento..."
            className="w-full h-11 pl-9 pr-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
          className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 cursor-pointer">
          <option value="todos">Todos los roles</option>
          {rolesOptions.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 cursor-pointer">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="suspendido">Suspendidos</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-outline">
            <div className="w-8 h-8 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
            <p className="text-sm">Cargando usuarios...</p>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-20 text-outline">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No se encontraron usuarios</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-visible">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low rounded-t-2xl">
                  {['Usuario','Contacto','Rol','Estado','Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-extrabold tracking-widest text-outline uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtrados.map(u => (
                  <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm text-white"
                          style={{ background: ROL_CONFIG[u.rol]?.color ?? '#003527' }}>
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface leading-none">{u.nombre}</p>
                          <p className="text-[11px] text-outline mt-0.5">DNI: {u.documento}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-on-surface">{u.correo}</p>
                      <p className="text-[11px] text-outline">+51 {u.celular}</p>
                    </td>
                    <td className="px-4 py-3"><RolChip rol={u.rol} /></td>
                    <td className="px-4 py-3"><EstadoChip estado={u.estado} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <RolSelector usuario={u} roles={roles} onUpdate={actualizarLocal} />
                        <button onClick={() => setModalEditar(u)}
                          className="p-1.5 rounded-lg bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7] transition-colors flex items-center gap-1 text-xs font-semibold">
                          <Pencil size={13} /> Editar
                        </button>
                        <button onClick={() => toggleEstado(u)}
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold transition-colors
                            ${u.estado === 'activo' ? 'bg-[#fee2e2] text-[#991b1b] hover:bg-[#fecaca]' : 'bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]'}`}>
                          {u.estado === 'activo' ? <><XCircle size={13} />Suspender</> : <><CheckCircle2 size={13} />Activar</>}
                        </button>
                        <button onClick={() => setModalReset(u)}
                          className="p-1.5 rounded-lg bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#dbeafe] transition-colors flex items-center gap-1 text-xs font-semibold">
                          <Key size={13} /> Clave
                        </button>
                        <button onClick={() => setModalEliminar(u)}
                          className="p-1.5 rounded-lg bg-[#fef2f2] text-[#991b1b] hover:bg-[#fee2e2] transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtrados.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-outline-variant/20 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm text-white"
                    style={{ background: ROL_CONFIG[u.rol]?.color ?? '#003527' }}>
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-on-surface text-sm leading-none">{u.nombre}</p>
                    <p className="text-[11px] text-outline mt-0.5">{u.correo}</p>
                    <p className="text-[11px] text-outline">+51 {u.celular} · DNI: {u.documento}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <RolChip rol={u.rol} /><EstadoChip estado={u.estado} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-outline-variant/20 flex-wrap">
                  <RolSelector usuario={u} roles={roles} onUpdate={actualizarLocal} />
                  <button onClick={() => setModalEditar(u)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#f0fdf4] text-[#166534] text-xs font-semibold"><Pencil size={12} />Editar</button>
                  <button onClick={() => toggleEstado(u)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold
                      ${u.estado === 'activo' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#dcfce7] text-[#166534]'}`}>
                    {u.estado === 'activo' ? <><XCircle size={12} />Suspender</> : <><CheckCircle2 size={12} />Activar</>}
                  </button>
                  <button onClick={() => setModalReset(u)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#eff6ff] text-[#1d4ed8] text-xs font-semibold"><Key size={12} />Clave</button>
                  <button onClick={() => setModalEliminar(u)} className="p-1.5 rounded-lg bg-[#fef2f2] text-[#991b1b]"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-outline text-center">Mostrando {filtrados.length} de {usuarios.length} usuarios</p>
        </>
      )}
    </div>
  )
}
