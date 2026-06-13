export function generarCodigoBicicleta(secuencial: number): string {
  const hoy = new Date()
  const yyyy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  const seq = String(secuencial).padStart(4, '0')
  return `BC-${yyyy}${mm}${dd}-${seq}`
}

export function validarCelularPeruano(celular: string): boolean {
  return /^9[0-9]{8}$/.test(celular)
}

export function validarDocumento(documento: string): boolean {
  return /^[0-9]{6,12}$/.test(documento)
}

export function validarCoordenadas(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}
