import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ vistas: [] })

    const admin = createAdminClient()
    const { data: perfil } = await admin
      .from('usuarios').select('rol').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ vistas: [] })

    const { data: rolData } = await admin
      .from('roles').select('vistas').eq('id', perfil.rol).maybeSingle()

    return NextResponse.json({ vistas: (rolData?.vistas as string[]) ?? [] })
  } catch {
    return NextResponse.json({ vistas: [] })
  }
}
