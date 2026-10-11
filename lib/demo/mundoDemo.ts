// "Mundo" único de la simulación: una sola verdad (stock, demanda por hora,
// técnicos) que TODAS las pantallas leen, para que los números cuenten la
// misma historia sin importar por dónde entres. Se genera una vez y se
// guarda en localStorage — persiste mientras el Modo Simulación siga
// activo, y se puede regenerar a pedido ("Recalcular algoritmo").
// También guarda, en el mismo storage del navegador, las órdenes de
// traslado "creadas" en modo demo, para que un técnico que también activa
// la simulación (en el mismo navegador) vea lo que el operador le asignó.

export const rand    = (a: number, b: number) => a + Math.random() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1))
export const pick    = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export const ESTACIONES_BASE = [
  { id: 'demo-e1', nombre: 'San Borja Norte',  direccion: 'Av. San Borja Norte, San Borja', lat: -12.09578,  lng: -76.989122, capacidad: 35 },
  { id: 'demo-e2', nombre: 'San Borja Sur',    direccion: 'Av. San Borja Sur, San Borja',    lat: -12.101107, lng: -77.001954, capacidad: 40 },
  { id: 'demo-e3', nombre: 'Angamos',          direccion: 'Av. Angamos Este, San Borja',     lat: -12.111848, lng: -77.0062,   capacidad: 20 },
  { id: 'demo-e4', nombre: 'Primavera',        direccion: 'Av. Primavera, San Borja',        lat: -12.111494, lng: -77.000019, capacidad: 30 },
  { id: 'demo-e5', nombre: 'Parque Sur',       direccion: 'Parque Sur, San Borja',           lat: -12.099038, lng: -77.010524, capacidad: 35 },
  { id: 'demo-e6', nombre: 'Pentagonito',      direccion: 'Av. Aviación, San Borja',         lat: -12.102622, lng: -76.99024,  capacidad: 15 },
  { id: 'demo-e7', nombre: 'Buena Vista',      direccion: 'Av. Buena Vista, San Borja',      lat: -12.103244, lng: -76.980446, capacidad: 35 },
  { id: 'demo-e8', nombre: 'Biblioteca',       direccion: 'Biblioteca Municipal, San Borja', lat: -12.086846, lng: -77.004137, capacidad: 25 },
]

export const TECNICOS_DEMO = [
  { id: 'demo-t1', nombre: 'Jorge Castillo R.',   correo: 'jorge.demo@sanborjabici.pe' },
  { id: 'demo-t2', nombre: 'Milagros Vega S.',    correo: 'milagros.demo@sanborjabici.pe' },
  { id: 'demo-t3', nombre: 'Renzo Palacios T.',   correo: 'renzo.demo@sanborjabici.pe' },
]

export interface EstacionMundo {
  id: string; nombre: string; direccion: string; lat: number; lng: number; capacidad: number
  bicis_actuales: number
  por_hora: { hora: number; demanda: number }[]
}

export interface MundoDemo {
  estaciones: EstacionMundo[]
  tecnicos: typeof TECNICOS_DEMO
  generadoEn: number
}

const MUNDO_KEY = 'sbb:mundo-simulacion'

function construirMundo(): MundoDemo {
  const estaciones: EstacionMundo[] = ESTACIONES_BASE.map((e, i) => {
    // Curva horaria realista: pico mañana (7-9), almuerzo (12-13), pico tarde (17-19)
    const por_hora = Array.from({ length: 24 }).map((_, h) => {
      let base = 0
      if (h >= 7 && h <= 9) base = rand(3, 7)
      else if (h >= 12 && h <= 13) base = rand(1.5, 3.5)
      else if (h >= 17 && h <= 19) base = rand(3, 7)
      else if (h >= 6 && h <= 22) base = rand(0.3, 1.5)
      return { hora: h, demanda: Math.round(base * 10) / 10 }
    })
    // La mitad de las estaciones (alternadas) arrancan con poco stock, para
    // que siempre haya déficits reales que mostrar — no es 50/50 azaroso
    // cada vez, es parte del guion de la demo.
    const factorStock = i % 2 === 0 ? rand(0.05, 0.25) : rand(0.4, 0.95)
    const bicis_actuales = Math.max(0, Math.round(e.capacidad * factorStock))
    return { ...e, bicis_actuales, por_hora }
  })
  return { estaciones, tecnicos: TECNICOS_DEMO, generadoEn: Date.now() }
}

let mundoCache: MundoDemo | null = null

export function obtenerMundo(): MundoDemo {
  if (mundoCache) return mundoCache
  try {
    const raw = localStorage.getItem(MUNDO_KEY)
    if (raw) { mundoCache = JSON.parse(raw) as MundoDemo; return mundoCache }
  } catch { /* noop */ }
  mundoCache = construirMundo()
  try { localStorage.setItem(MUNDO_KEY, JSON.stringify(mundoCache)) } catch { /* noop */ }
  return mundoCache
}

export function regenerarMundo(): MundoDemo {
  mundoCache = construirMundo()
  try { localStorage.setItem(MUNDO_KEY, JSON.stringify(mundoCache)) } catch { /* noop */ }
  return mundoCache
}

// ── Órdenes de traslado "creadas" en modo demo ──────────────────────
// Persistidas en localStorage (no en la base real) para que, en el mismo
// navegador, un técnico con el Modo Simulación activo vea lo que el
// operador le acaba de asignar.

export interface TrasladoDemo {
  id: string
  estacion_origen_id: string | null
  estacion_destino_id: string
  origen_nombre: string
  origen_direccion: string
  destino_nombre: string
  destino_direccion: string
  cantidad: number
  bicis_trasladadas: number
  tecnico_id: string
  tecnico_nombre: string
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'
  notas: string | null
  fecha_objetivo: string | null
  created_at: string
}

const TRASLADOS_KEY = 'sbb:traslados-simulacion'

export function obtenerTrasladosDemo(): TrasladoDemo[] {
  try {
    const raw = localStorage.getItem(TRASLADOS_KEY)
    return raw ? (JSON.parse(raw) as TrasladoDemo[]) : []
  } catch { return [] }
}

function guardarTrasladosDemo(lista: TrasladoDemo[]) {
  try { localStorage.setItem(TRASLADOS_KEY, JSON.stringify(lista)) } catch { /* noop */ }
}

export function agregarTrasladosDemo(
  nuevas: Omit<TrasladoDemo, 'id' | 'bicis_trasladadas' | 'estado' | 'created_at'>[]
): TrasladoDemo[] {
  const creadas: TrasladoDemo[] = nuevas.map(n => ({
    ...n,
    id: `demo-ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    bicis_trasladadas: 0,
    estado: 'pendiente',
    created_at: new Date().toISOString(),
  }))
  guardarTrasladosDemo([...obtenerTrasladosDemo(), ...creadas])
  return creadas
}

export function actualizarTrasladoDemo(id: string, cambios: Partial<TrasladoDemo>) {
  const lista = obtenerTrasladosDemo()
  const idx = lista.findIndex(o => o.id === id)
  if (idx === -1) return
  lista[idx] = { ...lista[idx], ...cambios }
  guardarTrasladosDemo(lista)
}

// Se llama al desactivar el Modo Simulación o al "Recalcular algoritmo":
// arranca un escenario limpio la próxima vez que se consulte el mundo.
export function limpiarSimulacionDemo() {
  mundoCache = null
  try {
    localStorage.removeItem(MUNDO_KEY)
    localStorage.removeItem(TRASLADOS_KEY)
  } catch { /* noop */ }
}
