import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NavbarCiudadano } from '@/components/NavbarCiudadano'
import { AccesoDenegado } from '@/components/AccesoDenegado'
import { getUserAccess, isVistaPermitida } from '@/lib/server/getUserAccess'

export default async function CiudadanoLayout({ children }: { children: React.ReactNode }) {
  const access = await getUserAccess()
  if (!access) redirect('/login')
  if (access.rol !== 'ciudadano') redirect('/operador?error=sin-acceso')

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const permitido = isVistaPermitida(pathname, access.vistas)

  return (
    <div className="min-h-screen bg-surface">
      <NavbarCiudadano />
      {/*
        pb-24 en mobile: bottom nav ~56px + FAB sobresale ~20px arriba = 76px → 96px con holgura
        md:pb-0 desktop: el header es sticky en la navbar
        md:pt-14: compensa el header desktop (h-14 = 56px)
      */}
      <main className="pb-24 md:pb-0 md:pt-14">
        {permitido ? children : <AccesoDenegado pathname={pathname} rol={access.rol} />}
      </main>
    </div>
  )
}
