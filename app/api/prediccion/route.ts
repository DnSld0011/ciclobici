import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const estacion_id = searchParams.get('estacion_id')
  const intervalo = parseInt(searchParams.get('intervalo') ?? '3')

  if (!estacion_id) {
    return NextResponse.json({ error: 'estacion_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get station capacity
  const { data: estacion } = await supabase
    .from('estaciones')
    .select('capacidad, nombre')
    .eq('id', estacion_id)
    .single()

  if (!estacion) {
    return NextResponse.json({ error: 'Estación no encontrada' }, { status: 404 })
  }

  // Get historical trips for this station
  const { data: viajes, error } = await supabase
    .from('viajes')
    .select('inicio_at')
    .eq('estacion_origen_id', estacion_id)
    .eq('estado', 'finalizado')
    .order('inicio_at', { ascending: false })
    .limit(1000)

  if (error || !viajes || viajes.length < 10) {
    return NextResponse.json({ sin_datos: true })
  }

  // Build hourly demand model: count trips per (day_of_week, hour)
  const modelo: Record<string, number[]> = {}
  viajes.forEach(v => {
    const d = new Date(v.inicio_at)
    const key = `${d.getDay()}-${d.getHours()}`
    if (!modelo[key]) modelo[key] = []
    modelo[key].push(1)
  })

  const ahora = new Date()
  const prediccion = []

  for (let i = 0; i < intervalo; i++) {
    const hora = new Date(ahora.getTime() + i * 60 * 60 * 1000)
    const key = `${hora.getDay()}-${hora.getHours()}`
    const registros = modelo[key] ?? []
    const demanda = registros.length > 0 ? Math.round(registros.length / Math.max(1, Math.ceil(viajes.length / 168))) : 0

    prediccion.push({
      hora: hora.getHours(),
      hora_label: hora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      demanda_estimada: Math.min(demanda, estacion.capacidad),
      capacidad: estacion.capacidad,
      estacion_nombre: estacion.nombre,
    })
  }

  return NextResponse.json({ prediccion, estacion: estacion.nombre })
}
