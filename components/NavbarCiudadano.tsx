'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Map, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './ui/button'

export function NavbarCiudadano() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-blue-700 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/ciudadano/mapa" className="flex items-center gap-2 font-bold text-lg" >
          <span>🚲</span>
          <span>CicloBici</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/ciudadano/mapa" className="flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm">
            <Map size={16} />
            <span className="hidden sm:inline">Mapa</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
