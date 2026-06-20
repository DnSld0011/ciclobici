import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface PdfOptions {
  titulo: string
  subtitulo?: string
  columnas: string[]
  filas: (string | number)[][]
  nombreArchivo: string
  orientacion?: 'portrait' | 'landscape'
}

// Paleta de marca
const COLOR_VERDE_OSCURO : [number, number, number] = [0,  53, 39]   // #003527
const COLOR_VERDE_MEDIO  : [number, number, number] = [0,  80, 58]   // #00503a
const COLOR_VERDE_CLARO  : [number, number, number] = [178,247,70]   // #b2f746
const COLOR_GRIS_FILA    : [number, number, number] = [245,247,245]
const COLOR_TEXTO_OSCURO : [number, number, number] = [18, 32, 26]
const COLOR_TEXTO_CLARO  : [number, number, number] = [100,115,108]

export function exportarPdf({
  titulo,
  subtitulo,
  columnas,
  filas,
  nombreArchivo,
  orientacion = 'portrait',
}: PdfOptions): void {
  const doc = new jsPDF({ orientation: orientacion, unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margen = 14

  // ── HEADER ───────────────────────────────────────────────────
  // Banda superior verde oscuro
  doc.setFillColor(...COLOR_VERDE_OSCURO)
  doc.rect(0, 0, pageW, 28, 'F')

  // Acento verde claro (franja delgada inferior del header)
  doc.setFillColor(...COLOR_VERDE_CLARO)
  doc.rect(0, 26, pageW, 2, 'F')

  // Nombre del sistema
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('San Borja en Bici', margen, 11)

  // Tagline
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(178, 247, 70) // verde claro
  doc.text('Sistema de Bicicletas Compartidas · Municipalidad de San Borja', margen, 17)

  // Fecha de generación (derecha)
  const ahora = new Date()
  const fechaStr = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
  const horaStr  = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  doc.setTextColor(200, 230, 210)
  doc.setFontSize(7)
  doc.text(`Generado: ${fechaStr} · ${horaStr}`, pageW - margen, 11, { align: 'right' })

  // ── TÍTULO DEL REPORTE ───────────────────────────────────────
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, margen, 41)

  let cursorY = 47

  if (subtitulo) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_TEXTO_CLARO)
    doc.text(subtitulo, margen, cursorY)
    cursorY += 6
  }

  // Línea divisora
  doc.setDrawColor(...COLOR_VERDE_CLARO)
  doc.setLineWidth(0.6)
  doc.line(margen, cursorY, pageW - margen, cursorY)
  cursorY += 5

  // Contador de registros
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_TEXTO_CLARO)
  doc.text(`${filas.length} registro${filas.length !== 1 ? 's' : ''}`, margen, cursorY)
  cursorY += 4

  // ── TABLA ────────────────────────────────────────────────────
  autoTable(doc, {
    startY: cursorY,
    head: [columnas],
    body: filas,
    margin: { left: margen, right: margen },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: COLOR_TEXTO_OSCURO,
      lineColor: [220, 228, 224],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLOR_VERDE_OSCURO,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
    },
    alternateRowStyles: {
      fillColor: COLOR_GRIS_FILA,
    },
    columnStyles: {},
    tableLineColor: COLOR_VERDE_MEDIO,
    tableLineWidth: 0.3,
    didParseCell(data) {
      // Primera columna en negrita
      if (data.column.index === 0 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ── FOOTER en cada página ────────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

    // Banda footer
    doc.setFillColor(...COLOR_VERDE_OSCURO)
    doc.rect(0, pageH - 12, pageW, 12, 'F')

    // Franja acento
    doc.setFillColor(...COLOR_VERDE_CLARO)
    doc.rect(0, pageH - 12, pageW, 1.5, 'F')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(178, 247, 70)
    doc.text('San Borja en Bici — Reporte confidencial de uso interno', margen, pageH - 4.5)
    doc.setTextColor(200, 230, 210)
    doc.text(`Página ${p} de ${totalPages}`, pageW - margen, pageH - 4.5, { align: 'right' })
  }

  doc.save(`${nombreArchivo}-${ahora.toISOString().slice(0, 10)}.pdf`)
}
