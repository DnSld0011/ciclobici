import { SidebarTecnico } from '@/components/SidebarTecnico'

export default function TecnicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <SidebarTecnico />
      <main className="flex-1 md:ml-60 transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
