'use client'

import { useEffect, useState } from 'react'
import { Truck, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

interface ProyeccionData {
  id: string
  nombre: string
  capacidad: number
  bicis_actuales: number
  reposicion: number
  proyeccion: { en_horas: number; estimado: number }[]
  estado: 'abastecida' | 'reposicion' | 'alta_demanda'
}

// Caché compartida en el cliente (60s): una sola consulta aunque el
// usuario toque varias estaciones seguidas
let cacheData: { estaciones: ProyeccionData[] } | null = null
let cacheAt = 0
let cachePromise: Promise<{ estaciones: ProyeccionData[] }> | null = null

async function obtenerDisponibilidad(): Promise<{ estaciones: ProyeccionData[] }> {
  const ahora = Date.now()
  if (cacheData && ahora - cacheAt < 60_000) return cacheData
  if (!cachePromise) {
    cachePromise = fetch('/api/ciudadano/disponibilidad')
      .then(r => r.json())
      .then(json => {
        cacheData = json
        cacheAt = Date.now()
        cachePromise = null
        return json
      })
      .catch(() => {
        cachePromise = null
        return cacheData ?? { estaciones: [] }
      })
  }
  return cachePromise
}

export function ProyeccionEstacion({ estacionId, compacto = false }: { estacionId: string; compacto?: boolean }) {
  const [data, setData] = useState<ProyeccionData | null>(null)

  useEffect(() => {
    let activo = true
    obtenerDisponibilidad().then(json => {
      if (activo) setData(json.estaciones?.find(e => e.id === estacionId) ?? null)
    })
    return () => { activo = false }
  }, [estacionId])

  if (!data) return null

  const chips = [
    { label: 'Ahora', valor: `${data.bicis_actuales}`, destacado: true },
    ...data.proyeccion.map(p => ({
      label: `+${p.en_horas}h`,
      valor: `~${p.estimado}`,
      destacado: false,
    })),
  ]

  return (
    <div className={compacto ? 'space-y-2' : 'space-y-2.5'}>
      <p className="text-[10px] font-extrabold text-outline uppercase tracking-widest flex items-center gap-1.5">
        <Clock size={10} />
        Bicis disponibles · próximas horas
      </p>

      {/* Chips de proyección */}
      <div className="grid grid-cols-4 gap-2">
        {chips.map(c => (
          <div key={c.label}
            className="rounded-xl p-2 text-center"
            style={{ background: c.destacado ? '#b2f746' : '#f4f6f5' }}>
            <p className="text-base font-extrabold leading-tight"
              style={{ color: '#002117' }}>
              {c.valor}
            </p>
            <p className="text-[9px] font-bold" style={{ color: c.destacado ? '#003527' : '#9ca3af' }}>
              {c.label}
            </p>
          </div>
        ))}
      </div>

      {/* Mensaje según el estado */}
      {data.estado === 'reposicion' && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: '#eff6ff' }}>
          <Truck size={13} className="shrink-0 mt-0.5" style={{ color: '#2563eb' }} />
          <p className="text-[11px] font-semibold leading-snug" style={{ color: '#1e40af' }}>
            Reposición en camino: <strong>+{data.reposicion} {data.reposicion === 1 ? 'bici' : 'bicis'}</strong> llegarán pronto a esta estación
          </p>
        </div>
      )}
      {data.estado === 'abastecida' && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: '#f0fdf4' }}>
          <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
          <p className="text-[11px] font-semibold leading-snug" style={{ color: '#166534' }}>
            Estación abastecida las próximas horas — puedes venir con confianza
            {data.reposicion > 0 && <> (además llegan +{data.reposicion} bicis por reposición)</>}
          </p>
        </div>
      )}
      {data.estado === 'alta_demanda' && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: '#fffbeb' }}>
          <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#d97706' }} />
          <p className="text-[11px] font-semibold leading-snug" style={{ color: '#854d0e' }}>
            Alta demanda en esta estación — te sugerimos venir pronto o revisar una cercana
          </p>
        </div>
      )}
    </div>
  )
}
