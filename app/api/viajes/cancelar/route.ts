import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { viaje_id } = await req.json()
  if (!viaje_id) return NextResponse.json({ error: 'viaje_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que el viaje pertenece al usuario y está activo
  const { data: viaje } = await admin
    .from('viajes')
    .select('id, bicicleta_id, estacion_origen_id, usuario_id')
    .eq('id', viaje_id)
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .single()

  if (!viaje) return NextResponse.json({ error: 'Viaje no encontrado o no activo' }, { status: 404 })

  // Cancelar el viaje
  await admin
    .from('viajes')
    .update({ estado: 'cancelado', fin_at: new Date().toISOString() })
    .eq('id', viaje_id)

  // Devolver la bici a su estación de origen (o dejarla disponible sin estación)
  await admin
    .from('bicicletas')
    .update({ estado: 'disponible', estacion_id: viaje.estacion_origen_id ?? null })
    .eq('id', viaje.bicicleta_id)

  return NextResponse.json({ ok: true })
}
