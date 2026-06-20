import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // 1. Autenticar usuario
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { viaje_id, estacion_destino_id, distancia_km } = await req.json()
  if (!viaje_id || !estacion_destino_id) {
    return NextResponse.json({ error: 'viaje_id y estacion_destino_id son requeridos' }, { status: 400 })
  }

  // 2. Usar cliente admin para todas las operaciones de BD
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

  // Verificar capacidad
  const { count: bicisAncladas } = await admin
    .from('bicicletas')
    .select('*', { count: 'exact', head: true })
    .eq('estacion_id', estacion_destino_id)

  if ((bicisAncladas ?? 0) >= estacion.capacidad) {
    return NextResponse.json(
      { error: `La estación "${estacion.nombre}" está llena (${bicisAncladas}/${estacion.capacidad} docks ocupados)` },
      { status: 409 }
    )
  }

  // Calcular duración
  const fin = new Date()
  const duracion_min = Math.max(1, Math.round((fin.getTime() - new Date(viaje.inicio_at).getTime()) / 60000))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    fin_at: fin.toISOString(),
    estacion_destino_id,
    estado: 'finalizado',
    duracion_min,
  }
  if (typeof distancia_km === 'number' && distancia_km > 0) {
    updatePayload.distancia_km = Math.round(distancia_km * 100) / 100
  }

  // Finalizar el viaje
  const { data: viajeActualizado, error: errUpdate } = await admin
    .from('viajes')
    .update(updatePayload)
    .eq('id', viaje_id)
    .select()
    .single()

  if (errUpdate || !viajeActualizado) {
    return NextResponse.json({ error: errUpdate?.message ?? 'Error al finalizar el viaje' }, { status: 500 })
  }

  // Devolver la bicicleta a la estación destino
  const { error: errBiciUpdate } = await admin
    .from('bicicletas')
    .update({ estado: 'disponible', estacion_id: estacion_destino_id })
    .eq('id', viaje.bicicleta_id)

  if (errBiciUpdate) {
    // El viaje ya está guardado. Solo loguear — la bici la puede ajustar el operador.
    console.error('[finalizar] Error al devolver bicicleta:', errBiciUpdate.message)
  }

  return NextResponse.json({ viaje: viajeActualizado })
}
