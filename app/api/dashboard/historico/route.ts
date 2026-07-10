import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/dashboard/historico — viajes finalizados de los últimos 365 días
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const desde = new Date(Date.now() - 365 * 24 * 3600000).toISOString()

  const { data, error } = await admin
    .from('viajes')
    .select('inicio_at, estacion_origen_id, distancia_km, duracion_min')
    .eq('estado', 'finalizado')
    .gte('inicio_at', desde)
    .limit(10000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ viajes: data ?? [] })
}
