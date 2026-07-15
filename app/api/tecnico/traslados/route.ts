import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function autorizar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !['tecnico', 'operador', 'administrador'].includes(perfil.rol)) {
    return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  }
  return { admin, userId: user.id, rol: perfil.rol }
}

// ── GET: mis órdenes de traslado (técnico autenticado) ────────
export async function GET() {
  const auth = await autorizar()
  if ('error' in auth) return auth.error
  const { admin, userId } = auth

  const [{ data: ordenes }, { data: estaciones }] = await Promise.all([
    admin.from('ordenes_traslado')
      .select('*')
      .eq('tecnico_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('estaciones').select('id, nombre, direccion'),
  ])

  const eMap = Object.fromEntries((estaciones ?? []).map(e => [e.id, e]))

  return NextResponse.json({
    ordenes: (ordenes ?? []).map(o => ({
      ...o,
      origen_nombre:     o.estacion_origen_id ? (eMap[o.estacion_origen_id]?.nombre ?? 'Estación') : 'Depósito central',
      origen_direccion:  o.estacion_origen_id ? (eMap[o.estacion_origen_id]?.direccion ?? '') : '',
      destino_nombre:    eMap[o.estacion_destino_id]?.nombre ?? 'Estación',
      destino_direccion: eMap[o.estacion_destino_id]?.direccion ?? '',
    })),
  })
}

// ── POST: registrar una bici escaneada en la orden ────────────
// body: { orden_id, codigo }
export async function POST(request: NextRequest) {
  const auth = await autorizar()
  if ('error' in auth) return auth.error
  const { admin, userId } = auth

  const { orden_id, codigo } = await request.json()
  if (!orden_id || !codigo) {
    return NextResponse.json({ error: 'orden_id y codigo son requeridos' }, { status: 400 })
  }

  // 1. La orden debe ser del técnico y estar activa
  const { data: orden } = await admin
    .from('ordenes_traslado')
    .select('*')
    .eq('id', orden_id)
    .eq('tecnico_id', userId)
    .in('estado', ['pendiente', 'en_proceso'])
    .single()

  if (!orden) {
    return NextResponse.json({ error: 'Orden no encontrada o ya finalizada' }, { status: 404 })
  }

  // 2. Buscar la bicicleta por código o QR
  const { data: bici } = await admin
    .from('bicicletas')
    .select('id, codigo, tipo, estado, estacion_id')
    .or(`codigo.eq.${codigo},qr_code.eq.${codigo}`)
    .maybeSingle()

  if (!bici) {
    return NextResponse.json({ error: `No existe una bicicleta con código "${codigo}"` }, { status: 404 })
  }
  if (bici.estado === 'en_viaje') {
    return NextResponse.json({ error: `La bici ${bici.codigo} está en viaje — no se puede trasladar` }, { status: 409 })
  }
  if (bici.estacion_id === orden.estacion_destino_id) {
    return NextResponse.json({ error: `La bici ${bici.codigo} ya está en la estación destino` }, { status: 409 })
  }
  // Si la orden tiene estación origen definida, la bici debería salir de ahí
  if (orden.estacion_origen_id && bici.estacion_id !== orden.estacion_origen_id) {
    return NextResponse.json({
      error: `La bici ${bici.codigo} no está en la estación de origen de esta orden`,
    }, { status: 409 })
  }

  // 3. Mover la bicicleta a la estación destino
  const { error: errBici } = await admin
    .from('bicicletas')
    .update({ estacion_id: orden.estacion_destino_id, estado: 'disponible' })
    .eq('id', bici.id)

  if (errBici) return NextResponse.json({ error: errBici.message }, { status: 500 })

  // 4. Avanzar el progreso de la orden
  const trasladadas = orden.bicis_trasladadas + 1
  const completada  = trasladadas >= orden.cantidad

  const { data: ordenActualizada, error: errOrden } = await admin
    .from('ordenes_traslado')
    .update({
      bicis_trasladadas: trasladadas,
      estado:            completada ? 'completada' : 'en_proceso',
      completada_at:     completada ? new Date().toISOString() : null,
    })
    .eq('id', orden_id)
    .select()
    .single()

  if (errOrden) return NextResponse.json({ error: errOrden.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    bici: { codigo: bici.codigo, tipo: bici.tipo },
    orden: ordenActualizada,
    completada,
  })
}
