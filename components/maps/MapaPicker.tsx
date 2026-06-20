'use client'

import { useCallback, useRef, useState } from 'react'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { MapPin } from 'lucide-react'

interface MapaPickerProps {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

const DEFAULT_CENTER = { lat: -12.1028, lng: -76.9943 } // San Borja
const containerStyle  = { width: '100%', height: '100%' }

export function MapaPicker({ lat, lng, onChange }: MapaPickerProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'sbbici-google-maps',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral | null>(
    lat && lng ? { lat, lng } : null
  )

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  const onUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  function handleClick(e: google.maps.MapMouseEvent) {
    const pos = e.latLng
    if (!pos) return
    const newLat = parseFloat(pos.lat().toFixed(6))
    const newLng = parseFloat(pos.lng().toFixed(6))
    setMarkerPos({ lat: newLat, lng: newLng })
    onChange(newLat, newLng)
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-surface-container-low rounded-xl flex items-center justify-center">
        <p className="text-xs text-outline">Cargando mapa...</p>
      </div>
    )
  }

  const center = markerPos ?? DEFAULT_CENTER

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={markerPos ? 16 : 14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleClick}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
        }}
      >
        {markerPos && (
          <Marker
            position={markerPos}
            animation={google.maps.Animation.DROP}
          />
        )}
      </GoogleMap>

      {!markerPos && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2">
          <div className="bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-md flex items-center gap-2 border border-outline-variant/20">
            <MapPin size={14} className="text-primary-container" />
            <span className="text-xs font-bold text-on-surface">Toca el mapa para marcar la ubicación</span>
          </div>
        </div>
      )}
    </div>
  )
}
