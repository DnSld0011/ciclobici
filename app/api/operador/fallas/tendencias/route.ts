import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IncidenciaTipo } from '@/types'

const TIPO_LABEL: Record<IncidenciaTipo, string> = {
  frenos: 'Frenos', llanta: 'Llanta', cadena: 'Cadena', manillar: 'Manillar',
  asiento: 'Asiento', iluminacion: 'Iluminación', electrico: 'Eléctrico',
  estructura: 'Estructura', otro: 'Otro',
}

const MESES_HISTORIAL = 6

// GET /api/operador/fallas/tendencias → analítica de fallas por componente y modelo (últimos 6 meses)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
  if (!perfil || !['operador', 'tecnico', 'administrador'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const desde = new Date(Date.now() - MESES_HISTORIAL * 30 * 86_400_000).toISOString()

  const { data: incidencias } = await admin
    .from('incidencias')
    .select('tipo, estado, created_at, bicicleta:bicicletas(marca, modelo)')
    .gte('created_at', desde)

  type Fila = {
    tipo: string
    estado: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bicicleta: any
  }
  const filas = (incidencias ?? []) as Fila[]

  // ── Distribución por tipo de componente (para el pie) ──
  const porTipo = new Map<string, number>()
  for (const f of filas) {
    const label = TIPO_LABEL[f.tipo as IncidenciaTipo] ?? f.tipo
    porTipo.set(label, (porTipo.get(label) ?? 0) + 1)
  }
  const distribucionTipo = [...porTipo.entries()]
    .map(([tipo, cantidad]) => ({ tipo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  // ── Tasa de falla por modelo ──
  const porModelo = new Map<string, number>()
  for (const f of filas) {
    const modelo = f.bicicleta?.modelo ? `${f.bicicleta.marca ?? ''} ${f.bicicleta.modelo}`.trim() : 'Sin modelo'
    porModelo.set(modelo, (porModelo.get(modelo) ?? 0) + 1)
  }
  const tasaPorModelo = [...porModelo.entries()]
    .map(([modelo, fallas]) => ({ modelo, fallas }))
    .sort((a, b) => b.fallas - a.fallas)
    .slice(0, 8)

  // ── Problemas recurrentes: (tipo, modelo) con más ocurrencias ──
  const porTipoModelo = new Map<string, { tipo: string; modelo: string; frecuencia: number; resueltas: number }>()
  for (const f of filas) {
    const tipoLabel = TIPO_LABEL[f.tipo as IncidenciaTipo] ?? f.tipo
    const modelo = f.bicicleta?.modelo ? `${f.bicicleta.marca ?? ''} ${f.bicicleta.modelo}`.trim() : 'Sin modelo'
    const key = `${tipoLabel}::${modelo}`
    const actual = porTipoModelo.get(key) ?? { tipo: tipoLabel, modelo, frecuencia: 0, resueltas: 0 }
    actual.frecuencia++
    if (f.estado === 'resuelta') actual.resueltas++
    porTipoModelo.set(key, actual)
  }
  const problemasRecurrentes = [...porTipoModelo.values()]
    .map(p => ({
      ...p,
      prioridad: p.frecuencia >= 5 ? 'critica' : p.frecuencia >= 3 ? 'alta' : 'media',
      estado: p.resueltas === p.frecuencia ? 'resuelto' : p.resueltas > 0 ? 'en_progreso' : 'pendiente',
    }))
    .sort((a, b) => b.frecuencia - a.frecuencia)
    .slice(0, 10)

  return NextResponse.json({
    mesesHistorial: MESES_HISTORIAL,
    totalFallas: filas.length,
    distribucionTipo,
    tasaPorModelo,
    problemasRecurrentes,
  })
}
