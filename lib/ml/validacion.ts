// Protocolo de validación: split train/test, validación cruzada k-fold,
// búsqueda de hiperparámetros (GridSearchCV) y métricas de error —
// el mismo esquema metodológico que Cai et al. (2025, J. Transport Geography
// 125:104201): 70/30 train/test + 5-fold CV + GridSearchCV, reportando
// R², RMSE y MAE por separado en train y test.

import { GradientBoostingRegressor, crearRng, type HiperparametrosGBDT } from './gbdt'

export interface Metricas { r2: number; rmse: number; mae: number }

export function r2Score(yReal: number[], yPred: number[]): number {
  const media = yReal.reduce((s, v) => s + v, 0) / yReal.length
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < yReal.length; i++) {
    ssRes += (yReal[i] - yPred[i]) ** 2
    ssTot += (yReal[i] - media) ** 2
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0
}

export function rmse(yReal: number[], yPred: number[]): number {
  const n = yReal.length
  const s = yReal.reduce((acc, v, i) => acc + (v - yPred[i]) ** 2, 0)
  return Math.sqrt(s / n)
}

export function mae(yReal: number[], yPred: number[]): number {
  const n = yReal.length
  const s = yReal.reduce((acc, v, i) => acc + Math.abs(v - yPred[i]), 0)
  return s / n
}

export function calcularMetricas(yReal: number[], yPred: number[]): Metricas {
  return { r2: r2Score(yReal, yPred), rmse: rmse(yReal, yPred), mae: mae(yReal, yPred) }
}

export interface ResultadoClasificacionDemanda {
  exactitud: number
  umbrales: { medio: number; alto: number }
  matriz: Record<'bajo' | 'medio' | 'alto', Record<'bajo' | 'medio' | 'alto', number>>
}

/**
 * Métrica complementaria al R²: en vez de exigir predecir la demanda exacta
 * (muy sensible al ruido con pocos datos), mide si el modelo clasifica bien
 * el NIVEL de demanda (bajo/medio/alto) — la pregunta operativa real para
 * decidir si una estación necesita rebalanceo. Los umbrales (terciles) se
 * calculan sobre la distribución real de yReal, no se eligen a mano.
 */
export function exactitudPorNivelDemanda(yReal: number[], yPred: number[]): ResultadoClasificacionDemanda {
  const ordenado = [...yReal].sort((a, b) => a - b)
  const percentil = (p: number) => ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * p))]
  const umbralMedio = Math.max(1, percentil(1 / 3))
  const umbralAlto = Math.max(umbralMedio + 1, percentil(2 / 3))

  const nivel = (v: number): 'bajo' | 'medio' | 'alto' =>
    v < umbralMedio ? 'bajo' : v < umbralAlto ? 'medio' : 'alto'

  const matriz: ResultadoClasificacionDemanda['matriz'] = {
    bajo: { bajo: 0, medio: 0, alto: 0 },
    medio: { bajo: 0, medio: 0, alto: 0 },
    alto: { bajo: 0, medio: 0, alto: 0 },
  }

  let aciertos = 0
  for (let i = 0; i < yReal.length; i++) {
    const real = nivel(yReal[i])
    const pred = nivel(yPred[i])
    matriz[real][pred]++
    if (real === pred) aciertos++
  }

  return {
    exactitud: yReal.length > 0 ? aciertos / yReal.length : 0,
    umbrales: { medio: umbralMedio, alto: umbralAlto },
    matriz,
  }
}

/** Split train/test aleatorio con semilla (reproducible). */
export function trainTestSplit(
  X: number[][], y: number[], testRatio: number, seed: number
): { xTrain: number[][]; yTrain: number[]; xTest: number[][]; yTest: number[] } {
  const rng = crearRng(seed)
  const n = X.length
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const nTest = Math.round(n * testRatio)
  const idxTest = idx.slice(0, nTest)
  const idxTrain = idx.slice(nTest)
  return {
    xTrain: idxTrain.map(i => X[i]), yTrain: idxTrain.map(i => y[i]),
    xTest: idxTest.map(i => X[i]), yTest: idxTest.map(i => y[i]),
  }
}

/** Índices de k particiones (folds) para validación cruzada. */
function kFoldIndices(n: number, k: number, seed: number): number[][] {
  const rng = crearRng(seed)
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const folds: number[][] = Array.from({ length: k }, () => [])
  idx.forEach((v, i) => folds[i % k].push(v))
  return folds
}

export interface ResultadoGridSearch {
  mejorHp: HiperparametrosGBDT
  mejorR2Promedio: number
  combinacionesEvaluadas: number
}

/**
 * GridSearchCV + validación cruzada de k particiones (Pedregosa et al., 2011,
 * como en el paper de referencia). Para cada combinación del grid, entrena
 * y evalúa en k particiones y promedia el R² de validación; se queda con la
 * combinación de mejor R² promedio.
 */
export function gridSearchCV(
  X: number[][], y: number[],
  grid: { nEstimators: number[]; learningRate: number[]; maxDepth: number[] },
  fijos: { minSamplesLeaf: number; subsample: number; maxFeatures: number },
  k: number, seed: number
): ResultadoGridSearch {
  const folds = kFoldIndices(X.length, k, seed)
  let mejorHp: HiperparametrosGBDT | null = null
  let mejorR2 = -Infinity
  let combinaciones = 0

  for (const nEstimators of grid.nEstimators) {
    for (const learningRate of grid.learningRate) {
      for (const maxDepth of grid.maxDepth) {
        const hp: HiperparametrosGBDT = { nEstimators, learningRate, maxDepth, ...fijos }
        let sumaR2 = 0

        for (let f = 0; f < k; f++) {
          const idxVal = folds[f]
          const idxTrain = folds.filter((_, i) => i !== f).flat()
          const xTrain = idxTrain.map(i => X[i]), yTrain = idxTrain.map(i => y[i])
          const xVal = idxVal.map(i => X[i]), yVal = idxVal.map(i => y[i])

          const modelo = new GradientBoostingRegressor(hp)
          modelo.fit(xTrain, yTrain, seed + f)
          sumaR2 += r2Score(yVal, modelo.predict(xVal))
        }

        const r2Promedio = sumaR2 / k
        combinaciones++
        if (r2Promedio > mejorR2) { mejorR2 = r2Promedio; mejorHp = hp }
      }
    }
  }

  return { mejorHp: mejorHp!, mejorR2Promedio: mejorR2, combinacionesEvaluadas: combinaciones }
}
