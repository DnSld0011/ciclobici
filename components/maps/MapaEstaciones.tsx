'use client'

import { useEffect, useRef, useState } from 'react'
import { EstacionConDisponibilidad } from '@/types'
import { LocateFixed } from 'lucide-react'

interface MapaEstacionesProps {
  estaciones: EstacionConDisponibilidad[]
  onEstacionClick?: (estacion: EstacionConDisponibilidad) => void
  modoOperador?: boolean
  focusEstacion?: EstacionConDisponibilidad | null
  userLocation?: { lat: number; lng: number } | null
}

export function MapaEstaciones({ estaciones, onEstacionClick, modoOperador = false, focusEstacion, userLocation }: MapaEstacionesProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const userMarkerRef = useRef<unknown>(null)
  const [mounted, setMounted] = useState(false)
  const focusedOnUserRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !mapRef.current) return

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      // Fix default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
      }

      const defaultCenter: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : estaciones.length > 0
          ? [estaciones[0].latitud, estaciones[0].longitud]
          : [4.711, -74.0721] // Bogotá

      const map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: userLocation ? 15 : 13,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      mapInstanceRef.current = map

      // Add markers de estaciones
      markersRef.current.forEach((m: unknown) => (m as { remove: () => void }).remove())
      markersRef.current = []

      estaciones.forEach(est => {
        const disponibles = est.bicicletas_disponibles ?? 0
        const porcentaje = disponibles / est.capacidad

        let color = '#DC2626' // rojo
        if (porcentaje >= 0.5) color = '#16A34A' // verde
        else if (porcentaje > 0) color = '#CA8A04' // amarillo

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 32px; height: 32px; border-radius: 50%;
              background: ${color}; border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex; align-items: center; justify-content: center;
              color: white; font-weight: bold; font-size: 11px;
            ">${disponibles}</div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const estadoBadge = est.estado === 'activa'
          ? '<span style="background:#16A34A;color:white;padding:2px 6px;border-radius:4px;font-size:11px">Activa</span>'
          : est.estado === 'mantenimiento'
            ? '<span style="background:#CA8A04;color:white;padding:2px 6px;border-radius:4px;font-size:11px">Mantenimiento</span>'
            : '<span style="background:#DC2626;color:white;padding:2px 6px;border-radius:4px;font-size:11px">Inactiva</span>'

        const popupContent = `
          <div style="font-family:sans-serif;min-width:180px">
            <div style="font-weight:bold;font-size:14px;margin-bottom:4px">${est.nombre}</div>
            <div style="font-size:12px;color:#666;margin-bottom:6px">${est.direccion}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
              ${estadoBadge}
            </div>
            <div style="font-size:13px">
              🚲 <strong>${disponibles}</strong> disponibles de <strong>${est.capacidad}</strong>
            </div>
          </div>
        `

        const marker = L.marker([est.latitud, est.longitud], { icon })
          .addTo(map)
          .bindPopup(popupContent)

        if (onEstacionClick) {
          marker.on('click', () => onEstacionClick(est))
        }

        markersRef.current.push(marker)
      })

      // Marcador de "mi ubicación" — punto azul pulsante estilo Google Maps
      if (userLocation && !modoOperador) {
        const userIcon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative; width:22px; height:22px;">
              <div style="
                position:absolute; inset:-10px; border-radius:50%;
                background: rgba(37,99,235,0.25); animation: sbbici-pulse 2s ease-out infinite;
              "></div>
              <div style="
                position:absolute; inset:0; border-radius:50%;
                background:#2563eb; border:3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              "></div>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        })
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup('Tu ubicación')
      }
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, estaciones, onEstacionClick, modoOperador])

  // Centrar suavemente en la ubicación del usuario la primera vez que llega (sin re-inicializar el mapa)
  useEffect(() => {
    if (!userLocation || !mapInstanceRef.current || focusedOnUserRef.current || focusEstacion) return
    const map = mapInstanceRef.current as { flyTo: (latlng: [number, number], zoom: number) => void }
    map.flyTo([userLocation.lat, userLocation.lng], 15)
    focusedOnUserRef.current = true
  }, [userLocation, focusEstacion])

  useEffect(() => {
    if (!focusEstacion || !mapInstanceRef.current) return
    const map = mapInstanceRef.current as { flyTo: (latlng: [number, number], zoom: number) => void }
    map.flyTo([focusEstacion.latitud, focusEstacion.longitud], 16)

    // Open popup of matching marker
    const idx = estaciones.findIndex(e => e.id === focusEstacion.id)
    const marker = markersRef.current[idx] as { openPopup: () => void } | undefined
    marker?.openPopup()
  }, [focusEstacion, estaciones])

  function centrarEnMiUbicacion() {
    if (!userLocation || !mapInstanceRef.current) return
    const map = mapInstanceRef.current as { flyTo: (latlng: [number, number], zoom: number) => void }
    map.flyTo([userLocation.lat, userLocation.lng], 16)
  }

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg">
        <div className="text-gray-500">Cargando mapa...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: '400px' }} />
      {userLocation && !modoOperador && (
        <button
          onClick={centrarEnMiUbicacion}
          aria-label="Centrar en mi ubicación"
          className="absolute bottom-4 right-3 z-[400] w-10 h-10 rounded-full bg-white shadow-lg border border-outline-variant/30 flex items-center justify-center active:scale-95 transition-transform"
        >
          <LocateFixed size={18} className="text-primary-container" />
        </button>
      )}
      <style jsx global>{`
        @keyframes sbbici-pulse {
          0%   { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
