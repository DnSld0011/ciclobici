import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'San Borja en Bici',
    short_name: 'SB Bici',
    description: 'Sistema municipal de bicicletas compartidas en San Borja, Lima',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f9ff',
    theme_color: '#003527',
    icons: [
      { src: '/api/pwa-icon?size=192',              sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/pwa-icon?size=512',               sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/pwa-icon?size=512&maskable=1',     sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
