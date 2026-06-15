'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Map, User, Home, Bike, QrCode, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const NAV_LEFT  = [
  { href: '/ciudadano',       label: 'Inicio', icon: Home },
  { href: '/ciudadano/mapa',  label: 'Mapa',   icon: Map  },
]
const NAV_RIGHT = [
  { href: '/ciudadano/viajes', label: 'Viajes', icon: Bike },
  { href: '/ciudadano/perfil', label: 'Perfil', icon: User },
]

export function NavbarCiudadano() {
  const router   = useRouter()
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

  const navLink = (href: string, label: string, Icon: React.ElementType) => {
    const active = pathname === href || (href !== '/ciudadano' && pathname.startsWith(href))
    return (
      <Link key={href} href={href}
        className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors
          ${active ? 'text-primary-container' : 'text-on-surface-variant'}`}>
        {active && <div className="w-1 h-1 rounded-full bg-primary-container" />}
        <Icon size={active ? 20 : 19} strokeWidth={active ? 2.5 : 1.8} />
        {label}
      </Link>
    )
  }

  return (
    <>
      {/* Banner viaje activo — mobile */}
      {viajeActivo && (
        <Link href="/ciudadano/viaje-activo"
          className="fixed top-0 left-0 right-0 z-50 bg-[#064e3b] text-white flex items-center justify-center gap-2 py-2 text-xs font-bold shadow-md md:hidden">
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
          {[...NAV_LEFT, ...NAV_RIGHT].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/ciudadano' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                  ${active ? 'bg-surface-container-low text-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                <Icon size={15} />{label}
              </Link>
            )
          })}
          <Link href="/ciudadano/escanear"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ml-1"
            style={{ background: '#b2f746', color: '#002117' }}>
            <QrCode size={15} /> Escanear
          </Link>
          {viajeActivo && (
            <Link href="/ciudadano/viaje-activo"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-[#064e3b] bg-[#b2f746] hover:bg-[#98da27] transition-colors ml-1">
              <div className="w-2 h-2 rounded-full bg-[#064e3b] animate-pulse" />
              Viaje activo
            </Link>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-error-container hover:text-error transition-colors ml-2">
            <LogOut size={15} /> Salir
          </button>
        </nav>
      </header>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-outline-variant/20 shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* items-end: los tabs normales se alinean al fondo, el FAB sobresale por arriba */}
        <div className="flex items-end h-16">
          {NAV_LEFT.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}

          {/* FAB central — QR scanner */}
          <Link href="/ciudadano/escanear"
            className="flex-1 flex flex-col items-center justify-end pb-2 relative">
            {/* El FAB flota sobre la barra */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #b2f746 0%, #8ecf30 100%)',
                  boxShadow: '0 -2px 20px rgba(178,247,70,0.5), 0 6px 18px rgba(0,53,39,0.3)',
                }}>
                <QrCode size={24} style={{ color: '#002117' }} strokeWidth={2.2} />
              </div>
            </div>
            <span className="text-[10px] font-extrabold mt-1" style={{ color: '#446900' }}>Escanear</span>
          </Link>

          {NAV_RIGHT.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
        </div>
      </nav>
    </>
  )
}
