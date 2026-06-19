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

  const { data: estacion } = await supabase
    .from('estaciones')
    .select('capacidad, nombre')
    .eq('id', estacion_id)
    .single()

  if (!estacion) {
    return NextResponse.json({ error: 'Estación no encontrada' }, { status: 404 })
  }

  // Últimas 8 semanas de viajes para esta estación
  const ochoSemanasAtras = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: viajes, error } = await supabase
    .from('viajes')
    .select('inicio_at')
    .eq('estacion_origen_id', estacion_id)
    .eq('estado', 'finalizado')
    .gte('inicio_at', ochoSemanasAtras)
    .order('inicio_at', { ascending: false })
    .limit(2000)

  if (error || !viajes || viajes.length < 5) {
    return NextResponse.json({ sin_datos: true })
  }

  const ahora = new Date()

  /*
   * Media ponderada por semana reciente:
   *   semana 0 (esta semana)   → peso 8
   *   semana 1                 → peso 6
   *   semana 2                 → peso 4
   *   semanas 3-7              → peso 2
   *
   * Clave de bucket: `${día_semana}-${hora}` (0-6, 0-23)
   */
  const PESOS = [8, 6, 4, 2, 2, 2, 2, 2]

  // Acumula [suma_ponderada, suma_pesos] por bucket (dow, hour)
  const modelo: Record<string, [number, number]> = {}

  for (const v of viajes) {
    const t = new Date(v.inicio_at)
    const semanasAtras = Math.floor(
      (ahora.getTime() - t.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    const peso = PESOS[semanasAtras] ?? 1
    const key = `${t.getDay()}-${t.getHours()}`
    if (!modelo[key]) modelo[key] = [0, 0]
    modelo[key][0] += peso
    modelo[key][1] += peso
  }

  /*
   * Para obtener la TASA media por (dow, hora), necesitamos cuántas semanas
   * de datos tenemos para cada bucket. Con 8 semanas, cada bucket (dow, hora)
   * debería aparecer idealmente 8 veces.
   */
  const semanasCubiertas = Math.min(Math.ceil(viajes.length / 168) + 1, 8)

  const prediccion = []

  for (let i = 0; i < intervalo; i++) {
    const slot = new Date(ahora.getTime() + i * 60 * 60 * 1000)
    const key = `${slot.getDay()}-${slot.getHours()}`
    const [sumaPeso, totalPeso] = modelo[key] ?? [0, 0]

    // Media ponderada normalizada: cuántos viajes esperamos en este slot
    const muestras = totalPeso > 0 ? sumaPeso / totalPeso : 0
    const tasaMediaPorSemana = muestras

    // Demanda estimada para el próximo ciclo de 1h
    const demanda_estimada = Math.round(tasaMediaPorSemana * semanasCubiertas / semanasCubiertas)
    const confianza: 'alta' | 'media' | 'baja' =
      totalPeso >= 6 * PESOS[0] ? 'alta' : totalPeso >= 2 * PESOS[1] ? 'media' : 'baja'

    prediccion.push({
      hora: slot.getHours(),
      hora_label: slot.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      demanda_estimada: Math.min(Math.round(muestras), estacion.capacidad),
      capacidad: estacion.capacidad,
      estacion_nombre: estacion.nombre,
      confianza,
    })
  }

  return NextResponse.json({
    prediccion,
    estacion: estacion.nombre,
    total_muestras: viajes.length,
    semanas_cubiertas: semanasCubiertas,
  })
}
