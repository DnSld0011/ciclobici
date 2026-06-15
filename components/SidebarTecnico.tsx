'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Wrench, AlertTriangle, Bike, Menu, X, ClipboardList, LogOut } from 'lucide-react'

const NAV = [
  { href: '/tecnico/mantenimiento', label: 'Mantenimiento',  icon: Wrench },
  { href: '/tecnico/incidencias',   label: 'Incidencias',    icon: AlertTriangle },
  { href: '/tecnico/bicicletas',    label: 'Bicicletas',     icon: Bike },
  { href: '/tecnico/historial',     label: 'Mi historial',   icon: ClipboardList },
]

export function SidebarTecnico() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pendientes, setPendientes] = useState(0)
  const supabase = createClient()

  const cargarPendientes = useCallback(async () => {
    const { count } = await supabase
      .from('incidencias')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
    setPendientes(count ?? 0)
  }, [supabase])

  useEffect(() => {
    cargarPendientes()
    const ch = supabase.channel('tecnico-incidencias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, cargarPendientes)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargarPendientes, supabase])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-outline-variant/15">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#b2f746' }}>
            <Wrench size={18} style={{ color: '#002117' }} />
          </div>
          <div>
            <p className="font-extrabold text-sm text-on-surface leading-none">Panel Técnico</p>
            <p className="text-[10px] text-outline mt-0.5">San Borja en Bici</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const badge = label === 'Incidencias' && pendientes > 0 ? pendientes : null
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? 'bg-primary-container text-white shadow-sm'
                  : 'text-on-surface hover:bg-surface-container-low'
              }`}>
              <Icon size={17} className={active ? 'text-white' : 'text-outline'} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  active ? 'bg-white/20 text-white' : 'bg-[#ffdad6] text-error'
                }`}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-outline-variant/15">
        <button onClick={cerrarSesion}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-outline hover:bg-surface-container-low hover:text-error transition-all">
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-60 bg-white border-r border-outline-variant/15 z-30 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-xl flex items-center justify-center shadow-md border border-outline-variant/20 bg-white">
        <Menu size={18} className="text-on-surface" />
      </button>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
          <aside className="md:hidden fixed left-0 top-0 h-screen w-60 bg-white z-50 shadow-2xl">
            <div className="absolute top-4 right-4">
              <button onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center">
                <X size={16} className="text-outline" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}
