'use client'

import { useCallback } from 'react'
import { GoogleMap, OverlayView, Polyline, useJsApiLoader } from '@react-google-maps/api'

interface Coord { lat: number; lng: number }

interface MapaResumenViajeProps {
  origen: Coord
  destino: Coord
}

const containerStyle = { width: '100%', height: '100%' }

export function MapaResumenViaje({ origen, destino }: MapaResumenViajeProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'sbbici-google-maps',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds()
    bounds.extend(origen)
    bounds.extend(destino)
    map.fitBounds(bounds, 56)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isLoaded) {
    return <div className="w-full h-full bg-surface-container-low animate-pulse" />
  }

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
      {/* Trazo de la ruta */}
      <Polyline
        path={[origen, destino]}
        options={{ strokeColor: '#16a34a', strokeWeight: 4, strokeOpacity: 0.9 }}
      />

      {/* Origen */}
      <OverlayView position={origen} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#16a34a', border: '2.5px solid #fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          transform: 'translate(-50%, -50%)',
        }} />
      </OverlayView>

      {/* Destino */}
      <OverlayView position={destino} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: '#fff', border: '4px solid #16a34a',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          transform: 'translate(-50%, -50%)',
        }} />
      </OverlayView>
    </GoogleMap>
  )
}
