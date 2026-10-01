// Generadores de datos de ejemplo para el Modo Simulación: producen
// información con la MISMA forma que las APIs/consultas reales de cada
// pantalla, pero calculada al instante en el navegador — sin tocar la
// base de datos. Los ids llevan prefijo "demo-" para que nunca se
// puedan confundir con registros reales.

import type { AlertaTipo, IncidenciaTipo } from '@/types'

export const rand    = (a: number, b: number) => a + Math.random() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1))
const pick   = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Estaciones base reutilizadas por todas las pantallas (nombres reales
// de San Borja para que la demo se sienta coherente con el resto de la app).
const ESTACIONES_BASE = [
  { id: 'demo-e1', nombre: 'San Borja Norte',  direccion: 'Av. San Borja Norte, San Borja', lat: -12.09578,  lng: -76.989122, capacidad: 35 },
  { id: 'demo-e2', nombre: 'San Borja Sur',    direccion: 'Av. San Borja Sur, San Borja',    lat: -12.101107, lng: -77.001954, capacidad: 40 },
  { id: 'demo-e3', nombre: 'Angamos',          direccion: 'Av. Angamos Este, San Borja',     lat: -12.111848, lng: -77.0062,   capacidad: 20 },
  { id: 'demo-e4', nombre: 'Primavera',        direccion: 'Av. Primavera, San Borja',        lat: -12.111494, lng: -77.000019, capacidad: 30 },
  { id: 'demo-e5', nombre: 'Parque Sur',       direccion: 'Parque Sur, San Borja',           lat: -12.099038, lng: -77.010524, capacidad: 35 },
  { id: 'demo-e6', nombre: 'Pentagonito',      direccion: 'Av. Aviación, San Borja',         lat: -12.102622, lng: -76.99024,  capacidad: 15 },
  { id: 'demo-e7', nombre: 'Buena Vista',      direccion: 'Av. Buena Vista, San Borja',      lat: -12.103244, lng: -76.980446, capacidad: 35 },
  { id: 'demo-e8', nombre: 'Biblioteca',       direccion: 'Biblioteca Municipal, San Borja', lat: -12.086846, lng: -77.004137, capacidad: 25 },
]

const TECNICOS_DEMO = [
  { id: 'demo-t1', nombre: 'Jorge Castillo R.',   correo: 'jorge.demo@sanborjabici.pe' },
  { id: 'demo-t2', nombre: 'Milagros Vega S.',    correo: 'milagros.demo@sanborjabici.pe' },
  { id: 'demo-t3', nombre: 'Renzo Palacios T.',   correo: 'renzo.demo@sanborjabici.pe' },
]

const TIPO_INCIDENCIA: IncidenciaTipo[] = ['frenos', 'llanta', 'cadena', 'manillar', 'asiento', 'iluminacion', 'electrico', 'estructura']
const TIPO_LABEL: Record<string, string> = {
  frenos: 'Frenos', llanta: 'Llanta', cadena: 'Cadena', manillar: 'Manillar',
  asiento: 'Asiento', iluminacion: 'Iluminación', electrico: 'Eléctrico', estructura: 'Estructura',
}
const MODELOS_DEMO = ['Oyama Urban 100', 'Monark City Rider', 'BH Eco Move', 'Xiaomi E-Bike Pro', 'Segway Volt 250']

// ── Dashboard principal (/operador) ─────────────────────────────────
export function demoDashboard() {
  const estaciones = ESTACIONES_BASE.map(e => {
    const disp = randInt(0, e.capacidad)
    return {
      id: e.id, nombre: e.nombre, direccion: e.direccion,
      latitud: e.lat, longitud: e.lng, capacidad: e.capacidad,
      foto_url: null, estado: 'activa' as const, created_at: new Date().toISOString(),
      bicicletas_disponibles: disp,
    }
  })
  const bicisTotal = ESTACIONES_BASE.reduce((s, e) => s + e.capacidad, 0) + randInt(10, 30)
  const bicisDisponibles = estaciones.reduce((s, e) => s + e.bicicletas_disponibles, 0)
  const bicisEnViaje = randInt(8, 22)
  const viajesHoy = randInt(140, 190)
  const viajesAyer = randInt(120, 180)

  const alertas = Array.from({ length: 4 }).map((_, i) => {
    const est = pick(ESTACIONES_BASE)
    const nivel = pick(['critica', 'warning', 'info'] as const)
    const tipo: AlertaTipo = nivel === 'critica' ? 'vacia' : nivel === 'warning' ? 'stock_bajo' : 'sistema'
    return {
      id: `demo-a${i}`, tipo, nivel,
      titulo: nivel === 'critica' ? `Estación vacía: ${est.nombre}` : nivel === 'warning' ? `Stock bajo en ${est.nombre}` : 'Sincronización completada',
      mensaje: nivel === 'critica' ? 'Sin bicis disponibles. Reposición en camino.' : nivel === 'warning' ? `Solo ${randInt(1, 3)} bicis disponibles.` : 'Todos los sistemas funcionando con normalidad.',
      estacion_id: est.id, bicicleta_id: null, leida: false, resuelta: false,
      created_at: new Date(Date.now() - randInt(2, 90) * 60_000).toISOString(),
      estacion: { id: est.id, nombre: est.nombre },
    }
  })

  const viajesAnio = Array.from({ length: 220 }).map(() => ({
    inicio_at: new Date(Date.now() - randInt(0, 364) * 86_400_000).toISOString(),
    estacion_origen_id: pick(ESTACIONES_BASE).id,
    distancia_km: Math.round(rand(0.8, 5.5) * 10) / 10,
    duracion_min: randInt(4, 35),
  }))

  return {
    kpis: {
      bicisDisponibles, bicisTotal, bicisEnViaje,
      viajesHoy, viajesAyer, viajesActivos: randInt(3, 12),
      estacionesActivas: ESTACIONES_BASE.length,
      co2Ahorrado: Math.round(viajesHoy * 0.21 * 2.2 * 10) / 10,
    },
    estaciones, alertas, viajesAnio,
  }
}

// ── KPIs Estratégicos (/operador/kpis) ──────────────────────────────
const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export function demoKpis() {
  const viajesTotal = randInt(3200, 5200)
  const viajesPrev = Math.round(viajesTotal * rand(0.75, 0.95))
  const chartData = Array.from({ length: 14 }).map((_, i) => {
    const actual = randInt(130, 195)
    return { dia: DIAS_SEM[i % 7], actual, objetivo: Math.round(actual * rand(1.05, 1.2)) }
  })
  const estaciones = ESTACIONES_BASE.map(e => {
    const disponibilidad = randInt(5, 95)
    return {
      id: e.id, nombre: e.nombre, direccion: e.direccion, capacidad: e.capacidad,
      estadoCalc: (disponibilidad < 15 ? 'CRÍTICO' : 'DISPONIBLE') as 'DISPONIBLE' | 'CRÍTICO' | 'MANTENIMIENTO',
      disponibilidad, vHoy: randInt(8, 40), tendencia: Math.round(rand(-15, 25)),
      accion: disponibilidad < 15 ? 'Redistribuir bicis' : 'Monitorear',
    }
  })
  const topZonas = [...ESTACIONES_BASE].sort(() => Math.random() - 0.5).slice(0, 5)
    .map(e => ({ nombre: e.nombre, viajes: randInt(20, 90), pct: randInt(40, 100) }))
    .sort((a, b) => b.viajes - a.viajes)
  return {
    viajesTotal, viajesPrev, usuarios: randInt(220, 480),
    chartData, estaciones, topZonas,
  }
}

// ── Predicción de demanda (/operador/prediccion) ────────────────────
export function demoPrediccion() {
  const horaActual = new Date().getHours()
  const estaciones = ESTACIONES_BASE.map(e => {
    const por_hora = Array.from({ length: 24 }).map((_, h) => ({
      hora: h,
      demanda: h >= 6 && h <= 22 ? Math.round(rand(0.5, 6) * (h >= 7 && h <= 9 || h >= 17 && h <= 19 ? 1.8 : 1)) : 0,
    }))
    const demanda_dia = Math.round(por_hora.reduce((s, p) => s + p.demanda, 0))
    const bicis_actuales = randInt(0, e.capacidad)
    const demanda_restante = Math.round(por_hora.filter(p => p.hora >= horaActual).reduce((s, p) => s + p.demanda, 0))
    const faltan = Math.max(0, Math.round(demanda_restante - bicis_actuales))
    const hora_pico = por_hora.reduce((best, p) => p.demanda > best.demanda ? p : best, por_hora[0]).hora
    return {
      id: e.id, nombre: e.nombre, capacidad: e.capacidad, bicis_actuales,
      demanda_dia, demanda_restante, faltan, hora_pico,
      hora_agotamiento: faltan > 0 ? Math.min(22, horaActual + randInt(1, 4)) : null,
      por_hora, confianza: pick(['alta', 'media', 'baja'] as const),
    }
  })
  return {
    estaciones,
    metadatos: {
      total_viajes: randInt(8000, 12000), meses_historial: 6,
      fecha_prediccion: new Date().toISOString(), hora_actual: horaActual,
      dia_semana: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()],
      muestras_entreno: randInt(5000, 9000), estimadores: 40, es_dia_futuro: false,
      memoria: {
        dias: 30, precision: randInt(78, 94),
        serie: Array.from({ length: 7 }).map((_, i) => ({
          fecha: new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
          reales: randInt(140, 190), predichos: randInt(140, 190),
        })),
      },
    },
  }
}

// ── Fallas mecánicas (/operador/fallas) ─────────────────────────────
export function demoFallas() {
  const alertas = Array.from({ length: 9 }).map((_, i) => {
    const tipo = pick(TIPO_INCIDENCIA)
    const horasActiva = randInt(0, 30)
    const urgencia = (tipo === 'frenos' || tipo === 'electrico' || horasActiva >= 12) ? 'alta'
      : horasActiva >= 4 ? 'media' : 'baja'
    const est = pick(ESTACIONES_BASE)
    return {
      id: `demo-f${i}`, tipo, tipoLabel: TIPO_LABEL[tipo],
      descripcion: 'Reportado por un ciudadano durante el uso.',
      estado: 'pendiente' as const, horasActiva, urgencia: urgencia as 'alta' | 'media' | 'baja',
      bicicleta: { codigo: `BC-DEMO-${100 + i}`, marca: pick(['Oyama', 'Monark', 'BH', 'Xiaomi']), modelo: pick(['Urban 100', 'City Rider', 'Eco Move']) },
      estacion: { nombre: est.nombre },
    }
  }).sort((a, b) => (a.urgencia === 'alta' ? -1 : 1) - (b.urgencia === 'alta' ? -1 : 1))

  const conteoPorTipo = new Map<string, number>()
  for (const a of alertas) conteoPorTipo.set(a.tipoLabel, (conteoPorTipo.get(a.tipoLabel) ?? 0) + 1)
  const resumenDiagnostico = [...conteoPorTipo.entries()].map(([tipo, cantidad]) => ({ tipo, cantidad })).sort((a, b) => b.cantidad - a.cantidad)

  return {
    pctFlotaAfectada: Math.round(rand(4, 14) * 10) / 10,
    totalAlertas: alertas.length,
    alertasUrgentes: alertas.filter(a => a.urgencia === 'alta').length,
    resumenDiagnostico, alertas,
  }
}

// ── Tendencias de fallas (/operador/fallas/tendencias) ──────────────
export function demoTendenciasFallas() {
  const distribucionTipo = TIPO_INCIDENCIA.map(t => ({ tipo: TIPO_LABEL[t], cantidad: randInt(2, 22) }))
    .sort((a, b) => b.cantidad - a.cantidad)
  const tasaPorModelo = MODELOS_DEMO.map(modelo => ({ modelo, fallas: randInt(3, 28) }))
    .sort((a, b) => b.fallas - a.fallas)
  const problemasRecurrentes = Array.from({ length: 8 }).map(() => {
    const frecuencia = randInt(1, 9)
    const resueltas = randInt(0, frecuencia)
    return {
      tipo: TIPO_LABEL[pick(TIPO_INCIDENCIA)], modelo: pick(MODELOS_DEMO), frecuencia,
      prioridad: (frecuencia >= 5 ? 'critica' : frecuencia >= 3 ? 'alta' : 'media') as 'critica' | 'alta' | 'media',
      estado: (resueltas === frecuencia ? 'resuelto' : resueltas > 0 ? 'en_progreso' : 'pendiente') as 'resuelto' | 'en_progreso' | 'pendiente',
    }
  }).sort((a, b) => b.frecuencia - a.frecuencia)

  return {
    mesesHistorial: 6, totalFallas: distribucionTipo.reduce((s, d) => s + d.cantidad, 0),
    distribucionTipo, tasaPorModelo, problemasRecurrentes,
  }
}

// ── Stock óptimo (/operador/stock) ──────────────────────────────────
function estStockDemo() {
  return ESTACIONES_BASE.map(e => {
    const demanda_predicha = Math.round(rand(2, e.capacidad * 0.9))
    const bicis_actuales = randInt(0, e.capacidad)
    const diferencia = bicis_actuales - demanda_predicha
    const accion = (diferencia < -2 ? 'deficit' : diferencia > 3 ? 'surplus' : 'ok') as 'deficit' | 'surplus' | 'ok'
    return {
      id: e.id, nombre: e.nombre, capacidad: e.capacidad, bicis_actuales,
      demanda_predicha, diferencia, accion, confianza: pick(['alta', 'media', 'baja'] as const),
    }
  })
}
export const demoStock = estStockDemo

// ── Rutas de rebalanceo (/operador/rutas-rebalanceo) ────────────────
export function demoRutasRebalanceo() {
  const datos = estStockDemo()
  const estaciones = ESTACIONES_BASE.map(e => {
    const base = datos.find(d => d.id === e.id)!
    return {
      id: e.id, nombre: e.nombre, direccion: e.direccion,
      latitud: e.lat, longitud: e.lng, capacidad: e.capacidad,
      foto_url: null, estado: 'activa' as const, created_at: new Date().toISOString(),
      bicicletas_disponibles: base.bicis_actuales,
    }
  })
  const ordenes = TECNICOS_DEMO.slice(0, 2).map(t => ({
    tecnico_id: t.id,
    estado: pick(['pendiente', 'en_proceso', 'completada'] as const),
  })) as { tecnico_id: string; estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada' }[]
  return { datos, estaciones, tecnicos: TECNICOS_DEMO, ordenes }
}

// ── Alertas operativas (/operador/alertas) ──────────────────────────
export function demoAlertas() {
  const NIVELES = ['critica', 'warning', 'info'] as const
  const TIPOS = ['saturacion', 'vacia', 'mantenimiento_urgente', 'bici_sin_retornar', 'stock_bajo', 'sistema'] as const
  const alertas = Array.from({ length: 12 }).map((_, i) => {
    const nivel = pick(NIVELES)
    const tipo = pick(TIPOS)
    const est = pick(ESTACIONES_BASE)
    const leida = Math.random() < 0.3
    return {
      id: `demo-al${i}`, tipo, nivel,
      titulo: `${tipo === 'vacia' ? 'Estación vacía' : tipo === 'saturacion' ? 'Saturación' : tipo === 'stock_bajo' ? 'Stock bajo' : 'Alerta'} en ${est.nombre}`,
      mensaje: 'Generado automáticamente por el sistema de monitoreo.',
      estacion_id: est.id, bicicleta_id: null, leida, resuelta: false,
      created_at: new Date(Date.now() - randInt(5, 4000) * 60_000).toISOString(),
      estacion: { id: est.id, nombre: est.nombre },
    }
  })
  return {
    alertas,
    resumen: {
      criticas: alertas.filter(a => a.nivel === 'critica' && !a.leida).length,
      warnings: alertas.filter(a => a.nivel === 'warning' && !a.leida).length,
      resueltas: randInt(14, 40),
    },
  }
}
