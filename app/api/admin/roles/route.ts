import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verificarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!['operador', 'administrador'].includes(perfil?.rol ?? '')) return null
  return user
}

// GET — listar todos los roles
export async function GET() {
  const caller = await verificarAdmin()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('roles').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ roles: data })
}

// POST — crear nuevo rol
export async function POST(req: NextRequest) {
  const caller = await verificarAdmin()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const { id, nombre, descripcion, color, vistas } = body
  if (!id || !nombre) return NextResponse.json({ error: 'id y nombre son requeridos' }, { status: 400 })

  // id debe ser slug válido
  const slug = id.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

  const admin = createAdminClient()
  const { data, error } = await admin.from('roles').insert({
    id: slug, nombre, descripcion: descripcion ?? '', color: color ?? '#6b7280',
    vistas: vistas ?? [], es_sistema: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rol: data })
}

// PATCH — actualizar rol
export async function PATCH(req: NextRequest) {
  const caller = await verificarAdmin()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const camposPermitidos = ['nombre', 'descripcion', 'color', 'vistas']
  const filtrado = Object.fromEntries(
    Object.entries(updates).filter(([k]) => camposPermitidos.includes(k))
  )

  const admin = createAdminClient()
  const { error } = await admin.from('roles').update(filtrado).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — eliminar rol (no permite borrar roles del sistema)
export async function DELETE(req: NextRequest) {
  const caller = await verificarAdmin()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: rol } = await admin.from('roles').select('es_sistema').eq('id', id).single()
  if (rol?.es_sistema)
    return NextResponse.json({ error: 'No se pueden eliminar roles del sistema' }, { status: 400 })

  const { error } = await admin.from('roles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
