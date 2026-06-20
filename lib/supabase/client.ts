import { createBrowserClient } from '@supabase/ssr'

// 1 año — la sesión persiste aunque el usuario cierre la PWA
const SESSION_MAX_AGE = 60 * 60 * 24 * 365
const LS_KEY_PREFIX = 'sbbici_cookie_'

function parseCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined') return []
  return document.cookie.split(';').flatMap(c => {
    const idx = c.indexOf('=')
    if (idx < 0) return []
    const name  = c.slice(0, idx).trim()
    const value = c.slice(idx + 1).trim()
    return name ? [{ name, value }] : []
  })
}

function setCookiePersistente(name: string, value: string, maxAge = SESSION_MAX_AGE) {
  if (typeof document === 'undefined') return
  const parts = [
    `${name}=${value}`,
    `path=/`,
    `max-age=${maxAge}`,
    `SameSite=Lax`,
  ]
  if (location.protocol === 'https:') parts.push('Secure')
  document.cookie = parts.join('; ')

  // Respaldo en localStorage para que la PWA sobreviva reinicios
  try {
    if (value) {
      localStorage.setItem(LS_KEY_PREFIX + name, value)
    } else {
      localStorage.removeItem(LS_KEY_PREFIX + name)
    }
  } catch { /* storage lleno o modo privado */ }
}

function getAll(): { name: string; value: string }[] {
  const fromCookies = parseCookies()

  // Si las cookies de sesión de Supabase no están (app recién abierta),
  // restaurarlas desde localStorage antes de que el cliente intente refrescar
  if (typeof localStorage !== 'undefined') {
    const cookieNames = new Set(fromCookies.map(c => c.name))
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LS_KEY_PREFIX)) continue
      const name  = key.slice(LS_KEY_PREFIX.length)
      const value = localStorage.getItem(key) ?? ''
      if (!cookieNames.has(name) && value) {
        // Restaurar la cookie con max-age largo
        setCookiePersistente(name, value)
        fromCookies.push({ name, value })
        cookieNames.add(name)
      }
    }
  }

  return fromCookies
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll,
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Si Supabase quiere borrar la cookie (maxAge 0 o -1), también limpiar localStorage
            const maxAge = (options as { maxAge?: number })?.maxAge
            if (maxAge !== undefined && maxAge <= 0) {
              setCookiePersistente(name, '', 0)
            } else {
              setCookiePersistente(name, value)
            }
          })
        },
      },
    }
  )
}
