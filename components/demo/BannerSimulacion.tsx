'use client'

import { Sparkles, X } from 'lucide-react'
import { useSimulacion } from '@/lib/demo/SimulacionContext'

// Aviso fijo y bien visible: cuando el modo simulación está activo, TODA
// la información de las pantallas que lo soportan es generada al vuelo,
// no viene de la base de datos real. Esto evita confundir una demo con
// el estado real del sistema.
export function BannerSimulacion() {
  const { activa, desactivar } = useSimulacion()
  if (!activa) return null

  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold text-[#002117]"
      style={{ background: '#b2f746' }}>
      <Sparkles size={13} />
      MODO SIMULACIÓN ACTIVO — la información que ves es generada de ejemplo, no son datos reales
      <button onClick={desactivar}
        className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#002117]/10 hover:bg-[#002117]/20 transition-colors">
        <X size={11} /> Desactivar
      </button>
    </div>
  )
}
