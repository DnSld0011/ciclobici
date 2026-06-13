import { SidebarOperador } from '@/components/SidebarOperador'

export default function OperadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarOperador />
      <main className="flex-1 md:ml-64 transition-all duration-300">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
