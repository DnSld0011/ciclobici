import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Inject pathname so async Server Component layouts can read it via headers()
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)

  const isProtected =
    pathname.startsWith('/ciudadano') ||
    pathname.startsWith('/operador') ||
    pathname.startsWith('/tecnico')

  if (!isProtected) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/ciudadano/:path*', '/operador/:path*', '/tecnico/:path*'],
}
