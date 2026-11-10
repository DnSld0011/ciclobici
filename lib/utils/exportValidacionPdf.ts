import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  CASOS_FUNCIONALES, HALLAZGOS_SEGURIDAD, METRICAS_MODELO_PREDICTIVO,
  type ResultadoValidacion,
} from '@/lib/validacion/datosValidacion'

const COLOR_VERDE_OSCURO: [number, number, number] = [0, 53, 39]
const COLOR_VERDE_CLARO: [number, number, number] = [178, 247, 70]
const COLOR_TEXTO_OSCURO: [number, number, number] = [18, 32, 26]
const COLOR_TEXTO_CLARO: [number, number, number] = [100, 115, 108]
const COLOR_GRIS_FILA: [number, number, number] = [245, 247, 245]
const COLOR_APROBADO: [number, number, number] = [22, 101, 52]
const COLOR_RECHAZADO: [number, number, number] = [186, 26, 26]

function escribirParrafo(doc: jsPDF, lineas: string[], x: number, y: number, lineHeight = 4.2, maxWidth = 182): number {
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  let cursorY = y
  for (const linea of lineas) {
    const envueltas: string[] = doc.splitTextToSize(linea, maxWidth)
    for (const sub of envueltas) {
      doc.text(sub, x, cursorY)
      cursorY += lineHeight
    }
  }
  return cursorY
}

export function exportarInformeValidacion(validacion: ResultadoValidacion): void {
  const { DIMENSIONES, IQC, REGLAS_VETO, APROBADO, usabilidadEsReal, resumenReal } = validacion
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margen = 14
  const ahora = new Date()

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
  doc.text('Validación de software antes de producción — Índice de Calidad Compuesto (IQC)', margen, 17)
  doc.setTextColor(200, 230, 210)
  doc.setFontSize(7)
  doc.text(
    `Generado: ${ahora.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    pageW - margen, 11, { align: 'right' }
  )

  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resultado de la validación', margen, 38)

  doc.setFillColor(...(APROBADO ? COLOR_APROBADO : COLOR_RECHAZADO))
  doc.roundedRect(margen, 42, pageW - margen * 2, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `IQC = ${(IQC * 100).toFixed(1)} / 100 — ${APROBADO ? 'Aprobado para producción' : 'No aprobado para producción'}`,
    margen + 4, 49.5
  )

  let cursorY = 62
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Metodología', margen, cursorY)
  cursorY = escribirParrafo(doc, [
    'Marco: ISO/IEC 25010 + Índice de Calidad Compuesto (IQC) ponderado en 6 dimensiones (Funcional 25%,',
    'Predictiva 20%, Seguridad 20%, Rendimiento 15%, Usabilidad 10%, Integridad 10%), con reglas de veto:',
    'ninguna dimensión por debajo de 0.70, cero defectos críticos y cero vulnerabilidades altas/críticas abiertas.',
    'Evidencia recolectada: pruebas manuales de extremo a extremo, revisión de código para seguridad e',
    'integridad, métricas reales del modelo de demanda, y cuestionario SUS/NPS' + (usabilidadEsReal
      ? ` con respuestas reales (n=${resumenReal?.n}).`
      : ' con datos de ejemplo (sin respuestas reales todavía).'),
  ], margen, cursorY + 5)

  cursorY += 6
  autoTable(doc, {
    startY: cursorY,
    head: [['Dimensión', 'Peso', 'Valor', 'Aporte', 'Evidencia']],
    body: DIMENSIONES.map(d => [
      d.nombre, `${(d.peso * 100).toFixed(0)}%`, (d.valor * 100).toFixed(1), (d.peso * d.valor * 100).toFixed(1), d.evidencia,
    ]),
    margin: { left: margen, right: margen },
    styles: { fontSize: 6.5, cellPadding: 2.2, textColor: COLOR_TEXTO_OSCURO },
    headStyles: { fillColor: COLOR_VERDE_OSCURO, textColor: [255, 255, 255], fontSize: 6.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR_GRIS_FILA },
    columnStyles: { 4: { cellWidth: 95 } },
  })

  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Reglas de veto', margen, y2)
  autoTable(doc, {
    startY: y2 + 3,
    head: [['Regla', 'Cumple', 'Detalle']],
    body: REGLAS_VETO.map(r => [r.regla, r.cumple ? 'Sí' : 'No', r.detalle]),
    margin: { left: margen, right: margen },
    styles: { fontSize: 7, cellPadding: 2.2, textColor: COLOR_TEXTO_OSCURO },
    headStyles: { fillColor: COLOR_VERDE_OSCURO, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR_GRIS_FILA },
  })

  // Página 2 — usabilidad, predictiva y seguridad
  doc.addPage()
  doc.setFillColor(...COLOR_VERDE_OSCURO)
  doc.rect(0, 0, pageW, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('San Borja en Bici · Validación de software (continuación)', margen, 10)

  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Usabilidad — SUS y NPS', margen, 26)

  const dimUsabilidad = DIMENSIONES.find(d => d.nombre === 'Usabilidad')!
  const y3 = escribirParrafo(doc, [
    dimUsabilidad.evidencia,
    dimUsabilidad.limitacion,
  ], margen, 31)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Predictiva — Modelo de demanda (Gradient Boosting)', margen, y3 + 4)
  const y4 = escribirParrafo(doc, [
    `${METRICAS_MODELO_PREDICTIVO.metodologia}`,
    `n = ${METRICAS_MODELO_PREDICTIVO.n} · R² test = ${METRICAS_MODELO_PREDICTIVO.r2Test} · RMSE test = ${METRICAS_MODELO_PREDICTIVO.rmseTest}`,
    METRICAS_MODELO_PREDICTIVO.limitacion,
  ], margen, y3 + 9)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Hallazgos de seguridad (encontrados y corregidos en esta validación)', margen, y4 + 4)
  autoTable(doc, {
    startY: y4 + 7,
    head: [['Endpoint', 'Severidad', 'Descripción', 'Estado']],
    body: HALLAZGOS_SEGURIDAD.map(h => [h.endpoint, h.severidad, h.descripcion, 'Corregido']),
    margin: { left: margen, right: margen },
    styles: { fontSize: 7, cellPadding: 2.2, textColor: COLOR_TEXTO_OSCURO },
    headStyles: { fillColor: COLOR_VERDE_OSCURO, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR_GRIS_FILA },
    columnStyles: { 2: { cellWidth: 95 } },
  })

  const y5 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Matriz de casos funcionales (${CASOS_FUNCIONALES.length})`, margen, y5)
  autoTable(doc, {
    startY: y5 + 3,
    head: [['Caso', 'Resultado', 'Detalle']],
    body: CASOS_FUNCIONALES.map(c => [
      c.caso,
      c.resultado === 'aprobado' ? 'Aprobado' : c.resultado === 'aprobado_advertencia' ? 'Aprobado (advertencia)' : 'Corregido',
      c.detalle,
    ]),
    margin: { left: margen, right: margen },
    styles: { fontSize: 6.5, cellPadding: 2, textColor: COLOR_TEXTO_OSCURO },
    headStyles: { fillColor: COLOR_VERDE_OSCURO, textColor: [255, 255, 255], fontSize: 6.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR_GRIS_FILA },
    columnStyles: { 2: { cellWidth: 95 } },
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLOR_TEXTO_CLARO)
  doc.text(
    'Validación ejecutada manualmente sobre el repositorio real; no reemplaza una suite automatizada de',
    margen, doc.internal.pageSize.getHeight() - 10
  )
  doc.text(
    'pruebas (CI), ni herramientas de carga/seguridad dedicadas (JMeter, OWASP ZAP).',
    margen, doc.internal.pageSize.getHeight() - 6
  )

  doc.save(`informe-validacion-software-${ahora.toISOString().slice(0, 10)}.pdf`)
}
