import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin2 = createAdminClient()
  const { data: perfil } = await admin2
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'operador')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, newPassword } = await req.json()
  if (!id || !newPassword || newPassword.length < 8)
    return NextResponse.json({ error: 'ID y contraseña (mín. 8 chars) requeridos' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
