import { NextResponse } from 'next/server'
import { getUserAccess } from '@/lib/server/getUserAccess'

// Devuelve las vistas permitidas usando la misma lógica que el middleware
// (fallbacks por rol + vistas core), para que el menú y los guards coincidan.
export async function GET() {
  try {
    const access = await getUserAccess()
    return NextResponse.json({ vistas: access?.vistas ?? [] })
  } catch {
    return NextResponse.json({ vistas: [] })
  }
}
