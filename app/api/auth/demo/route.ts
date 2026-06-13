import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TEST_USERS: Record<string, { email: string; rol: string }> = {
  '519001000001': { email: 'operador@ciclobici.pe', rol: 'operador' },
  '519001000002': { email: 'tecnico@ciclobici.pe',  rol: 'tecnico' },
  '519001000003': { email: 'maria@example.pe',      rol: 'ciudadano' },
  '519001000004': { email: 'juan@example.pe',       rol: 'ciudadano' },
  '519001000005': { email: 'laura@example.pe',      rol: 'ciudadano' },
}

const REDIRECT: Record<string, string> = {
  operador:   '/operador/mapa',
  tecnico:    '/tecnico/mantenimiento',
  ciudadano:  '/ciudadano/mapa',
}

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  const normalized = phone.replace('+', '').replace(/\s/g, '')
  const test = TEST_USERS[normalized]

  if (!test) {
    return NextResponse.json({ error: 'Número no registrado como usuario de prueba' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ciclobici.vercel.app'

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: test.email,
    options: { redirectTo: `${baseUrl}${REDIRECT[test.rol]}` },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ url: data.properties.action_link })
}
