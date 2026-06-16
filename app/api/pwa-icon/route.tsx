import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { BikeIconArt } from '@/lib/pwa-icon-art'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const size = Math.min(Math.max(parseInt(searchParams.get('size') ?? '512', 10) || 512, 48), 1024)
  const maskable = searchParams.get('maskable') === '1'

  return new ImageResponse(
    <BikeIconArt size={size} maskable={maskable} />,
    { width: size, height: size }
  )
}
