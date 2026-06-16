import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const size = Math.min(Math.max(parseInt(searchParams.get('size') ?? '512', 10) || 512, 48), 1024)
  const maskable = searchParams.get('maskable') === '1'

  // En íconos maskable el OS recorta el lienzo; el contenido debe vivir
  // en la "safe zone" central (~66%), el fondo siempre llena el 100%.
  const pad = maskable ? size * 0.22 : size * 0.16
  const glyph = size - pad * 2

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#003527',
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#b2f746"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18.5" cy="17.5" r="3.5" />
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="15" cy="5" r="1" />
          <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
