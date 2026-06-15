'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Search, Shield, Bike, Wrench, CheckCircle2,
  XCircle, Trash2, Key, ChevronDown, RefreshCw, X, Eye, EyeOff,
} from 'lucide-react'

type Rol    = 'ciudadano' | 'operador' | 'tecnico'
type Estado = 'activo' | 'suspendido'

interface Usuario {
  id:         string
  nombre:     string
  documento:  string
  correo:     string
  celular:    string
  rol:        Rol
  estado:     Estado
}

/* ── chips ── */
const ROL_CONFIG: Record<Rol, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ciudadano: { label: 'Ciudadano', color: '#166534', bg: '#dcfce7', icon: Bike },
  operador:  { label: 'Operador',  color: '#1d4ed8', bg: '#dbeafe', icon: Shield },
  tecnico:   { label: 'Técnico',   color: '#92400e', bg: '#fef3c7', icon: Wrench },
}
const ESTADO_CONFIG: Record<Estado, { label: string; color: string; bg: string }> = {
  activo:     { label: 'Activo',     color: '#166534', bg: '#dcfce7' },
  suspendido: { label: 'Suspendido', color: '#991b1b', bg: '#fee2e2' },
}

function RolChip({ rol }: { rol: Rol }) {
  const c = ROL_CONFIG[rol] ?? ROL_CONFIG.ciudadano
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

/* ── modal reset password ── */
function ModalResetPassword({ usuario, onClose, onDone }: {
  usuario: Usuario; onClose: () => void; onDone: () => void
}) {
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleReset() {
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/usuarios/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: usuario.id, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al resetear contraseña')
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
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-outline">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-extrabold tracking-widest text-outline uppercase mb-1.5">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              className="w-full h-11 px-3 pr-10 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
              value={password} onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleReset}
            disabled={loading || password.length < 8}
            className="flex-1 h-10 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: '#003527', color: 'white' }}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── modal confirmar eliminación ── */
function ModalEliminar({ usuario, onClose, onDone }: {
  usuario: Usuario; onClose: () => void; onDone: () => void
}) {
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
          <div>
            <h3 className="font-extrabold text-on-surface text-lg">Eliminar usuario</h3>
            <p className="text-sm text-outline mt-0.5">Esta acción no se puede deshacer</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-outline">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
          <p className="text-sm font-bold text-[#991b1b]">{usuario.nombre}</p>
          <p className="text-xs text-[#991b1b]/80">{usuario.correo}</p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-[#ffdad6] text-error text-sm font-semibold border border-error/20">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 h-10 rounded-xl text-sm font-bold bg-error text-white transition-all disabled:opacity-50">
            {loading ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── dropdown de rol ── */
function RolSelector({ usuario, onUpdate }: { usuario: Usuario; onUpdate: (id: string, campo: string, valor: string) => void }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)

  const roles: Rol[] = ['ciudadano', 'operador', 'tecnico']

  async function cambiarRol(nuevoRol: Rol) {
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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 hover:bg-surface-container-low transition-colors disabled:opacity-50 text-xs font-semibold text-on-surface-variant">
        {saving
          ? <span className="w-3 h-3 border-2 border-outline/30 border-t-outline rounded-full animate-spin" />
          : <><ChevronDown size={12} /> Rol</>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-outline-variant/30 overflow-hidden min-w-[130px]">
            {roles.map(r => {
              const c = ROL_CONFIG[r]
              return (
                <button
                  key={r}
                  onClick={() => cambiarRol(r)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold hover:bg-surface-container-low transition-colors
                    ${r === usuario.rol ? 'opacity-50 cursor-default' : ''}`}
                  style={{ color: c.color }}>
                  <c.icon size={12} />{c.label}
                  {r === usuario.rol && <span className="ml-auto text-outline">✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ── componente principal ── */
export default function UsuariosPage() {
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [loading, setLoading]     = useState(true)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroRol, setFiltroRol]       = useState<Rol | 'todos'>('todos')
  const [filtroEstado, setFiltroEstado] = useState<Estado | 'todos'>('todos')
  const [modalReset, setModalReset]     = useState<Usuario | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Usuario | null>(null)
  const [toast, setToast]               = useState('')

  const mostrarToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const cargarUsuarios = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/usuarios')
      const data = await res.json()
      if (data.usuarios) setUsuarios(data.usuarios)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  function actualizarLocal(id: string, campo: string, valor: string) {
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, [campo]: valor } : u))
  }

  async function toggleEstado(usuario: Usuario) {
    const nuevoEstado: Estado = usuario.estado === 'activo' ? 'suspendido' : 'activo'
    actualizarLocal(usuario.id, 'estado', nuevoEstado)
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: usuario.id, campo: 'estado', valor: nuevoEstado }),
    })
    if (!res.ok) {
      actualizarLocal(usuario.id, 'estado', usuario.estado) // revertir
      mostrarToast('Error al cambiar estado')
    } else {
      mostrarToast(`Usuario ${nuevoEstado === 'activo' ? 'activado' : 'suspendido'}`)
    }
  }

  // Filtros
  const usuariosFiltrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase()
    const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q)
      || u.celular.includes(q) || u.documento.includes(q)
    const matchRol    = filtroRol    === 'todos' || u.rol    === filtroRol
    const matchEstado = filtroEstado === 'todos' || u.estado === filtroEstado
    return matchSearch && matchRol && matchEstado
  })

  // Estadísticas
  const stats = {
    total:      usuarios.length,
    activos:    usuarios.filter(u => u.estado === 'activo').length,
    ciudadanos: usuarios.filter(u => u.rol === 'ciudadano').length,
    operadores: usuarios.filter(u => u.rol === 'operador').length,
    tecnicos:   usuarios.filter(u => u.rol === 'tecnico').length,
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-[#003527] text-white rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#b2f746]" />
          {toast}
        </div>
      )}

      {/* Modal reset password */}
      {modalReset && (
        <ModalResetPassword
          usuario={modalReset}
          onClose={() => setModalReset(null)}
          onDone={() => { setModalReset(null); mostrarToast('Contraseña actualizada') }}
        />
      )}

      {/* Modal eliminar */}
      {modalEliminar && (
        <ModalEliminar
          usuario={modalEliminar}
          onClose={() => setModalEliminar(null)}
          onDone={() => {
            setUsuarios(prev => prev.filter(u => u.id !== modalEliminar.id))
            setModalEliminar(null)
            mostrarToast('Usuario eliminado')
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface flex items-center gap-2">
            <Users size={24} className="text-primary-container" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-outline mt-1">{stats.total} usuarios registrados</p>
        </div>
        <button
          onClick={cargarUsuarios}
          disabled={loading}
          className="p-2 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low transition-colors text-outline disabled:opacity-50">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total',      value: stats.total,      color: '#003527', bg: '#f0fdf4' },
          { label: 'Activos',    value: stats.activos,    color: '#166534', bg: '#dcfce7' },
          { label: 'Ciudadanos', value: stats.ciudadanos, color: '#166534', bg: '#f0fdf4' },
          { label: 'Operadores', value: stats.operadores, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Técnicos',   value: stats.tecnicos,   color: '#92400e', bg: '#fffbeb' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-2xl p-4 border border-outline-variant/20" style={{ background: bg }}>
            <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
            <p className="text-xs font-semibold text-outline mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, celular o documento..."
            className="w-full h-11 pl-9 pr-4 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        {/* Filtro rol */}
        <select
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value as Rol | 'todos')}
          className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 cursor-pointer">
          <option value="todos">Todos los roles</option>
          <option value="ciudadano">Ciudadanos</option>
          <option value="operador">Operadores</option>
          <option value="tecnico">Técnicos</option>
        </select>

        {/* Filtro estado */}
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as Estado | 'todos')}
          className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 cursor-pointer">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="suspendido">Suspendidos</option>
        </select>
      </div>

      {/* Tabla / lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-outline">
            <div className="w-8 h-8 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
            <p className="text-sm">Cargando usuarios...</p>
          </div>
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="text-center py-20 text-outline">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No se encontraron usuarios</p>
          <p className="text-sm mt-1">Prueba con otros filtros o términos de búsqueda</p>
        </div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block bg-white rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/20">
                  <th className="text-left px-4 py-3 text-[11px] font-extrabold tracking-widest text-outline uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-[11px] font-extrabold tracking-widest text-outline uppercase">Contacto</th>
                  <th className="text-left px-4 py-3 text-[11px] font-extrabold tracking-widest text-outline uppercase">Rol</th>
                  <th className="text-left px-4 py-3 text-[11px] font-extrabold tracking-widest text-outline uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-extrabold tracking-widest text-outline uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {usuariosFiltrados.map(usuario => (
                  <tr key={usuario.id} className="hover:bg-surface-container-low/50 transition-colors">
                    {/* Usuario */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm text-white"
                          style={{ background: ROL_CONFIG[usuario.rol]?.color ?? '#003527' }}>
                          {usuario.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface leading-none">{usuario.nombre}</p>
                          <p className="text-[11px] text-outline mt-0.5">DNI: {usuario.documento}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contacto */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-on-surface">{usuario.correo}</p>
                      <p className="text-[11px] text-outline">+51 {usuario.celular}</p>
                    </td>

                    {/* Rol */}
                    <td className="px-4 py-3">
                      <RolChip rol={usuario.rol} />
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <EstadoChip estado={usuario.estado} />
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Cambiar rol */}
                        <RolSelector usuario={usuario} onUpdate={actualizarLocal} />

                        {/* Toggle estado */}
                        <button
                          onClick={() => toggleEstado(usuario)}
                          title={usuario.estado === 'activo' ? 'Suspender' : 'Activar'}
                          className={`p-1.5 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1
                            ${usuario.estado === 'activo'
                              ? 'bg-[#fee2e2] text-[#991b1b] hover:bg-[#fecaca]'
                              : 'bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]'}`}>
                          {usuario.estado === 'activo' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                          {usuario.estado === 'activo' ? 'Suspender' : 'Activar'}
                        </button>

                        {/* Reset password */}
                        <button
                          onClick={() => setModalReset(usuario)}
                          title="Restablecer contraseña"
                          className="p-1.5 rounded-lg bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#dbeafe] transition-colors flex items-center gap-1 text-xs font-semibold">
                          <Key size={14} />
                          Clave
                        </button>

                        {/* Eliminar */}
                        <button
                          onClick={() => setModalEliminar(usuario)}
                          title="Eliminar usuario"
                          className="p-1.5 rounded-lg bg-[#fef2f2] text-[#991b1b] hover:bg-[#fee2e2] transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {usuariosFiltrados.map(usuario => (
              <div key={usuario.id} className="bg-white rounded-2xl border border-outline-variant/20 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm text-white"
                    style={{ background: ROL_CONFIG[usuario.rol]?.color ?? '#003527' }}>
                    {usuario.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-on-surface text-sm leading-none">{usuario.nombre}</p>
                    <p className="text-[11px] text-outline mt-0.5">{usuario.correo}</p>
                    <p className="text-[11px] text-outline">+51 {usuario.celular} · DNI: {usuario.documento}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <RolChip rol={usuario.rol} />
                      <EstadoChip estado={usuario.estado} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-outline-variant/20">
                  <RolSelector usuario={usuario} onUpdate={actualizarLocal} />
                  <button
                    onClick={() => toggleEstado(usuario)}
                    className={`flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors
                      ${usuario.estado === 'activo' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#dcfce7] text-[#166534]'}`}>
                    {usuario.estado === 'activo' ? <><XCircle size={12} /> Suspender</> : <><CheckCircle2 size={12} /> Activar</>}
                  </button>
                  <button
                    onClick={() => setModalReset(usuario)}
                    className="flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 bg-[#eff6ff] text-[#1d4ed8]">
                    <Key size={12} /> Clave
                  </button>
                  <button
                    onClick={() => setModalEliminar(usuario)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center bg-[#fef2f2] text-[#991b1b]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Contador */}
          <p className="text-xs text-outline text-center">
            Mostrando {usuariosFiltrados.length} de {usuarios.length} usuarios
          </p>
        </>
      )}
    </div>
  )
}
