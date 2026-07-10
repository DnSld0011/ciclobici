import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─────────────────────────────────────────────────────────────
// Gradient Boosting Regressor — implementación pura TypeScript
// ─────────────────────────────────────────────────────────────

interface Sample { features: number[]; target: number }
interface TreeNode {
  value?: number
  featureIdx?: number
  threshold?: number
  left?: TreeNode
  right?: TreeNode
}

function mse(samples: Sample[]): number {
  if (!samples.length) return 0
  const mean = samples.reduce((s, x) => s + x.target, 0) / samples.length
  return samples.reduce((s, x) => s + (x.target - mean) ** 2, 0) / samples.length
}

function meanTarget(samples: Sample[]): number {
  return samples.length ? samples.reduce((s, x) => s + x.target, 0) / samples.length : 0
}

// Máx 16 umbrales candidatos por feature (cuantiles) para mantener velocidad
function candidateThresholds(vals: number[]): number[] {
  const uniq = [...new Set(vals)].sort((a, b) => a - b)
  if (uniq.length <= 16) {
    return uniq.slice(0, -1).map((v, i) => (v + uniq[i + 1]) / 2)
  }
  const out: number[] = []
  for (let i = 1; i < 16; i++) {
    const q = uniq[Math.floor((i / 16) * uniq.length)]
    if (out[out.length - 1] !== q) out.push(q)
  }
  return out
}

function buildTree(samples: Sample[], depth: number, maxDepth: number): TreeNode {
  if (depth >= maxDepth || samples.length < 6) return { value: meanTarget(samples) }

  const nFeatures = samples[0].features.length
  let bestGain = -Infinity, bestF = 0, bestT = 0
  let bestL: Sample[] = [], bestR: Sample[] = []
  const baseMSE = mse(samples)

  for (let f = 0; f < nFeatures; f++) {
    for (const t of candidateThresholds(samples.map(s => s.features[f]))) {
      const L = samples.filter(s => s.features[f] <= t)
      const R = samples.filter(s => s.features[f] >  t)
      if (L.length < 3 || R.length < 3) continue
      const gain = baseMSE - (L.length / samples.length) * mse(L) - (R.length / samples.length) * mse(R)
      if (gain > bestGain) { bestGain = gain; bestF = f; bestT = t; bestL = L; bestR = R }
    }
  }

  if (bestGain <= 0) return { value: meanTarget(samples) }

  return {
    featureIdx: bestF,
    threshold:  bestT,
    left:  buildTree(bestL, depth + 1, maxDepth),
    right: buildTree(bestR, depth + 1, maxDepth),
  }
}

function predictTree(node: TreeNode, features: number[]): number {
  if (node.value !== undefined) return node.value
  return features[node.featureIdx!] <= node.threshold!
    ? predictTree(node.left!,  features)
    : predictTree(node.right!, features)
}

interface GBModel { baseMean: number; trees: TreeNode[]; lr: number }

function trainGB(samples: Sample[], nEstimators = 30, lr = 0.15, maxDepth = 3): GBModel {
  if (!samples.length) return { baseMean: 0, trees: [], lr }

  const baseMean = meanTarget(samples)
  const work = samples.map(s => ({ features: s.features, target: s.target - baseMean }))
  const trees: TreeNode[] = []

  for (let i = 0; i < nEstimators; i++) {
    const tree = buildTree(work, 0, maxDepth)
    trees.push(tree)
    for (const s of work) {
      s.target -= lr * predictTree(tree, s.features)
    }
  }

  return { baseMean, trees, lr }
}

function predictGB(model: GBModel, features: number[]): number {
  if (!model.trees.length) return model.baseMean
  let pred = model.baseMean
  for (const tree of model.trees) pred += model.lr * predictTree(tree, features)
  return Math.max(0, pred)
}

// ─────────────────────────────────────────────────────────────
// Feature engineering (todas las horas/días en UTC para ser
// consistentes con inicio_at, que se guarda en UTC)
// ─────────────────────────────────────────────────────────────
function buildFeatures(stationIdx: number, hourUTC: number, dowUTC: number): number[] {
  return [
    stationIdx,
    hourUTC / 23,
    dowUTC  / 6,
    (dowUTC === 0 || dowUTC === 6) ? 1 : 0,
    // Rush hours de Lima expresados en UTC (Lima = UTC-5)
    (hourUTC >= 12 && hourUTC <= 14) ? 1 : 0,  // 7-9 Lima
    (hourUTC >= 22 || hourUTC <= 0)  ? 1 : 0,  // 17-19 Lima
    Math.sin(2 * Math.PI * hourUTC / 24),
    Math.cos(2 * Math.PI * hourUTC / 24),
    Math.sin(2 * Math.PI * dowUTC  / 7),
    Math.cos(2 * Math.PI * dowUTC  / 7),
  ]
}

const LIMA_OFFSET_MS = 5 * 3600000  // Lima = UTC-5

// ─────────────────────────────────────────────────────────────
// GET /api/prediccion/todas?intervalo=4
// GET /api/prediccion/todas?fecha=2026-07-11&hora=8   (hora de Lima)
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const intervalo  = parseInt(searchParams.get('intervalo') ?? '4')
  const fechaParam = searchParams.get('fecha')
  const horaParam  = searchParams.get('hora')

  const admin = createAdminClient()
  const ahora = new Date()

  const slots: { dow: number; hour: number }[] = []   // en UTC
  let targetDate: Date
  let esDiaFuturo = false

  if (fechaParam && horaParam !== null) {
    // La hora elegida es hora de Lima → fijar offset -05:00 explícito
    targetDate = new Date(`${fechaParam}T${String(horaParam).padStart(2, '0')}:00:00-05:00`)
    slots.push({ dow: targetDate.getUTCDay(), hour: targetDate.getUTCHours() })
    // Día futuro comparando fechas calendario de Lima
    const hoyLima = new Date(ahora.getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10)
    esDiaFuturo = fechaParam > hoyLima
  } else {
    targetDate = new Date(ahora.getTime() + Math.floor(intervalo / 2) * 3600000)
    for (let i = 0; i < intervalo; i++) {
      const t = new Date(ahora.getTime() + i * 3600000)
      slots.push({ dow: t.getUTCDay(), hour: t.getUTCHours() })
    }
  }

  const [{ data: estaciones }, { data: bicis }] = await Promise.all([
    admin.from('estaciones').select('id, nombre, capacidad').eq('estado', 'activa').order('nombre'),
    admin.from('bicicletas').select('estacion_id, estado'),
  ])

  if (!estaciones?.length) return NextResponse.json({ error: 'Sin estaciones' }, { status: 500 })

  const bicisMap: Record<string, number> = {}
  for (const b of bicis ?? []) {
    if (b.estacion_id && b.estado === 'disponible')
      bicisMap[b.estacion_id] = (bicisMap[b.estacion_id] ?? 0) + 1
  }

  const desde = new Date(ahora.getTime() - 365 * 24 * 3600000).toISOString()
  const { data: viajes } = await admin
    .from('viajes')
    .select('estacion_origen_id, inicio_at')
    .eq('estado', 'finalizado')
    .gte('inicio_at', desde)
    .limit(10000)

  const stationIds = estaciones.map(e => e.id)
  const stationIdx = Object.fromEntries(stationIds.map((id, i) => [id, i]))

  if (!viajes?.length) {
    return NextResponse.json({
      estaciones: estaciones.map(e => ({
        id: e.id, nombre: e.nombre, capacidad: e.capacidad ?? 10,
        bicis_actuales: bicisMap[e.id] ?? 0,
        demanda_predicha: 0, diferencia: -(bicisMap[e.id] ?? 0),
        accion: 'ok' as const, confianza: 'baja' as const,
      })),
      metadatos: {
        total_viajes: 0, meses_historial: 0,
        fecha_prediccion: targetDate.toISOString(),
        hora_prediccion: targetDate.getHours(),
        dia_semana: '',
        algoritmo: 'gradient_boosting',
        es_dia_futuro: esDiaFuturo,
      },
    })
  }

  // ── Dataset: conteo anual por (estación, díaSemana, hora) ────
  // Incluye TODAS las combinaciones (con ceros) para que el modelo
  // aprenda también cuándo NO hay demanda.
  const buckets: Record<string, number> = {}
  const totalPorEstacion: Record<number, number> = {}
  let minFecha = ahora, maxFecha = new Date(0)

  for (const v of viajes) {
    if (!v.estacion_origen_id || !v.inicio_at) continue
    const idx = stationIdx[v.estacion_origen_id]
    if (idx === undefined) continue
    const t = new Date(v.inicio_at)
    if (t < minFecha) minFecha = t
    if (t > maxFecha) maxFecha = t
    const key = `${idx}-${t.getUTCDay()}-${t.getUTCHours()}`
    buckets[key] = (buckets[key] ?? 0) + 1
    totalPorEstacion[idx] = (totalPorEstacion[idx] ?? 0) + 1
  }

  const samples: Sample[] = []
  for (let idx = 0; idx < stationIds.length; idx++) {
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        samples.push({
          features: buildFeatures(idx, hour, dow),
          target:   buckets[`${idx}-${dow}-${hour}`] ?? 0,
        })
      }
    }
  }

  // ── Entrenar Gradient Boosting ───────────────────────────────
  const model = trainGB(samples, 30, 0.15, 3)

  const mesesHistorial = Math.max(1,
    Math.round((maxFecha.getTime() - minFecha.getTime()) / (30 * 24 * 3600000)))

  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  // Componentes de fecha/hora en Lima para los metadatos
  const targetLima = new Date(targetDate.getTime() - LIMA_OFFSET_MS)

  // ── Predicción por estación ──────────────────────────────────
  const estResult = estaciones.map(e => {
    const idx = stationIdx[e.id]
    if (idx === undefined) return null

    let demandaPico = 0
    let ocurrencias = 0
    for (const slot of slots) {
      const pred = predictGB(model, buildFeatures(idx, slot.hour, slot.dow))
      if (pred > demandaPico) demandaPico = pred
      ocurrencias = Math.max(ocurrencias, buckets[`${idx}-${slot.dow}-${slot.hour}`] ?? 0)
    }

    const demanda_predicha = Math.min(Math.round(demandaPico), e.capacidad ?? 10)
    const bicis_actuales   = bicisMap[e.id] ?? 0
    const diferencia       = esDiaFuturo ? 0 : demanda_predicha - bicis_actuales

    const estTotal = totalPorEstacion[idx] ?? 0
    const confianza: 'alta' | 'media' | 'baja' =
      estTotal >= 40 ? 'alta' : estTotal >= 15 ? 'media' : 'baja'

    const accion: 'deficit' | 'surplus' | 'ok' = esDiaFuturo ? 'ok' :
      diferencia >  1 ? 'deficit' :
      diferencia < -2 ? 'surplus' : 'ok'

    return { id: e.id, nombre: e.nombre, capacidad: e.capacidad ?? 10, bicis_actuales, demanda_predicha, diferencia, accion, confianza }
  }).filter(Boolean)

  return NextResponse.json({
    estaciones: estResult,
    metadatos: {
      total_viajes:      viajes.length,
      meses_historial:   mesesHistorial,
      fecha_prediccion:  targetDate.toISOString(),
      hora_prediccion:   targetLima.getUTCHours(),
      dia_semana:        diasSemana[targetLima.getUTCDay()],
      algoritmo:         'gradient_boosting',
      muestras_entreno:  samples.length,
      estimadores:       30,
      es_dia_futuro:     esDiaFuturo,
    },
  })
}
