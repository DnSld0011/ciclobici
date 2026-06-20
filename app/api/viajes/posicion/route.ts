import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { viaje_id, lat, lng } = await req.json()
  if (!viaje_id || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que el viaje pertenece al usuario y está activo
  const { data: viaje } = await admin
    .from('viajes')
    .select('id')
    .eq('id', viaje_id)
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .single()

  if (!viaje) return NextResponse.json({ ok: false }, { status: 404 })

  await admin.from('viajes').update({ lat, lng }).eq('id', viaje_id)

  return NextResponse.json({ ok: true })
}
