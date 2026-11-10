import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DIMENSIONES = ['usabilidad', 'seguridad', 'funcionalidad', 'rendimiento', 'integridad'] as const

function puntajeSUS(f: { p1: number; p2: number; p3: number; p4: number; p5: number; p6: number; p7: number; p8: number; p9: number; p10: number }): number {
  return ((f.p1 - 1) + (5 - f.p2) + (f.p3 - 1) + (5 - f.p4) + (f.p5 - 1) + (5 - f.p6) + (f.p7 - 1) + (5 - f.p8) + (f.p9 - 1) + (5 - f.p10)) * 2.5
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

  const { data: filas, error } = await admin
    .from('encuestas_usabilidad')
    .select('dimension, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, nps')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const porDimension: Record<string, { n: number; promedioSUS: number }> = {}
  for (const dim of DIMENSIONES) {
    const filasDim = (filas ?? []).filter(f => (f.dimension ?? 'usabilidad') === dim)
    if (filasDim.length === 0) { porDimension[dim] = { n: 0, promedioSUS: 0 }; continue }
    const puntajes = filasDim.map(puntajeSUS)
    porDimension[dim] = {
      n: filasDim.length,
      promedioSUS: Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 100) / 100,
    }
  }

  const filasUsabilidad = (filas ?? []).filter(f => (f.dimension ?? 'usabilidad') === 'usabilidad' && f.nps !== null)
  const promotores = filasUsabilidad.filter(f => (f.nps as number) >= 9).length
  const pasivos = filasUsabilidad.filter(f => (f.nps as number) >= 7 && (f.nps as number) <= 8).length
  const detractores = filasUsabilidad.filter(f => (f.nps as number) <= 6).length
  const promedioNPS = filasUsabilidad.length > 0 ? ((promotores - detractores) / filasUsabilidad.length) * 100 : 0

  return NextResponse.json({
    // Compatibilidad con el resumen general de Usabilidad ya existente.
    n: porDimension.usabilidad.n,
    promedioSUS: porDimension.usabilidad.promedioSUS,
    promedioNPS: Math.round(promedioNPS * 100) / 100,
    promotores, pasivos, detractores,
    porDimension,
  })
}
