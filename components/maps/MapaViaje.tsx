'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, OverlayView, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { EstacionConDisponibilidad } from '@/types'
import { Locate } from 'lucide-react'

interface Coord { lat: number; lng: number }

interface MapaViajeProps {
  estaciones: EstacionConDisponibilidad[]
  userLocation: Coord | null
  /** Estación confirmada como destino (resaltada en el mapa) */
  estacionDestino?: EstacionConDisponibilidad | null
}

const containerStyle = { width: '100%', height: '100%' }
const DEFAULT_CENTER = { lat: -12.1028, lng: -76.9943 }

export function MapaViaje({ estaciones, userLocation, estacionDestino }: MapaViajeProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'sbbici-google-maps',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })
  const mapRef = useRef<google.maps.Map | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const centeredRef = useRef(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    if (userLocation) {
      map.panTo(userLocation)
      map.setZoom(16)
      centeredRef.current = true
    }
    const ro = new ResizeObserver(() => google.maps.event.trigger(map, 'resize'))
    ro.observe(map.getDiv())
    resizeObserverRef.current = ro
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onUnmount = useCallback(() => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    mapRef.current = null
  }, [])

  // Centrar en usuario la primera vez
  useEffect(() => {
    if (!userLocation || !mapRef.current || centeredRef.current) return
    mapRef.current.panTo(userLocation)
    mapRef.current.setZoom(16)
    centeredRef.current = true
  }, [userLocation])

  // Resaltar estación destino confirmada
  useEffect(() => {
    if (!estacionDestino || !mapRef.current) return
    mapRef.current.panTo({ lat: estacionDestino.latitud, lng: estacionDestino.longitud })
    mapRef.current.setZoom(16)
  }, [estacionDestino])

  function centrarEnMi() {
    if (!userLocation || !mapRef.current) return
    mapRef.current.panTo(userLocation)
    mapRef.current.setZoom(16)
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-surface-container flex items-center justify-center">
        <div className="text-outline text-sm animate-pulse">Cargando mapa...</div>
      </div>
    )
  }

  const initialCenter = userLocation
    ?? (estaciones.length > 0 ? { lat: estaciones[0].latitud, lng: estaciones[0].longitud } : DEFAULT_CENTER)

  const activeEst = estaciones.find(e => e.id === activeId) ?? null

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={initialCenter}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
        }}
      >
        {/* Marcadores de estaciones */}
        {estaciones.map(est => {
          const pct = est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0
          const esDestino = estacionDestino?.id === est.id
          const bgColor = esDestino
            ? '#003527'
            : pct === 0 ? '#ba1a1a'
            : pct <= 0.3 ? '#d97706'
            : '#16a34a'
          const textColor = '#ffffff'
          const isActive = activeId === est.id

          return (
            <OverlayView
              key={est.id}
              position={{ lat: est.latitud, lng: est.longitud }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                onClick={() => setActiveId(isActive ? null : est.id)}
                style={{ transform: 'translate(-50%, -100%)', cursor: 'pointer', paddingBottom: 6 }}
              >
                {/* Tarjeta */}
                <div style={{
                  background: 'white',
                  borderRadius: 10,
                  boxShadow: isActive
                    ? '0 4px 16px rgba(0,0,0,0.25)'
                    : '0 2px 8px rgba(0,0,0,0.18)',
                  border: `2px solid ${bgColor}`,
                  minWidth: 80,
                  maxWidth: 120,
                  overflow: 'hidden',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}>
                  {/* Badge de disponibilidad */}
                  <div style={{
                    background: bgColor,
                    padding: '3px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11 }}>🚲</span>
                    <span style={{
                      color: textColor,
                      fontWeight: 800,
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}>
                      {est.bicicletas_disponibles}/{est.capacidad}
                    </span>
                  </div>
                  {/* Nombre */}
                  <div style={{
                    padding: '3px 7px 4px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#1a1a1a',
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 116,
                  }}>
                    {est.nombre}
                  </div>
                </div>
                {/* Flecha */}
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `6px solid ${bgColor}`,
                  margin: '0 auto',
                }} />
              </div>
            </OverlayView>
          )
        })}

        {/* InfoWindow expandida al tocar un marcador */}
        {activeEst && (
          <InfoWindow
            position={{ lat: activeEst.latitud, lng: activeEst.longitud }}
            onCloseClick={() => setActiveId(null)}
            options={{ pixelOffset: new google.maps.Size(0, -60) }}
          >
            <div style={{ fontFamily: 'sans-serif', padding: '2px 4px', minWidth: 140 }}>
              <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{activeEst.nombre}</p>
              {activeEst.direccion && (
                <p style={{ fontSize: 11, color: '#666', margin: '2px 0 4px' }}>{activeEst.direccion}</p>
              )}
              <p style={{ fontSize: 12, margin: 0 }}>
                🚲 <strong>{activeEst.bicicletas_disponibles}</strong> disponibles
                &nbsp;/&nbsp;{activeEst.capacidad} docks
              </p>
            </div>
          </InfoWindow>
        )}

        {/* Punto GPS del usuario */}
        {userLocation && (
          <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <div style={{ position: 'relative', width: 22, height: 22, transform: 'translate(-11px, -11px)' }}>
              <div style={{
                position: 'absolute', inset: -10, borderRadius: '50%',
                background: 'rgba(59,130,246,0.3)',
                animation: 'sbbici-gps-pulse 1.8s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#3b82f6', border: '2.5px solid white',
                boxShadow: '0 2px 8px rgba(59,130,246,.55)',
              }} />
            </div>
          </OverlayView>
        )}
      </GoogleMap>

      {/* Botón centrar en mí */}
      {userLocation && (
        <button
          onClick={centrarEnMi}
          style={{
            position: 'absolute', bottom: 72, right: 12,
            width: 40, height: 40,
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Centrar en mi posición"
        >
          <Locate size={18} color="#3b82f6" />
        </button>
      )}

      <style jsx global>{`
        @keyframes sbbici-gps-pulse {
          0%   { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
