'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, InfoWindow, OverlayView, useJsApiLoader } from '@react-google-maps/api'
import { EstacionConDisponibilidad } from '@/types'
import { LocateFixed } from 'lucide-react'

export interface CiclistaVivo {
  id: string
  nombre: string
  bicicleta: string
  lat: number
  lng: number
}

interface MapaEstacionesProps {
  estaciones: EstacionConDisponibilidad[]
  onEstacionClick?: (estacion: EstacionConDisponibilidad) => void
  modoOperador?: boolean
  focusEstacion?: EstacionConDisponibilidad | null
  userLocation?: { lat: number; lng: number } | null
  ciclistas?: CiclistaVivo[]
}

const containerStyle = { width: '100%', height: '100%' }
const DEFAULT_CENTER = { lat: -12.1028, lng: -76.9943 } // San Borja, Lima (fallback)

// Paleta de marca en vez de rojo/amarillo/verde genéricos
function estiloPorDisponibilidad(disponibles: number, capacidad: number) {
  const pct = capacidad > 0 ? disponibles / capacidad : 0
  if (pct === 0)  return { gradient: 'linear-gradient(135deg, #f87171, #ba1a1a)', solid: '#ba1a1a', text: '#ffffff' }
  if (pct < 0.2)  return { gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', solid: '#f59e0b', text: '#ffffff' }
  return { gradient: 'linear-gradient(135deg, #cdff7a, #b2f746)', solid: '#b2f746', text: '#002117' }
}

export function MapaEstaciones({ estaciones, onEstacionClick, modoOperador = false, focusEstacion, userLocation, ciclistas = [] }: MapaEstacionesProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'sbbici-google-maps',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })
  const mapRef = useRef<google.maps.Map | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const focusedOnUserRef = useRef(false)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    if (userLocation && !focusEstacion) {
      map.panTo(userLocation)
      map.setZoom(15)
      focusedOnUserRef.current = true
    }
    // El contenedor puede cambiar de tamaño después de cargar el mapa (layout aún
    // asentándose, safe-area, etc.) — sin avisarle a Google Maps, los tiles quedan
    // más chicos que el div y se ve un hueco junto a la barra de atribución.
    const ro = new ResizeObserver(() => {
      google.maps.event.trigger(map, 'resize')
    })
    ro.observe(map.getDiv())
    resizeObserverRef.current = ro
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onUnmount = useCallback(() => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    mapRef.current = null
  }, [])

  // Centrar en la ubicación del usuario la primera vez que llega (si no hay estación enfocada)
  useEffect(() => {
    if (!userLocation || !mapRef.current || focusedOnUserRef.current || focusEstacion) return
    mapRef.current.panTo(userLocation)
    mapRef.current.setZoom(15)
    focusedOnUserRef.current = true
  }, [userLocation, focusEstacion])

  // Centrar/zoom en la estación enfocada
  useEffect(() => {
    if (!focusEstacion || !mapRef.current) return
    mapRef.current.panTo({ lat: focusEstacion.latitud, lng: focusEstacion.longitud })
    mapRef.current.setZoom(16)
    setActiveId(focusEstacion.id)
  }, [focusEstacion])

  function centrarEnMiUbicacion() {
    if (!userLocation || !mapRef.current) return
    mapRef.current.panTo(userLocation)
    mapRef.current.setZoom(16)
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg">
        <div className="text-gray-500">Cargando mapa...</div>
      </div>
    )
  }

  const initialCenter = userLocation ?? (estaciones.length > 0
    ? { lat: estaciones[0].latitud, lng: estaciones[0].longitud }
    : DEFAULT_CENTER)

  const activa = estaciones.find(e => e.id === activeId) ?? null

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={initialCenter}
        zoom={userLocation ? 15 : 13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        }}
      >
        {estaciones.map(est => {
          const disponibles = est.bicicletas_disponibles ?? 0
          const { gradient, solid, text } = estiloPorDisponibilidad(disponibles, est.capacidad)
          const activo = activeId === est.id
          return (
            <OverlayView
              key={est.id}
              position={{ lat: est.latitud, lng: est.longitud }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                onClick={() => { setActiveId(est.id); onEstacionClick?.(est) }}
                style={{
                  transform: `translate(-50%, -100%) scale(${activo ? 1.12 : 1})`,
                  transition: 'transform 0.15s ease-out',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: gradient,
                  border: '3px solid #fff',
                  boxShadow: activo ? '0 4px 14px rgba(0,0,0,0.45)' : '0 3px 10px rgba(0,0,0,0.32)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: text, fontWeight: 800, fontSize: 13, lineHeight: 1,
                  fontFamily: 'inherit',
                }}>
                  {disponibles}
                </div>
                {/* colita del pin */}
                <div style={{
                  width: 0, height: 0, marginTop: -2,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `8px solid ${solid}`,
                  filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))',
                }} />
              </div>
            </OverlayView>
          )
        })}

        {/* En modo ciudadano la tarjeta inferior de la página ya muestra estos datos —
            el InfoWindow nativo solo se usa en el panel del operador. */}
        {activa && modoOperador && (
          <InfoWindow
            position={{ lat: activa.latitud, lng: activa.longitud }}
            onCloseClick={() => setActiveId(null)}
          >
            <div style={{ fontFamily: 'sans-serif', minWidth: 180 }}>
              <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>{activa.nombre}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{activa.direccion}</div>
              <div style={{ marginBottom: 4 }}>
                <span style={{
                  background: activa.estado === 'activa' ? '#16A34A' : activa.estado === 'mantenimiento' ? '#CA8A04' : '#DC2626',
                  color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 11,
                }}>
                  {activa.estado === 'activa' ? 'Activa' : activa.estado === 'mantenimiento' ? 'Mantenimiento' : 'Inactiva'}
                </span>
              </div>
              <div style={{ fontSize: 13 }}>
                🚲 <strong>{activa.bicicletas_disponibles}</strong> disponibles de <strong>{activa.capacidad}</strong>
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Ciclistas en tiempo real (solo modo operador) */}
        {modoOperador && ciclistas.map(c => (
          <OverlayView
            key={c.id}
            position={{ lat: c.lat, lng: c.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
              {/* Halo pulsante */}
              <div style={{
                position: 'absolute', inset: -14, borderRadius: '50%',
                background: 'rgba(59,130,246,0.25)',
                animation: 'sbbici-ciclista-pulse 2s ease-out infinite',
              }} />
              {/* Punto central */}
              <div style={{
                position: 'relative', width: 20, height: 20, borderRadius: '50%',
                background: '#3b82f6', border: '3px solid white',
                boxShadow: '0 2px 8px rgba(59,130,246,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>
                🚴
              </div>
              {/* Etiqueta */}
              <div style={{
                position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(30,58,138,0.9)', color: 'white',
                borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700,
                whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>
                {c.bicicleta}
              </div>
            </div>
          </OverlayView>
        ))}

        {userLocation && !modoOperador && (
          <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <div style={{ position: 'relative', width: 22, height: 22, transform: 'translate(-11px, -11px)' }}>
              <div style={{
                position: 'absolute', inset: -10, borderRadius: '50%',
                background: 'rgba(37,99,235,0.25)', animation: 'sbbici-pulse 2s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#2563eb', border: '3px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }} />
            </div>
          </OverlayView>
        )}
      </GoogleMap>

      {userLocation && !modoOperador && (
        // bottom despeja la barra de navegación inferior del panel ciudadano (h-16 + safe-area)
        <button
          onClick={centrarEnMiUbicacion}
          aria-label="Centrar en mi ubicación"
          className="absolute right-3 z-[400] w-10 h-10 rounded-full bg-white shadow-lg border border-outline-variant/30 flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <LocateFixed size={18} className="text-primary-container" />
        </button>
      )}

      <style jsx global>{`
        @keyframes sbbici-pulse {
          0%   { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes sbbici-ciclista-pulse {
          0%   { transform: scale(0.5); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
