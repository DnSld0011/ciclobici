import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DIMENSIONES_VALIDAS = ['usabilidad', 'seguridad', 'funcionalidad', 'rendimiento', 'integridad']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const dimension: unknown = body?.dimension ?? 'usabilidad'
  const respuestas: unknown = body?.respuestas
  const nps: unknown = body?.nps ?? null
  const comentario: string | null = typeof body?.comentario === 'string' ? body.comentario.trim().slice(0, 1000) || null : null

  if (typeof dimension !== 'string' || !DIMENSIONES_VALIDAS.includes(dimension)) {
    return NextResponse.json({ error: 'dimension inválida' }, { status: 400 })
  }
  if (
    !Array.isArray(respuestas) || respuestas.length !== 10 ||
    !respuestas.every(r => Number.isInteger(r) && r >= 1 && r <= 5)
  ) {
    return NextResponse.json({ error: 'respuestas debe ser un array de 10 enteros entre 1 y 5' }, { status: 400 })
  }
  if (nps !== null && (!Number.isInteger(nps) || (nps as number) < 0 || (nps as number) > 10)) {
    return NextResponse.json({ error: 'nps debe ser un entero entre 0 y 10, o null' }, { status: 400 })
  }

  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10] = respuestas as number[]
  const fila = { dimension, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, nps, comentario }

  // Con sesión: queda asociada al usuario (respeta RLS). Sin sesión: respuesta
  // anónima real (usuario_id null), igual que cualquier encuesta pública.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const admin = createAdminClient()
    const { data: perfil } = await admin.from('usuarios').select('rol').eq('id', user.id).single()
    const { error } = await supabase.from('encuestas_usabilidad').insert({
      ...fila, usuario_id: user.id, rol: perfil?.rol ?? 'desconocido',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const admin = createAdminClient()
    const { error } = await admin.from('encuestas_usabilidad').insert({
      ...fila, usuario_id: null, rol: 'anonimo',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
