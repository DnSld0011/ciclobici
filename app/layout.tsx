import type { Metadata } from 'next'
import { Manrope, Inter } from 'next/font/google'
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${inter.variable} font-sans bg-surface text-on-surface antialiased`}>
        {children}
      </body>
    </html>
  )
}
