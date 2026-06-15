import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { viaje_id, estacion_destino_id } = await req.json()
  if (!viaje_id || !estacion_destino_id) {
    return NextResponse.json({ error: 'viaje_id y estacion_destino_id son requeridos' }, { status: 400 })
  }

  // Verificar que el viaje pertenece al usuario y está activo
  const { data: viaje, error: errViaje } = await supabase
    .from('viajes')
    .select('id, bicicleta_id, inicio_at, estado, usuario_id')
    .eq('id', viaje_id)
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .single()

  if (errViaje || !viaje) {
    return NextResponse.json({ error: 'Viaje no encontrado o no está activo' }, { status: 404 })
  }

  // Verificar que la estación destino tiene capacidad
  const { data: estacion } = await supabase
    .from('estaciones')
    .select('id, capacidad, nombre')
    .eq('id', estacion_destino_id)
    .eq('estado', 'activa')
    .single()

  if (!estacion) {
    return NextResponse.json({ error: 'Estación destino no válida o inactiva' }, { status: 400 })
  }

  const { count: ocupadas } = await supabase
    .from('bicicletas')
    .select('*', { count: 'exact', head: true })
    .eq('estacion_id', estacion_destino_id)
    .eq('estado', 'disponible')

  if ((ocupadas ?? 0) >= estacion.capacidad) {
    return NextResponse.json({ error: `La estación "${estacion.nombre}" está llena` }, { status: 409 })
  }

  const fin = new Date().toISOString()

  // Finalizar el viaje (trigger fn_finalizar_viaje calculará duracion_min y distancia_km)
  const { data: viajeActualizado, error: errUpdate } = await supabase
    .from('viajes')
    .update({
      fin_at: fin,
      estacion_destino_id,
      estado: 'finalizado',
    })
    .eq('id', viaje_id)
    .select()
    .single()

  if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 500 })

  // Devolver la bicicleta a la estación destino
  await supabase
    .from('bicicletas')
    .update({ estado: 'disponible', estacion_id: estacion_destino_id })
    .eq('id', viaje.bicicleta_id)

  return NextResponse.json({ viaje: viajeActualizado })
}
