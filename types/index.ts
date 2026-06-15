export type UsuarioRol = 'ciudadano' | 'operador' | 'tecnico'
export type UsuarioEstado = 'pendiente' | 'activo' | 'suspendido'
export type EstacionEstado = 'activa' | 'inactiva' | 'mantenimiento'
export type BicicletaEstado = 'disponible' | 'en_viaje' | 'mantenimiento' | 'baja'
export type ViajeEstado = 'activo' | 'finalizado' | 'cancelado'
export type IncidenciaTipo = 'frenos' | 'llanta' | 'cadena' | 'manillar' | 'asiento' | 'iluminacion' | 'electrico' | 'estructura' | 'otro'
export type IncidenciaEstado = 'pendiente' | 'en_revision' | 'resuelta' | 'descartada'
export type AlertaTipo = 'saturacion' | 'vacia' | 'mantenimiento_urgente' | 'bici_sin_retornar' | 'stock_bajo' | 'sistema'
export type AlertaNivel = 'info' | 'warning' | 'critica'

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
  qr_code: string
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
  distancia_km: number | null
  duracion_min: number | null
  bicicleta?: Bicicleta
  estacion_origen?: Estacion
  estacion_destino?: Estacion
}

export interface Incidencia {
  id: string
  bicicleta_id: string | null
  usuario_id: string | null
  estacion_id: string | null
  tipo: IncidenciaTipo
  descripcion: string | null
  foto_url: string | null
  estado: IncidenciaEstado
  mantenimiento_id: string | null
  created_at: string
  updated_at: string
  bicicleta?: Bicicleta
  estacion?: Estacion
  usuario?: Pick<Usuario, 'id' | 'nombre'>
}

export interface Alerta {
  id: string
  tipo: AlertaTipo
  nivel: AlertaNivel
  titulo: string
  mensaje: string | null
  estacion_id: string | null
  bicicleta_id: string | null
  leida: boolean
  resuelta: boolean
  created_at: string
  estacion?: Pick<Estacion, 'id' | 'nombre'>
  bicicleta?: Pick<Bicicleta, 'id' | 'codigo'>
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
