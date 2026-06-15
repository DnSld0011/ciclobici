'use client'

import { useEffect, useRef, useState } from 'react'
import { EstacionConDisponibilidad } from '@/types'

interface Coord { lat: number; lng: number }

interface MapaViajeProps {
  estaciones: EstacionConDisponibilidad[]
  destino: EstacionConDisponibilidad | null
  userLocation: Coord | null
  onEstacionClick?: (est: EstacionConDisponibilidad) => void
}

type LeafletMap = {
  flyTo: (c: [number, number], z: number) => void
  setView: (c: [number, number], z: number) => void
  remove: () => void
}
type LeafletMarker = { setLatLng: (c: [number, number]) => void; remove: () => void }

export function MapaViaje({ estaciones, destino, userLocation, onEstacionClick }: MapaViajeProps) {
  const mapRef        = useRef<HTMLDivElement>(null)
  const mapObj        = useRef<LeafletMap | null>(null)
  const userMarker    = useRef<LeafletMarker | null>(null)
  const destMarker    = useRef<LeafletMarker | null>(null)
  const routeLine     = useRef<{ remove: () => void } | null>(null)
  const stMarkers     = useRef<{ remove: () => void }[]>([])
  const centeredOnUser = useRef(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // ── Init map once ──────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !mapRef.current || mapObj.current) return

    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl

      const center: [number, number] = estaciones.length > 0
        ? [estaciones[0].latitud, estaciones[0].longitud]
        : [-12.1028, -76.9943]

      const map = L.map(mapRef.current!, {
        center,
        zoom: 15,
        zoomControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: 'topright' }).addTo(map)
      mapObj.current = map as unknown as LeafletMap

      // Add station markers (dim, tappable to set as destination)
      stMarkers.current.forEach(m => m.remove())
      stMarkers.current = []

      estaciones.forEach(est => {
        const pct = est.capacidad > 0 ? est.bicicletas_disponibles / est.capacidad : 0
        const color = pct === 0 ? '#ba1a1a' : pct < 0.25 ? '#f59e0b' : '#16a34a'

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:30px;height:30px;border-radius:50%;
            background:${color};opacity:0.55;
            border:2.5px solid rgba(255,255,255,0.7);
            box-shadow:0 1px 5px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:700;font-size:10px;">
            ${est.bicicletas_disponibles}
          </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })

        const m = L.marker([est.latitud, est.longitud], { icon }).addTo(map)
        if (onEstacionClick) m.on('click', () => onEstacionClick(est))
        stMarkers.current.push(m as unknown as { remove: () => void })
      })
    })()

    return () => {
      mapObj.current?.remove()
      mapObj.current = null
      centeredOnUser.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  // ── User location marker ─────────────────────────────────────
  useEffect(() => {
    if (!mounted || !mapObj.current || !userLocation) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const pos: [number, number] = [userLocation.lat, userLocation.lng]

      const icon = L.divIcon({
        className: '',
        html: `
          <style>@keyframes gpsPing{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.8);opacity:0}}</style>
          <div style="position:relative;width:22px;height:22px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.35);
              animation:gpsPing 1.8s ease-out infinite;"></div>
            <div style="position:absolute;inset:3px;border-radius:50%;background:#3b82f6;
              border:2.5px solid white;box-shadow:0 2px 8px rgba(59,130,246,.55);"></div>
          </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

      if (userMarker.current) {
        userMarker.current.setLatLng(pos)
      } else {
        const m = L.marker(pos, { icon, zIndexOffset: 1000 })
          .addTo(mapObj.current as unknown as import('leaflet').Map)
        userMarker.current = m as unknown as LeafletMarker
      }

      // Center on user only first time
      if (!centeredOnUser.current) {
        mapObj.current?.flyTo(pos, 16)
        centeredOnUser.current = true
      }
    })()
  }, [userLocation, mounted])

  // ── Destination marker + route line ─────────────────────────
  useEffect(() => {
    if (!mounted || !mapObj.current) return
    ;(async () => {
      const L = (await import('leaflet')).default

      // Remove old destination marker and route
      destMarker.current?.remove()
      destMarker.current = null
      routeLine.current?.remove()
      routeLine.current = null

      if (!destino) return

      const pos: [number, number] = [destino.latitud, destino.longitud]

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="
              background:#b2f746;border:3px solid #002117;border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);width:32px;height:32px;
              box-shadow:0 4px 12px rgba(0,0,0,.35);">
            </div>
          </div>`,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
      })

      const m = L.marker(pos, { icon, zIndexOffset: 900 })
        .addTo(mapObj.current as unknown as import('leaflet').Map)
        .bindPopup(`<b>${destino.nombre}</b><br>${destino.bicicletas_disponibles} bicis disponibles`)
      destMarker.current = m as unknown as LeafletMarker

      // Draw dashed route line from user to dest
      if (userLocation) {
        const line = L.polyline(
          [[userLocation.lat, userLocation.lng], pos],
          { color: '#003527', weight: 3, dashArray: '8 6', opacity: 0.65 }
        ).addTo(mapObj.current as unknown as import('leaflet').Map)
        routeLine.current = line as unknown as { remove: () => void }
      }

      mapObj.current?.flyTo(pos, 15)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino, mounted])

  if (!mounted) return (
    <div className="w-full h-full bg-surface-container flex items-center justify-center">
      <div className="text-outline text-sm animate-pulse">Iniciando mapa...</div>
    </div>
  )

  return <div ref={mapRef} className="w-full h-full" />
}
