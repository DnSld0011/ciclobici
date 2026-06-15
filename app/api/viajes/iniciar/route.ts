import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { bicicleta_id, estacion_origen_id } = await req.json()
  if (!bicicleta_id || !estacion_origen_id) {
    return NextResponse.json({ error: 'bicicleta_id y estacion_origen_id son requeridos' }, { status: 400 })
  }

  // Verificar que la bici está disponible
  const { data: bici, error: errBici } = await supabase
    .from('bicicletas')
    .select('id, estado, codigo, qr_code')
    .eq('id', bicicleta_id)
    .single()

  if (errBici || !bici) return NextResponse.json({ error: 'Bicicleta no encontrada' }, { status: 404 })
  if (bici.estado !== 'disponible') {
    return NextResponse.json({ error: 'La bicicleta no está disponible' }, { status: 409 })
  }

  // Verificar que el ciudadano no tiene un viaje activo
  const { data: viajeActivo } = await supabase
    .from('viajes')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .maybeSingle()

  if (viajeActivo) {
    return NextResponse.json({ error: 'Ya tienes un viaje en curso' }, { status: 409 })
  }

  // Crear el viaje
  const { data: viaje, error: errViaje } = await supabase
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

  if (errViaje) return NextResponse.json({ error: errViaje.message }, { status: 500 })

  // Marcar bicicleta como en_viaje y sacarla de la estación
  await supabase
    .from('bicicletas')
    .update({ estado: 'en_viaje', estacion_id: null })
    .eq('id', bicicleta_id)

  return NextResponse.json({ viaje }, { status: 201 })
}
