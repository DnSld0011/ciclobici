import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // 1. Autenticar usuario con su sesión
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { bicicleta_id, estacion_origen_id } = await req.json()
  if (!bicicleta_id || !estacion_origen_id) {
    return NextResponse.json({ error: 'bicicleta_id y estacion_origen_id son requeridos' }, { status: 400 })
  }

  // 2. Usar cliente admin para todas las operaciones de BD (bypassa RLS de forma controlada)
  const admin = createAdminClient()

  // Verificar que la bici está disponible
  const { data: bici, error: errBici } = await admin
    .from('bicicletas')
    .select('id, estado, codigo')
    .eq('id', bicicleta_id)
    .single()

  if (errBici || !bici) return NextResponse.json({ error: 'Bicicleta no encontrada' }, { status: 404 })
  if (bici.estado !== 'disponible') {
    return NextResponse.json({ error: 'La bicicleta no está disponible' }, { status: 409 })
  }

  // Verificar que el ciudadano no tiene un viaje activo
  const { data: viajeActivo } = await admin
    .from('viajes')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .maybeSingle()

  if (viajeActivo) {
    return NextResponse.json({ error: 'Ya tienes un viaje en curso' }, { status: 409 })
  }

  // Marcar bicicleta como en_viaje ANTES de crear el viaje (así no hay rollback necesario)
  const { error: errBiciUpdate } = await admin
    .from('bicicletas')
    .update({ estado: 'en_viaje', estacion_id: null })
    .eq('id', bicicleta_id)

  if (errBiciUpdate) {
    return NextResponse.json(
      { error: 'No se pudo actualizar el estado de la bicicleta. Intenta de nuevo.' },
      { status: 500 }
    )
  }

  // Crear el viaje
  const { data: viaje, error: errViaje } = await admin
    .from('viajes')
    .insert({
      usuario_id: user.id,
      bicicleta_id,
      estacion_origen_id,
      inicio_at: new Date().toISOString(),
      estado: 'activo',
    })
    .select()
    .single()

  if (errViaje || !viaje) {
    // Revertir la bici si el viaje no se pudo crear
    await admin.from('bicicletas').update({ estado: 'disponible', estacion_id: estacion_origen_id }).eq('id', bicicleta_id)
    return NextResponse.json({ error: errViaje?.message ?? 'Error al crear el viaje' }, { status: 500 })
  }

  return NextResponse.json({ viaje }, { status: 201 })
}
