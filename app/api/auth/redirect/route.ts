import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// El browser navega aquí después del login para que el servidor lea la cookie y redirija
export async function GET(req: Request) {
  const origin = new URL(req.url).origin

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=sin-sesion`)
    }

    const admin = createAdminClient()
    const { data: perfil } = await admin
      .from('usuarios')
      .select('rol, estado')
      .eq('id', user.id)
      .maybeSingle()

    if (!perfil) {
      return NextResponse.redirect(`${origin}/registro?correo=${encodeURIComponent(user.email ?? '')}`)
    }
    if (perfil.estado === 'suspendido') {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=suspendido`)
    }

    if (perfil.rol === 'administrador' || perfil.rol === 'operador')
      return NextResponse.redirect(`${origin}/operador`)
    if (perfil.rol === 'tecnico')
      return NextResponse.redirect(`${origin}/tecnico/mantenimiento`)
    return NextResponse.redirect(`${origin}/ciudadano`)

  } catch {
    return NextResponse.redirect(`${origin}/login?error=error-interno`)
  }
}
