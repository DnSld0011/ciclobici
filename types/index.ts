export type UsuarioRol = 'ciudadano' | 'operador' | 'tecnico'
export type UsuarioEstado = 'pendiente' | 'activo' | 'suspendido'
export type EstacionEstado = 'activa' | 'inactiva' | 'mantenimiento'
export type BicicletaEstado = 'disponible' | 'en_viaje' | 'mantenimiento' | 'baja'
export type ViajeEstado = 'activo' | 'finalizado' | 'cancelado'

export interface Usuario {
  id: string
  nombre: string
  documento: string
  correo: string
  celular: string
  estado: UsuarioEstado
  rol: UsuarioRol
  created_at: string
}

export interface Estacion {
  id: string
  nombre: string
  direccion: string
  latitud: number
  longitud: number
  capacidad: number
  foto_url: string | null
  estado: EstacionEstado
  created_at: string
  bicicletas_disponibles?: number
}

export interface Bicicleta {
  id: string
  codigo: string
  tipo: string
  marca: string | null
  modelo: string | null
  qr_url: string | null
  estado: BicicletaEstado
  estacion_id: string | null
  created_at: string
  estacion?: Estacion
}

export interface Mantenimiento {
  id: string
  bicicleta_id: string
  tipo_intervencion: string
  descripcion: string | null
  responsable: string
  fecha: string
  created_at: string
  bicicleta?: Bicicleta
}

export interface Viaje {
  id: string
  usuario_id: string | null
  bicicleta_id: string | null
  estacion_origen_id: string | null
  estacion_destino_id: string | null
  inicio_at: string
  fin_at: string | null
  estado: ViajeEstado
}

export interface PrediccionHora {
  hora: number
  demanda_estimada: number
  capacidad: number
  estacion_nombre: string
}

export interface EstacionConDisponibilidad extends Estacion {
  bicicletas_disponibles: number
}
