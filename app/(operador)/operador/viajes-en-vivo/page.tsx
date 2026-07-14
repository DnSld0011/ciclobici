import { redirect } from 'next/navigation'

// Módulo unificado con el Mapa en Tiempo Real (pestaña "Viajes activos")
export default function ViajesEnVivoRedirect() {
  redirect('/operador/mapa')
}
