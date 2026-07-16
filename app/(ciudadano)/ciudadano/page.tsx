'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { EstacionConDisponibilidad } from '@/types'
import { Map, Bike, MapPin, ChevronRight, Leaf, Clock, AlertTriangle, TrendingUp, Home, Briefcase, Trophy } from 'lucide-react'
import { ProyeccionEstacion } from '@/components/ciudadano/ProyeccionEstacion'

const LOGROS: { id: string; emoji: string; titulo: string; desc: string; umbral: (s: Stats) => boolean }[] = [
  { id: 'primer_viaje',    emoji: '🚲', titulo: 'Primera pedalada',  desc: '1 viaje completado',      umbral: s => s.viajes >= 1 },
  { id: 'diez_viajes',     emoji: '🔟', titulo: 'Pedalero habitual', desc: '10 viajes completados',   umbral: s => s.viajes >= 10 },
  { id: 'cincuenta_viajes',emoji: '⭐', titulo: 'Ciclista SB',       desc: '50 viajes completados',   umbral: s => s.viajes >= 50 },
  { id: 'cien_viajes',     emoji: '🏆', titulo: 'Leyenda del pedal', desc: '100 viajes completados',  umbral: s => s.viajes >= 100 },
  { id: 'diez_km',         emoji: '🛣️', titulo: 'Primeros km',       desc: '10 km recorridos',        umbral: s => s.km >= 10 },
  { id: 'cincuenta_km',    emoji: '🌆', titulo: 'Explorador urbano', desc: '50 km recorridos',        umbral: s => s.km >= 50 },
  { id: 'cien_km',         emoji: '🏙️', titulo: 'Maratonista verde', desc: '100 km recorridos',       umbral: s => s.km >= 100 },
  { id: 'co2_ahorrado',    emoji: '🌿', titulo: 'Guardián del clima',desc: '1 kg CO₂ ahorrado',       umbral: s => s.co2 >= 1 },
  { id: 'diez_co2',        emoji: '🌱', titulo: 'Amigo del planeta', desc: '10 kg CO₂ ahorrado',      umbral: s => s.co2 >= 10 },
]

interface Stats { viajes: number; co2: number; km: number }

export default function DashboardCiudadano() {
  const [nombre, setNombre] = useState('')
  const [stats, setStats] = useState<Stats>({ viajes: 0, co2: 0, km: 0 })
  const [estaciones, setEstaciones] = useState<EstacionConDisponibilidad[]>([])
  const [casaId, setCasaId] = useState<string | null>(null)
  const [trabajoId, setTrabajoId] = useState<string | null>(null)
  const [viajeActivo, setViajeActivo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saludo, setSaludo] = useState('Hola')
  const router = useRouter()

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: perfil }, { data: ests }, { data: viajes }, viajeRes] = await Promise.all([
        supabase.from('usuarios').select('nombre, estacion_casa_id, estacion_trabajo_id').eq('id', user.id).single(),
        supabase.from('estaciones').select('*, bicicletas(id,estado)').eq('estado', 'activa').order('nombre'),
        supabase.from('viajes').select('distancia_km, duracion_min').eq('usuario_id', user.id).eq('estado', 'finalizado'),
        fetch('/api/viajes/activo').then(r => r.json()),
      ])

      if (perfil) {
        setNombre(perfil.nombre.split(' ')[0])
        setCasaId(perfil.estacion_casa_id ?? null)
        setTrabajoId(perfil.estacion_trabajo_id ?? null)
      }
      if (viajeRes?.viaje) setViajeActivo(true)

      if (viajes) {
        const km = viajes.reduce((s, v) => s + (v.distancia_km ?? 0), 0)
        setStats({
          viajes: viajes.length,
          km: Math.round(km * 10) / 10,
          co2: Math.round(km * 0.21 * 10) / 10,
        })
      }

      if (ests) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (ests as any[]).map(e => ({
          ...e,
          bicicletas_disponibles: Array.isArray(e.bicicletas)
            ? e.bicicletas.filter((b: { estado: string }) => b.estado === 'disponible').length : 0,
        }))
        // favoritas primero, luego por disponibilidad
        mapped.sort((a, b) => {
          const aFav = a.id === perfil?.estacion_casa_id || a.id === perfil?.estacion_trabajo_id ? 1 : 0
          const bFav = b.id === perfil?.estacion_casa_id || b.id === perfil?.estacion_trabajo_id ? 1 : 0
          if (bFav !== aFav) return bFav - aFav
          return b.bicicletas_disponibles - a.bicicletas_disponibles
        })
        setEstaciones(mapped)
      }
      setLoading(false)
    }
    cargar()
    const supabase = createClient()
    let timeout: ReturnType<typeof setTimeout> | null = null
    const debounced = () => { if (timeout) clearTimeout(timeout); timeout = setTimeout(cargar, 800) }
    const ch = supabase.channel('dashboard-ciudadano-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bicicletas' }, debounced)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estaciones' }, debounced)
      .subscribe()
    return () => { if (timeout) clearTimeout(timeout); supabase.removeChannel(ch) }
  }, [router])

  // El saludo depende de la hora local — calcularlo en el cliente tras montar
  // evita que el render del servidor y el de hidratación muestren textos distintos.
  useEffect(() => {
    const hora = new Date().getHours()
    setSaludo(hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches')
  }, [])

  const totalLibres = estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)
  const logrosDesbloqueados = LOGROS.filter(l => l.umbral(stats))
  const logrosLocked = LOGROS.filter(l => !l.umbral(stats))

  return (
    <div className="max-w-lg mx-auto pb-6 space-y-5">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-b-[2rem] px-5 pt-8 pb-7"
        style={{ background: 'linear-gradient(160deg, #003527 0%, #064e3b 55%, #0a6b52 100%)' }}>

        {/* Orbes de fondo */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #b2f746, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #95d3ba, transparent 70%)' }} />

        {/* Banner viaje activo — dentro del hero */}
        {viajeActivo && (
          <Link href="/ciudadano/viaje-activo"
            className="flex items-center gap-3 mb-5 px-4 py-2.5 rounded-2xl relative z-10"
            style={{ background: 'rgba(178,247,70,0.15)', border: '1px solid rgba(178,247,70,0.3)' }}>
            <div className="w-2 h-2 rounded-full bg-[#b2f746] animate-pulse shrink-0" />
            <p className="text-[#b2f746] font-bold text-sm flex-1">Viaje en curso</p>
            <ChevronRight size={15} className="text-[#b2f746]" />
          </Link>
        )}

        {/* Saludo */}
        <div className="relative z-10">
          <p className="text-white/50 text-sm">{saludo},</p>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-0.5">
            {loading ? <span className="opacity-30">...</span> : nombre}
          </h1>
        </div>

        {/* Número grande de bicis */}
        <div className="relative z-10 mt-6 flex items-end justify-between">
          <div>
            <p className="text-[#b2f746]/70 text-xs font-semibold uppercase tracking-widest mb-1">
              Bicicletas disponibles ahora
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold text-white leading-none">
                {loading ? '—' : totalLibres}
              </span>
              <span className="text-white/40 text-sm font-medium">
                en {estaciones.length} estaciones
              </span>
            </div>
          </div>
          {/* CTA único */}
          {!viajeActivo && (
            <Link href="/ciudadano/mapa"
              className="shrink-0 flex items-center gap-2 h-11 px-5 rounded-2xl font-bold text-sm active:scale-[.97] transition-all"
              style={{ background: '#b2f746', color: '#002117' }}>
              <Map size={16} /> Explorar
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 space-y-5">

        {/* ── PROYECCIÓN DE TU ESTACIÓN FAVORITA ── */}
        {!loading && (casaId || trabajoId) && (() => {
          const favId = casaId ?? trabajoId
          const fav = estaciones.find(e => e.id === favId)
          if (!fav || !favId) return null
          return (
            <div className="bg-white rounded-2xl border border-outline-variant/15 shadow-sm p-4 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-extrabold text-sm text-on-surface flex items-center gap-1.5">
                  {casaId ? <Home size={13} className="text-primary-container" /> : <Briefcase size={13} className="text-primary-container" />}
                  {fav.nombre}
                </p>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#003527', color: '#b2f746' }}>
                  Tu estación
                </span>
              </div>
              <ProyeccionEstacion estacionId={favId} compacto />
            </div>
          )
        })()}

        {/* ── ESTACIONES — scroll horizontal ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-on-surface text-sm">Estaciones activas</h2>
            <Link href="/ciudadano/mapa"
              className="text-xs text-primary-container font-semibold flex items-center gap-0.5 hover:underline">
              Ver mapa <ChevronRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex-none w-44 h-28 rounded-2xl bg-surface-container-low animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
              {estaciones.slice(0, 8).map(est => {
                const pct = est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0
                const barColor = pct === 0 ? '#ba1a1a' : pct < 0.2 ? '#f59e0b' : '#b2f746'
                const bg = pct === 0 ? '#ffdad6' : pct < 0.2 ? '#fef9c3' : '#dcfce7'
                const text = pct === 0 ? '#991b1b' : pct < 0.2 ? '#854d0e' : '#166534'
                const esCasa = est.id === casaId
                const esTrabajo = est.id === trabajoId
                return (
                  <Link key={est.id} href="/ciudadano/mapa"
                    className="flex-none w-44 rounded-2xl p-4 border bg-white shadow-sm snap-start active:scale-[.97] transition-all hover:shadow-md"
                    style={{ borderColor: esCasa || esTrabajo ? '#003527' : undefined }}>
                    {/* Badge favorita */}
                    {(esCasa || esTrabajo) && (
                      <div className="flex items-center gap-1 mb-2">
                        {esCasa && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#003527', color: '#b2f746' }}>
                            <Home size={8} /> Casa
                          </span>
                        )}
                        {esTrabajo && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#003527', color: '#b2f746' }}>
                            <Briefcase size={8} /> Trabajo
                          </span>
                        )}
                      </div>
                    )}
                    {/* Nombre */}
                    <p className="font-bold text-xs text-on-surface leading-tight line-clamp-2 mb-3">
                      {est.nombre}
                    </p>
                    {/* Número grande */}
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-extrabold" style={{ color: text }}>
                        {est.bicicletas_disponibles}
                      </span>
                      <span className="text-xs text-outline">/ {est.capacidad}</span>
                    </div>
                    {/* Barra */}
                    <div className="h-1.5 rounded-full bg-outline-variant/15 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, pct * 100)}%`, background: barColor }} />
                    </div>
                    <p className="text-[10px] text-outline mt-1.5 truncate flex items-center gap-1">
                      <MapPin size={9} className="shrink-0" />{est.direccion}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── MI IMPACTO — strip compacto ── */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-sm text-on-surface flex items-center gap-2">
              <Leaf size={15} className="text-[#166534]" /> Mi impacto
            </p>
            <Link href="/ciudadano/perfil"
              className="text-xs text-primary-container font-semibold hover:underline">
              Ver más
            </Link>
          </div>
          <div className="grid grid-cols-3 divide-x divide-outline-variant/20">
            {[
              { label: 'Viajes', value: loading ? '—' : String(stats.viajes), unit: '' },
              { label: 'Kilómetros', value: loading ? '—' : String(stats.km), unit: 'km' },
              { label: 'CO₂ ahorrado', value: loading ? '—' : String(stats.co2), unit: 'kg' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="text-center px-3">
                <p className="text-xl font-extrabold text-primary-container">
                  {value}<span className="text-xs font-normal text-outline ml-0.5">{unit}</span>
                </p>
                <p className="text-[10px] text-outline mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── LOGROS ── */}
        {!loading && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-on-surface text-sm flex items-center gap-2">
                <Trophy size={15} className="text-amber-500" /> Mis logros
              </h2>
              <span className="text-xs font-bold text-primary-container">
                {logrosDesbloqueados.length}/{LOGROS.length}
              </span>
            </div>

            {logrosDesbloqueados.length === 0 ? (
              <div className="card px-4 py-4 text-center">
                <p className="text-sm text-outline">Completa tu primer viaje para desbloquear logros</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {/* Logros desbloqueados */}
                {logrosDesbloqueados.map(l => (
                  <div key={l.id} className="bg-white rounded-2xl p-3 shadow-sm border border-[#b2f746]/40 text-center">
                    <span className="text-2xl block mb-1">{l.emoji}</span>
                    <p className="text-[10px] font-extrabold text-[#003527] leading-tight">{l.titulo}</p>
                    <p className="text-[9px] text-outline mt-0.5 leading-tight">{l.desc}</p>
                  </div>
                ))}
                {/* Próximo logro a desbloquear */}
                {logrosLocked.length > 0 && (
                  <div className="bg-surface-container-low rounded-2xl p-3 text-center border border-dashed border-outline-variant/30 opacity-60">
                    <span className="text-2xl block mb-1 grayscale">{logrosLocked[0].emoji}</span>
                    <p className="text-[10px] font-extrabold text-outline leading-tight">{logrosLocked[0].titulo}</p>
                    <p className="text-[9px] text-outline mt-0.5 leading-tight">{logrosLocked[0].desc}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ACCIONES rápidas ── */}
        <div>
          <h2 className="font-extrabold text-on-surface text-sm mb-3">Acciones</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { href: '/ciudadano/mapa',        icon: Map,          label: 'Mapa',      bg: 'bg-[#e5eeff]', fg: 'text-primary-container' },
              { href: '/ciudadano/viajes',       icon: Clock,        label: 'Viajes',    bg: 'bg-[#e5eeff]', fg: 'text-primary-container' },
              { href: '/ciudadano/incidencias',  icon: AlertTriangle,label: 'Reportar',  bg: 'bg-[#fef9c3]', fg: 'text-[#854d0e]' },
              { href: '/ciudadano/perfil',       icon: TrendingUp,   label: 'Perfil',    bg: 'bg-[#dcfce7]', fg: 'text-[#166534]' },
            ].map(({ href, icon: Icon, label, bg, fg }) => (
              <Link key={href} href={href}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-outline-variant/20 hover:border-primary-container/20 hover:shadow-sm active:scale-[.96] transition-all">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                  <Icon size={18} className={fg} />
                </div>
                <span className="text-[10px] font-bold text-on-surface">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── ÚLTIMA ESTACIÓN CON MÁS BICIS ── */}
        {!loading && estaciones.length > 0 && estaciones[0].bicicletas_disponibles > 0 && (
          <Link href="/ciudadano/mapa"
            className="card px-4 py-4 flex items-center gap-4 hover:border-primary-container/30 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#dcfce7] flex items-center justify-center shrink-0">
              <Bike size={22} className="text-[#166534]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-outline uppercase font-extrabold tracking-widest mb-0.5">Mejor opción ahora</p>
              <p className="font-extrabold text-sm text-on-surface truncate">{estaciones[0].nombre}</p>
              <p className="text-xs text-outline truncate">{estaciones[0].direccion}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-extrabold text-[#166534]">{estaciones[0].bicicletas_disponibles}</p>
              <p className="text-[10px] text-outline">bicis libres</p>
            </div>
          </Link>
        )}

      </div>
    </div>
  )
}
