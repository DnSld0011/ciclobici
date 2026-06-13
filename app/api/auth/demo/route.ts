import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TEST_USERS: Record<string, { email: string; rol: string }> = {
  '51900100001': { email: 'operador@ciclobici.pe', rol: 'operador' },
  '51900100002': { email: 'tecnico@ciclobici.pe',  rol: 'tecnico' },
  '51900100003': { email: 'maria@example.pe',      rol: 'ciudadano' },
  '51900100004': { email: 'juan@example.pe',       rol: 'ciudadano' },
  '51900100005': { email: 'laura@example.pe',      rol: 'ciudadano' },
}

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone') ?? ''
  const test = TEST_USERS[phone]

  if (!test) {
    return NextResponse.json({ error: 'Número no registrado como usuario de prueba' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ciclobici.vercel.app'

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: test.email,
    options: { redirectTo: `${baseUrl}/login` },
  })

  if (error || !data?.properties?.action_link) {
    const msg = error?.message ?? 'No se generó el enlace'
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, baseUrl))
  }

  return NextResponse.redirect(data.properties.action_link)
}
