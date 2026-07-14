import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/operador/historial              → viajes finalizados (máx 2000, recientes primero)
// GET /api/operador/historial?viaje_id=X   → detalle + waypoints GPS de un viaje
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const admin = createAdminClient()

    const { data: perfil } = await admin
      .from('usuarios').select('rol').eq('id', user.id).single()
    if (!perfil || !['operador', 'tecnico', 'administrador'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const viajeId = searchParams.get('viaje_id')

    // ── Detalle de un viaje: waypoints GPS ──────────────────────
    if (viajeId) {
      const { data: waypoints } = await admin
        .from('viaje_waypoints')
        .select('lat, lng, recorded_at')
        .eq('viaje_id', viajeId)
        .order('recorded_at', { ascending: true })
      return NextResponse.json({ waypoints: waypoints ?? [] })
    }

    // ── Lista de viajes finalizados ─────────────────────────────
    const { data: viajes, error } = await admin
      .from('viajes')
      .select('id, usuario_id, bicicleta_id, estacion_origen_id, estacion_destino_id, inicio_at, fin_at, duracion_min, distancia_km, calificacion')
      .eq('estado', 'finalizado')
      .order('inicio_at', { ascending: false })
      .limit(2000)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!viajes?.length) return NextResponse.json({ viajes: [] })

    const usuarioIds   = [...new Set(viajes.map(v => v.usuario_id).filter(Boolean))]
    const bicicletaIds = [...new Set(viajes.map(v => v.bicicleta_id).filter(Boolean))]
    const estacionIds  = [...new Set([
      ...viajes.map(v => v.estacion_origen_id),
      ...viajes.map(v => v.estacion_destino_id),
    ].filter(Boolean))]

    const [{ data: usuarios }, { data: bicicletas }, { data: estaciones }] = await Promise.all([
      admin.from('usuarios').select('id, nombre, correo').in('id', usuarioIds),
      admin.from('bicicletas').select('id, codigo, tipo').in('id', bicicletaIds),
      admin.from('estaciones').select('id, nombre, latitud, longitud').in('id', estacionIds),
    ])

    const uMap = Object.fromEntries((usuarios ?? []).map(u => [u.id, u]))
    const bMap = Object.fromEntries((bicicletas ?? []).map(b => [b.id, b]))
    const eMap = Object.fromEntries((estaciones ?? []).map(e => [e.id, e]))

    return NextResponse.json({
      viajes: viajes.map(v => ({
        id:            v.id,
        inicio_at:     v.inicio_at,
        fin_at:        v.fin_at,
        duracion_min:  v.duracion_min,
        distancia_km:  v.distancia_km,
        calificacion:  v.calificacion,
        usuario:       uMap[v.usuario_id] ?? null,
        bicicleta:     bMap[v.bicicleta_id] ?? null,
        origen:        eMap[v.estacion_origen_id] ?? null,
        destino:       eMap[v.estacion_destino_id] ?? null,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
