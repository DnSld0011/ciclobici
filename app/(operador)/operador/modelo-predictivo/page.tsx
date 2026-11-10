'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Legend,
} from 'recharts'
import { FlaskConical, Play, Download, Loader2, Info, CheckCircle2 } from 'lucide-react'
import type { ResultadoEntrenamiento } from '@/lib/ml/tipos'
import { exportarInformeModelo } from '@/lib/utils/exportModeloPdf'

const TAMANOS: { valor: number | 'completo'; etiqueta: string }[] = [
  { valor: 1000, etiqueta: '1,000 registros' },
  { valor: 2000, etiqueta: '2,000 registros' },
  { valor: 'completo', etiqueta: 'Dataset completo (máx. 3,000)' },
]

export default function ModeloPredictivoPage() {
  const [resultados, setResultados] = useState<Record<string, ResultadoEntrenamiento>>({})
  const [corriendo, setCorriendo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccionActiva, setSeleccionActiva] = useState<string | null>(null)

  async function entrenar(tamano: number | 'completo', etiqueta: string) {
    setCorriendo(etiqueta)
    setError(null)
    try {
      const res = await fetch('/api/operador/modelo-predictivo/entrenar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: tamano }),
      })
      const json = await res.json()
      if (!res.ok || json.sin_datos) {
        setError(json.sin_datos
          ? `No hay suficientes viajes reales en la base de datos (solo ${json.filasDisponibles} filas construidas; se necesitan al menos 100).`
          : (json.error ?? 'Error al entrenar el modelo.'))
        return
      }
      setResultados(prev => ({ ...prev, [etiqueta]: json }))
      setSeleccionActiva(etiqueta)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setCorriendo(null)
    }
  }

  const corridas = Object.entries(resultados)
  const activa = seleccionActiva ? resultados[seleccionActiva] : null

  const comparacionR2 = corridas.map(([etiqueta, r]) => ({
    etiqueta, 'R² train': Number(r.metricas.train.r2.toFixed(3)), 'R² test': Number(r.metricas.test.r2.toFixed(3)),
  }))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#002117' }}>
          <FlaskConical size={20} style={{ color: '#b2f746' }} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-on-surface">Modelo Predictivo (Gradient Boosting)</h1>
          <p className="text-sm text-outline mt-0.5">
            Entrena y valida, sobre los viajes reales de la base de datos, un modelo de Gradient Boosting
            (familia XGBoost/LightGBM) que predice la demanda horaria por estación — la base para calcular
            cuántas bicicletas debe tener cada estación.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed bg-surface-container-low text-on-surface-variant">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          Metodología igual a la referencia académica (Cai et al., 2025, <em>Journal of Transport Geography</em> 125:104201):
          split 70/30 train/test, selección de hiperparámetros con GridSearchCV + validación cruzada de 5 particiones,
          y métricas R²/RMSE/MAE reportadas por separado en entrenamiento y prueba. El experimento con distintos
          tamaños de muestra (1,000 vs. 2,000 vs. dataset completo) muestra cómo cambia el ajuste del modelo según
          el volumen de información disponible.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-on-surface mb-3">Entrenar con distintos tamaños de muestra</h2>
        <div className="flex flex-wrap gap-2.5">
          {TAMANOS.map(({ valor, etiqueta }) => {
            const yaCorrido = !!resultados[etiqueta]
            return (
              <button key={etiqueta} onClick={() => entrenar(valor, etiqueta)}
                disabled={corriendo !== null}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50
                  ${yaCorrido ? 'bg-[#002117] text-white' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}>
                {corriendo === etiqueta ? <Loader2 size={15} className="animate-spin" />
                  : yaCorrido ? <CheckCircle2 size={15} style={{ color: '#b2f746' }} /> : <Play size={15} />}
                {etiqueta}
              </button>
            )
          })}
          {corridas.length > 0 && (
            <button onClick={() => exportarInformeModelo(resultados)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ml-auto"
              style={{ background: '#b2f746', color: '#002117' }}>
              <Download size={15} />Descargar informe (PDF)
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-xs font-semibold text-error">{error}</p>}
      </section>

      {corridas.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-on-surface mb-1">Tabla de resultados</h2>
          <p className="text-xs text-outline mb-3">Elegí una fila para ver sus gráficos en detalle.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-outline border-b border-gray-100">
                  <th className="py-2 pr-3">Muestra</th>
                  <th className="py-2 pr-3">n (train/test)</th>
                  <th className="py-2 pr-3">Hiperparámetros</th>
                  <th className="py-2 pr-3">R² train</th>
                  <th className="py-2 pr-3">R² test</th>
                  <th className="py-2 pr-3">RMSE test</th>
                  <th className="py-2 pr-3">MAE test</th>
                </tr>
              </thead>
              <tbody>
                {corridas.map(([etiqueta, r]) => (
                  <tr key={etiqueta}
                    onClick={() => setSeleccionActiva(etiqueta)}
                    className={`cursor-pointer border-b border-gray-50 ${seleccionActiva === etiqueta ? 'bg-surface-container-low' : 'hover:bg-surface-container-low/60'}`}>
                    <td className="py-2 pr-3 font-bold">{etiqueta}</td>
                    <td className="py-2 pr-3">{r.nTrain} / {r.nTest}</td>
                    <td className="py-2 pr-3 font-mono text-[10px]">
                      n_estimators={r.mejoresHiperparametros.nEstimators}, lr={r.mejoresHiperparametros.learningRate}, depth={r.mejoresHiperparametros.maxDepth}
                    </td>
                    <td className="py-2 pr-3">{r.metricas.train.r2.toFixed(3)}</td>
                    <td className="py-2 pr-3 font-bold">{r.metricas.test.r2.toFixed(3)}</td>
                    <td className="py-2 pr-3">{r.metricas.test.rmse.toFixed(2)}</td>
                    <td className="py-2 pr-3">{r.metricas.test.mae.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {corridas.length > 1 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-on-surface mb-1">Comparación de R² según volumen de datos</h2>
          <p className="text-xs text-outline mb-3">
            Muestra cómo cambia el ajuste del modelo (R²) al entrenar con más o menos registros.
          </p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={comparacionR2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="R² train" fill="#8fd4ff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="R² test" fill="#002117" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {activa && (
        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-on-surface mb-1">Importancia de variables — {seleccionActiva}</h2>
            <p className="text-xs text-outline mb-3">Qué tan determinante fue cada variable en las predicciones del modelo.</p>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={activa.importancias} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="importancia" fill="#b2f746" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-on-surface mb-1">Predicho vs. real (test) — {seleccionActiva}</h2>
            <p className="text-xs text-outline mb-3">Cada punto es una hora/estación del conjunto de prueba; más cerca de la diagonal, mejor.</p>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" dataKey="real" name="Real" tick={{ fontSize: 10 }} />
                  <YAxis type="number" dataKey="predicho" name="Predicho" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Scatter data={activa.predichoVsReal} fill="#002117" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
