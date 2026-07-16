import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCache, setCache } from '@/lib/server/memoCache'

const LIMA_OFFSET_MS = 5 * 3600000

interface Proyeccion {
  id: string
  nombre: string
  capacidad: number
  bicis_actuales: number
  reposicion: number   // bicis en camino por traslados asignados
  // Estimado de bicis disponibles dentro de 1, 2 y 3 horas
  proyeccion: { en_horas: number; estimado: number }[]
  estado: 'abastecida' | 'reposicion' | 'alta_demanda'
}

// GET /api/ciudadano/disponibilidad — disponibilidad actual y proyectada
// (próximas 3 horas) de todas las estaciones activas, en lenguaje ciudadano.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hit = getCache<object>('ciudadano:disponibilidad')
  if (hit) return NextResponse.json(hit)

  const admin = createAdminClient()
  const ahora = new Date()
  const desde28 = new Date(ahora.getTime() - 28 * 24 * 3600000).toISOString()

  const [{ data: estaciones }, { data: bicis }, { data: ordenes }] = await Promise.all([
    admin.from('estaciones').select('id, nombre, capacidad').eq('estado', 'activa').order('nombre'),
    admin.from('bicicletas').select('estacion_id, estado'),
    admin.from('ordenes_traslado')
      .select('estacion_destino_id, cantidad, bicis_trasladadas')
      .in('estado', ['pendiente', 'en_proceso']),
  ])

  if (!estaciones?.length) return NextResponse.json({ estaciones: [] })

  // Viajes de los últimos 28 días (paginado por el límite de 1000 filas)
  const viajes: { estacion_origen_id: string | null; estacion_destino_id: string | null; inicio_at: string; fin_at: string | null }[] = []
  for (let from = 0; from < 10000; from += 1000) {
    const { data } = await admin
      .from('viajes')
      .select('estacion_origen_id, estacion_destino_id, inicio_at, fin_at')
      .eq('estado', 'finalizado')
      .gte('inicio_at', desde28)
      .order('inicio_at', { ascending: false })
      .range(from, from + 999)
    if (!data?.length) break
    viajes.push(...data)
    if (data.length < 1000) break
  }

  // Bicis disponibles por estación
  const bicisMap: Record<string, number> = {}
  for (const b of bicis ?? []) {
    if (b.estacion_id && b.estado === 'disponible')
      bicisMap[b.estacion_id] = (bicisMap[b.estacion_id] ?? 0) + 1
  }

  // Reposiciones en camino (traslados con destino a la estación)
  const repoMap: Record<string, number> = {}
  for (const o of ordenes ?? []) {
    const restantes = o.cantidad - o.bicis_trasladadas
    if (restantes > 0)
      repoMap[o.estacion_destino_id] = (repoMap[o.estacion_destino_id] ?? 0) + restantes
  }

  // Promedios de salidas y llegadas por (estación, díaSemana, hora) — Lima
  const salidas: Record<string, number> = {}
  const llegadas: Record<string, number> = {}
  const occ28 = Array(7).fill(0) as number[]
  for (let i = 0; i < 28; i++) {
    occ28[new Date(ahora.getTime() - i * 86400000 - LIMA_OFFSET_MS).getUTCDay()]++
  }
  for (const v of viajes) {
    if (v.estacion_origen_id && v.inicio_at) {
      const t = new Date(new Date(v.inicio_at).getTime() - LIMA_OFFSET_MS)
      salidas[`${v.estacion_origen_id}-${t.getUTCDay()}-${t.getUTCHours()}`] =
        (salidas[`${v.estacion_origen_id}-${t.getUTCDay()}-${t.getUTCHours()}`] ?? 0) + 1
    }
    if (v.estacion_destino_id && v.fin_at) {
      const t = new Date(new Date(v.fin_at).getTime() - LIMA_OFFSET_MS)
      llegadas[`${v.estacion_destino_id}-${t.getUTCDay()}-${t.getUTCHours()}`] =
        (llegadas[`${v.estacion_destino_id}-${t.getUTCDay()}-${t.getUTCHours()}`] ?? 0) + 1
    }
  }

  const limaAhora = new Date(ahora.getTime() - LIMA_OFFSET_MS)

  const resultado: Proyeccion[] = estaciones.map(e => {
    const actual = bicisMap[e.id] ?? 0
    const capacidad = e.capacidad ?? 10
    const repo = repoMap[e.id] ?? 0

    // Proyección acumulada hora a hora
    const proyeccion: { en_horas: number; estimado: number }[] = []
    let balance = actual + repo   // la reposición llega dentro de la 1.ª hora
    for (let h = 1; h <= 3; h++) {
      const t = new Date(limaAhora.getTime() + h * 3600000)
      const key = `${e.id}-${t.getUTCDay()}-${t.getUTCHours()}`
      const sal = (salidas[key] ?? 0) / Math.max(occ28[t.getUTCDay()], 1)
      const lle = (llegadas[key] ?? 0) / Math.max(occ28[t.getUTCDay()], 1)
      balance = balance - sal + lle
      proyeccion.push({
        en_horas: h,
        estimado: Math.max(0, Math.min(capacidad, Math.round(balance))),
      })
    }

    const minimo = Math.min(actual, ...proyeccion.map(p => p.estimado))
    const estado: Proyeccion['estado'] =
      minimo >= 3 ? 'abastecida' :
      repo > 0    ? 'reposicion' :
                    'alta_demanda'

    return {
      id: e.id, nombre: e.nombre, capacidad,
      bicis_actuales: actual, reposicion: repo, proyeccion, estado,
    }
  })

  const payload = { estaciones: resultado, actualizado: ahora.toISOString() }
  setCache('ciudadano:disponibilidad', payload, 60_000)
  return NextResponse.json(payload)
}
