import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verificarOperador() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'operador') return null
  return user
}

// GET — listar todos los usuarios
export async function GET() {
  const caller = await verificarOperador()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, documento, correo, celular, rol, estado')
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ usuarios: data })
}

// PATCH — actualizar rol o estado de un usuario
export async function PATCH(req: NextRequest) {
  const caller = await verificarOperador()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, campo, valor } = await req.json()
  if (!id || !campo || valor === undefined)
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  const camposPermitidos = ['rol', 'estado']
  if (!camposPermitidos.includes(campo))
    return NextResponse.json({ error: 'Campo no permitido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('usuarios').update({ [campo]: valor }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — eliminar usuario de usuarios y de auth.users
export async function DELETE(req: NextRequest) {
  const caller = await verificarOperador()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // No permitir auto-eliminación
  if (id === caller.id)
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })

  const supabase = await createClient()
  const admin    = createAdminClient()

  // Eliminar de la tabla pública primero
  const { error: dbErr } = await supabase.from('usuarios').delete().eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Eliminar de auth.users
  const { error: authErr } = await admin.auth.admin.deleteUser(id)
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
