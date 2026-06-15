'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Map, Bike, Building2, Wrench,
  TrendingUp, Bell, Menu, X, LogOut, Activity
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/operador',                   label: 'Dashboard',      icon: LayoutDashboard, exact: true },
  { href: '/operador/viajes-en-vivo',    label: 'Viajes en vivo', icon: Activity },
  { href: '/operador/mapa',              label: 'Mapa en vivo',   icon: Map },
  { href: '/operador/alertas',           label: 'Alertas',        icon: Bell },
  { href: '/operador/estaciones',        label: 'Estaciones',     icon: Building2 },
  { href: '/operador/bicicletas',        label: 'Bicicletas',     icon: Bike },
  { href: '/operador/mantenimiento',     label: 'Mantenimiento',  icon: Wrench },
  { href: '/operador/prediccion',        label: 'Predicción',     icon: TrendingUp },
]

export function SidebarOperador() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0)
  const [viajesActivos, setViajesActivos]     = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const refrescarAlertas = () =>
      supabase.from('alertas').select('*', { count: 'exact', head: true }).eq('leida', false)
        .then(({ count }) => setAlertasNoLeidas(count ?? 0))

    const refrescarViajes = () =>
      supabase.from('viajes').select('*', { count: 'exact', head: true }).eq('estado', 'activo')
        .then(({ count }) => setViajesActivos(count ?? 0))

    refrescarAlertas()
    refrescarViajes()

    const ch = supabase.channel('sidebar-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, refrescarAlertas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, refrescarViajes)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
  }

  const sidebarContent = (
    <aside className="flex flex-col h-full bg-white border-r border-outline-variant/30 w-64">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-outline-variant/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center text-base">🚲</div>
          <div>
            <p className="font-extrabold text-sm text-primary-container leading-none">San Borja en Bici</p>
            <p className="text-[10px] text-outline mt-0.5">Centro de Control</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative
                ${active
                  ? 'bg-primary-container text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
              {label === 'Alertas' && alertasNoLeidas > 0 && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${active ? 'bg-white/20 text-white' : 'bg-error text-white'}`}>
                  {alertasNoLeidas > 9 ? '9+' : alertasNoLeidas}
                </span>
              )}
              {label === 'Viajes en vivo' && viajesActivos > 0 && (
                <span className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${active ? 'bg-white/20 text-white' : 'bg-[#064e3b] text-[#b2f746]'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b2f746] animate-pulse" />
                  {viajesActivos}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-outline-variant/20 space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
        >
          <LogOut size={17} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-primary-container text-white p-2 rounded-lg shadow-md"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar — fixed */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-40 w-64">
        {sidebarContent}
      </div>

      {/* Mobile sidebar — slide in */}
      <div className={`fixed left-0 top-0 h-full z-50 w-64 transition-transform duration-300 md:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>
    </>
  )
}
