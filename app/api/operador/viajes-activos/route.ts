import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // El rol está en la tabla 'usuarios', columna 'rol'
    const admin = createAdminClient()

    const { data: perfil, error: errPerfil } = await admin
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (errPerfil || !perfil) {
      return NextResponse.json({ error: `Perfil no encontrado: ${errPerfil?.message}` }, { status: 403 })
    }

    if (!['operador', 'tecnico', 'administrador'].includes(perfil.rol)) {
      return NextResponse.json({ error: `Rol sin permiso: ${perfil.rol}` }, { status: 403 })
    }

    // ── Recorrido punto por punto de un viaje activo ──
    const viajeId = request.nextUrl.searchParams.get('viaje_id')
    if (viajeId) {
      const { data: waypoints } = await admin
        .from('viaje_waypoints')
        .select('lat, lng, recorded_at')
        .eq('viaje_id', viajeId)
        .order('recorded_at', { ascending: true })
        .limit(2000)
      return NextResponse.json({ waypoints: waypoints ?? [] })
    }

    // Obtener viajes activos (sin joins complejos para evitar errores de FK)
    const { data: viajes, error: errViajes } = await admin
      .from('viajes')
      .select('id, inicio_at, usuario_id, bicicleta_id, estacion_origen_id, lat, lng')
      .eq('estado', 'activo')
      .order('inicio_at', { ascending: false })

    if (errViajes) {
      return NextResponse.json({ error: errViajes.message }, { status: 500 })
    }

    if (!viajes || viajes.length === 0) {
      return NextResponse.json({ viajes: [] })
    }

    // Enriquecer con datos de usuario, bicicleta y estación en queries separadas
    const usuarioIds   = [...new Set(viajes.map(v => v.usuario_id).filter(Boolean))]
    const bicicletaIds = [...new Set(viajes.map(v => v.bicicleta_id).filter(Boolean))]
    const estacionIds  = [...new Set(viajes.map(v => v.estacion_origen_id).filter(Boolean))]

    const [{ data: usuarios }, { data: bicicletas }, { data: estaciones }] = await Promise.all([
      admin.from('usuarios').select('id, nombre, email').in('id', usuarioIds),
      admin.from('bicicletas').select('id, codigo, tipo').in('id', bicicletaIds),
      admin.from('estaciones').select('id, nombre, latitud, longitud, direccion').in('id', estacionIds),
    ])

    const usuarioMap   = Object.fromEntries((usuarios ?? []).map(u => [u.id, u]))
    const bicicletaMap = Object.fromEntries((bicicletas ?? []).map(b => [b.id, b]))
    const estacionMap  = Object.fromEntries((estaciones ?? []).map(e => [e.id, e]))

    const viajesEnriquecidos = viajes.map(v => ({
      id: v.id,
      inicio_at: v.inicio_at,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      usuario: usuarioMap[v.usuario_id] ?? null,
      bicicleta: bicicletaMap[v.bicicleta_id] ?? null,
      estacion_origen: estacionMap[v.estacion_origen_id] ?? null,
    }))

    return NextResponse.json({ viajes: viajesEnriquecidos })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
