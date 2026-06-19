import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/* ── Rutas raíz de grupo: sólo coinciden exactas, no sus sub-rutas ── */
const GROUP_ROOTS = ['/ciudadano', '/operador', '/tecnico']

function isVistaPermitida(pathname: string, vistas: string[]): boolean {
  return vistas.some(v =>
    pathname === v || (!GROUP_ROOTS.includes(v) && pathname.startsWith(v + '/'))
  )
}

/* ── Vistas por defecto cuando el rol no tiene entrada en `roles` ── */
const VISTAS_FALLBACK: Record<string, string[]> = {
  ciudadano: [
    '/ciudadano', '/ciudadano/mapa', '/ciudadano/viajes', '/ciudadano/escanear',
    '/ciudadano/viaje', '/ciudadano/viaje-activo',
    '/ciudadano/incidencias', '/ciudadano/incidencias/historial', '/ciudadano/perfil',
  ],
  operador: [
    '/operador', '/operador/viajes-en-vivo', '/operador/mapa', '/operador/alertas',
    '/operador/estaciones', '/operador/bicicletas', '/operador/mantenimiento',
    '/operador/asignacion', '/operador/prediccion',
  ],
  administrador: [
    '/operador', '/operador/viajes-en-vivo', '/operador/mapa', '/operador/alertas',
    '/operador/estaciones', '/operador/bicicletas', '/operador/mantenimiento',
    '/operador/asignacion', '/operador/prediccion',
    '/operador/kpis', '/operador/stock', '/operador/usuarios', '/operador/roles',
  ],
  tecnico: [
    '/tecnico/mantenimiento', '/tecnico/bicicletas', '/tecnico/incidencias', '/tecnico/historial',
  ],
}

const HOME_POR_ROL: Record<string, string> = {
  administrador: '/operador',
  operador:      '/operador',
  tecnico:       '/tecnico/mantenimiento',
  ciudadano:     '/ciudadano',
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) return supabaseResponse

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

    if (isPublic) return supabaseResponse

    if (userError && userError.name !== 'AuthSessionMissingError') return supabaseResponse

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('usuarios')
      .select('rol, estado')
      .eq('id', user.id)
      .single()

    if (perfilError && perfilError.code !== 'PGRST116') return supabaseResponse
    if (!perfil) return NextResponse.redirect(new URL('/login', request.url))

    if (perfil.estado === 'pendiente' && !pathname.startsWith('/verificacion')) {
      return NextResponse.redirect(new URL('/verificacion', request.url))
    }

    const rol = perfil.rol as string

    // ── Protección por grupo de rol ──
    if (pathname.startsWith('/operador') && !['operador', 'administrador'].includes(rol)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (pathname.startsWith('/tecnico') && !['tecnico', 'operador', 'administrador'].includes(rol)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (pathname.startsWith('/ciudadano') && !['ciudadano', 'administrador'].includes(rol)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // ── Verificación de vistas configuradas para el rol ──
    const isAppRoute = GROUP_ROOTS.some(g => pathname.startsWith(g))
    if (!isAppRoute) return supabaseResponse

    // Obtener vistas del rol desde la BD usando service role para evitar RLS
    let vistas: string[] | null = null
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: rolData } = await admin
        .from('roles')
        .select('vistas')
        .eq('id', rol)
        .maybeSingle()

      if (rolData?.vistas && (rolData.vistas as string[]).length > 0) {
        vistas = rolData.vistas as string[]
      }
    }

    // Si no hay vistas configuradas en BD, usar fallback hardcodeado
    const vistasEfectivas = vistas ?? VISTAS_FALLBACK[rol] ?? []

    if (!isVistaPermitida(pathname, vistasEfectivas)) {
      const home = HOME_POR_ROL[rol] ?? '/login'
      return NextResponse.redirect(new URL(home, request.url))
    }

    return supabaseResponse
  } catch {
    return supabaseResponse
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|sw.js|api/).*)'],
}
