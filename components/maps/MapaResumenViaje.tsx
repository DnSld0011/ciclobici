'use client'

import { useCallback } from 'react'
import { GoogleMap, OverlayView, Polyline, useJsApiLoader } from '@react-google-maps/api'

interface Coord { lat: number; lng: number }

interface MapaResumenViajeProps {
  origen: Coord
  destino: Coord | null
  waypoints?: Coord[]
}

const containerStyle = { width: '100%', height: '100%' }

export function MapaResumenViaje({ origen, destino, waypoints = [] }: MapaResumenViajeProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'sbbici-google-maps',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds()
    bounds.extend(origen)
    if (destino) bounds.extend(destino)
    if (waypoints.length > 0) waypoints.forEach(p => bounds.extend(p))
    map.fitBounds(bounds, 56)
    // Si solo hay un punto, ajustar zoom manualmente para no hacer zoom infinito
    if (!destino && waypoints.length === 0) {
      map.setZoom(15)
      map.setCenter(origen)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isLoaded) {
    return <div className="w-full h-full bg-surface-container-low animate-pulse" />
  }

  // Ruta real si hay waypoints; si no, línea recta entre estaciones
  const trayecto: Coord[] = waypoints.length >= 2
    ? waypoints
    : (destino ? [origen, destino] : [])

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={origen}
      zoom={14}
      onLoad={onLoad}
      options={{
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        draggable: false,
        clickableIcons: false,
      }}
    >
      {/* Recorrido */}
      {trayecto.length >= 2 && (
        <Polyline
          path={trayecto}
          options={{
            strokeColor: '#16a34a',
            strokeWeight: waypoints.length >= 2 ? 2.5 : 3,
            strokeOpacity: 0.85,
            // GPS real: línea sólida; estimada: guiones
            ...(waypoints.length < 2 && destino ? { strokeOpacity: 0.5, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '10px' }] } : {}),
          }}
        />
      )}

      {/* Marcador origen */}
      <OverlayView position={origen} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#16a34a', border: '2.5px solid #fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          transform: 'translate(-50%, -50%)',
        }} />
      </OverlayView>

      {/* Marcador destino */}
      {destino && (
        <OverlayView position={destino} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#fff', border: '4px solid #16a34a',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            transform: 'translate(-50%, -50%)',
          }} />
        </OverlayView>
      )}
    </GoogleMap>
  )
}
