import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/prediccion/todas?intervalo=4
// GET /api/prediccion/todas?fecha=2026-07-09&hora=8
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const intervalo  = parseInt(searchParams.get('intervalo') ?? '4')
  const fechaParam = searchParams.get('fecha')
  const horaParam  = searchParams.get('hora')

  const admin = createAdminClient()
  const ahora = new Date()

  // Slots a predecir (1 hora específica o rango de N horas)
  const slots: { dow: number; hour: number }[] = []
  let targetDate: Date

  if (fechaParam && horaParam !== null) {
    targetDate = new Date(`${fechaParam}T${String(horaParam).padStart(2, '0')}:00:00`)
    slots.push({ dow: targetDate.getDay(), hour: targetDate.getHours() })
  } else {
    targetDate = new Date(ahora.getTime() + Math.floor(intervalo / 2) * 3600000)
    for (let i = 0; i < intervalo; i++) {
      const t = new Date(ahora.getTime() + i * 3600000)
      slots.push({ dow: t.getDay(), hour: t.getHours() })
    }
  }

  const [{ data: estaciones }, { data: bicis }] = await Promise.all([
    admin.from('estaciones').select('id, nombre, capacidad').eq('estado', 'activa').order('nombre'),
    admin.from('bicicletas').select('estacion_id, estado'),
  ])

  if (!estaciones?.length) return NextResponse.json({ error: 'Sin estaciones' }, { status: 500 })

  // Bicis disponibles actuales por estación
  const bicisMap: Record<string, number> = {}
  for (const b of bicis ?? []) {
    if (b.estacion_id && b.estado === 'disponible')
      bicisMap[b.estacion_id] = (bicisMap[b.estacion_id] ?? 0) + 1
  }

  // Historial: últimos 6 meses
  const desde = new Date(ahora.getTime() - 180 * 24 * 3600000).toISOString()
  const { data: viajes } = await admin
    .from('viajes')
    .select('estacion_origen_id, inicio_at')
    .eq('estado', 'finalizado')
    .gte('inicio_at', desde)

  // Sin historial → predicción 0
  if (!viajes?.length) {
    return NextResponse.json({
      estaciones: estaciones.map(e => ({
        id: e.id, nombre: e.nombre, capacidad: e.capacidad,
        bicis_actuales: bicisMap[e.id] ?? 0,
        demanda_predicha: 0, diferencia: -(bicisMap[e.id] ?? 0),
        accion: 'ok', confianza: 'baja',
      })),
      metadatos: { total_viajes: 0, meses_historial: 0, fecha_prediccion: targetDate.toISOString(), hora_prediccion: targetDate.getHours(), dia_semana: '' },
    })
  }

  // Construir modelo: por estación → por (dow-hora) → array de ocurrencias
  const modelo: Record<string, Record<string, number>> = {}
  let minFecha = ahora, maxFecha = new Date(0)

  for (const v of viajes) {
    if (!v.estacion_origen_id || !v.inicio_at) continue
    const t = new Date(v.inicio_at)
    if (t < minFecha) minFecha = t
    if (t > maxFecha) maxFecha = t
    const key = `${t.getDay()}-${t.getHours()}`
    if (!modelo[v.estacion_origen_id]) modelo[v.estacion_origen_id] = {}
    modelo[v.estacion_origen_id][key] = (modelo[v.estacion_origen_id][key] ?? 0) + 1
  }

  const mesesHistorial = Math.max(1, Math.round((maxFecha.getTime() - minFecha.getTime()) / (30 * 24 * 3600000)))
  const semanas = Math.max(1, Math.round((ahora.getTime() - minFecha.getTime()) / (7 * 24 * 3600000)))

  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  const estResult = estaciones.map(e => {
    const estModelo = modelo[e.id] ?? {}

    // Pico de demanda entre todos los slots del intervalo
    let demandaPico = 0
    let maxOcurrencias = 0
    for (const slot of slots) {
      const key   = `${slot.dow}-${slot.hour}`
      const count = estModelo[key] ?? 0
      const avg   = Math.round(count / Math.min(semanas, 26))
      if (avg > demandaPico) demandaPico = avg
      if (count > maxOcurrencias) maxOcurrencias = count
    }

    const demanda_predicha = Math.min(demandaPico, e.capacidad ?? 10)
    const bicis_actuales   = bicisMap[e.id] ?? 0
    const diferencia       = demanda_predicha - bicis_actuales

    const confianza: 'alta' | 'media' | 'baja' =
      maxOcurrencias >= 8 ? 'alta' : maxOcurrencias >= 3 ? 'media' : 'baja'

    const accion: 'deficit' | 'surplus' | 'ok' =
      diferencia >  1 ? 'deficit' :
      diferencia < -2 ? 'surplus' : 'ok'

    return { id: e.id, nombre: e.nombre, capacidad: e.capacidad ?? 10, bicis_actuales, demanda_predicha, diferencia, accion, confianza }
  })

  return NextResponse.json({
    estaciones: estResult,
    metadatos: {
      total_viajes:      viajes.length,
      meses_historial:   mesesHistorial,
      fecha_prediccion:  targetDate.toISOString(),
      hora_prediccion:   targetDate.getHours(),
      dia_semana:        diasSemana[targetDate.getDay()],
    },
  })
}
