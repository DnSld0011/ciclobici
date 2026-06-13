'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [msg, setMsg] = useState('Verificando sesión...')

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()

      // Supabase needs a moment to exchange the hash token
      await new Promise(r => setTimeout(r, 800))

      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session?.user) {
        setMsg('Error al verificar sesión. Redirigiendo al login...')
        setTimeout(() => router.replace('/login'), 1500)
        return
      }

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', session.user.id)
        .single()

      if (perfil?.rol === 'operador')       router.replace('/operador/mapa')
      else if (perfil?.rol === 'tecnico')   router.replace('/tecnico/mantenimiento')
      else if (perfil?.rol === 'ciudadano') router.replace('/ciudadano/mapa')
      else {
        setMsg('Rol no reconocido. Redirigiendo al login...')
        setTimeout(() => router.replace('/login'), 1500)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4" />
        <p className="text-lg">{msg}</p>
      </div>
    </div>
  )
}
