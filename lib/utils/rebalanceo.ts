// Algoritmo compartido de emparejamiento estación-con-excedente ↔
// estación-con-déficit, usado por /operador/stock y /operador/prediccion
// (designación de traslados) para sugerir movimientos de bicicletas.

export interface NodoExceso {
  id: string
  nombre: string
  disponible: number // > 0
}

export interface NodoDeficit {
  id: string
  nombre: string
  necesita: number // > 0
}

export interface Movimiento {
  origen: { id: string; nombre: string } | null // null = depósito central
  destino: { id: string; nombre: string }
  cantidad: number
}

/**
 * Empareja excedentes con déficits (mayor disponibilidad/necesidad primero).
 * Si `permitirDeposito` es true, el déficit que no se cubre con excedentes
 * de otras estaciones se asigna al depósito central (origen null) en vez
 * de quedar sin cubrir.
 */
export function calcularMovimientos(
  excesoIn: NodoExceso[],
  deficitIn: NodoDeficit[],
  opts: { permitirDeposito?: boolean } = {}
): Movimiento[] {
  const exceso = excesoIn
    .filter(e => e.disponible > 0)
    .map(e => ({ ...e }))
    .sort((a, b) => b.disponible - a.disponible)

  const deficit = deficitIn
    .filter(d => d.necesita > 0)
    .map(d => ({ ...d }))
    .sort((a, b) => b.necesita - a.necesita)

  const movs: Movimiento[] = []
  let i = 0

  for (const d of deficit) {
    while (d.necesita > 0 && i < exceso.length) {
      const cantidad = Math.min(d.necesita, exceso[i].disponible)
      if (cantidad > 0) {
        movs.push({
          origen:  { id: exceso[i].id, nombre: exceso[i].nombre },
          destino: { id: d.id, nombre: d.nombre },
          cantidad,
        })
        d.necesita -= cantidad
        exceso[i].disponible -= cantidad
      }
      if (exceso[i].disponible <= 0) i++
    }
    if (d.necesita > 0 && opts.permitirDeposito) {
      movs.push({ origen: null, destino: { id: d.id, nombre: d.nombre }, cantidad: d.necesita })
    }
  }

  return movs
}
