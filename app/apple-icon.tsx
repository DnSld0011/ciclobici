import { ImageResponse } from 'next/og'
import { BikeIconArt } from '@/lib/pwa-icon-art'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS aplica su propia máscara/esquinas: el lienzo debe llegar lleno hasta el borde.
export default function AppleIcon() {
  return new ImageResponse(<BikeIconArt size={180} />, { ...size })
}
