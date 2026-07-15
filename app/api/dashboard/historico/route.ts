import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCache, setCache } from '@/lib/server/memoCache'

// GET /api/dashboard/historico — viajes finalizados de los últimos 365 días
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hit = getCache<object>('dashboard:historico')
  if (hit) return NextResponse.json(hit)

  const admin = createAdminClient()
  const desde = new Date(Date.now() - 365 * 24 * 3600000).toISOString()

  // Supabase limita cada request a 1000 filas → paginar para traer todo el año
  const viajes: unknown[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await admin
      .from('viajes')
      .select('inicio_at, estacion_origen_id, distancia_km, duracion_min')
      .eq('estado', 'finalizado')
      .gte('inicio_at', desde)
      .order('inicio_at', { ascending: false })
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) break
    viajes.push(...data)
    if (data.length < 1000) break
  }

  const payload = { viajes }
  setCache('dashboard:historico', payload, 60_000)
  return NextResponse.json(payload)
}
