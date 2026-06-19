import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Inyectar pathname en los headers para que los layouts Server Component puedan leerlo
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars missing, pass through (pages will handle gracefully)
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    const publicRoutes = ['/login', '/registro', '/verificacion', '/api/']
    const isPublic = publicRoutes.some(r => pathname.startsWith(r))

    if (isPublic) {
      return supabaseResponse
    }

    // Error de red/servidor al validar el token (no "no hay sesión") — no expulsar al usuario,
    // dejar pasar y que la página lo reintente en el cliente.
    if (userError && userError.name !== 'AuthSessionMissingError') {
      return supabaseResponse
    }

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('usuarios')
      .select('rol, estado')
      .eq('id', user.id)
      .single()

    // Error transitorio de base de datos — no es lo mismo que "el perfil no existe".
    if (perfilError && perfilError.code !== 'PGRST116') {
      return supabaseResponse
    }

    if (!perfil) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (perfil.estado === 'pendiente' && !pathname.startsWith('/verificacion')) {
      return NextResponse.redirect(new URL('/verificacion', request.url))
    }

    if (pathname.startsWith('/operador') && !['operador', 'administrador'].includes(perfil.rol)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (pathname.startsWith('/tecnico') && !['tecnico', 'operador', 'administrador'].includes(perfil.rol)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (pathname.startsWith('/ciudadano') && !['ciudadano', 'administrador'].includes(perfil.rol)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return supabaseResponse
  } catch {
    // Error inesperado (timeout, red, etc.) — NO expulsar al usuario a /login.
    // La sesión real no se perdió; dejamos pasar y cada página valida por su cuenta.
    return supabaseResponse
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|sw.js|api/).*)'],
}
