import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { pathname } = request.nextUrl

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    const publicRoutes = ['/login', '/registro', '/verificacion', '/api/']
    const isPublic = publicRoutes.some(r => pathname.startsWith(r))

    if (isPublic) {
      return supabaseResponse
    }

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol, estado')
      .eq('id', user.id)
      .single()

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
    // On Supabase error, redirect protected routes to login
    const publicRoutes = ['/login', '/registro', '/verificacion', '/api/']
    if (!publicRoutes.some(r => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|sw.js|api/).*)'],
}
