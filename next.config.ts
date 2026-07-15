import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  turbopack: {},
  experimental: {
    // Cachear segmentos visitados en el cliente: volver a un módulo
    // ya visitado no re-consulta el servidor durante 30s
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
}

export default nextConfig
