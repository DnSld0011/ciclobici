import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ viaje: null })

  const admin = createAdminClient()

  const { data: viaje } = await admin
    .from('viajes')
    .select(`
      id, inicio_at, estado,
      bicicleta:bicicleta_id(id, codigo, tipo, marca, modelo),
      estacion_origen:estacion_origen_id(id, nombre, direccion)
    `)
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .maybeSingle()

  return NextResponse.json({ viaje })
}
