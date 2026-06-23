import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Verificar que el usuario es staff
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !['operador', 'tecnico', 'administrador'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await req.json()
  const { codigo, tipo, marca, modelo, qr_url, estado, estacion_id } = body

  if (!codigo || !tipo) {
    return NextResponse.json({ error: 'codigo y tipo son requeridos' }, { status: 400 })
  }

  // Verificar que el código no existe ya
  const { data: existe } = await admin
    .from('bicicletas')
    .select('id')
    .eq('codigo', codigo)
    .maybeSingle()

  if (existe) {
    return NextResponse.json({ error: `Ya existe una bicicleta con código ${codigo}` }, { status: 409 })
  }

  const { data: bici, error } = await admin
    .from('bicicletas')
    .insert({ codigo, tipo, marca: marca || null, modelo: modelo || null, qr_url: qr_url || null, estado: estado ?? 'disponible', estacion_id: estacion_id || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ bici }, { status: 201 })
}
