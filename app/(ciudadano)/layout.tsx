import { NavbarCiudadano } from '@/components/NavbarCiudadano'

export default function CiudadanoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <NavbarCiudadano />
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
