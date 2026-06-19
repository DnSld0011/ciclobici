import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SidebarOperador } from '@/components/SidebarOperador'
import { AccesoDenegado } from '@/components/AccesoDenegado'
import { getUserAccess, isVistaPermitida } from '@/lib/server/getUserAccess'

const ROLES_PERMITIDOS = ['operador', 'administrador']

export default async function OperadorLayout({ children }: { children: React.ReactNode }) {
  const access = await getUserAccess()
  if (!access) redirect('/login')
  if (!ROLES_PERMITIDOS.includes(access.rol)) redirect('/ciudadano?error=sin-acceso')

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const permitido = isVistaPermitida(pathname, access.vistas)

  return (
    <div className="flex min-h-screen bg-surface">
      <SidebarOperador />
      <main className="flex-1 md:ml-64 min-h-screen">
        {permitido ? children : <AccesoDenegado pathname={pathname} rol={access.rol} />}
      </main>
    </div>
  )
}
