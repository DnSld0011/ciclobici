/**
 * Arte compartido para los íconos de la PWA (favicon, apple-icon, manifest).
 * Genera un badge circular lima sobre un fondo con degradado verde,
 * igual a la paleta del hero de login/registro.
 */
export function BikeIconArt({
  size,
  maskable = false,
  rounded = false,
}: {
  size: number
  maskable?: boolean
  rounded?: boolean
}) {
  // En maskable el OS recorta el lienzo; el badge debe vivir en la safe zone central.
  const badgeRatio = maskable ? 0.58 : 0.72
  const badge = size * badgeRatio
  const glyph = badge * 0.54

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #003527 0%, #064e3b 55%, #001a12 100%)',
        borderRadius: rounded ? size * 0.18 : 0,
        position: 'relative',
      }}
    >
      {/* glow decorativo, como en el hero de login */}
      <div
        style={{
          position: 'absolute',
          top: size * -0.12,
          right: size * -0.12,
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(178,247,70,0.35) 0%, rgba(178,247,70,0) 70%)',
        }}
      />

      {/* badge lima con la bici */}
      <div
        style={{
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #cdff7a 0%, #b2f746 100%)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#002117"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18.5" cy="17.5" r="3.5" />
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="15" cy="5" r="1" />
          <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
        </svg>
      </div>
    </div>
  )
}
