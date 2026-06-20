import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  // Verificar que es staff (operador, técnico, administrador)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: rol } = await supabase
    .from('roles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!rol || !['operador', 'tecnico', 'administrador'].includes(rol.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Usar adminClient para ver todos los viajes sin restricción de RLS
  const admin = createAdminClient()
  const { data: viajes, error } = await admin
    .from('viajes')
    .select(`
      id, inicio_at,
      usuario:usuario_id(nombre, email),
      bicicleta:bicicleta_id(codigo, tipo),
      estacion_origen:estacion_origen_id(id, nombre, latitud, longitud, direccion)
    `)
    .eq('estado', 'activo')
    .order('inicio_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ viajes })
}
