'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Map, User, Home, Bike, AlertTriangle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/ciudadano',              label: 'Inicio',   icon: Home },
  { href: '/ciudadano/mapa',         label: 'Mapa',     icon: Map  },
  { href: '/ciudadano/viajes',       label: 'Viajes',   icon: Bike },
  { href: '/ciudadano/incidencias',  label: 'Reportar', icon: AlertTriangle },
  { href: '/ciudadano/perfil',       label: 'Perfil',   icon: User },
]

export function NavbarCiudadano() {
  const router = useRouter()
  const pathname = usePathname()
  const [viajeActivo, setViajeActivo] = useState(false)

  useEffect(() => {
    fetch('/api/viajes/activo')
      .then(r => r.json())
      .then(({ viaje }) => setViajeActivo(!!viaje))
      .catch(() => {})
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Banner viaje activo */}
      {viajeActivo && (
        <Link
          href="/ciudadano/viaje-activo"
          className="fixed top-0 left-0 right-0 z-50 bg-[#064e3b] text-white flex items-center justify-center gap-2 py-2 text-xs font-bold shadow-md md:hidden"
        >
          <div className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse" />
          Viaje en curso — Toca para ver detalles
        </Link>
      )}

      {/* Top bar — desktop */}
      <header className="hidden md:flex bg-white border-b shadow-sm h-14 items-center justify-between px-6 sticky top-0 z-40">
        <Link href="/ciudadano" className="flex items-center gap-2 font-extrabold text-primary-container text-lg">
          <span className="text-2xl">🚲</span> San Borja en Bici
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/ciudadano' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                  ${active
                    ? 'bg-surface-container-low text-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <Icon size={15} />{label}
              </Link>
            )
          })}
          {viajeActivo && (
            <Link
              href="/ciudadano/viaje-activo"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-[#064e3b] bg-[#b2f746] hover:bg-[#98da27] transition-colors ml-1"
            >
              <div className="w-2 h-2 rounded-full bg-[#064e3b] animate-pulse" />
              Viaje activo
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-error-container hover:text-error transition-colors ml-2"
          >
            <LogOut size={15} /> Salir
          </button>
        </nav>
      </header>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-outline-variant/30 shadow-lg safe-area-pb">
        <div className="flex items-center">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/ciudadano' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-semibold transition-colors
                  ${active ? 'text-primary-container' : 'text-on-surface-variant'}`}>
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-container mb-0.5 transition-all" />
                )}
                <Icon size={active ? 20 : 19} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
