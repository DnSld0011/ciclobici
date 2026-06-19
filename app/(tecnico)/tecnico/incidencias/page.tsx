'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Incidencia, IncidenciaEstado } from '@/types'
import { AlertTriangle, Search, CheckCircle, X, Clock, Wrench, ImageOff, ExternalLink, Plus } from 'lucide-react'

const ESTADO_CHIP: Record<IncidenciaEstado, string> = {
  pendiente:    'bg-[#fef9c3] text-[#854d0e] border-[#fde68a]',
  en_revision:  'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]',
  resuelta:     'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  descartada:   'bg-[#f1f5f9] text-outline border-outline-variant/30',
}
const ESTADO_LABEL: Record<IncidenciaEstado, string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión', resuelta: 'Resuelta', descartada: 'Descartada',
}
const TIPO_ICON: Record<string, string> = {
  frenos: '🛑', llanta: '🔵', cadena: '⛓️', manillar: '🔧',
  asiento: '🪑', iluminacion: '💡', electrico: '⚡', estructura: '🏗️', otro: '❓',
}

export default function TecnicoIncidenciasPage() {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [seleccionada, setSeleccionada] = useState<Incidencia | null>(null)
  const [loading, setLoading] = useState(true)
  const [creandoMant, setCreandoMant] = useState(false)
  const [mantExito, setMantExito] = useState(false)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('incidencias')
      .select('*, bicicleta:bicicletas(codigo, tipo), estacion:estaciones(nombre), usuario:usuarios(nombre)')
      .order('created_at', { ascending: false })
    if (data) setIncidencias(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    cargar()
    const ch = supabase.channel('tecnico-incidencias-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [cargar])

  async function cambiarEstado(id: string, estado: IncidenciaEstado) {
    const supabase = createClient()
    await supabase.from('incidencias').update({ estado }).eq('id', id)
    await cargar()
    if (seleccionada?.id === id) setSeleccionada(prev => prev ? { ...prev, estado } : null)

    // Si el técnico marca como resuelta, enviar push al ciudadano
    if (estado === 'resuelta') {
      const inc = incidencias.find(i => i.id === id)
      if (inc?.usuario_id) {
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_id: inc.usuario_id,
            titulo: '✅ Incidencia resuelta',
            cuerpo: `Tu reporte de ${inc.tipo} ha sido resuelto por el equipo técnico.`,
            url: '/ciudadano/incidencias',
          }),
        }).catch(() => {})
      }
    }
  }

  async function crearMantenimiento() {
    if (!seleccionada) return
    const bici = seleccionada.bicicleta as unknown as { codigo: string } | null
    if (!bici) return
    setCreandoMant(true)
    setMantExito(false)
    const supabase = createClient()

    const { data: biciData } = await supabase
      .from('bicicletas')
      .select('id')
      .eq('codigo', bici.codigo)
      .single()

    if (!biciData) { setCreandoMant(false); return }

    const tipoMap: Record<string, string> = {
      frenos: 'Reparación de Frenos', llanta: 'Cambio de Neumático',
      cadena: 'Lubricación de Cadena', manillar: 'Reparación de Manubrio',
      asiento: 'Reemplazo de Sillín', iluminacion: 'Revisión Eléctrica',
      electrico: 'Revisión Eléctrica', estructura: 'Revisión General', otro: 'Revisión General',
    }

    const { data: mant, error } = await supabase.from('mantenimientos').insert({
      bicicleta_id: biciData.id,
      tipo_intervencion: tipoMap[seleccionada.tipo] ?? 'Revisión General',
      descripcion: seleccionada.descripcion ?? `Incidencia reportada: ${seleccionada.tipo}`,
      responsable: 'Técnico',
      fecha: new Date().toISOString(),
    }).select('id').single()

    if (!error && mant) {
      await supabase.from('incidencias').update({ estado: 'en_revision', mantenimiento_id: mant.id }).eq('id', seleccionada.id)
      await cargar()
      setSeleccionada(prev => prev ? { ...prev, estado: 'en_revision' } : null)
      setMantExito(true)
    }
    setCreandoMant(false)
  }

  const filtradas = incidencias.filter(i => {
    const bici = i.bicicleta as unknown as { codigo: string } | null
    const matchTexto = !filtro ||
      (bici?.codigo ?? '').toLowerCase().includes(filtro.toLowerCase()) ||
      i.tipo.toLowerCase().includes(filtro.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || i.estado === filtroEstado
    return matchTexto && matchEstado
  })

  const pendientes   = incidencias.filter(i => i.estado === 'pendiente').length
  const en_revision  = incidencias.filter(i => i.estado === 'en_revision').length
  const resueltas    = incidencias.filter(i => i.estado === 'resuelta').length

  return (
    <div className="p-6 space-y-5 max-w-[1100px]">

      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-primary-container">Incidencias</h1>
        <p className="text-xs text-outline mt-0.5">Reportes de ciudadanos · Gestión técnica</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendientes',   value: pendientes,  chip: ESTADO_CHIP.pendiente,   icon: Clock },
          { label: 'En revisión',  value: en_revision, chip: ESTADO_CHIP.en_revision, icon: Wrench },
          { label: 'Resueltas',    value: resueltas,   chip: ESTADO_CHIP.resuelta,    icon: CheckCircle },
        ].map(({ label, value, chip, icon: Icon }) => (
          <div key={label} className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-on-surface">{loading ? '—' : value}</p>
              <span className={`mt-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip}`}>{label}</span>
            </div>
            <Icon size={20} className="text-outline-variant" />
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-outline" size={14} />
          <input className="w-full h-11 px-3 pl-9 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container transition-all"
            placeholder="Buscar por código o tipo..."
            value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        <select className="h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none"
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="en_revision">En revisión</option>
          <option value="resuelta">Resueltas</option>
          <option value="descartada">Descartadas</option>
        </select>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container-low">
              {['Tipo', 'Bicicleta', 'Estación', 'Reportado por', 'Fecha', 'Estado', ''].map(h => (
                <th key={h} className={`px-5 py-3 text-[10px] font-extrabold tracking-widest text-outline uppercase ${h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filtradas.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center text-outline py-12 text-sm">Sin incidencias</td></tr>
            )}
            {loading && (
              <tr><td colSpan={7} className="text-center text-outline py-12 text-sm">Cargando...</td></tr>
            )}
            {filtradas.map(inc => {
              const bici    = inc.bicicleta as unknown as { codigo: string; tipo: string } | null
              const estacion = inc.estacion as unknown as { nombre: string } | null
              const usuario  = inc.usuario  as unknown as { nombre: string } | null
              return (
                <tr key={inc.id} className="hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                  onClick={() => setSeleccionada(inc)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span>{TIPO_ICON[inc.tipo] ?? '❓'}</span>
                      <span className="font-medium text-on-surface capitalize">{inc.tipo}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono font-bold text-primary-container text-xs">
                    {bici?.codigo ?? '—'}<br />
                    <span className="font-sans font-normal text-outline">{bici?.tipo}</span>
                  </td>
                  <td className="px-5 py-3 text-outline text-xs">{estacion?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-on-surface text-xs">{usuario?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-outline text-xs whitespace-nowrap">
                    {new Date(inc.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ESTADO_CHIP[inc.estado]}`}>
                      {ESTADO_LABEL[inc.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-xs text-primary-container font-semibold hover:underline"
                      onClick={e => { e.stopPropagation(); setSeleccionada(inc) }}>
                      Ver →
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Panel lateral detalle */}
      {seleccionada && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setSeleccionada(null)} />
          <div className="fixed right-0 top-0 h-screen w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col border-l border-outline-variant/20">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
              <h3 className="font-extrabold text-on-surface">Detalle de incidencia</h3>
              <button onClick={() => setSeleccionada(null)}
                className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container transition-colors">
                <X size={16} className="text-outline" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Tipo + estado */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{TIPO_ICON[seleccionada.tipo]}</span>
                  <div>
                    <p className="font-extrabold text-on-surface capitalize">{seleccionada.tipo}</p>
                    <p className="text-xs text-outline">
                      {new Date(seleccionada.created_at).toLocaleDateString('es-PE', { dateStyle: 'long' })}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ESTADO_CHIP[seleccionada.estado]}`}>
                  {ESTADO_LABEL[seleccionada.estado]}
                </span>
              </div>

              {/* Descripción */}
              {seleccionada.descripcion && (
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest mb-1">Descripción</p>
                  <p className="text-sm text-on-surface">{seleccionada.descripcion}</p>
                </div>
              )}

              {/* Info */}
              {[
                { label: 'Bicicleta', value: (seleccionada.bicicleta as unknown as { codigo: string })?.codigo ?? '—' },
                { label: 'Estación', value: (seleccionada.estacion as unknown as { nombre: string })?.nombre ?? '—' },
                { label: 'Reportado por', value: (seleccionada.usuario as unknown as { nombre: string })?.nombre ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-on-surface">{value}</p>
                </div>
              ))}

              {/* Foto de evidencia */}
              {seleccionada.foto_url ? (
                <div>
                  <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest mb-2">Foto de evidencia</p>
                  <div className="relative rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container-low">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={seleccionada.foto_url} alt="Evidencia" className="w-full max-h-52 object-cover" />
                    <a href={seleccionada.foto_url} target="_blank" rel="noreferrer"
                      className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                      <ExternalLink size={10} /> Ver original
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-outline py-2">
                  <ImageOff size={14} />
                  Sin foto de evidencia
                </div>
              )}

              {/* Botón crear mantenimiento */}
              {seleccionada.estado !== 'resuelta' && seleccionada.estado !== 'descartada' && (
                <div className="pt-2 border-t border-outline-variant/20">
                  <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest mb-2">Acción rápida</p>
                  {mantExito ? (
                    <div className="flex items-center gap-2 text-xs text-[#166534] bg-[#dcfce7] px-3 py-2 rounded-xl font-semibold">
                      <CheckCircle size={13} /> Mantenimiento creado y estado actualizado a En revisión
                    </div>
                  ) : (
                    <button
                      onClick={crearMantenimiento}
                      disabled={creandoMant}
                      className="w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-primary-container text-white hover:opacity-90 disabled:opacity-50 transition-all">
                      <Plus size={13} />
                      {creandoMant ? 'Creando...' : 'Crear orden de mantenimiento'}
                    </button>
                  )}
                </div>
              )}

              {/* Cambiar estado */}
              <div className="pt-2 border-t border-outline-variant/20">
                <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest mb-3">Cambiar estado</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['pendiente', 'en_revision', 'resuelta', 'descartada'] as IncidenciaEstado[]).map(est => (
                    <button key={est}
                      className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                        seleccionada.estado === est
                          ? ESTADO_CHIP[est] + ' ring-2 ring-offset-1 ring-primary-container/30'
                          : 'border-outline-variant/30 text-outline hover:bg-surface-container-low'
                      }`}
                      onClick={() => cambiarEstado(seleccionada.id, est)}>
                      {ESTADO_LABEL[est]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
