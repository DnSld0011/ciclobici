'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Map, Bike, Building2, Wrench, TrendingUp,
  Menu, X, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/operador/mapa', label: 'Mapa en Tiempo Real', icon: Map },
  { href: '/operador/estaciones', label: 'Estaciones', icon: Building2 },
  { href: '/operador/bicicletas', label: 'Bicicletas', icon: Bike },
  { href: '/operador/mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { href: '/operador/prediccion', label: 'Predicción', icon: TrendingUp },
]

export function SidebarOperador() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-blue-700 text-white p-2 rounded-md"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-full bg-blue-900 text-white transition-all duration-300 flex flex-col',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blue-800">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-xl">🚲</span>
              <span className="font-bold text-lg">CicloBici</span>
            </div>
          )}
          {collapsed && <span className="text-xl mx-auto">🚲</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex text-blue-300 hover:text-white p-1 rounded"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 hover:text-white transition-colors text-sm font-medium w-full"
            title={collapsed ? 'Cerrar Sesión' : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
