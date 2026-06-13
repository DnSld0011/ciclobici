import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public routes
  const publicRoutes = ['/login', '/registro', '/verificacion']
  if (publicRoutes.some(r => pathname.startsWith(r))) {
    if (user) {
      // Redirect authenticated users away from auth pages
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // No user → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch user profile for role/state checks
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol, estado')
    .eq('id', user.id)
    .single()

  if (!perfil) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Pending users must verify phone
  if (perfil.estado === 'pendiente' && !pathname.startsWith('/verificacion')) {
    return NextResponse.redirect(new URL('/verificacion', request.url))
  }

  // Route protection by role
  if (pathname.startsWith('/operador') && perfil.rol !== 'operador') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname.startsWith('/tecnico') && !['tecnico', 'operador'].includes(perfil.rol)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname.startsWith('/ciudadano') && perfil.rol !== 'ciudadano') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/prediccion).*)'],
}
