import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verificarStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', status: 401, user: null }
  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !['operador', 'tecnico', 'administrador'].includes(perfil.rol)) {
    return { error: 'Sin permiso', status: 403, user: null }
  }
  return { error: null, status: 200, user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status } = await verificarStaff()
  if (error) return NextResponse.json({ error }, { status })

  const { tipo, marca, modelo, estado, estacion_id } = await req.json()
  const admin = createAdminClient()

  const { data: bici, error: err } = await admin
    .from('bicicletas')
    .update({
      tipo: tipo?.trim() || undefined,
      marca: marca ?? null,
      modelo: modelo ?? null,
      estado: estado || undefined,
      estacion_id: estacion_id || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ bici })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status } = await verificarStaff()
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()

  const { data: bici } = await admin.from('bicicletas').select('estado, codigo').eq('id', id).single()
  if (bici?.estado === 'en_viaje') {
    return NextResponse.json({ error: `No se puede eliminar ${bici.codigo}: está en viaje activo` }, { status: 409 })
  }

  const { error: err } = await admin.from('bicicletas').delete().eq('id', id)
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
