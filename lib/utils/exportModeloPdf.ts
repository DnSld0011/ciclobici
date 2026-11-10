import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ResultadoEntrenamiento } from '@/lib/ml/tipos'

const COLOR_VERDE_OSCURO: [number, number, number] = [0, 53, 39]
const COLOR_VERDE_CLARO: [number, number, number] = [178, 247, 70]
const COLOR_TEXTO_OSCURO: [number, number, number] = [18, 32, 26]
const COLOR_TEXTO_CLARO: [number, number, number] = [100, 115, 108]
const COLOR_GRIS_FILA: [number, number, number] = [245, 247, 245]

const METODOLOGIA = [
  'Algoritmo: Gradient Boosting Regressor (familia XGBoost/LightGBM), implementado nativamente siguiendo',
  'el algoritmo de Friedman (2001): F0(x) = media(y); en cada iteración m se entrena un árbol de regresión',
  'sobre el residuo r_i = y_i - F(m-1)(x_i), y se actualiza F_m(x) = F_(m-1)(x) + v * h_m(x), con v = learning_rate.',
  '',
  'Variable objetivo: demanda horaria (viajes iniciados) por estación, agregada de los registros reales de la',
  'tabla "viajes". Variables explicativas: hora, día de semana, fin de semana, capacidad de la estación,',
  'identificador de estación, demanda hace 1h, demanda hace 7 días (misma hora/día), demanda ayer (misma',
  'hora) y media móvil de 24h.',
  '',
  'Validación: igual protocolo que Cai et al. (2025, J. of Transport Geography 125:104201) — split 70/30',
  'train/test, selección de hiperparámetros con GridSearchCV + validación cruzada de 5 particiones (folds),',
  'y reporte de R², RMSE y MAE por separado en entrenamiento y prueba.',
]

function escribirParrafo(doc: jsPDF, lineas: string[], x: number, y: number, lineHeight = 4.2): number {
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  let cursorY = y
  for (const linea of lineas) {
    doc.text(linea, x, cursorY)
    cursorY += lineHeight
  }
  return cursorY
}

export function exportarInformeModelo(resultados: Record<string, ResultadoEntrenamiento>): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margen = 14
  const ahora = new Date()

  // Header
  doc.setFillColor(...COLOR_VERDE_OSCURO)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setFillColor(...COLOR_VERDE_CLARO)
  doc.rect(0, 26, pageW, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('San Borja en Bici', margen, 11)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(178, 247, 70)
  doc.text('Modelo predictivo de demanda — Gradient Boosting (validación GBDT)', margen, 17)
  doc.setTextColor(200, 230, 210)
  doc.setFontSize(7)
  doc.text(
    `Generado: ${ahora.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    pageW - margen, 11, { align: 'right' }
  )

  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Entrenamiento y validación del modelo predictivo', margen, 38)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Metodología', margen, 46)
  let cursorY = escribirParrafo(doc, METODOLOGIA, margen, 51)

  cursorY += 4
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Resultados por tamaño de muestra', margen, cursorY)
  cursorY += 5

  const filasComparacion = Object.entries(resultados).map(([etiqueta, r]) => [
    etiqueta,
    String(r.n),
    `${r.nTrain} / ${r.nTest}`,
    JSON.stringify(r.mejoresHiperparametros),
    r.metricas.train.r2.toFixed(3),
    r.metricas.test.r2.toFixed(3),
    r.metricas.test.rmse.toFixed(2),
    r.metricas.test.mae.toFixed(2),
  ])

  autoTable(doc, {
    startY: cursorY,
    head: [['Muestra', 'n', 'train/test', 'Hiperparámetros', 'R² train', 'R² test', 'RMSE test', 'MAE test']],
    body: filasComparacion,
    margin: { left: margen, right: margen },
    styles: { fontSize: 6.5, cellPadding: 2.5, textColor: COLOR_TEXTO_OSCURO },
    headStyles: { fillColor: COLOR_VERDE_OSCURO, textColor: [255, 255, 255], fontSize: 6.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR_GRIS_FILA },
  })

  // Importancia de variables — se toma la corrida de mayor n disponible
  const corridas = Object.values(resultados)
  if (corridas.length > 0) {
    const mayor = corridas.reduce((a, b) => (b.n > a.n ? b : a))
    const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLOR_TEXTO_OSCURO)
    doc.text(`Importancia de variables (muestra n=${mayor.n})`, margen, y2)

    autoTable(doc, {
      startY: y2 + 3,
      head: [['Variable', 'Importancia relativa']],
      body: mayor.importancias.map(i => [i.feature, i.importancia.toFixed(3)]),
      margin: { left: margen, right: margen },
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: COLOR_TEXTO_OSCURO },
      headStyles: { fillColor: COLOR_VERDE_OSCURO, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COLOR_GRIS_FILA },
    })
  }

  doc.setFontSize(7)
  doc.setTextColor(...COLOR_TEXTO_CLARO)
  doc.text(
    'Nota: grid de hiperparámetros reducido frente al de la referencia (Cai et al., 2025) para completar el',
    margen, doc.internal.pageSize.getHeight() - 10
  )
  doc.text(
    'entrenamiento dentro de una función serverless; mismo método (GBDT + GridSearchCV + 5-fold CV).',
    margen, doc.internal.pageSize.getHeight() - 6
  )

  doc.save(`informe-modelo-predictivo-${ahora.toISOString().slice(0, 10)}.pdf`)
}
