'use client'

import { useEffect, useRef, useState } from 'react'
import { EstacionConDisponibilidad } from '@/types'

interface MapaEstacionesProps {
  estaciones: EstacionConDisponibilidad[]
  onEstacionClick?: (estacion: EstacionConDisponibilidad) => void
  modoOperador?: boolean
  focusEstacion?: EstacionConDisponibilidad | null
}

export function MapaEstaciones({ estaciones, onEstacionClick, modoOperador = false, focusEstacion }: MapaEstacionesProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const [mounted, setMounted] = useState(false)

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

      const defaultCenter: [number, number] = estaciones.length > 0
        ? [estaciones[0].latitud, estaciones[0].longitud]
        : [4.711, -74.0721] // Bogotá

      const map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      mapInstanceRef.current = map

      // Add markers
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
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [mounted, estaciones, onEstacionClick])

  useEffect(() => {
    if (!focusEstacion || !mapInstanceRef.current) return
    const map = mapInstanceRef.current as { flyTo: (latlng: [number, number], zoom: number) => void }
    map.flyTo([focusEstacion.latitud, focusEstacion.longitud], 16)

    // Open popup of matching marker
    const idx = estaciones.findIndex(e => e.id === focusEstacion.id)
    const marker = markersRef.current[idx] as { openPopup: () => void } | undefined
    marker?.openPopup()
  }, [focusEstacion, estaciones])

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg">
        <div className="text-gray-500">Cargando mapa...</div>
      </div>
    )
  }

  return (
    <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: '400px' }} />
  )
}
