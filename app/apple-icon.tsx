import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS aplica su propia máscara/esquinas: el ícono debe llenar
// el lienzo completo, sin bordes redondeados ni transparencia.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#003527',
        }}
      >
        <svg
          width={112}
          height={112}
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
    { ...size }
  )
}
