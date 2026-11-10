import { crearRng } from './gbdt'
import type { EstacionBase, ViajeBase } from './datosViajes'

// Genera viajes SINTÉTICOS en memoria (nunca se escriben en la base de datos
// real) para proyectar cómo rendiría el mismo modelo con un volumen de datos
// comparable al del paper de referencia. Usa un patrón de demanda realista
// (picos de hora punta, menor actividad en fin de semana) con ruido aleatorio,
// no copia ni deriva de usuarios o viajes reales existentes.
export function generarViajesSimulados(
  estaciones: EstacionBase[],
  dias: number,
  seed = 42
): ViajeBase[] {
  const rng = crearRng(seed)
  const viajes: ViajeBase[] = []
  const ahora = new Date()
  const inicio = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000)

  // Curva de demanda horaria típica de bici compartida: picos AM (7-9) y PM (17-19).
  const factorHora = (h: number) => {
    if (h >= 7 && h <= 9) return 2.6
    if (h >= 17 && h <= 19) return 2.8
    if (h >= 10 && h <= 16) return 1.1
    if (h >= 20 && h <= 22) return 0.6
    if (h >= 6 && h < 7) return 0.5
    return 0.1
  }

  for (const est of estaciones) {
    // Tasa base por estación, proporcional a su capacidad (estaciones más
    // grandes reciben más tránsito), con algo de variación entre estaciones.
    const tasaBase = (est.capacidad / 20) * (0.7 + rng() * 0.6)

    for (let dia = 0; dia < dias; dia++) {
      const fecha = new Date(inicio.getTime() + dia * 24 * 60 * 60 * 1000)
      const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6
      const factorDia = esFinDeSemana ? 0.55 : 1.0

      for (let hora = 6; hora <= 22; hora++) {
        const lambda = tasaBase * factorHora(hora) * factorDia
        // Aproximación de Poisson vía ruido gaussiano simple (suficiente para
        // una proyección, no se busca exactitud estadística perfecta).
        const n = Math.max(0, Math.round(lambda + (rng() - 0.5) * Math.sqrt(Math.max(lambda, 1)) * 2))
        for (let i = 0; i < n; i++) {
          const minuto = Math.floor(rng() * 60)
          const t = new Date(fecha)
          t.setHours(hora, minuto, 0, 0)
          viajes.push({ estacion_origen_id: est.id, inicio_at: t.toISOString() })
        }
      }
    }
  }

  viajes.sort((a, b) => (a.inicio_at! < b.inicio_at! ? -1 : 1))
  return viajes
}
