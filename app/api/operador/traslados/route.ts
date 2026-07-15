import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function autorizar(roles: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !roles.includes(perfil.rol)) {
    return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  }
  return { admin, userId: user.id, rol: perfil.rol }
}

// ── GET: lista de órdenes + técnicos disponibles ──────────────
export async function GET() {
  const auth = await autorizar(['operador', 'administrador', 'tecnico'])
  if ('error' in auth) return auth.error
  const { admin } = auth

  const [{ data: ordenes }, { data: tecnicos }, { data: estaciones }] = await Promise.all([
    admin.from('ordenes_traslado')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    admin.from('usuarios')
      .select('id, nombre, correo')
      .eq('rol', 'tecnico')
      .eq('estado', 'activo')
      .order('nombre'),
    admin.from('estaciones').select('id, nombre'),
  ])

  const eMap = Object.fromEntries((estaciones ?? []).map(e => [e.id, e.nombre]))
  const tMap = Object.fromEntries((tecnicos ?? []).map(t => [t.id, t.nombre]))

  return NextResponse.json({
    ordenes: (ordenes ?? []).map(o => ({
      ...o,
      origen_nombre:  o.estacion_origen_id ? (eMap[o.estacion_origen_id] ?? 'Estación') : 'Depósito central',
      destino_nombre: eMap[o.estacion_destino_id] ?? 'Estación',
      tecnico_nombre: o.tecnico_id ? (tMap[o.tecnico_id] ?? 'Técnico') : null,
    })),
    tecnicos: tecnicos ?? [],
  })
}

// ── POST: crear órdenes (designación del operador) ────────────
export async function POST(request: NextRequest) {
  const auth = await autorizar(['operador', 'administrador'])
  if ('error' in auth) return auth.error
  const { admin, userId } = auth

  const body = await request.json()
  const ordenes: {
    origen_id: string | null
    destino_id: string
    cantidad: number
    tecnico_id: string
    notas?: string
    fecha_objetivo?: string
  }[] = body.ordenes ?? []

  if (!ordenes.length) {
    return NextResponse.json({ error: 'Sin órdenes que crear' }, { status: 400 })
  }
  for (const o of ordenes) {
    if (!o.destino_id || !o.tecnico_id || !o.cantidad || o.cantidad < 1) {
      return NextResponse.json({ error: 'Cada orden requiere destino, técnico y cantidad válida' }, { status: 400 })
    }
  }

  const { data, error } = await admin
    .from('ordenes_traslado')
    .insert(ordenes.map(o => ({
      estacion_origen_id:  o.origen_id,
      estacion_destino_id: o.destino_id,
      cantidad:            o.cantidad,
      tecnico_id:          o.tecnico_id,
      creado_por:          userId,
      notas:               o.notas ?? null,
      fecha_objetivo:      o.fecha_objetivo ?? null,
      estado:              'pendiente',
    })))
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ordenes: data })
}

// ── PATCH: cancelar una orden ─────────────────────────────────
export async function PATCH(request: NextRequest) {
  const auth = await autorizar(['operador', 'administrador'])
  if ('error' in auth) return auth.error
  const { admin } = auth

  const { id, accion } = await request.json()
  if (!id || accion !== 'cancelar') {
    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('ordenes_traslado')
    .update({ estado: 'cancelada' })
    .eq('id', id)
    .in('estado', ['pendiente', 'en_proceso'])
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'La orden no existe o ya fue completada' }, { status: 400 })
  }
  return NextResponse.json({ orden: data })
}
