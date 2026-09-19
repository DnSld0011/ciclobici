import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IncidenciaTipo } from '@/types'

const TIPO_LABEL: Record<IncidenciaTipo, string> = {
  frenos: 'Frenos', llanta: 'Llanta', cadena: 'Cadena', manillar: 'Manillar',
  asiento: 'Asiento', iluminacion: 'Iluminación', electrico: 'Eléctrico',
  estructura: 'Estructura', otro: 'Otro',
}

// Tipos que comprometen la seguridad del ciclista → siempre urgentes
const TIPOS_CRITICOS: IncidenciaTipo[] = ['frenos', 'electrico']

type Urgencia = 'alta' | 'media' | 'baja'

function calcularUrgencia(tipo: IncidenciaTipo, horasActiva: number): Urgencia {
  if (TIPOS_CRITICOS.includes(tipo) || horasActiva >= 12) return 'alta'
  if (horasActiva >= 4) return 'media'
  return 'baja'
}

// GET /api/operador/fallas → estado de fallas mecánicas activas de la flota
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !['operador', 'tecnico', 'administrador'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const [{ data: incidencias }, { count: totalFlota }] = await Promise.all([
    admin.from('incidencias')
      .select('id, tipo, descripcion, estado, created_at, bicicleta:bicicletas(codigo, marca, modelo), estacion:estaciones(nombre)')
      .in('estado', ['pendiente', 'en_revision'])
      .order('created_at', { ascending: true }),
    admin.from('bicicletas').select('id', { count: 'exact', head: true }),
  ])

  const ahora = Date.now()
  const lista = (incidencias ?? []).map(i => {
    const horasActiva = (ahora - new Date(i.created_at).getTime()) / 3_600_000
    return {
      id: i.id,
      tipo: i.tipo,
      tipoLabel: TIPO_LABEL[i.tipo as IncidenciaTipo] ?? i.tipo,
      descripcion: i.descripcion,
      estado: i.estado,
      horasActiva: Math.round(horasActiva),
      urgencia: calcularUrgencia(i.tipo as IncidenciaTipo, horasActiva),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bicicleta: (i as any).bicicleta ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      estacion: (i as any).estacion ?? null,
    }
  }).sort((a, b) => {
    const orden: Record<Urgencia, number> = { alta: 0, media: 1, baja: 2 }
    return orden[a.urgencia] - orden[b.urgencia]
  })

  // Resumen de diagnóstico: conteo por tipo de componente
  const conteoPorTipo = new Map<string, number>()
  for (const i of lista) conteoPorTipo.set(i.tipoLabel, (conteoPorTipo.get(i.tipoLabel) ?? 0) + 1)
  const resumenDiagnostico = [...conteoPorTipo.entries()]
    .map(([tipo, cantidad]) => ({ tipo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const bicisAfectadas = new Set(
    lista.map(i => i.bicicleta && typeof i.bicicleta === 'object' ? (i.bicicleta as { codigo?: string }).codigo : null).filter(Boolean)
  ).size
  const pctFlotaAfectada = totalFlota ? Math.round((bicisAfectadas / totalFlota) * 1000) / 10 : 0

  return NextResponse.json({
    pctFlotaAfectada,
    totalAlertas: lista.length,
    alertasUrgentes: lista.filter(i => i.urgencia === 'alta').length,
    resumenDiagnostico,
    alertas: lista,
  })
}
