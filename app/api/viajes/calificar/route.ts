import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { viaje_id, calificacion } = await req.json()
  if (!viaje_id || typeof calificacion !== 'number' || calificacion < 1 || calificacion > 5) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que el viaje pertenece al usuario
  const { data: viaje } = await admin
    .from('viajes')
    .select('id, usuario_id')
    .eq('id', viaje_id)
    .eq('usuario_id', user.id)
    .single()

  if (!viaje) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })

  const { error } = await admin
    .from('viajes')
    .update({ calificacion })
    .eq('id', viaje_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
