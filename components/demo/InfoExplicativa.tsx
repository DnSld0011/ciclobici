'use client'

import { Info } from 'lucide-react'
import { useSimulacion } from '@/lib/demo/SimulacionContext'

// Caja de explicación "para qué sirve esto / qué significa este gráfico",
// visible solo en modo simulación (pensada para mostrarle la app a
// alguien que la está viendo por primera vez, sin saturar el uso diario).
export function InfoExplicativa({ children }: { children: React.ReactNode }) {
  const { activa } = useSimulacion()
  if (!activa) return null

  return (
    <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
      style={{ background: '#e5eeff', color: '#1e3a8a' }}>
      <Info size={14} className="shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  )
}
