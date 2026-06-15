import { NavbarCiudadano } from '@/components/NavbarCiudadano'

export default function CiudadanoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarCiudadano />
      <main className="pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
