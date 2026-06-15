'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Map, User, Home, Bike, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/ciudadano',        label: 'Inicio',  icon: Home },
  { href: '/ciudadano/mapa',   label: 'Mapa',    icon: Map  },
  { href: '/ciudadano/viajes', label: 'Viajes',  icon: Bike },
  { href: '/ciudadano/perfil', label: 'Perfil',  icon: User },
]

export function NavbarCiudadano() {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Top bar — desktop */}
      <header className="hidden md:flex bg-white border-b shadow-sm h-14 items-center justify-between px-6 sticky top-0 z-40">
        <Link href="/ciudadano" className="flex items-center gap-2 font-bold text-blue-700 text-lg">
          <span className="text-2xl">🚲</span> CicloBici
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${pathname === href || (href !== '/ciudadano' && pathname.startsWith(href))
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Icon size={16} />{label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors ml-2"
          >
            <LogOut size={16} /> Salir
          </button>
        </nav>
      </header>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg">
        <div className="flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/ciudadano' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors
                  ${active ? 'text-blue-700' : 'text-gray-500'}`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
