import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCache, setCache } from '@/lib/server/memoCache'

export interface UserAccess {
  userId: string
  rol: string
  vistas: string[]
  rolNombre: string
  rolColor: string
}

// Vistas por defecto cuando el rol no tiene entrada en la tabla `roles`
const VISTAS_FALLBACK: Record<string, string[]> = {
  ciudadano: [
    '/ciudadano',
    '/ciudadano/mapa',
    '/ciudadano/viajes',
    '/ciudadano/escanear',
    '/ciudadano/viaje',
    '/ciudadano/viaje-activo',
    '/ciudadano/incidencias',
    '/ciudadano/incidencias/historial',
    '/ciudadano/perfil',
  ],
  operador: [
    '/operador',
    '/operador/viajes-en-vivo',
    '/operador/viajes',
    '/operador/traslados',
    '/operador/mapa',
    '/operador/alertas',
    '/operador/estaciones',
    '/operador/bicicletas',
    '/operador/mantenimiento',
    '/operador/asignacion',
    '/operador/prediccion',
  ],
  administrador: [
    '/operador',
    '/operador/admin',
    '/operador/viajes-en-vivo',
    '/operador/viajes',
    '/operador/traslados',
    '/operador/mapa',
    '/operador/alertas',
    '/operador/estaciones',
    '/operador/bicicletas',
    '/operador/mantenimiento',
    '/operador/asignacion',
    '/operador/prediccion',
    '/operador/kpis',
    '/operador/stock',
    '/operador/usuarios',
    '/operador/roles',
  ],
  tecnico: [
    '/tecnico/mantenimiento',
    '/tecnico/traslados',
    '/tecnico/bicicletas',
    '/tecnico/incidencias',
    '/tecnico/historial',
  ],
}

// cache() de React deduplica dentro del mismo request (layout + page);
// el memoCache evita repetir las consultas de rol/vistas en cada
// navegación (TTL 2 min — un cambio de permisos tarda máx. eso en verse).
export const getUserAccess = cache(async (): Promise<UserAccess | null> => {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const cacheKey = `access:${user.id}`
    const hit = getCache<UserAccess>(cacheKey)
    if (hit) return hit

    const admin = createAdminClient()

    const { data: perfil } = await admin
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!perfil) return null
    const rol = perfil.rol as string

    const { data: rolData } = await admin
      .from('roles')
      .select('vistas, nombre, color')
      .eq('id', rol)
      .maybeSingle()

    // Rutas funcionales core que siempre deben ser accesibles aunque el rol tenga vistas custom
    const VISTAS_CORE: Record<string, string[]> = {
      ciudadano: [
        '/ciudadano/viaje-activo', '/ciudadano/escanear', '/ciudadano/viaje',
        '/ciudadano/incidencias', '/ciudadano/incidencias/historial',
      ],
      // Rutas nuevas accesibles aunque el rol tenga vistas custom antiguas
      operador:      ['/operador/viajes', '/operador/traslados'],
      administrador: ['/operador/viajes', '/operador/traslados'],
      tecnico:       ['/tecnico/traslados'],
    }
    const vistasBD = rolData?.vistas as string[] | undefined
    const vistas =
      vistasBD && vistasBD.length > 0
        ? [...new Set([...vistasBD, ...(VISTAS_CORE[rol] ?? [])])]
        : (VISTAS_FALLBACK[rol] ?? [])

    const access: UserAccess = {
      userId: user.id,
      rol,
      vistas,
      rolNombre: rolData?.nombre ?? rol,
      rolColor: rolData?.color ?? '#6b7280',
    }
    setCache(cacheKey, access, 120_000)
    return access
  } catch {
    return null
  }
})

// Rutas raíz de grupo: sólo coinciden con la ruta exacta, no con sub-rutas
const GROUP_ROOTS = ['/ciudadano', '/operador', '/tecnico']

export function isVistaPermitida(pathname: string, vistas: string[]): boolean {
  return vistas.some(v => {
    if (pathname === v) return true
    // Sub-rutas: /operador/kpis permite /operador/kpis/algo
    // Pero /operador NO permite /operador/kpis (sería la raíz de grupo)
    if (!GROUP_ROOTS.includes(v) && pathname.startsWith(v + '/')) return true
    return false
  })
}
