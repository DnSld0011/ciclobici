import { ImageResponse } from 'next/og'
import { BikeIconArt } from '@/lib/pwa-icon-art'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(<BikeIconArt size={192} rounded />, { ...size })
}
