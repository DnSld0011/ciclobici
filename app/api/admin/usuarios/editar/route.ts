import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!['operador', 'administrador'].includes(perfil?.rol ?? ''))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, nombre, documento, correo, celular } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // Actualizar en tabla usuarios
  const { error: dbErr } = await admin.from('usuarios')
    .update({ nombre, documento, correo, celular })
    .eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Si cambió el correo, actualizar también en auth.users
  if (correo) {
    const { error: authErr } = await admin.auth.admin.updateUserById(id, { email: correo })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
