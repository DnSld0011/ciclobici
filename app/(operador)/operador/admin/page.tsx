'use client'

import Link from 'next/link'
import { BarChart2, PackageSearch, Users, Shield } from 'lucide-react'

const MODULOS = [
  {
    href: '/operador/kpis',
    label: 'KPIs Estratégicos',
    descripcion: 'Métricas clave de rendimiento del sistema',
    icon: BarChart2,
    color: '#0f2419',
    bg: '#b2f746',
  },
  {
    href: '/operador/stock',
    label: 'Stock Óptimo',
    descripcion: 'Gestión de disponibilidad por estación',
    icon: PackageSearch,
    color: '#1d4ed8',
    bg: '#eff6ff',
  },
  {
    href: '/operador/usuarios',
    label: 'Gestión de Usuarios',
    descripcion: 'Administrar cuentas y estados de usuarios',
    icon: Users,
    color: '#065f46',
    bg: '#ecfdf5',
  },
  {
    href: '/operador/roles',
    label: 'Gestión de Roles',
    descripcion: 'Configurar permisos y accesos por rol',
    icon: Shield,
    color: '#6d28d9',
    bg: '#f5f3ff',
  },
]

export default function AdminPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Panel de Administración</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión avanzada del sistema San Borja en Bici</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULOS.map(({ href, label, descripcion, icon: Icon, color, bg }) => (
          <Link key={href} href={href}
            className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200 transition-all">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: bg }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm group-hover:text-gray-700">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
