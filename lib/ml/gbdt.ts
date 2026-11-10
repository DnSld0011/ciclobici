// Gradient Boosting Regressor (familia XGBoost/LightGBM) implementado nativamente en TS.
//
// Fundamento matemático (Friedman, 2001), igual al usado por XGBoost/LightGBM:
//   F_0(x) = media(y)
//   para m = 1..M:
//     r_i = y_i - F_{m-1}(x_i)                 (pseudo-residuo = gradiente negativo de la pérdida L2)
//     h_m = árbol de regresión entrenado para predecir r_i a partir de x_i
//     F_m(x) = F_{m-1}(x) + ν · h_m(x)          (ν = learning_rate, "shrinkage")
//   F_M(x) es la predicción final tras M árboles.
//
// Cada árbol es un CART: en cada nodo busca, entre las features candidatas,
// el punto de corte que maximiza la reducción de varianza (SSE) del residuo.
// subsample y max_features introducen aleatoriedad (como en stochastic GBM / RF)
// para reducir sobreajuste.

export interface HiperparametrosGBDT {
  nEstimators: number
  learningRate: number
  maxDepth: number
  minSamplesLeaf: number
  subsample: number    // fracción de filas usada por árbol (0-1]
  maxFeatures: number  // fracción de features candidatas por split (0-1]
}

interface NodoArbol {
  esHoja: boolean
  valor?: number
  featureIdx?: number
  umbral?: number
  izq?: NodoArbol
  der?: NodoArbol
}

// PRNG determinista (mulberry32) — reproducibilidad exigida por el protocolo de validación.
export function crearRng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mezclarIndices(n: number, rng: () => number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

function sse(valores: number[], suma: number): number {
  if (valores.length === 0) return 0
  const media = suma / valores.length
  let s = 0
  for (const v of valores) s += (v - media) * (v - media)
  return s
}

class ArbolRegresion {
  raiz: NodoArbol
  importancias: Float64Array // reducción de varianza acumulada por feature

  constructor(
    X: number[][], y: number[], filas: number[],
    maxDepth: number, minSamplesLeaf: number, maxFeatures: number,
    nFeatures: number, rng: () => number
  ) {
    this.importancias = new Float64Array(nFeatures)
    this.raiz = this.construir(X, y, filas, 0, maxDepth, minSamplesLeaf, maxFeatures, nFeatures, rng)
  }

  private hoja(y: number[], filas: number[]): NodoArbol {
    const suma = filas.reduce((s, i) => s + y[i], 0)
    return { esHoja: true, valor: filas.length > 0 ? suma / filas.length : 0 }
  }

  private construir(
    X: number[][], y: number[], filas: number[], profundidad: number,
    maxDepth: number, minSamplesLeaf: number, maxFeatures: number,
    nFeatures: number, rng: () => number
  ): NodoArbol {
    if (profundidad >= maxDepth || filas.length < 2 * minSamplesLeaf) {
      return this.hoja(y, filas)
    }

    const sumaTotal = filas.reduce((s, i) => s + y[i], 0)
    const sseTotal = sse(filas.map(i => y[i]), sumaTotal)
    if (sseTotal <= 1e-12) return this.hoja(y, filas)

    const nCandidatas = Math.max(1, Math.round(nFeatures * maxFeatures))
    const featuresCandidatas = mezclarIndices(nFeatures, rng).slice(0, nCandidatas)

    let mejorGanancia = 0
    let mejorFeature = -1
    let mejorUmbral = 0

    for (const f of featuresCandidatas) {
      const ordenados = [...filas].sort((a, b) => X[a][f] - X[b][f])
      let sumaIzq = 0
      const valoresOrdenados = ordenados.map(i => y[i])
      const xOrdenados = ordenados.map(i => X[i][f])

      for (let k = 1; k < ordenados.length; k++) {
        sumaIzq += valoresOrdenados[k - 1]
        const nIzq = k
        const nDer = ordenados.length - k
        if (nIzq < minSamplesLeaf || nDer < minSamplesLeaf) continue
        if (xOrdenados[k] === xOrdenados[k - 1]) continue // mismo valor, no hay corte real

        const sumaDer = sumaTotal - sumaIzq
        const sseIzq = sse(valoresOrdenados.slice(0, k), sumaIzq)
        const sseDer = sse(valoresOrdenados.slice(k), sumaDer)
        const ganancia = sseTotal - sseIzq - sseDer

        if (ganancia > mejorGanancia) {
          mejorGanancia = ganancia
          mejorFeature = f
          mejorUmbral = (xOrdenados[k] + xOrdenados[k - 1]) / 2
        }
      }
    }

    if (mejorFeature === -1 || mejorGanancia <= 1e-12) return this.hoja(y, filas)

    this.importancias[mejorFeature] += mejorGanancia

    const filasIzq = filas.filter(i => X[i][mejorFeature] <= mejorUmbral)
    const filasDer = filas.filter(i => X[i][mejorFeature] > mejorUmbral)

    return {
      esHoja: false,
      featureIdx: mejorFeature,
      umbral: mejorUmbral,
      izq: this.construir(X, y, filasIzq, profundidad + 1, maxDepth, minSamplesLeaf, maxFeatures, nFeatures, rng),
      der: this.construir(X, y, filasDer, profundidad + 1, maxDepth, minSamplesLeaf, maxFeatures, nFeatures, rng),
    }
  }

  predecir(x: number[]): number {
    let nodo = this.raiz
    while (!nodo.esHoja) {
      nodo = x[nodo.featureIdx!] <= nodo.umbral! ? nodo.izq! : nodo.der!
    }
    return nodo.valor!
  }
}

export class GradientBoostingRegressor {
  private arboles: ArbolRegresion[] = []
  private valorInicial = 0
  private nFeatures = 0
  importanciasRelativas: number[] = []

  constructor(private hp: HiperparametrosGBDT) {}

  fit(X: number[][], y: number[], seed = 42): void {
    const n = X.length
    this.nFeatures = X[0]?.length ?? 0
    this.valorInicial = y.reduce((s, v) => s + v, 0) / n
    this.arboles = []
    const rng = crearRng(seed)
    const importanciasAcum = new Float64Array(this.nFeatures)

    const predActual = new Float64Array(n).fill(this.valorInicial)

    for (let m = 0; m < this.hp.nEstimators; m++) {
      const residuos = Array.from({ length: n }, (_, i) => y[i] - predActual[i])

      // Submuestreo estocástico de filas (stochastic gradient boosting)
      const nMuestra = Math.max(2, Math.round(n * this.hp.subsample))
      const filasMuestra = mezclarIndices(n, rng).slice(0, nMuestra)

      const arbol = new ArbolRegresion(
        X, residuos, filasMuestra,
        this.hp.maxDepth, this.hp.minSamplesLeaf, this.hp.maxFeatures,
        this.nFeatures, rng
      )
      this.arboles.push(arbol)

      for (let f = 0; f < this.nFeatures; f++) importanciasAcum[f] += arbol.importancias[f]

      for (let i = 0; i < n; i++) {
        predActual[i] += this.hp.learningRate * arbol.predecir(X[i])
      }
    }

    const totalImportancia = importanciasAcum.reduce((s, v) => s + v, 0)
    this.importanciasRelativas = totalImportancia > 0
      ? Array.from(importanciasAcum, v => v / totalImportancia)
      : Array.from(importanciasAcum, () => 0)
  }

  predict(X: number[][]): number[] {
    return X.map(x => {
      let pred = this.valorInicial
      for (const arbol of this.arboles) pred += this.hp.learningRate * arbol.predecir(x)
      return pred
    })
  }
}
