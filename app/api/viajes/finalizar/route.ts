import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Auth: leer sesión del ciudadano desde cookies
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { viaje_id, estacion_destino_id, distancia_km } = await req.json()
  if (!viaje_id || !estacion_destino_id) {
    return NextResponse.json({ error: 'viaje_id y estacion_destino_id son requeridos' }, { status: 400 })
  }

  // Usar admin para todas las operaciones de DB
  const admin = createAdminClient()

  // Verificar que el viaje pertenece al usuario y está activo
  const { data: viaje, error: errViaje } = await admin
    .from('viajes')
    .select('id, bicicleta_id, inicio_at, estado, usuario_id')
    .eq('id', viaje_id)
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .single()

  if (errViaje || !viaje) {
    return NextResponse.json({ error: 'Viaje no encontrado o no está activo' }, { status: 404 })
  }

  // Verificar que la estación destino existe y está activa
  const { data: estacion } = await admin
    .from('estaciones')
    .select('id, capacidad, nombre')
    .eq('id', estacion_destino_id)
    .eq('estado', 'activa')
    .single()

  if (!estacion) {
    return NextResponse.json({ error: 'Estación destino no válida o inactiva' }, { status: 400 })
  }

  const { count: ocupadas } = await admin
    .from('bicicletas')
    .select('*', { count: 'exact', head: true })
    .eq('estacion_id', estacion_destino_id)
    .eq('estado', 'disponible')

  if ((ocupadas ?? 0) >= estacion.capacidad) {
    return NextResponse.json({ error: `La estación "${estacion.nombre}" está llena` }, { status: 409 })
  }

  const fin = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    fin_at: fin,
    estacion_destino_id,
    estado: 'finalizado',
  }
  if (typeof distancia_km === 'number' && distancia_km > 0) {
    updatePayload.distancia_km = distancia_km
  }

  const { data: viajeActualizado, error: errUpdate } = await admin
    .from('viajes')
    .update(updatePayload)
    .eq('id', viaje_id)
    .select()
    .single()

  if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 500 })

  // Devolver la bicicleta a la estación destino
  await admin
    .from('bicicletas')
    .update({ estado: 'disponible', estacion_id: estacion_destino_id })
    .eq('id', viaje.bicicleta_id)

  return NextResponse.json({ viaje: viajeActualizado })
}
