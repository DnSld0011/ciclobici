'use client'

import { ShieldOff } from 'lucide-react'
import Link from 'next/link'

interface Props {
  pathname: string
  rol: string
}

const HOME_POR_ROL: Record<string, string> = {
  administrador: '/operador',
  operador:      '/operador',
  tecnico:       '/tecnico/mantenimiento',
  ciudadano:     '/ciudadano',
}

export function AccesoDenegado({ pathname, rol }: Props) {
  const home = HOME_POR_ROL[rol] ?? '/login'

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
        <ShieldOff size={28} className="text-red-500" />
      </div>
      <h2 className="text-xl font-extrabold text-gray-900 mb-2">Acceso denegado</h2>
      <p className="text-sm text-gray-500 mb-1">
        Tu rol <strong className="font-semibold text-gray-700">{rol}</strong> no tiene permiso para acceder a esta sección.
      </p>
      <p className="text-xs text-gray-400 font-mono mb-7 bg-gray-100 px-3 py-1 rounded-lg">{pathname}</p>
      <Link
        href={home}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: '#0f2419' }}
      >
        Volver al inicio
      </Link>
    </div>
  )
}
