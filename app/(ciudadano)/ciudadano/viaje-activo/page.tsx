'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { MapPin, Clock, Bike, CheckCircle, AlertCircle, ChevronUp } from 'lucide-react'

const MapaEstaciones = dynamicImport(
  () => import('@/components/maps/MapaEstaciones').then(m => m.MapaEstaciones),
  { ssr: false }
)

interface ViajeActivo {
  id: string
  inicio_at: string
  bicicleta: { id: string; codigo: string; tipo: string; marca: string | null }
  estacion_origen: { id: string; nombre: string; direccion: string }
}

function useTiempo(inicioAt: string | null) {
  const [seg, setSeg] = useState(0)
  useEffect(() => {
    if (!inicioAt) return
    const calc = () => Math.floor((Date.now() - new Date(inicioAt).getTime()) / 1000)
    setSeg(calc())
    const id = setInterval(() => setSeg(calc()), 1000)
    return () => clearInterval(id)
  }, [inicioAt])
  const hh = String(Math.floor(seg / 3600)).padStart(2, '0')
  const mm = String(Math.floor((seg % 3600) / 60)).padStart(2, '0')
  const ss = String(seg % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function ViajeActivoPage() {
  const [viaje, setViaje] = useState<ViajeActivo | null>(null)
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [destino, setDestino] = useState<EstacionConDisponibilidad | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const tiempo = useTiempo(viaje?.inicio_at ?? null)
  const router = useRouter()
  const supabase = createClient()

  const cargarEstaciones = useCallback(async () => {
    const { data } = await supabase
      .from('estaciones')
      .select('*, bicicletas(id,estado)')
      .eq('estado', 'activa')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEstaciones((data as any[]).map(e => ({
        ...e,
        bicicletas_disponibles: Array.isArray(e.bicicletas)
          ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
      })))
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/viajes/activo')
      const { viaje: v } = await res.json()
      if (!v) { router.replace('/ciudadano'); return }
      setViaje(v)
      await cargarEstaciones()
      setLoading(false)
    }
    init()
  }, [router, cargarEstaciones])

  async function finalizar() {
    if (!destino) { setError('Selecciona una estación de destino en el mapa'); return }
    if (!viaje) return
    setFinalizando(true)
    setError(null)
    const res = await fetch('/api/viajes/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viaje_id: viaje.id, estacion_destino_id: destino.id }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setFinalizando(false); return }
    router.push(`/ciudadano/viaje/${data.viaje.id}`)
  }

  if (loading) return (
    <div className="h-screen bg-surface flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-container" />
    </div>
  )

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Mapa full-screen */}
      <div className="flex-1 relative">
        <MapaEstaciones
          estaciones={estaciones}
          onEstacionClick={setDestino}
          focusEstacion={destino}
        />

        {/* Top bar flotante */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-3">
          <div className="glass-panel flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/50 shadow-md flex-1">
            <div className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse" />
            <span className="text-sm font-bold text-on-surface">Viaje en curso</span>
            <span className="ml-auto font-mono text-sm font-semibold text-primary-container">{tiempo}</span>
          </div>
        </div>

        {/* Info bici flotante (top-right) */}
        <div className="absolute top-16 right-4 z-20">
          <div className="glass-panel px-3 py-2 rounded-xl border border-white/50 shadow-md">
            <div className="flex items-center gap-2">
              <Bike size={14} className="text-primary-container" />
              <span className="text-xs font-bold text-on-surface">{viaje?.bicicleta.codigo}</span>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{viaje?.bicicleta.tipo} · {viaje?.bicicleta.marca}</p>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ease-out ${sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-120px)]'}`}>
        {/* Pull handle */}
        <button
          onClick={() => setSheetOpen(o => !o)}
          className="glass-panel w-full rounded-t-3xl border-t border-x border-white/50 px-6 pt-3 pb-4 flex flex-col items-center shadow-lg"
        >
          <div className="w-10 h-1 bg-outline-variant rounded-full mb-2" />
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary-container" />
              <span className="text-sm font-bold text-on-surface">
                {destino ? destino.nombre : 'Selecciona estación destino'}
              </span>
            </div>
            <ChevronUp size={18} className={`text-outline transition-transform ${sheetOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Sheet content */}
        <div className="glass-panel border-x border-b border-white/50 px-6 pb-8 space-y-4">
          {/* Origen */}
          <div className="bg-surface-container-low rounded-xl p-3">
            <p className="text-xs text-outline font-semibold uppercase tracking-wide mb-1">Origen</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#003527]" />
              <p className="text-sm font-medium text-on-surface">{viaje?.estacion_origen.nombre}</p>
            </div>
          </div>

          {/* Destino seleccionado */}
          {destino && (
            <div className="bg-surface-container-low rounded-xl p-3">
              <p className="text-xs text-outline font-semibold uppercase tracking-wide mb-1">Destino seleccionado</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#b2f746]" />
                  <p className="text-sm font-medium text-on-surface">{destino.nombre}</p>
                </div>
                <span className="text-xs bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded-full font-semibold">
                  {destino.bicicletas_disponibles < destino.capacidad
                    ? `${destino.capacidad - destino.bicicletas_disponibles} dock libres`
                    : 'Llena'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-[#ba1a1a] bg-[#ffdad6] px-3 py-2 rounded-xl">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <button
            onClick={finalizar}
            disabled={finalizando || !destino}
            className="w-full flex items-center justify-center gap-2 bg-[#064e3b] disabled:bg-outline-variant text-white font-bold py-4 rounded-2xl text-sm shadow-lg active:scale-[0.98] transition-all"
          >
            <CheckCircle size={18} />
            {finalizando ? 'Finalizando...' : 'Finalizar viaje'}
          </button>

          <p className="text-center text-xs text-outline">
            Toca una estación en el mapa para elegir destino
          </p>
        </div>
      </div>
    </div>
  )
}
