'use client'

import { useCallback, useRef, useState } from 'react'
import { GoogleMap, InfoWindow, OverlayView, useJsApiLoader } from '@react-google-maps/api'

export interface EstacionStockPin {
  id: string
  nombre: string
  direccion: string
  latitud: number
  longitud: number
  capacidad: number
  disp: number
  objetivo: number
  demanda: string
  status: 'ÓPTIMO' | 'BAJO STOCK' | 'SOBRE STOCK'
  sectorLabel: string
}

interface Props {
  estaciones: EstacionStockPin[]
}

const containerStyle = { width: '100%', height: '100%' }
const DEFAULT_CENTER = { lat: -12.1028, lng: -76.9943 }

function estiloPin(status: EstacionStockPin['status']) {
  switch (status) {
    case 'BAJO STOCK':  return { gradient: 'linear-gradient(135deg,#f87171,#dc2626)', solid: '#dc2626', text: '#fff' }
    case 'SOBRE STOCK': return { gradient: 'linear-gradient(135deg,#fbbf24,#f59e0b)', solid: '#f59e0b', text: '#fff' }
    default:            return { gradient: 'linear-gradient(135deg,#cdff7a,#b2f746)', solid: '#b2f746', text: '#002117' }
  }
}

export function MapaStock({ estaciones }: Props) {
  const { isLoaded } = useJsApiLoader({
    id: 'sbbici-google-maps',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })
  const mapRef   = useRef<google.maps.Map | null>(null)
  const roRef    = useRef<ResizeObserver | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    const ro = new ResizeObserver(() => google.maps.event.trigger(map, 'resize'))
    ro.observe(map.getDiv())
    roRef.current = ro
  }, [])

  const onUnmount = useCallback(() => {
    roRef.current?.disconnect()
    roRef.current = null
    mapRef.current = null
  }, [])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-2xl">
        <p className="text-sm text-gray-400">Cargando mapa…</p>
      </div>
    )
  }

  const center = estaciones.length > 0
    ? { lat: estaciones[0].latitud, lng: estaciones[0].longitud }
    : DEFAULT_CENTER

  const activa = estaciones.find(e => e.id === activeId) ?? null

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        }}
      >
        {estaciones.map(est => {
          const { gradient, solid, text } = estiloPin(est.status)
          const activo = activeId === est.id
          return (
            <OverlayView
              key={est.id}
              position={{ lat: est.latitud, lng: est.longitud }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                onClick={() => setActiveId(activo ? null : est.id)}
                style={{
                  transform: `translate(-50%, -100%) scale(${activo ? 1.18 : 1})`,
                  transition: 'transform 0.15s ease-out',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                {/* Pin circle */}
                <div style={{
                  minWidth: 44, height: 44, borderRadius: 22, padding: '0 8px',
                  background: gradient,
                  border: `3px solid ${activo ? '#fff' : 'rgba(255,255,255,0.85)'}`,
                  boxShadow: activo
                    ? '0 6px 20px rgba(0,0,0,0.45)'
                    : '0 3px 10px rgba(0,0,0,0.28)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: text, fontWeight: 800, fontSize: 13, lineHeight: 1,
                  fontFamily: 'inherit', gap: 2, whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontSize: 15 }}>{est.disp}</span>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>/{est.capacidad}</span>
                </div>
                {/* Tail */}
                <div style={{
                  width: 0, height: 0, marginTop: -2,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `8px solid ${solid}`,
                  filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))',
                }} />
              </div>
            </OverlayView>
          )
        })}

        {/* InfoWindow */}
        {activa && (
          <InfoWindow
            position={{ lat: activa.latitud, lng: activa.longitud }}
            onCloseClick={() => setActiveId(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -56) }}
          >
            <div style={{ fontFamily: 'sans-serif', minWidth: 210, padding: '4px 2px' }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: '#0f2419', marginBottom: 2 }}>
                {activa.nombre}
              </p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{activa.sectorLabel}</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, background: '#f8fafb', borderRadius: 8, padding: '6px 10px' }}>
                  <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>STOCK ACTUAL</p>
                  <p style={{
                    fontSize: 18, fontWeight: 900,
                    color: activa.status === 'BAJO STOCK' ? '#dc2626' : '#0f2419',
                  }}>
                    {activa.disp}<span style={{ fontSize: 12, color: '#9ca3af' }}>/{activa.capacidad}</span>
                  </p>
                </div>
                <div style={{ flex: 1, background: '#f8fafb', borderRadius: 8, padding: '6px 10px' }}>
                  <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>OBJETIVO</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#0f2419' }}>{activa.objetivo}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20,
                  background: activa.status === 'BAJO STOCK'  ? '#fee2e2'
                            : activa.status === 'SOBRE STOCK' ? '#fef9c3'
                            : '#d1fae5',
                  color: activa.status === 'BAJO STOCK'  ? '#991b1b'
                       : activa.status === 'SOBRE STOCK' ? '#854d0e'
                       : '#065f46',
                }}>
                  {activa.status}
                </span>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{activa.demanda}</span>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}
