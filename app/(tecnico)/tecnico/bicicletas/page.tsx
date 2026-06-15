'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bicicleta, BicicletaEstado } from '@/types'
import { Bike, Search } from 'lucide-react'

const ESTADO_CHIP: Record<BicicletaEstado, string> = {
  disponible:   'chip-disponible',
  en_viaje:     'chip-en-uso',
  mantenimiento:'chip-mantenimiento',
  baja:         'chip-baja',
}
const ESTADO_LABEL: Record<BicicletaEstado, string> = {
  disponible: 'Disponible', en_viaje: 'En viaje', mantenimiento: 'Mantenimiento', baja: 'Baja',
}

export default function TecnicoBicicletasPage() {
  const [bicicletas, setBicicletas] = useState<Bicicleta[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('bicicletas')
      .select('*, estacion:estaciones(nombre)')
      .order('estado')
    if (data) setBicicletas(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  const filtradas = bicicletas.filter(b =>
    b.codigo.toLowerCase().includes(filtro.toLowerCase()) &&
    (filtroEstado === 'todos' || b.estado === filtroEstado)
  )

  return (
    <div className="p-6 space-y-5 max-w-[1000px]">
      <div>
        <h1 className="text-xl font-extrabold text-primary-container">Bicicletas</h1>
        <p className="text-xs text-outline mt-0.5">Vista de flota (solo lectura)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['disponible', 'en_viaje', 'mantenimiento', 'baja'] as BicicletaEstado[]).map(e => (
          <div key={e} className={`card p-4 cursor-pointer transition-all ${filtroEstado === e ? 'ring-2 ring-primary-container' : ''}`}
            onClick={() => setFiltroEstado(filtroEstado === e ? 'todos' : e)}>
            <p className="text-2xl font-extrabold text-on-surface">{loading ? '—' : bicicletas.filter(b => b.estado === e).length}</p>
            <span className={`mt-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${ESTADO_CHIP[e]}`}>{ESTADO_LABEL[e]}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-outline" size={14} />
          <input className="w-full h-11 px-3 pl-9 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
            placeholder="Buscar por código..."
            value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        <select className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none"
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="en_viaje">En viaje</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container-low">
              {['Código', 'Tipo / Marca', 'Estado', 'Estación'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {loading && <tr><td colSpan={4} className="text-center text-outline py-12 text-sm">Cargando...</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={4} className="text-center text-outline py-12 text-sm">Sin bicicletas</td></tr>}
            {filtradas.map(b => (
              <tr key={b.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="px-5 py-3">
                  <span className="font-mono font-bold text-primary-container text-xs tracking-wide">{b.codigo}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Bike size={13} className="text-outline shrink-0" />
                    <span className="text-on-surface">{b.tipo}{b.marca ? ` · ${b.marca}` : ''}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ESTADO_CHIP[b.estado]}`}>
                    {ESTADO_LABEL[b.estado]}
                  </span>
                </td>
                <td className="px-5 py-3 text-outline text-xs">
                  {(b.estacion as unknown as { nombre?: string })?.nombre ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
