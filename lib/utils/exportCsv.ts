/**
 * Descarga un array de objetos como archivo CSV.
 * Las claves del primer elemento se usan como cabeceras.
 */
export function exportarCsv(filas: Record<string, unknown>[], nombreArchivo: string): void {
  if (!filas.length) return

  const cabeceras = Object.keys(filas[0])
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v).replace(/"/g, '""')
    return /[,"\n]/.test(s) ? `"${s}"` : s
  }

  const csv = [
    cabeceras.join(','),
    ...filas.map(fila => cabeceras.map(k => escape(fila[k])).join(',')),
  ].join('\r\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
