'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function loginAction(formData: FormData) {
  const identifier = (formData.get('identifier') as string ?? '').trim().toLowerCase()
  const password   = (formData.get('password')   as string ?? '').trim()

  if (!identifier || !password) {
    return { error: 'Ingresa tu correo/celular y contraseña' }
  }

  const admin = createAdminClient()
  let emailToUse = identifier

  if (!identifier.includes('@')) {
    const phone = identifier.replace(/\D/g, '')
    const { data: usuario } = await admin
      .from('usuarios').select('correo').eq('celular', phone).maybeSingle()
    if (!usuario?.correo) {
      return { error: 'No encontramos una cuenta con ese número de celular' }
    }
    emailToUse = usuario.correo
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  })

  if (signInError) {
    if (signInError.message.includes('Invalid login') || signInError.message.includes('invalid_credentials')) {
      return { error: 'Correo/teléfono o contraseña incorrectos' }
    }
    if (signInError.message.includes('Email not confirmed')) {
      return { error: 'Confirma tu correo electrónico antes de iniciar sesión' }
    }
    return { error: signInError.message }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No se pudo obtener la sesión' }

  const { data: perfil } = await admin
    .from('usuarios').select('rol, estado').eq('id', user.id).maybeSingle()

  if (!perfil) {
    return { redirectTo: `/registro?correo=${encodeURIComponent(user.email ?? '')}` }
  }
  if (perfil.estado === 'suspendido') {
    await supabase.auth.signOut()
    return { error: 'Tu cuenta está suspendida. Contacta al administrador.' }
  }

  if (perfil.rol === 'administrador' || perfil.rol === 'operador') return { redirectTo: '/operador' }
  if (perfil.rol === 'tecnico') return { redirectTo: '/tecnico/mantenimiento' }
  return { redirectTo: '/ciudadano' }
}
