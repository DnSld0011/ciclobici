'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { IncidenciaEstado, IncidenciaTipo } from '@/types'
import { ArrowLeft, Inbox, AlertTriangle } from 'lucide-react'

interface ReporteHistorial {
  id: string
  tipo: IncidenciaTipo
  descripcion: string | null
  foto_url: string | null
  estado: IncidenciaEstado
  created_at: string
  bicicleta: { codigo: string } | null
  estacion: { nombre: string } | null
}

const TIPO_LABEL: Record<IncidenciaTipo, string> = {
  frenos: 'Frenos', llanta: 'Llanta', cadena: 'Cadena', manillar: 'Manillar',
  asiento: 'Asiento', iluminacion: 'Iluminación', electrico: 'Eléctrico',
  estructura: 'Estructura', otro: 'Otro',
}

const ESTADO_STYLE: Record<IncidenciaEstado, { bg: string; text: string; label: string }> = {
  pendiente:   { bg: '#fef9c3', text: '#854d0e', label: 'Pendiente' },
  en_revision: { bg: '#e5eeff', text: '#1d4ed8', label: 'En revisión' },
  resuelta:    { bg: '#dcfce7', text: '#166534', label: 'Resuelta' },
  descartada:  { bg: '#f3f4f6', text: '#6b7280', label: 'Descartada' },
}

function fechaRelativa(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hora}`
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`
  return `${d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}, ${hora}`
}

export default function MisReportesPage() {
  const [reportes, setReportes] = useState<ReporteHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data } = await supabase
        .from('incidencias')
        .select(`
          id, tipo, descripcion, foto_url, estado, created_at,
          bicicleta:bicicleta_id(codigo),
          estacion:estacion_id(nombre)
        `)
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })

      if (data) setReportes(data as unknown as ReporteHistorial[])
      setLoading(false)
    }
    cargar()

    const supabase = createClient()
    const ch = supabase.channel('mis-reportes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/ciudadano/incidencias"
          className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0">
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </Link>
        <div>
          <h1 className="text-lg font-extrabold text-on-surface">Mis reportes</h1>
          <p className="text-xs text-on-surface-variant">Estado de las incidencias que reportaste</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-outline-variant/10" />
          ))}
        </div>
      ) : reportes.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <Inbox size={32} className="mx-auto mb-3 text-outline" />
          <p className="font-semibold text-sm text-on-surface-variant">Aún no has reportado nada</p>
          <p className="text-xs text-outline mt-1">Cuando reportes una incidencia, aparecerá aquí</p>
          <Link href="/ciudadano/incidencias"
            className="inline-block mt-4 h-10 px-5 rounded-xl font-bold text-xs leading-10"
            style={{ background: '#b2f746', color: '#002117' }}>
            Reportar una incidencia
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reportes.map(r => {
            const estilo = ESTADO_STYLE[r.estado]
            return (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-outline-variant/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: '#fef9c3' }}>
                      <AlertTriangle size={18} style={{ color: '#854d0e' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface">{TIPO_LABEL[r.tipo]}</p>
                      <p className="text-[10px] text-outline mt-0.5">
                        {r.bicicleta?.codigo ?? '—'}{r.estacion?.nombre ? ` · ${r.estacion.nombre}` : ''}
                      </p>
                      {r.descripcion && (
                        <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-2">{r.descripcion}</p>
                      )}
                      <p className="text-[10px] text-outline mt-1.5">{fechaRelativa(r.created_at)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: estilo.bg, color: estilo.text }}>
                    {estilo.label}
                  </span>
                </div>
                {r.foto_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.foto_url} alt="Evidencia" className="w-full h-32 object-cover rounded-xl mt-3" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
