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

      // Supabase processes the hash token on getSession
      await new Promise(r => setTimeout(r, 800))

      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session?.user) {
        setMsg('Error al verificar sesión. Redirigiendo al login...')
        setTimeout(() => router.replace('/login'), 1500)
        return
      }

      const user = session.user

      // Si es un recovery (reset de contraseña), ir a la página de nueva contraseña
      // Supabase pone type=recovery en el hash cuando viene de un password reset
      const hash = window.location.hash
      if (hash.includes('type=recovery')) {
        router.replace('/auth/reset-password')
        return
      }

      // Verificar si el perfil existe; si no, crearlo desde los metadatos del signUp
      const { data: perfilExistente } = await supabase
        .from('usuarios').select('id, rol').eq('id', user.id).maybeSingle()

      if (!perfilExistente) {
        const meta = user.user_metadata ?? {}
        if (meta.nombre) {
          await supabase.from('usuarios').insert({
            id:        user.id,
            nombre:    meta.nombre,
            documento: meta.documento ?? '',
            correo:    user.email ?? '',
            celular:   meta.celular ?? '',
            estado:   'activo',
            rol:      'ciudadano',
          })
        } else {
          // Sin metadatos de perfil — completar registro manualmente
          router.replace(`/registro?correo=${encodeURIComponent(user.email ?? '')}`)
          return
        }
      }

      const { data: perfil } = await supabase
        .from('usuarios').select('rol').eq('id', user.id).maybeSingle()

      if (perfil?.rol === 'administrador' || perfil?.rol === 'operador') router.replace('/operador')
      else if (perfil?.rol === 'tecnico') router.replace('/tecnico/mantenimiento')
      else                                router.replace('/ciudadano')
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-on-surface text-center space-y-4">
        <div className="w-10 h-10 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin mx-auto" />
        <p className="text-sm text-outline">{msg}</p>
      </div>
    </div>
  )
}
