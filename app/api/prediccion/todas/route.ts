import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCache, setCache } from '@/lib/server/memoCache'

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
function buildFeatures(stationIdx: number, hourUTC: number, dowUTC: number, popularity: number): number[] {
  return [
    stationIdx,
    popularity,          // viajes históricos de la estación / máximo (0-1)
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

function addDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────
// Memoria de demanda (Fase 2): consolida en `demanda_historica`
// los días ya cerrados — demanda real por estación/hora + lo que
// el modelo habría predicho (backtest con los 28 días previos).
// Devuelve el resumen de precisión de los últimos 7 días.
// ─────────────────────────────────────────────────────────────
interface Memoria {
  dias: number
  precision: number | null
  serie: { fecha: string; reales: number; predichos: number }[]
}

async function consolidarMemoria(
  admin: ReturnType<typeof createAdminClient>,
  viajes: { estacion_origen_id: string | null; inicio_at: string }[],
  stationIds: string[],
  hoyLima: string,
): Promise<Memoria | null> {
  try {
    // Índice de viajes en calendario Lima
    const reales: Record<string, number> = {}
    const lista: { est: string; fecha: string; dow: number; hora: number }[] = []
    for (const v of viajes) {
      if (!v.estacion_origen_id || !v.inicio_at) continue
      const lima  = new Date(new Date(v.inicio_at).getTime() - LIMA_OFFSET_MS)
      const fecha = lima.toISOString().slice(0, 10)
      const hora  = lima.getUTCHours()
      reales[`${v.estacion_origen_id}|${fecha}|${hora}`] =
        (reales[`${v.estacion_origen_id}|${fecha}|${hora}`] ?? 0) + 1
      lista.push({ est: v.estacion_origen_id, fecha, dow: lima.getUTCDay(), hora })
    }

    const ayer = addDias(hoyLima, -1)
    const { data: ult, error: errUlt } = await admin
      .from('demanda_historica')
      .select('fecha').order('fecha', { ascending: false }).limit(1)
    if (errUlt) return null   // tabla aún no creada

    let cursor = ult?.[0]?.fecha ? addDias(String(ult[0].fecha), 1) : addDias(hoyLima, -14)
    const minCursor = addDias(hoyLima, -14)
    if (cursor < minCursor) cursor = minCursor

    // Consolidar cada día cerrado pendiente
    while (cursor <= ayer) {
      const ini28 = addDias(cursor, -28)
      const dowD  = new Date(`${cursor}T00:00:00Z`).getUTCDay()

      // Backtest: promedio del mismo día de semana en los 28 días previos
      const bucket: Record<string, number> = {}
      for (const t of lista) {
        if (t.fecha >= cursor || t.fecha < ini28 || t.dow !== dowD) continue
        bucket[`${t.est}|${t.hora}`] = (bucket[`${t.est}|${t.hora}`] ?? 0) + 1
      }

      const filas = []
      for (const est of stationIds) {
        for (let h = 5; h <= 22; h++) {
          filas.push({
            estacion_id:      est,
            fecha:            cursor,
            hora:             h,
            viajes_reales:    reales[`${est}|${cursor}|${h}`] ?? 0,
            viajes_predichos: Math.round(((bucket[`${est}|${h}`] ?? 0) / 4) * 100) / 100,
          })
        }
      }
      await admin.from('demanda_historica').upsert(filas, { onConflict: 'estacion_id,fecha,hora' })
      cursor = addDias(cursor, 1)
    }

    // Resumen: precisión de los últimos 7 días (real vs predicho por día)
    const desde7 = addDias(hoyLima, -7)
    const filas7: { fecha: string; viajes_reales: number; viajes_predichos: number | null }[] = []
    for (let from = 0; from < 4000; from += 1000) {
      const { data } = await admin
        .from('demanda_historica')
        .select('fecha, viajes_reales, viajes_predichos')
        .gte('fecha', desde7).lte('fecha', ayer)
        .range(from, from + 999)
      if (!data?.length) break
      filas7.push(...(data as typeof filas7))
      if (data.length < 1000) break
    }

    const porFecha: Record<string, { r: number; p: number }> = {}
    for (const f of filas7) {
      const m = porFecha[f.fecha] ?? (porFecha[f.fecha] = { r: 0, p: 0 })
      m.r += f.viajes_reales
      m.p += Number(f.viajes_predichos ?? 0)
    }
    const serie = Object.entries(porFecha)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([fecha, m]) => ({ fecha, reales: m.r, predichos: Math.round(m.p) }))

    const totalR = serie.reduce((s, x) => s + x.reales, 0)
    const errAbs = serie.reduce((s, x) => s + Math.abs(x.reales - x.predichos), 0)
    const precision = totalR > 0 ? Math.max(0, Math.round((1 - errAbs / totalR) * 100)) : null

    const { count } = await admin
      .from('demanda_historica').select('*', { count: 'exact', head: true })
    const dias = count ? Math.round(count / Math.max(stationIds.length * 18, 1)) : serie.length

    return { dias, precision, serie }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/prediccion/todas?intervalo=4
// GET /api/prediccion/todas?fecha=2026-07-11&hora=8   (hora de Lima)
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const intervalo  = parseInt(searchParams.get('intervalo') ?? '4')
  const fechaParam = searchParams.get('fecha')
  const horaParam  = searchParams.get('hora')
  const diaParam   = searchParams.get('dia')   // modo día completo: ?dia=2026-07-15

  // Caché 60s: el primer request paga el entrenamiento del modelo,
  // los siguientes reciben la respuesta al instante
  const cacheKey = `prediccion:${searchParams.toString()}`
  const hit = getCache<object>(cacheKey)
  if (hit) return NextResponse.json(hit)
  const responder = (payload: object) => {
    setCache(cacheKey, payload, 60_000)
    return NextResponse.json(payload)
  }

  const admin = createAdminClient()
  const ahora = new Date()

  const slots: { dow: number; hour: number }[] = []   // en UTC
  let targetDate: Date
  let esDiaFuturo = false

  if (diaParam) {
    targetDate = new Date(`${diaParam}T12:00:00-05:00`)
    const hoyLima = new Date(ahora.getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10)
    esDiaFuturo = diaParam > hoyLima
    // los slots por hora se generan más abajo (modo día)
  } else if (fechaParam && horaParam !== null) {
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

  // Supabase limita cada request a 1000 filas → paginar para traer todo el año
  const desde = new Date(ahora.getTime() - 365 * 24 * 3600000).toISOString()
  const viajes: { estacion_origen_id: string | null; inicio_at: string }[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data: pagina } = await admin
      .from('viajes')
      .select('estacion_origen_id, inicio_at')
      .eq('estado', 'finalizado')
      .gte('inicio_at', desde)
      .order('inicio_at', { ascending: false })
      .range(from, from + 999)
    if (!pagina?.length) break
    viajes.push(...pagina)
    if (pagina.length < 1000) break
  }

  const stationIds = estaciones.map(e => e.id)
  const stationIdx = Object.fromEntries(stationIds.map((id, i) => [id, i]))

  if (!viajes?.length) {
    return responder({
      estaciones: estaciones.map(e => ({
        id: e.id, nombre: e.nombre, capacidad: e.capacidad ?? 10,
        bicis_actuales: bicisMap[e.id] ?? 0,
        demanda_predicha: 0, diferencia: -(bicisMap[e.id] ?? 0),
        accion: 'ok' as const, confianza: 'baja' as const,
        demanda_dia: 0, demanda_restante: 0, faltan: 0,
        hora_pico: 8, hora_agotamiento: null,
        por_hora: [] as { hora: number; demanda: number }[],
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

  // ── Dataset: demanda ESPERADA POR HORA por (estación, díaSemana, hora) ──
  // Cada viaje suma con peso por recencia (lo reciente pesa más) y luego se
  // normaliza por las ocurrencias ponderadas de ese día de semana, de modo
  // que el target es "viajes esperados en esa hora de ese día" — no un
  // conteo acumulado del año. Incluye ceros para aprender cuándo NO hay demanda.
  const pesoRecencia = (dias: number) => (dias <= 14 ? 6 : dias <= 45 ? 3 : 1)

  const buckets: Record<string, number> = {}          // suma ponderada (año)
  const buckets28: Record<string, number> = {}        // conteo crudo últimos 28 días
  const totalPorEstacion: Record<number, number> = {} // conteo crudo (confianza/popularidad)
  let minFecha = ahora, maxFecha = new Date(0)

  for (const v of viajes) {
    if (!v.estacion_origen_id || !v.inicio_at) continue
    const idx = stationIdx[v.estacion_origen_id]
    if (idx === undefined) continue
    const t = new Date(v.inicio_at)
    if (t < minFecha) minFecha = t
    if (t > maxFecha) maxFecha = t
    const dias = (ahora.getTime() - t.getTime()) / 86400000
    const key = `${idx}-${t.getUTCDay()}-${t.getUTCHours()}`
    buckets[key] = (buckets[key] ?? 0) + pesoRecencia(dias)
    if (dias <= 28) buckets28[key] = (buckets28[key] ?? 0) + 1
    totalPorEstacion[idx] = (totalPorEstacion[idx] ?? 0) + 1
  }

  // Ocurrencias ponderadas de cada día de semana en la ventana de 365 días
  const occSemana = Array(7).fill(0) as number[]
  const occSemana28 = Array(7).fill(0) as number[]
  for (let i = 0; i < 365; i++) {
    const d = new Date(ahora.getTime() - i * 86400000)
    occSemana[d.getUTCDay()] += pesoRecencia(i)
    if (i < 28) occSemana28[d.getUTCDay()] += 1
  }

  const maxEstTotal = Math.max(...Object.values(totalPorEstacion), 1)
  const popularidad = (idx: number) => (totalPorEstacion[idx] ?? 0) / maxEstTotal

  const samples: Sample[] = []
  for (let idx = 0; idx < stationIds.length; idx++) {
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        samples.push({
          features: buildFeatures(idx, hour, dow, popularidad(idx)),
          target:   (buckets[`${idx}-${dow}-${hour}`] ?? 0) / Math.max(occSemana[dow], 1),
        })
      }
    }
  }

  // ── Entrenar Gradient Boosting ───────────────────────────────
  const model = trainGB(samples, 50, 0.15, 3)

  // Predicción final: el promedio empírico de los últimos 28 días marca el
  // nivel de demanda actual (piso), y el GB aporta el patrón aprendido del
  // año — así ni el suavizado ni el historial antiguo diluyen la demanda real.
  const empirico28 = (idx: number, dow: number, hour: number) =>
    (buckets28[`${idx}-${dow}-${hour}`] ?? 0) / Math.max(occSemana28[dow], 1)
  const predecir = (idx: number, dow: number, hour: number) => {
    const gb  = predictGB(model, buildFeatures(idx, hour, dow, popularidad(idx)))
    const e28 = empirico28(idx, dow, hour)
    return Math.max(e28, 0.5 * (gb + e28))
  }

  const mesesHistorial = Math.max(1,
    Math.round((maxFecha.getTime() - minFecha.getTime()) / (30 * 24 * 3600000)))

  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  // Componentes de fecha/hora en Lima para los metadatos
  const targetLima = new Date(targetDate.getTime() - LIMA_OFFSET_MS)

  // ── MODO DÍA COMPLETO: demanda por hora para todo el día ─────
  if (diaParam) {
    const dowLima   = new Date(`${diaParam}T00:00:00Z`).getUTCDay()
    const horaAhoraLima = new Date(ahora.getTime() - LIMA_OFFSET_MS).getUTCHours()
    const hoyLimaStr = new Date(ahora.getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10)

    // Fase 2: consolidar días cerrados en la memoria y obtener precisión
    const memoria = await consolidarMemoria(admin, viajes, stationIds, hoyLimaStr)
    const HORAS = Array.from({ length: 18 }, (_, i) => i + 5)  // 05:00–22:00 Lima

    const estDia = estaciones.map(e => {
      const idx = stationIdx[e.id]
      if (idx === undefined) return null

      // Demanda predicha por hora (Lima), convirtiendo a UTC para el modelo
      const porHora = HORAS.map(h => {
        const utc  = h + 5
        const hour = utc % 24
        const dow  = utc >= 24 ? (dowLima + 1) % 7 : dowLima
        const pred = predecir(idx, dow, hour)
        return { hora: h, demanda: Math.round(pred * 10) / 10 }
      })

      const demanda_dia = Math.round(porHora.reduce((s, x) => s + x.demanda, 0))
      const pico = porHora.reduce((top, x) => x.demanda > top.demanda ? x : top, porHora[0])
      const bicis_actuales = bicisMap[e.id] ?? 0
      const capacidad = e.capacidad ?? 10

      // Hoy: hora estimada en que el stock se agota (demanda acumulada desde ahora)
      let hora_agotamiento: number | null = null
      if (!esDiaFuturo && bicis_actuales > 0) {
        let acum = 0
        for (const x of porHora) {
          if (x.hora < horaAhoraLima) continue
          acum += x.demanda
          if (acum >= bicis_actuales) { hora_agotamiento = x.hora; break }
        }
      } else if (!esDiaFuturo && bicis_actuales === 0 && demanda_dia > 0) {
        hora_agotamiento = Math.max(horaAhoraLima, 5)
      }

      // Bicis que faltan: para hoy vs stock actual; para día futuro vs cero
      const demanda_restante = esDiaFuturo
        ? demanda_dia
        : Math.round(porHora.filter(x => x.hora >= horaAhoraLima).reduce((s, x) => s + x.demanda, 0))
      const necesarias = Math.min(capacidad, demanda_restante)
      const faltan = esDiaFuturo ? necesarias : Math.max(0, necesarias - bicis_actuales)

      const estTotal = totalPorEstacion[idx] ?? 0
      const confianza: 'alta' | 'media' | 'baja' =
        estTotal >= 40 ? 'alta' : estTotal >= 15 ? 'media' : 'baja'

      return {
        id: e.id, nombre: e.nombre, capacidad,
        bicis_actuales, demanda_dia, demanda_restante,
        faltan, hora_pico: pico.hora, hora_agotamiento,
        por_hora: porHora, confianza,
      }
    }).filter(Boolean)

    return responder({
      estaciones: estDia,
      metadatos: {
        total_viajes:     viajes.length,
        meses_historial:  mesesHistorial,
        fecha_prediccion: targetDate.toISOString(),
        dia_semana:       diasSemana[dowLima],
        algoritmo:        'gradient_boosting',
        muestras_entreno: samples.length,
        estimadores:      30,
        es_dia_futuro:    esDiaFuturo,
        hora_actual:      horaAhoraLima,
        version:          'v5-memoria',
        memoria,
      },
    })
  }

  // ── Predicción por estación ──────────────────────────────────
  const estResult = estaciones.map(e => {
    const idx = stationIdx[e.id]
    if (idx === undefined) return null

    let demandaPico = 0
    let ocurrencias = 0
    for (const slot of slots) {
      const pred = predecir(idx, slot.dow, slot.hour)
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

  return responder({
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
