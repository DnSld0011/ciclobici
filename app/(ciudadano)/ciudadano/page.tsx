'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Map, Bike, MapPin, ChevronRight, Leaf, Clock, AlertTriangle, QrCode } from 'lucide-react'

interface Stats { viajes: number; estacionesActivas: number }

export default function DashboardCiudadano() {
  const [nombre, setNombre] = useState('')
  const [stats, setStats] = useState<Stats>({ viajes: 0, estacionesActivas: 0 })
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [viajeActivo, setViajeActivo] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: perfil }, { data: ests }, { count: viajes }, viajeRes] = await Promise.all([
        supabase.from('usuarios').select('nombre').eq('id', user.id).single(),
        supabase.from('estaciones').select('*, bicicletas(id,estado)').eq('estado', 'activa').order('nombre'),
        supabase.from('viajes').select('*', { count: 'exact', head: true }).eq('usuario_id', user.id).eq('estado', 'finalizado'),
        fetch('/api/viajes/activo').then(r => r.json()),
      ])

      if (perfil) setNombre(perfil.nombre.split(' ')[0])
      if (viajeRes?.viaje) setViajeActivo(true)

      if (ests) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (ests as any[]).map(e => ({
          ...e,
          bicicletas_disponibles: Array.isArray(e.bicicletas)
            ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
        }))
        setEstaciones(mapped.sort((a, b) => b.bicicletas_disponibles - a.bicicletas_disponibles))
        setStats({ viajes: viajes ?? 0, estacionesActivas: ests.length })
      }
      setLoading(false)
    }
    cargar()
  }, [router, supabase])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const totalBicisLibres = estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Banner viaje activo */}
      {viajeActivo && (
        <Link
          href="/ciudadano/viaje-activo"
          className="flex items-center gap-3 bg-[#064e3b] text-white px-4 py-3 rounded-2xl shadow-md animate-fade-up"
        >
          <div className="w-3 h-3 rounded-full bg-[#b2f746] animate-pulse shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">Tienes un viaje en curso</p>
            <p className="text-xs text-on-primary-container opacity-80">Toca para ver el estado y finalizar</p>
          </div>
          <ChevronRight size={16} className="text-[#b2f746]" />
        </Link>
      )}

      {/* Hero saludo */}
      <div className="bg-primary-container rounded-2xl p-5 text-white shadow-[0px_4px_30px_rgba(0,53,39,0.2)] relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="absolute bottom-0 right-4 w-16 h-16 rounded-full bg-[#b2f746]/10" />
        <div className="relative z-10">
          <p className="text-on-primary-container opacity-70 text-sm">{saludo}</p>
          <h1 className="text-2xl font-extrabold mt-0.5 tracking-tight">
            {loading ? '...' : nombre}
          </h1>
          <p className="text-on-primary-container opacity-60 text-sm mt-1">¿Listo para pedalear por San Borja?</p>
          {!viajeActivo && (
            <div className="mt-4 flex gap-2">
              <Link
                href="/ciudadano/escanear"
                className="inline-flex items-center gap-2 bg-[#b2f746] text-[#003527] font-extrabold px-4 py-2.5 rounded-xl text-sm shadow-md hover:bg-[#98da27] active:scale-[0.97] transition-all"
              >
                <QrCode size={15} /> Escanear QR
              </Link>
              <Link
                href="/ciudadano/mapa"
                className="inline-flex items-center gap-2 bg-white/10 text-white font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-white/20 active:scale-[0.97] transition-all border border-white/20"
              >
                <Map size={15} /> Ver mapa
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Bike,    color: 'bg-[#e5eeff] text-primary-container', label: 'Viajes',    value: stats.viajes },
          { icon: MapPin,  color: 'bg-[#dcfce7] text-[#166534]',         label: 'Estaciones',value: stats.estacionesActivas },
          { icon: Leaf,    color: 'bg-[#b2f746]/20 text-[#446900]',       label: 'Bicis libres',value: totalBicisLibres },
        ].map(({ icon: Icon, color, label, value }) => (
          <div key={label} className="card p-4 text-center">
            <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center mx-auto mb-2`}>
              <Icon size={17} />
            </div>
            <p className="text-2xl font-extrabold text-on-surface">{loading ? '—' : value}</p>
            <p className="text-[10px] text-outline uppercase font-semibold tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/ciudadano/escanear" className="card p-4 flex items-center gap-3 hover:border-[#bbf7d0] hover:shadow-md transition-all col-span-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#b2f746' }}>
            <QrCode size={19} style={{ color: '#002117' }} />
          </div>
          <div>
            <p className="font-bold text-sm text-on-surface">Escanear QR</p>
            <p className="text-xs text-outline">Tomar una bicicleta</p>
          </div>
        </Link>
        <Link href="/ciudadano/mapa" className="card p-4 flex items-center gap-3 hover:border-primary-container/30 hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-[#e5eeff] rounded-xl flex items-center justify-center shrink-0">
            <Map size={19} className="text-primary-container" />
          </div>
          <div>
            <p className="font-bold text-sm text-on-surface">Ver mapa</p>
            <p className="text-xs text-outline">Estaciones en vivo</p>
          </div>
        </Link>
        <Link href="/ciudadano/incidencias" className="card p-4 flex items-center gap-3 hover:border-[#fde68a] hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-[#fef9c3] rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={19} className="text-[#854d0e]" />
          </div>
          <div>
            <p className="font-bold text-sm text-on-surface">Reportar</p>
            <p className="text-xs text-outline">Bici dañada</p>
          </div>
        </Link>
        <Link href="/ciudadano/viajes" className="card p-4 flex items-center gap-3 hover:border-primary-container/30 hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-[#e5eeff] rounded-xl flex items-center justify-center shrink-0">
            <Clock size={19} className="text-primary-container" />
          </div>
          <div>
            <p className="font-bold text-sm text-on-surface">Historial</p>
            <p className="text-xs text-outline">Mis viajes</p>
          </div>
        </Link>
        <Link href="/ciudadano/perfil" className="card p-4 flex items-center gap-3 hover:border-primary-container/30 hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-[#dcfce7] rounded-xl flex items-center justify-center shrink-0">
            <Leaf size={19} className="text-[#166534]" />
          </div>
          <div>
            <p className="font-bold text-sm text-on-surface">Mi impacto</p>
            <p className="text-xs text-outline">Perfil y CO₂</p>
          </div>
        </Link>
      </div>

      {/* Estaciones disponibles */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-on-surface">Estaciones cercanas</h2>
          <Link href="/ciudadano/mapa" className="text-xs text-primary-container flex items-center gap-0.5 font-semibold hover:underline">
            Ver todas <ChevronRight size={12} />
          </Link>
        </div>
        <div className="space-y-2">
          {loading
            ? Array(3).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-xl h-16 animate-pulse border border-slate-100" />
              ))
            : estaciones.slice(0, 5).map(est => {
                const pct = est.bicicletas_disponibles / est.capacidad
                const dot = pct === 0 ? 'bg-error' : pct < 0.2 ? 'bg-amber-400' : 'bg-[#b2f746]'
                const chip = pct === 0
                  ? 'chip-baja'
                  : pct < 0.2
                    ? 'chip-mantenimiento'
                    : 'chip-disponible'
                return (
                  <Link
                    key={est.id}
                    href="/ciudadano/mapa"
                    className="card px-4 py-3 flex items-center gap-3 hover:border-primary-container/30 transition-all"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-on-surface truncate">{est.nombre}</p>
                      <p className="text-xs text-outline truncate">{est.direccion}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${chip}`}>
                      {est.bicicletas_disponibles}/{est.capacidad}
                    </span>
                  </Link>
                )
              })}
        </div>
      </div>
    </div>
  )
}
