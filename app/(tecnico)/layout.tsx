import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SidebarTecnico } from '@/components/SidebarTecnico'
import { AccesoDenegado } from '@/components/AccesoDenegado'
import { getUserAccess, isVistaPermitida } from '@/lib/server/getUserAccess'

export default async function TecnicoLayout({ children }: { children: React.ReactNode }) {
  const access = await getUserAccess()
  if (!access) redirect('/login')
  if (access.rol !== 'tecnico') redirect('/operador?error=sin-acceso')

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const permitido = isVistaPermitida(pathname, access.vistas)

  return (
    <div className="flex min-h-screen bg-surface">
      <SidebarTecnico />
      <main className="flex-1 md:ml-60 transition-all duration-300">
        {permitido ? children : <AccesoDenegado pathname={pathname} rol={access.rol} />}
      </main>
    </div>
  )
}
