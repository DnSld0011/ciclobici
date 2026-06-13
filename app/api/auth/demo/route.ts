import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEMO_PASS = 'CicloBici_Demo_2024!'

const TEST_USERS: Record<string, { email: string; celular: string }> = {
  '51900100001': { email: 'operador@ciclobici.pe', celular: '900100001' },
  '51900100002': { email: 'tecnico@ciclobici.pe',  celular: '900100002' },
  '51900100003': { email: 'maria@example.pe',      celular: '900100003' },
  '51900100004': { email: 'juan@example.pe',       celular: '900100004' },
  '51900100005': { email: 'laura@example.pe',      celular: '900100005' },
}

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone') ?? ''
  const test = TEST_USERS[phone]
  if (!test) {
    return NextResponse.json({ error: 'Número de prueba no encontrado' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find user ID from public.usuarios
  const { data: usuario, error: uErr } = await supabase
    .from('usuarios')
    .select('id')
    .eq('celular', test.celular)
    .single()

  if (uErr || !usuario) {
    return NextResponse.json({ error: `Usuario no encontrado en DB: ${uErr?.message}` }, { status: 404 })
  }

  // Set a known password for the test user
  const { error: pErr } = await supabase.auth.admin.updateUserById(
    usuario.id,
    { password: DEMO_PASS, email_confirm: true }
  )
  if (pErr) {
    return NextResponse.json({ error: `Error al configurar password: ${pErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ email: test.email, password: DEMO_PASS })
}
