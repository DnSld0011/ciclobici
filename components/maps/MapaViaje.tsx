'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, Marker, InfoWindow, OverlayView, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { EstacionConDisponibilidad } from '@/types'

interface Coord { lat: number; lng: number }

interface MapaViajeProps {
  estaciones: EstacionConDisponibilidad[]
  destino: EstacionConDisponibilidad | null
  userLocation: Coord | null
  onEstacionClick?: (est: EstacionConDisponibilidad) => void
}

const containerStyle = { width: '100%', height: '100%' }
const DEFAULT_CENTER = { lat: -12.1028, lng: -76.9943 } // San Borja, Lima (fallback)

// Recta punteada — Google Maps no soporta dashArray directo, se logra repitiendo un símbolo.
const DASHED_LINE_ICON = {
  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
  offset: '0',
  repeat: '12px',
}

export function MapaViaje({ estaciones, destino, userLocation, onEstacionClick }: MapaViajeProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'sbbici-google-maps',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })
  const mapRef = useRef<google.maps.Map | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const centeredOnUserRef = useRef(false)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    if (userLocation) {
      map.panTo(userLocation)
      map.setZoom(16)
      centeredOnUserRef.current = true
    }
    // Avisar a Google Maps si el contenedor cambia de tamaño tras el primer render
    // (evita el hueco entre los tiles y la barra de atribución).
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

  // Centrar en el usuario solo la primera vez que llega su ubicación
  useEffect(() => {
    if (!userLocation || !mapRef.current || centeredOnUserRef.current) return
    mapRef.current.panTo(userLocation)
    mapRef.current.setZoom(16)
    centeredOnUserRef.current = true
  }, [userLocation])

  // Centrar en el destino cuando se elige
  useEffect(() => {
    if (!destino || !mapRef.current) return
    mapRef.current.panTo({ lat: destino.latitud, lng: destino.longitud })
    mapRef.current.setZoom(15)
    setActiveId(destino.id)
  }, [destino])

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-surface-container flex items-center justify-center">
        <div className="text-outline text-sm animate-pulse">Iniciando mapa...</div>
      </div>
    )
  }

  const initialCenter = userLocation ?? (estaciones.length > 0
    ? { lat: estaciones[0].latitud, lng: estaciones[0].longitud }
    : DEFAULT_CENTER)

  const activa = estaciones.find(e => e.id === activeId) ?? null

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={initialCenter}
      zoom={15}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      }}
    >
      {/* Estaciones — tenues, tocables para fijar destino */}
      {estaciones.map(est => {
        const pct = est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0
        const solid = pct === 0 ? '#ba1a1a' : pct < 0.25 ? '#f59e0b' : '#b2f746'
        const text = pct < 0.25 ? '#ffffff' : '#002117'
        return (
          <OverlayView
            key={est.id}
            position={{ lat: est.latitud, lng: est.longitud }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              onClick={() => { setActiveId(est.id); onEstacionClick?.(est) }}
              style={{ transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: solid, opacity: 0.65,
                border: '2.5px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: text, fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
              }}>
                {est.bicicletas_disponibles}
              </div>
            </div>
          </OverlayView>
        )
      })}

      {activa && (
        <InfoWindow
          position={{ lat: activa.latitud, lng: activa.longitud }}
          onCloseClick={() => setActiveId(null)}
        >
          <div style={{ fontFamily: 'sans-serif', minWidth: 160 }}>
            <strong>{activa.nombre}</strong><br />
            {activa.bicicletas_disponibles} bicis disponibles
          </div>
        </InfoWindow>
      )}

      {/* Destino — pin lima */}
      {destino && (
        <Marker
          position={{ lat: destino.latitud, lng: destino.longitud }}
          icon={{
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
            fillColor: '#b2f746',
            fillOpacity: 1,
            strokeColor: '#002117',
            strokeWeight: 2,
            scale: 1.6,
            anchor: new google.maps.Point(12, 22),
          }}
          zIndex={900}
        />
      )}

      {/* Ruta punteada usuario → destino */}
      {destino && userLocation && (
        <Polyline
          path={[userLocation, { lat: destino.latitud, lng: destino.longitud }]}
          options={{
            strokeOpacity: 0,
            strokeColor: '#003527',
            icons: [DASHED_LINE_ICON],
          }}
        />
      )}

      {/* Mi ubicación — punto azul pulsante */}
      {userLocation && (
        <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{ position: 'relative', width: 22, height: 22, transform: 'translate(-11px, -11px)' }}>
            <div style={{
              position: 'absolute', inset: -10, borderRadius: '50%',
              background: 'rgba(59,130,246,0.35)', animation: 'sbbici-gps-pulse 1.8s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: '#3b82f6', border: '2.5px solid white',
              boxShadow: '0 2px 8px rgba(59,130,246,.55)',
            }} />
          </div>
        </OverlayView>
      )}

      <style jsx global>{`
        @keyframes sbbici-gps-pulse {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </GoogleMap>
  )
}
