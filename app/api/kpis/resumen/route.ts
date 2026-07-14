import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LIMA_OFFSET_MS = 5 * 3600000  // Lima = UTC-5

// GET /api/kpis/resumen?dias=30 — métricas agregadas (adminClient evita RLS)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dias = Math.min(365, Math.max(1, parseInt(searchParams.get('dias') ?? '30')))

  const admin = createAdminClient()
  const ahora = new Date()
  const desde     = new Date(ahora.getTime() - dias * 86400000).toISOString()
  const desdePrev = new Date(ahora.getTime() - dias * 2 * 86400000).toISOString()

  // Inicio del día de hoy y de hace 13 días, en calendario de Lima
  const limaNow  = new Date(ahora.getTime() - LIMA_OFFSET_MS)
  const hoyLima0 = Date.UTC(limaNow.getUTCFullYear(), limaNow.getUTCMonth(), limaNow.getUTCDate()) + LIMA_OFFSET_MS
  const desde14  = new Date(hoyLima0 - 13 * 86400000).toISOString()

  const [
    { count: viajesTotal },
    { count: viajesPrev },
    { count: usuariosTotal },
    { data: v14 },
  ] = await Promise.all([
    admin.from('viajes').select('*', { count: 'exact', head: true })
      .eq('estado', 'finalizado').gte('inicio_at', desde),
    admin.from('viajes').select('*', { count: 'exact', head: true })
      .eq('estado', 'finalizado').gte('inicio_at', desdePrev).lt('inicio_at', desde),
    admin.from('usuarios').select('*', { count: 'exact', head: true }),
    admin.from('viajes').select('inicio_at, estacion_origen_id')
      .eq('estado', 'finalizado').gte('inicio_at', desde14).limit(10000),
  ])

  // Viajes por día (calendario Lima) de los últimos 14 días
  const porDia: { fecha: string; viajes: number }[] = []
  const idxDia: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const key = new Date(hoyLima0 - LIMA_OFFSET_MS - i * 86400000).toISOString().slice(0, 10)
    idxDia[key] = porDia.length
    porDia.push({ fecha: key, viajes: 0 })
  }

  const hoyKey = new Date(hoyLima0 - LIMA_OFFSET_MS).toISOString().slice(0, 10)
  const viajesHoyPorEstacion: Record<string, number> = {}

  for (const v of v14 ?? []) {
    if (!v.inicio_at) continue
    const key = new Date(new Date(v.inicio_at).getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10)
    if (idxDia[key] !== undefined) porDia[idxDia[key]].viajes++
    if (key === hoyKey && v.estacion_origen_id) {
      viajesHoyPorEstacion[v.estacion_origen_id] = (viajesHoyPorEstacion[v.estacion_origen_id] ?? 0) + 1
    }
  }

  return NextResponse.json({
    viajes_total:  viajesTotal ?? 0,
    viajes_prev:   viajesPrev ?? 0,
    usuarios:      usuariosTotal ?? 0,
    por_dia:       porDia,
    viajes_hoy_por_estacion: viajesHoyPorEstacion,
  })
}
