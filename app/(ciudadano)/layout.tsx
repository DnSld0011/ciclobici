import { NavbarCiudadano } from '@/components/NavbarCiudadano'

export default function CiudadanoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <NavbarCiudadano />
      {/*
        pb-24 en mobile: bottom nav ~56px + FAB sobresale ~20px arriba = 76px → 96px con holgura
        md:pb-0 desktop: el header es sticky en la navbar
        md:pt-14: compensa el header desktop (h-14 = 56px)
      */}
      <main className="pb-24 md:pb-0 md:pt-14">
        {children}
      </main>
    </div>
  )
}
