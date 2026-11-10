import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { construirDatasetCompleto, submuestrear, NOMBRES_FEATURES } from '@/lib/ml/datosViajes'
import { GradientBoostingRegressor } from '@/lib/ml/gbdt'
import { trainTestSplit, gridSearchCV, calcularMetricas, exactitudPorNivelDemanda } from '@/lib/ml/validacion'

// Grid reducido frente al del paper (5 × 7 × 4 × 2 × 2 × 2 = 5600 combinaciones)
// para mantener el entrenamiento dentro del tiempo de una función serverless.
// Mismo método (GridSearchCV + 5-fold CV), grid más angosto.
const GRID = { nEstimators: [50, 100], learningRate: [0.05, 0.1], maxDepth: [2, 3] }
const FIJOS = { minSamplesLeaf: 3, subsample: 0.8, maxFeatures: 0.8 }
const K_FOLDS = 5
const TEST_RATIO = 0.3
// GridSearchCV entrena 8 combinaciones × 5 folds = 40 modelos completos; con el
// dataset completo (decenas de miles de filas agregadas por estación/hora) esto
// supera el tiempo de una función serverless, así que "completo" se acota aquí.
const MAX_COMPLETO = 3000

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const nSolicitado: number | 'completo' = body?.n === 'completo' ? 'completo' : Number(body?.n)

  if (nSolicitado !== 'completo' && (!Number.isFinite(nSolicitado) || nSolicitado < 100)) {
    return NextResponse.json({ error: 'n debe ser "completo" o un número >= 100' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { filas: datasetCompleto, totalViajesFuente } = await construirDatasetCompleto(admin)

  if (datasetCompleto.length < 100) {
    return NextResponse.json({ sin_datos: true, filasDisponibles: datasetCompleto.length })
  }

  const n = nSolicitado === 'completo'
    ? Math.min(datasetCompleto.length, MAX_COMPLETO)
    : Math.min(nSolicitado, datasetCompleto.length)
  const muestra = submuestrear(datasetCompleto, n)

  const X = muestra.map(f => f.x)
  const y = muestra.map(f => f.y)
  const seed = 42 + n

  const { xTrain, yTrain, xTest, yTest } = trainTestSplit(X, y, TEST_RATIO, seed)

  const busqueda = gridSearchCV(xTrain, yTrain, GRID, FIJOS, K_FOLDS, seed)

  const modeloFinal = new GradientBoostingRegressor(busqueda.mejorHp)
  modeloFinal.fit(xTrain, yTrain, seed)

  const predTrain = modeloFinal.predict(xTrain)
  const predTest = modeloFinal.predict(xTest)

  const MAX_PUNTOS_GRAFICO = 150
  const predichoVsReal = yTest.slice(0, MAX_PUNTOS_GRAFICO).map((real, i) => ({
    real, predicho: Math.round(predTest[i] * 100) / 100,
  }))

  const clasificacionNivelDemanda = exactitudPorNivelDemanda(yTest, predTest)

  return NextResponse.json({
    n,
    nSolicitado: nSolicitado === 'completo' ? 'completo' : nSolicitado,
    filasDisponiblesEnDataset: datasetCompleto.length,
    totalViajesFuente,
    nTrain: xTrain.length,
    nTest: xTest.length,
    mejoresHiperparametros: busqueda.mejorHp,
    r2PromedioValidacionCruzada: Math.round(busqueda.mejorR2Promedio * 1000) / 1000,
    combinacionesEvaluadas: busqueda.combinacionesEvaluadas,
    metricas: {
      train: calcularMetricas(yTrain, predTrain),
      test: calcularMetricas(yTest, predTest),
    },
    importancias: NOMBRES_FEATURES.map((nombre, i) => ({
      feature: nombre,
      importancia: Math.round((modeloFinal.importanciasRelativas[i] ?? 0) * 1000) / 1000,
    })).sort((a, b) => b.importancia - a.importancia),
    predichoVsReal,
    clasificacionNivelDemanda,
  })
}
