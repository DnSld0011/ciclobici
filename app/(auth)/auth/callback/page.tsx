'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('id', session.user.id)
          .single()

        if (perfil?.rol === 'operador')  router.replace('/operador/mapa')
        else if (perfil?.rol === 'tecnico') router.replace('/tecnico/mantenimiento')
        else router.replace('/ciudadano/mapa')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4" />
        <p className="text-lg">Iniciando sesión...</p>
      </div>
    </div>
  )
}
