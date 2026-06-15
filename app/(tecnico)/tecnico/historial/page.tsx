'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mantenimiento } from '@/types'
import { CalendarDays, Wrench, TrendingUp } from 'lucide-react'

export default function TecnicoHistorialPage() {
  const [registros, setRegistros] = useState<Mantenimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const supabase = createClient()

  const cargar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: perfil } = await supabase.from('usuarios').select('nombre').eq('id', user?.id ?? '').single()
    if (!perfil?.nombre) { setLoading(false); return }
    setNombre(perfil.nombre)
    const { data } = await supabase
      .from('mantenimientos')
      .select('*, bicicleta:bicicletas(codigo, tipo)')
      .eq('responsable', perfil.nombre)
      .order('fecha', { ascending: false })
    if (data) setRegistros(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  // Agrupar por mes
  const porMes: Record<string, Mantenimiento[]> = {}
  registros.forEach(r => {
    const key = new Date(r.fecha).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
    if (!porMes[key]) porMes[key] = []
    porMes[key].push(r)
  })

  const tiposConteo: Record<string, number> = {}
  registros.forEach(r => { tiposConteo[r.tipo_intervencion] = (tiposConteo[r.tipo_intervencion] ?? 0) + 1 })
  const topTipo = Object.entries(tiposConteo).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="p-6 space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-extrabold text-primary-container">Mi historial</h1>
        <p className="text-xs text-outline mt-0.5">{nombre ? `Técnico: ${nombre}` : 'Cargando...'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total intervenciones', value: registros.length, icon: Wrench },
          { label: 'Meses activo', value: Object.keys(porMes).length, icon: CalendarDays },
          { label: 'Tipo más frecuente', value: topTipo ? topTipo[1] : 0, sub: topTipo?.[0] ?? '—', icon: TrendingUp },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="card p-5 flex items-start justify-between">
            <div>
              <p className="text-2xl font-extrabold text-on-surface">{loading ? '—' : value}</p>
              <p className="text-xs text-outline mt-0.5">{label}</p>
              {sub && <p className="text-[10px] text-primary-container font-semibold mt-1 truncate max-w-[120px]">{sub}</p>}
            </div>
            <Icon size={20} className="text-outline-variant shrink-0" />
          </div>
        ))}
      </div>

      {/* Timeline por mes */}
      {loading && <div className="card p-12 text-center text-outline text-sm">Cargando historial...</div>}
      {!loading && registros.length === 0 && (
        <div className="card p-12 text-center">
          <Wrench size={32} className="text-outline-variant mx-auto mb-3" />
          <p className="text-sm text-outline">Aún no tienes intervenciones registradas.</p>
        </div>
      )}

      {Object.entries(porMes).map(([mes, items]) => (
        <div key={mes} className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-extrabold tracking-widest text-outline uppercase">{mes}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-outline border border-outline-variant/20">
              {items.length} intervención{items.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div className="card divide-y divide-outline-variant/10 overflow-hidden">
            {items.map(m => {
              const bici = m.bicicleta as unknown as { codigo: string; tipo: string } | null
              return (
                <div key={m.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-container-low/50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                    <Wrench size={14} className="text-outline" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-on-surface">{m.tipo_intervencion}</p>
                    <p className="text-xs text-outline truncate">
                      {bici?.codigo} · {bici?.tipo}
                      {m.descripcion ? ` — ${m.descripcion}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-outline whitespace-nowrap shrink-0">
                    {new Date(m.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
