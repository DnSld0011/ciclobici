import type { Metadata, Viewport } from 'next'
import { Manrope, Inter } from 'next/font/google'
import { RegisterSW } from '@/components/RegisterSW'
import { InstallPwaPrompt } from '@/components/InstallPwaPrompt'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'San Borja en Bici — CicloBici',
  description: 'Sistema municipal de bicicletas compartidas en San Borja, Lima',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SB Bici',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#003527',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${inter.variable} font-sans bg-surface text-on-surface antialiased`}>
        {children}
        <RegisterSW />
        <InstallPwaPrompt />
      </body>
    </html>
  )
}
