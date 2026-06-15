import { NavbarCiudadano } from '@/components/NavbarCiudadano'

export default function CiudadanoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <NavbarCiudadano />
      {/* pb-16 para bottom nav mobile + md:pt-0 desktop tiene sticky header */}
      <main className="pb-16 md:pb-0 md:pt-14">
        {children}
      </main>
    </div>
  )
}
