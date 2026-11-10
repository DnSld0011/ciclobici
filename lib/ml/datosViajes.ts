import type { SupabaseClient } from '@supabase/supabase-js'
import { crearRng } from './gbdt'

// Variables explicativas (equivalente simplificado a las 11 de Cai et al. 2025,
// adaptadas a los datos disponibles: aquí no hay uso de suelo/GIS, sino historial
// de viajes por estación y hora — el mismo tipo de variable temporal que ya usa
// /api/prediccion, pero ahora como features de un modelo entrenado y validado).
export const NOMBRES_FEATURES = [
  'hora', 'dia_semana', 'es_fin_de_semana', 'capacidad_estacion', 'estacion_idx',
  'demanda_hace_1h', 'demanda_mismo_dia_semana_pasada', 'demanda_ayer_misma_hora', 'media_movil_24h',
] as const

export interface FilaEntrenamiento {
  x: number[]
  y: number
  meta: { estacionId: string; estacionNombre: string; fechaHora: string }
}

const HORA_INICIO = 6
const HORA_FIN = 22 // ventana operativa, igual que mundoDemo.ts

export interface EstacionBase { id: string; nombre: string; capacidad: number }
export interface ViajeBase { estacion_origen_id: string | null; inicio_at: string | null }

/**
 * Construye el dataset completo (estación × día × hora operativa) a partir de
 * los viajes reales en Supabase: variable objetivo = cantidad de viajes
 * iniciados en esa estación durante esa hora ("demanda").
 */
export async function construirDatasetCompleto(
  admin: SupabaseClient
): Promise<{ filas: FilaEntrenamiento[]; totalViajesFuente: number }> {
  const { data: estaciones } = await admin
    .from('estaciones')
    .select('id, nombre, capacidad')
    .order('nombre')

  if (!estaciones || estaciones.length === 0) return { filas: [], totalViajesFuente: 0 }

  // Supabase (PostgREST) aplica un tope de "Max Rows" por consulta (por defecto
  // 1000) sin importar el .limit() del cliente — hay que paginar explícitamente
  // o se entrena silenciosamente con una fracción mínima de los viajes reales.
  const TAMANO_PAGINA = 1000
  const MAX_VIAJES = 50000
  const viajes: ViajeBase[] = []
  for (let desde = 0; desde < MAX_VIAJES; desde += TAMANO_PAGINA) {
    const { data: pagina } = await admin
      .from('viajes')
      .select('estacion_origen_id, inicio_at')
      .not('estacion_origen_id', 'is', null)
      .not('inicio_at', 'is', null)
      .order('inicio_at', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (!pagina || pagina.length === 0) break
    viajes.push(...(pagina as ViajeBase[]))
    if (pagina.length < TAMANO_PAGINA) break
  }

  if (viajes.length < 50) return { filas: [], totalViajesFuente: viajes.length }

  return {
    filas: construirDatasetDesdeViajes(estaciones as EstacionBase[], viajes as ViajeBase[]),
    totalViajesFuente: viajes.length,
  }
}

/**
 * Misma ingeniería de variables que construirDatasetCompleto, pero recibe los
 * viajes ya en memoria (reales o sintéticos) en vez de consultarlos a Supabase.
 * Se usa tanto para el dataset real como para proyecciones con datos simulados.
 */
export function construirDatasetDesdeViajes(
  estaciones: EstacionBase[],
  viajes: ViajeBase[]
): FilaEntrenamiento[] {
  const estacionIdx = new Map(estaciones.map((e, i) => [e.id as string, i]))
  const capacidadPorEstacion = new Map(estaciones.map(e => [e.id as string, e.capacidad as number]))

  // Bucket: `${estacionId}|${YYYY-MM-DD}|${hora}` → conteo de viajes
  const conteo = new Map<string, number>()
  const claveDeFecha = (d: Date) => d.toISOString().slice(0, 10)
  const claveBucket = (estId: string, fecha: string, hora: number) => `${estId}|${fecha}|${hora}`

  let minFecha = new Date(viajes[0].inicio_at as string)
  let maxFecha = minFecha
  for (const v of viajes) {
    const t = new Date(v.inicio_at as string)
    if (t < minFecha) minFecha = t
    if (t > maxFecha) maxFecha = t
    const estId = v.estacion_origen_id as string
    if (!estacionIdx.has(estId)) continue
    const hora = t.getHours()
    if (hora < HORA_INICIO || hora > HORA_FIN) continue
    const clave = claveBucket(estId, claveDeFecha(t), hora)
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
  }

  const MS_DIA = 24 * 60 * 60 * 1000
  const totalDias = Math.max(1, Math.round((maxFecha.getTime() - minFecha.getTime()) / MS_DIA))

  const filas: FilaEntrenamiento[] = []

  for (const est of estaciones) {
    const estId = est.id as string
    const capacidad = capacidadPorEstacion.get(estId) ?? 15
    const idx = estacionIdx.get(estId)!

    // Se empieza 7 días después del inicio para que los lags (1 semana) sean válidos.
    for (let dia = 7; dia <= totalDias; dia++) {
      const fecha = new Date(minFecha.getTime() + dia * MS_DIA)
      const fechaStr = claveDeFecha(fecha)
      const diaSemana = fecha.getDay()
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6 ? 1 : 0

      for (let hora = HORA_INICIO; hora <= HORA_FIN; hora++) {
        const y = conteo.get(claveBucket(estId, fechaStr, hora)) ?? 0

        const fechaHace1h = new Date(fecha.getTime() - 1 * 60 * 60 * 1000)
        const demandaHace1h = conteo.get(claveBucket(estId, claveDeFecha(fechaHace1h), fechaHace1h.getHours())) ?? 0

        const fechaAyer = new Date(fecha.getTime() - MS_DIA)
        const demandaAyerMismaHora = conteo.get(claveBucket(estId, claveDeFecha(fechaAyer), hora)) ?? 0

        const fechaSemanaPasada = new Date(fecha.getTime() - 7 * MS_DIA)
        const demandaSemanaPasada = conteo.get(claveBucket(estId, claveDeFecha(fechaSemanaPasada), hora)) ?? 0

        let sumaVentana = 0
        for (let h = 0; h < 24; h++) {
          const t = new Date(fecha.getTime() - h * 60 * 60 * 1000)
          sumaVentana += conteo.get(claveBucket(estId, claveDeFecha(t), t.getHours())) ?? 0
        }
        const mediaMovil24h = sumaVentana / 24

        filas.push({
          x: [
            hora, diaSemana, esFinDeSemana, capacidad, idx,
            demandaHace1h, demandaSemanaPasada, demandaAyerMismaHora, mediaMovil24h,
          ],
          y,
          meta: { estacionId: estId, estacionNombre: est.nombre as string, fechaHora: `${fechaStr}T${String(hora).padStart(2, '0')}:00` },
        })
      }
    }
  }

  return filas
}

/** Submuestreo sin reemplazo de N filas, con semilla fija por N (reproducible). */
export function submuestrear(filas: FilaEntrenamiento[], n: number): FilaEntrenamiento[] {
  if (n >= filas.length) return filas
  const rng = crearRng(1000 + n)
  const idx = Array.from({ length: filas.length }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, n).map(i => filas[i])
}
