export interface Metricas { r2: number; rmse: number; mae: number }

export interface Importancia { feature: string; importancia: number }

export interface PuntoPredichoVsReal { real: number; predicho: number }

export interface ResultadoEntrenamiento {
  n: number
  nSolicitado: number | 'completo'
  filasDisponiblesEnDataset: number
  totalViajesFuente: number
  nTrain: number
  nTest: number
  mejoresHiperparametros: { nEstimators: number; learningRate: number; maxDepth: number; minSamplesLeaf: number; subsample: number; maxFeatures: number }
  r2PromedioValidacionCruzada: number
  combinacionesEvaluadas: number
  metricas: { train: Metricas; test: Metricas }
  importancias: Importancia[]
  predichoVsReal: PuntoPredichoVsReal[]
}
