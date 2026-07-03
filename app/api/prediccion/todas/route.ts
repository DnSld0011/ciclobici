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

function buildTree(samples: Sample[], depth: number, maxDepth: number): TreeNode {
  if (depth >= maxDepth || samples.length < 3) return { value: meanTarget(samples) }

  const nFeatures = samples[0].features.length
  let bestGain = -Infinity, bestF = 0, bestT = 0
  let bestL: Sample[] = [], bestR: Sample[] = []
  const baseMSE = mse(samples)

  for (let f = 0; f < nFeatures; f++) {
    const vals = [...new Set(samples.map(s => s.features[f]))].sort((a, b) => a - b)
    for (let i = 0; i < vals.length - 1; i++) {
      const t = (vals[i] + vals[i + 1]) / 2
      const L = samples.filter(s => s.features[f] <= t)
      const R = samples.filter(s => s.features[f] >  t)
      if (L.length < 2 || R.length < 2) continue
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

function trainGB(samples: Sample[], nEstimators = 40, lr = 0.12, maxDepth = 3): GBModel {
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
// Feature engineering
// ─────────────────────────────────────────────────────────────
// Features: [stationIdx, hour, dow, month, isWeekend, isMorningRush, isEveningRush, hourSin, hourCos, dowSin, dowCos]

function buildFeatures(stationIdx: number, hour: number, dow: number, month: number): number[] {
  return [
    stationIdx,
    hour / 23,                           // normalizado 0-1
    dow  / 6,                            // normalizado 0-1
    month / 12,                          // normalizado 0-1
    (dow === 0 || dow === 6) ? 1 : 0,   // fin de semana
    (hour >= 7  && hour <= 9)  ? 1 : 0, // rush mañana
    (hour >= 17 && hour <= 19) ? 1 : 0, // rush tarde
    Math.sin(2 * Math.PI * hour / 24),  // ciclicidad hora
    Math.cos(2 * Math.PI * hour / 24),
    Math.sin(2 * Math.PI * dow  / 7),   // ciclicidad día
    Math.cos(2 * Math.PI * dow  / 7),
  ]
}

// ─────────────────────────────────────────────────────────────
// GET /api/prediccion/todas?intervalo=4
// GET /api/prediccion/todas?fecha=2026-07-09&hora=8
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const intervalo  = parseInt(searchParams.get('intervalo') ?? '4')
  const fechaParam = searchParams.get('fecha')
  const horaParam  = searchParams.get('hora')

  const admin = createAdminClient()
  const ahora = new Date()

  const slots: { dow: number; hour: number; month: number }[] = []
  let targetDate: Date
  let esDiaFuturo = false

  if (fechaParam && horaParam !== null) {
    targetDate = new Date(`${fechaParam}T${String(horaParam).padStart(2, '0')}:00:00`)
    slots.push({ dow: targetDate.getDay(), hour: targetDate.getHours(), month: targetDate.getMonth() + 1 })
    // Día futuro = fecha solicitada posterior al día de hoy (las bicis se
    // retiran en la noche, así que "actuales" no aplica para otros días)
    const hoy = new Date(ahora)
    hoy.setHours(23, 59, 59, 999)
    esDiaFuturo = targetDate.getTime() > hoy.getTime()
  } else {
    targetDate = new Date(ahora.getTime() + Math.floor(intervalo / 2) * 3600000)
    for (let i = 0; i < intervalo; i++) {
      const t = new Date(ahora.getTime() + i * 3600000)
      slots.push({ dow: t.getDay(), hour: t.getHours(), month: t.getMonth() + 1 })
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

  const stationIds  = estaciones.map(e => e.id)
  const stationIdx  = Object.fromEntries(stationIds.map((id, i) => [id, i]))

  // Sin historial → devolver zeros con confianza baja
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

  // ── Construir dataset de entrenamiento ──────────────────────
  // Agrupar por (estacion_id, fecha_dia, hora) → conteo de viajes
  const buckets: Record<string, number> = {}
  let minFecha = ahora, maxFecha = new Date(0)

  for (const v of viajes) {
    if (!v.estacion_origen_id || !v.inicio_at) continue
    const t = new Date(v.inicio_at)
    if (t < minFecha) minFecha = t
    if (t > maxFecha) maxFecha = t
    const dateKey = t.toISOString().slice(0, 13) // "2026-01-15T08"
    const key = `${v.estacion_origen_id}|${dateKey}`
    buckets[key] = (buckets[key] ?? 0) + 1
  }

  const samples: Sample[] = []
  for (const [key, count] of Object.entries(buckets)) {
    const [estId, dateHour] = key.split('|')
    const t = new Date(`${dateHour}:00:00Z`)
    const idx = stationIdx[estId]
    if (idx === undefined) continue
    samples.push({
      features: buildFeatures(idx, t.getUTCHours(), t.getUTCDay(), t.getUTCMonth() + 1),
      target:   count,
    })
  }

  // ── Entrenar modelo Gradient Boosting ──────────────────────
  const model = trainGB(samples, 40, 0.12, 3)

  const mesesHistorial = Math.max(1,
    Math.round((maxFecha.getTime() - minFecha.getTime()) / (30 * 24 * 3600000)))

  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  // ── Predecir para cada estación ────────────────────────────
  const estResult = estaciones.map(e => {
    const idx = stationIdx[e.id]
    if (idx === undefined) return null

    // Pico de demanda predicha entre todos los slots del intervalo
    let demandaPico = 0
    for (const slot of slots) {
      const feat  = buildFeatures(idx, slot.hour, slot.dow, slot.month)
      const pred  = predictGB(model, feat)
      if (pred > demandaPico) demandaPico = pred
    }

    const demanda_predicha = Math.min(Math.round(demandaPico), e.capacidad ?? 10)
    const bicis_actuales   = bicisMap[e.id] ?? 0
    // En día futuro no hay bicis colocadas todavía → la comparación no aplica
    const diferencia       = esDiaFuturo ? 0 : demanda_predicha - bicis_actuales

    // Confianza basada en nº de muestras históricas de esta estación
    const estSamples = samples.filter(s => s.features[0] === idx).length
    const confianza: 'alta' | 'media' | 'baja' =
      estSamples >= 20 ? 'alta' : estSamples >= 8 ? 'media' : 'baja'

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
      hora_prediccion:   targetDate.getHours(),
      dia_semana:        diasSemana[targetDate.getDay()],
      algoritmo:         'gradient_boosting',
      muestras_entreno:  samples.length,
      estimadores:       40,
      es_dia_futuro:     esDiaFuturo,
    },
  })
}
