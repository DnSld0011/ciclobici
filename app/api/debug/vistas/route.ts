import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const admin = createAdminClient()

    const { data: perfil } = await admin
      .from('usuarios').select('rol').eq('id', user.id).single()

    const { data: roles, error: rolesError } = await admin
      .from('roles').select('id, nombre, vistas').order('id')

    const rolDelUsuario = perfil?.rol ?? null

    const roleMatch = roles?.find(r => r.id === rolDelUsuario) ?? null

    return NextResponse.json({
      userId: user.id,
      usuariosRol: rolDelUsuario,
      todosLosRoles: roles?.map(r => ({ id: r.id, nombre: r.nombre, numVistas: (r.vistas as string[])?.length ?? 0 })),
      matchEncontrado: roleMatch ? { id: roleMatch.id, vistas: roleMatch.vistas } : null,
      rolesError: rolesError?.message ?? null,
      serviceKeyPresente: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
