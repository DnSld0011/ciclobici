import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { construirDatasetDesdeViajes, submuestrear, NOMBRES_FEATURES, type EstacionBase } from '@/lib/ml/datosViajes'
import { generarViajesSimulados } from '@/lib/ml/datosViajesSimulados'
import { GradientBoostingRegressor } from '@/lib/ml/gbdt'
import { trainTestSplit, gridSearchCV, calcularMetricas } from '@/lib/ml/validacion'

// Proyección con datos SINTÉTICOS (nunca se escriben en la base real): ¿cómo
// rendiría el mismo modelo/protocolo si hubiera un volumen de viajes
// comparable al del paper de referencia (Cai et al. 2025, ~180k viajes)?
// No sustituye ni se mezcla con la validación real — es un escenario aparte.
const GRID = { nEstimators: [50, 100], learningRate: [0.05, 0.1], maxDepth: [2, 3] }
const FIJOS = { minSamplesLeaf: 3, subsample: 0.8, maxFeatures: 0.8 }
const K_FOLDS = 5
const TEST_RATIO = 0.3
const MAX_FILAS_ENTRENAMIENTO = 4000

export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !['operador', 'administrador'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { data: estaciones } = await admin.from('estaciones').select('id, nombre, capacidad').order('nombre')
  if (!estaciones || estaciones.length === 0) {
    return NextResponse.json({ error: 'No hay estaciones para simular' }, { status: 400 })
  }

  // ~365 días con el mismo número de estaciones reales alcanza un volumen de
  // viajes sintéticos del mismo orden de magnitud que el paper de referencia.
  const viajesSinteticos = generarViajesSimulados(estaciones as EstacionBase[], 365)
  const datasetCompleto = construirDatasetDesdeViajes(estaciones as EstacionBase[], viajesSinteticos)

  if (datasetCompleto.length < 100) {
    return NextResponse.json({ error: 'No se pudo generar suficiente dataset simulado' }, { status: 500 })
  }

  const n = Math.min(datasetCompleto.length, MAX_FILAS_ENTRENAMIENTO)
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

  return NextResponse.json({
    esSimulado: true,
    totalViajesSinteticos: viajesSinteticos.length,
    filasDisponiblesEnDataset: datasetCompleto.length,
    n, nTrain: xTrain.length, nTest: xTest.length,
    mejoresHiperparametros: busqueda.mejorHp,
    metricas: { train: calcularMetricas(yTrain, predTrain), test: calcularMetricas(yTest, predTest) },
    importancias: NOMBRES_FEATURES.map((nombre, i) => ({
      feature: nombre, importancia: Math.round((modeloFinal.importanciasRelativas[i] ?? 0) * 1000) / 1000,
    })).sort((a, b) => b.importancia - a.importancia),
  })
}
