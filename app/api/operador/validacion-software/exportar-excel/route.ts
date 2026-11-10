import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface FilaEncuesta {
  rol: string
  p1: number; p2: number; p3: number; p4: number; p5: number
  p6: number; p7: number; p8: number; p9: number; p10: number
  nps: number | null
  comentario: string | null
}

// Estilo "Marca San Borja" — verde oscuro + lima, igual a los colores de la app.
const VERDE_OSCURO = 'FF002117'
const LIMA = 'FFB2F746'
const VERDE_TEXTO_ACENTO = 'FF446900'
const VERDE_CLARO_FILA = 'FFF4FAEA'
const BORDE_GRIS = 'FFE5E7EB'

const ENCABEZADOS_SUS = [
  'Usuario / ID', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10',
  'Puntaje Final SUS', 'Interpretación',
]

function formulaSUS(fila: number): string {
  return `((B${fila}-1)+(5-C${fila})+(D${fila}-1)+(5-E${fila})+(F${fila}-1)+(5-G${fila})+(H${fila}-1)+(5-I${fila})+(J${fila}-1)+(5-K${fila}))*2.5`
}

function formulaInterpretacion(col: string, fila: number): string {
  return `IF(${col}${fila}>=80,"Excelente (Muy Buena)",IF(${col}${fila}>=68,"Aceptable (Buena)",IF(${col}${fila}>=51,"Marginal (Baja)","Deficiente (Inaceptable)")))`
}

function estilizarTitulo(ws: ExcelJS.Worksheet, fila: number, ultimaColumna: string, texto: string) {
  ws.mergeCells(`A${fila}:${ultimaColumna}${fila}`)
  const c = ws.getCell(`A${fila}`)
  c.value = texto
  c.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  c.alignment = { vertical: 'middle' }
  ws.getRow(fila).height = 26
  ws.getRow(fila).eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } }
  })
}

function estilizarSubtitulo(ws: ExcelJS.Worksheet, fila: number, ultimaColumna: string, texto: string) {
  ws.mergeCells(`A${fila}:${ultimaColumna}${fila}`)
  const c = ws.getCell(`A${fila}`)
  c.value = texto
  c.font = { italic: true, size: 10, color: { argb: VERDE_TEXTO_ACENTO } }
  ws.getRow(fila).eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF7D1' } }
  })
}

function estilizarEncabezado(ws: ExcelJS.Worksheet, fila: number) {
  ws.getRow(fila).eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } }
    c.alignment = { horizontal: 'center' }
    c.border = { bottom: { style: 'medium', color: { argb: LIMA } } }
  })
}

function estilizarFilaDatos(ws: ExcelJS.Worksheet, fila: number, indice: number) {
  const row = ws.getRow(fila)
  if (indice % 2 === 1) {
    row.eachCell({ includeEmpty: true }, c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO_FILA } } })
  }
  row.eachCell(c => {
    c.border = { bottom: { style: 'thin', color: { argb: BORDE_GRIS } } }
    c.alignment = { horizontal: 'center' }
  })
  row.getCell(1).alignment = { horizontal: 'left' }
}

function estilizarFilaPromedio(ws: ExcelJS.Worksheet, fila: number) {
  const row = ws.getRow(fila)
  row.eachCell({ includeEmpty: true }, c => {
    c.font = { bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIMA } }
    c.alignment = { horizontal: 'center' }
  })
  row.getCell(1).alignment = { horizontal: 'left' }
}

function aplicarEscalaSUS(ws: ExcelJS.Worksheet, ref: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [{
      type: 'colorScale',
      priority: 1,
      cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 68 }, { type: 'num', value: 100 }],
      color: [{ argb: 'FFF08E8E' }, { argb: 'FFFBE38A' }, { argb: 'FF9BD37A' }],
    }],
  })
}

function agregarHojaSUS(wb: ExcelJS.Workbook, nombreHoja: string, titulo: string, respuestas: FilaEncuesta[]) {
  const ws = wb.addWorksheet(nombreHoja)
  estilizarTitulo(ws, 1, 'M', titulo)
  estilizarSubtitulo(ws, 2, 'M', `Generado el ${new Date().toLocaleDateString('es-PE')} · Total de respuestas: ${respuestas.length}`)
  ws.addRow([])
  ws.addRow(ENCABEZADOS_SUS)
  estilizarEncabezado(ws, 4)
  ws.views = [{ state: 'frozen', ySplit: 4 }]

  respuestas.forEach((r, i) => {
    const filaExcel = 5 + i
    ws.addRow([
      `Respuesta ${i + 1} (${r.rol})`, r.p1, r.p2, r.p3, r.p4, r.p5, r.p6, r.p7, r.p8, r.p9, r.p10,
      { formula: formulaSUS(filaExcel) },
      { formula: formulaInterpretacion('L', filaExcel) },
    ])
    estilizarFilaDatos(ws, filaExcel, i)
  })

  if (respuestas.length > 0) {
    const inicio = 5
    const fin = 4 + respuestas.length
    const filaProm = fin + 1
    ws.addRow([
      'PROMEDIO GENERAL', null, null, null, null, null, null, null, null, null, null,
      { formula: `AVERAGE(L${inicio}:L${fin})` },
      { formula: formulaInterpretacion('L', filaProm) },
    ])
    estilizarFilaPromedio(ws, filaProm)
    aplicarEscalaSUS(ws, `L${inicio}:L${fin}`)
  }
  ws.columns.forEach(c => { c.width = 14 })
  ws.getColumn(1).width = 26
  ws.getColumn(13).width = 22
  ws.pageSetup = { fitToPage: true, fitToWidth: 1 }
  return ws
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !['operador', 'tecnico', 'administrador'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { data: todas } = await admin
    .from('encuestas_usabilidad')
    .select('dimension, rol, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, nps, comentario, created_at')
    .order('created_at', { ascending: true })

  const filasPorDimension = (dim: string): FilaEncuesta[] =>
    (todas ?? []).filter(f => (f.dimension ?? 'usabilidad') === dim) as FilaEncuesta[]

  const respuestas = filasPorDimension('usabilidad')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'San Borja en Bici'
  wb.created = new Date()

  // ── Hoja 1: Calculadora SUS — Usabilidad general ──
  agregarHojaSUS(wb, 'Calculadora SUS', 'CALCULADORA SUS — DATOS REALES (/encuesta-usabilidad)', respuestas)

  // ── Hoja 2: Calculadora SUS y NPS — Usabilidad general ──
  const ws2 = wb.addWorksheet('SUS y NPS')
  estilizarTitulo(ws2, 1, 'Q', 'CALCULADORA SUS + NPS — DATOS REALES (/encuesta-usabilidad)')
  ws2.addRow([])
  ws2.addRow([
    'Usuario', ...Array.from({ length: 10 }, (_, i) => `P${i + 1}`),
    'Puntaje SUS', 'Diagnóstico SUS', 'Recomendación NPS (0-10)', 'Comentario',
    null, 'MÉTRICAS METODOLÓGICAS',
  ])
  estilizarEncabezado(ws2, 3)
  ws2.views = [{ state: 'frozen', ySplit: 3 }]

  respuestas.forEach((r, i) => {
    const filaExcel = 4 + i
    ws2.addRow([
      `Respuesta ${i + 1} (${r.rol})`, r.p1, r.p2, r.p3, r.p4, r.p5, r.p6, r.p7, r.p8, r.p9, r.p10,
      { formula: formulaSUS(filaExcel) },
      { formula: formulaInterpretacion('L', filaExcel) },
      r.nps, r.comentario ?? '',
    ])
    estilizarFilaDatos(ws2, filaExcel, i)
  })

  if (respuestas.length > 0) {
    const inicio = 4
    const fin = 3 + respuestas.length
    const filaProm = fin + 1
    ws2.addRow([
      'PROMEDIO GENERAL', null, null, null, null, null, null, null, null, null, null,
      { formula: `AVERAGE(L${inicio}:L${fin})` },
      { formula: formulaInterpretacion('L', filaProm) },
      { formula: `AVERAGE(N${inicio}:N${fin})` },
    ])
    estilizarFilaPromedio(ws2, filaProm)
    aplicarEscalaSUS(ws2, `L${inicio}:L${fin}`)

    ws2.getCell(`P${inicio - 1}`).value = 'Promedio global SUS'
    ws2.getCell(`Q${inicio - 1}`).value = { formula: `L${filaProm}` }
    ws2.getCell(`P${inicio}`).value = 'Resultado Diagnóstico'
    ws2.getCell(`Q${inicio}`).value = { formula: `M${filaProm}` }
    ws2.getCell(`P${inicio + 1}`).value = 'Total de Promotores (9-10)'
    ws2.getCell(`Q${inicio + 1}`).value = { formula: `COUNTIFS(N${inicio}:N${fin},">=9")` }
    ws2.getCell(`P${inicio + 2}`).value = 'Total de Pasivos (7-8)'
    ws2.getCell(`Q${inicio + 2}`).value = { formula: `COUNTIFS(N${inicio}:N${fin},">=7",N${inicio}:N${fin},"<=8")` }
    ws2.getCell(`P${inicio + 3}`).value = 'Total de Detractores (0-6)'
    ws2.getCell(`Q${inicio + 3}`).value = { formula: `COUNTIFS(N${inicio}:N${fin},"<=6")` }
    ws2.getCell(`P${inicio + 4}`).value = 'Total Encuestados'
    ws2.getCell(`Q${inicio + 4}`).value = { formula: `COUNT(N${inicio}:N${fin})` }
    ws2.getCell(`P${inicio + 5}`).value = 'INDICADOR NPS FINAL'
    ws2.getCell(`Q${inicio + 5}`).value = { formula: `((Q${inicio + 1}-Q${inicio + 3})/Q${inicio + 4})*100` }
    for (let f = inicio - 1; f <= inicio + 5; f++) {
      ws2.getCell(`P${f}`).font = { bold: true, color: { argb: VERDE_TEXTO_ACENTO } }
      ws2.getCell(`Q${f}`).font = { bold: true }
    }
  }
  ws2.columns.forEach(c => { c.width = 14 })
  ws2.getColumn(1).width = 24
  ws2.getColumn(15).width = 8
  ws2.getColumn(16).width = 24
  ws2.pageSetup = { fitToPage: true, fitToWidth: 1 }

  // ── Hojas 3-6: una por cada dimensión adicional (igual que las hojas 1-4
  // de la plantilla original: Seguridad, Funcionalidad, Rendimiento, Integridad) ──
  agregarHojaSUS(wb, 'SUS Seguridad', 'CUESTIONARIO SUS: SEGURIDAD Y CONFIDENCIALIDAD', filasPorDimension('seguridad'))
  agregarHojaSUS(wb, 'SUS Funcionalidad', 'CUESTIONARIO SUS: FUNCIONALIDAD Y COBERTURA', filasPorDimension('funcionalidad'))
  agregarHojaSUS(wb, 'SUS Rendimiento', 'CUESTIONARIO SUS: RENDIMIENTO Y EFICIENCIA', filasPorDimension('rendimiento'))
  agregarHojaSUS(wb, 'SUS Integridad', 'CUESTIONARIO SUS: INTEGRIDAD Y CONSISTENCIA DE DATOS', filasPorDimension('integridad'))

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="encuesta-usabilidad-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
