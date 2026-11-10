// Generadores de datos de ejemplo para el Modo Simulación: producen
// información con la MISMA forma que las APIs/consultas reales de cada
// pantalla, pero calculada al instante en el navegador a partir del
// "mundo" único (lib/demo/mundoDemo.ts) — así los números cuentan la
// misma historia en todas las pantallas. Los ids llevan prefijo "demo-"
// para que nunca se puedan confundir con registros reales.

import type { AlertaTipo, IncidenciaTipo } from '@/types'
import { ESTACIONES_BASE, TECNICOS_DEMO, obtenerMundo, rand, randInt, pick } from './mundoDemo'

const TIPO_INCIDENCIA: IncidenciaTipo[] = ['frenos', 'llanta', 'cadena', 'manillar', 'asiento', 'iluminacion', 'electrico', 'estructura']
const TIPO_LABEL: Record<string, string> = {
  frenos: 'Frenos', llanta: 'Llanta', cadena: 'Cadena', manillar: 'Manillar',
  asiento: 'Asiento', iluminacion: 'Iluminación', electrico: 'Eléctrico', estructura: 'Estructura',
}
const MODELOS_DEMO = ['Oyama Urban 100', 'Monark City Rider', 'BH Eco Move', 'Xiaomi E-Bike Pro', 'Segway Volt 250']

function horaLima() {
  return new Date(Date.now() - 5 * 3_600_000).getHours()
}

// ── Dashboard principal (/operador) ─────────────────────────────────
export function demoDashboard() {
  const mundo = obtenerMundo()
  const horaActual = horaLima()

  const estaciones = mundo.estaciones.map(e => ({
    id: e.id, nombre: e.nombre, direccion: e.direccion,
    latitud: e.lat, longitud: e.lng, capacidad: e.capacidad,
    foto_url: null, estado: 'activa' as const, created_at: new Date().toISOString(),
    bicicletas_disponibles: e.bicis_actuales,
  }))

  const bicisTotal = mundo.estaciones.reduce((s, e) => s + e.capacidad, 0) + randInt(10, 30)
  const bicisDisponibles = mundo.estaciones.reduce((s, e) => s + e.bicis_actuales, 0)
  const demandaHoyTotal = mundo.estaciones.reduce(
    (s, e) => s + e.por_hora.filter(p => p.hora <= horaActual).reduce((a, p) => a + p.demanda, 0), 0
  )
  const viajesHoy = Math.max(8, Math.round(demandaHoyTotal))
  const viajesAyer = Math.max(6, Math.round(viajesHoy * rand(0.75, 1.15)))

  // Estaciones realmente en déficit del mundo → alertas coherentes con el resto de pantallas
  const vacias = mundo.estaciones.filter(e => e.bicis_actuales === 0)
  const bajas  = mundo.estaciones.filter(e => e.bicis_actuales > 0 && e.bicis_actuales / e.capacidad <= 0.2)
  const alertas: { id: string; tipo: AlertaTipo; nivel: 'critica' | 'warning' | 'info'; titulo: string; mensaje: string; estacion_id: string | null; bicicleta_id: null; leida: boolean; resuelta: boolean; created_at: string; estacion?: { id: string; nombre: string } }[] = []
  for (const e of vacias.slice(0, 2)) {
    alertas.push({
      id: `demo-a-vacia-${e.id}`, tipo: 'vacia', nivel: 'critica',
      titulo: `Estación vacía: ${e.nombre}`, mensaje: 'Sin bicis disponibles. Reposición recomendada.',
      estacion_id: e.id, bicicleta_id: null, leida: false, resuelta: false,
      created_at: new Date(Date.now() - randInt(2, 90) * 60_000).toISOString(),
      estacion: { id: e.id, nombre: e.nombre },
    })
  }
  for (const e of bajas.slice(0, 2)) {
    alertas.push({
      id: `demo-a-baja-${e.id}`, tipo: 'stock_bajo', nivel: 'warning',
      titulo: `Stock bajo en ${e.nombre}`, mensaje: `Solo ${e.bicis_actuales} bici(s) disponible(s).`,
      estacion_id: e.id, bicicleta_id: null, leida: false, resuelta: false,
      created_at: new Date(Date.now() - randInt(2, 90) * 60_000).toISOString(),
      estacion: { id: e.id, nombre: e.nombre },
    })
  }
  while (alertas.length < 4) {
    alertas.push({
      id: `demo-a-ok-${alertas.length}`, tipo: 'sistema', nivel: 'info',
      titulo: 'Sincronización completada', mensaje: 'Todos los sistemas funcionando con normalidad.',
      estacion_id: null, bicicleta_id: null, leida: false, resuelta: false,
      created_at: new Date(Date.now() - randInt(2, 90) * 60_000).toISOString(),
    })
  }

  // Viajes de hoy: uno por cada unidad de demanda ya transcurrida de cada
  // estación (para que el gráfico "por hora" de hoy tenga datos reales),
  // más una cola histórica de los últimos 12 meses para KPIs/histórico anual.
  const viajesAnio: { inicio_at: string; estacion_origen_id: string | null; distancia_km: number; duracion_min: number }[] = []
  const hoyLima = new Date(Date.now() - 5 * 3_600_000)
  hoyLima.setHours(0, 0, 0, 0)
  for (const e of mundo.estaciones) {
    for (const p of e.por_hora) {
      if (p.hora > horaActual) continue
      const n = Math.round(p.demanda)
      for (let i = 0; i < n; i++) {
        const t = new Date(hoyLima.getTime() + p.hora * 3_600_000 + randInt(0, 59) * 60_000 + 5 * 3_600_000)
        viajesAnio.push({
          inicio_at: t.toISOString(), estacion_origen_id: e.id,
          distancia_km: Math.round(rand(0.8, 5.5) * 10) / 10, duracion_min: randInt(4, 35),
        })
      }
    }
  }
  const diasHistoria = 364
  const totalHistorico = randInt(12000, 17000)
  for (let i = 0; i < totalHistorico; i++) {
    const dia = randInt(1, diasHistoria)
    const hora = randInt(5, 22)
    const t = new Date(hoyLima.getTime() - dia * 86_400_000 + hora * 3_600_000 + randInt(0, 59) * 60_000 + 5 * 3_600_000)
    viajesAnio.push({
      inicio_at: t.toISOString(), estacion_origen_id: pick(mundo.estaciones).id,
      distancia_km: Math.round(rand(0.8, 5.5) * 10) / 10, duracion_min: randInt(4, 35),
    })
  }

  return {
    kpis: {
      bicisDisponibles, bicisTotal, bicisEnViaje: randInt(8, 22),
      viajesHoy, viajesAyer, viajesActivos: randInt(3, 12),
      estacionesActivas: mundo.estaciones.length,
      co2Ahorrado: Math.round(viajesHoy * 0.21 * 2.2 * 10) / 10,
    },
    estaciones, alertas, viajesAnio,
  }
}

// ── KPIs Estratégicos (/operador/kpis) ──────────────────────────────
const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export function demoKpis() {
  const mundo = obtenerMundo()
  const horaActual = horaLima()
  const viajesTotal = randInt(3200, 5200)
  const viajesPrev = Math.round(viajesTotal * rand(0.75, 0.95))
  const chartData = Array.from({ length: 14 }).map((_, i) => {
    const actual = randInt(130, 195)
    return { dia: DIAS_SEM[i % 7], actual, objetivo: Math.round(actual * rand(1.05, 1.2)) }
  })
  const estaciones = mundo.estaciones.map(e => {
    const disponibilidad = e.capacidad > 0 ? Math.round((e.bicis_actuales / e.capacidad) * 100) : 0
    const vHoy = Math.round(e.por_hora.filter(p => p.hora <= horaActual).reduce((s, p) => s + p.demanda, 0))
    return {
      id: e.id, nombre: e.nombre, direccion: e.direccion, capacidad: e.capacidad,
      estadoCalc: (disponibilidad < 15 ? 'CRÍTICO' : 'DISPONIBLE') as 'DISPONIBLE' | 'CRÍTICO' | 'MANTENIMIENTO',
      disponibilidad, vHoy, tendencia: disponibilidad > 60 ? Math.round(rand(8, 20)) : disponibilidad < 20 ? -Math.round(rand(15, 25)) : 0,
      accion: disponibilidad < 15 ? 'Redistribuir bicis' : 'Monitorear',
    }
  })
  const topZonas = [...estaciones].sort((a, b) => b.vHoy - a.vHoy).slice(0, 5)
    .map(e => ({ nombre: e.nombre, viajes: e.vHoy, pct: Math.round((e.vHoy / Math.max(1, estaciones[0].vHoy)) * 100) }))
  return {
    viajesTotal, viajesPrev, usuarios: randInt(220, 480),
    chartData, estaciones, topZonas,
  }
}

// ── Predicción de demanda (/operador/prediccion) ────────────────────
export function demoPrediccion() {
  const mundo = obtenerMundo()
  const horaActual = horaLima()
  const estaciones = mundo.estaciones.map(e => {
    const demanda_dia = Math.round(e.por_hora.reduce((s, p) => s + p.demanda, 0))
    const demanda_restante = Math.round(e.por_hora.filter(p => p.hora >= horaActual).reduce((s, p) => s + p.demanda, 0))
    const faltan = Math.max(0, Math.round(demanda_restante - e.bicis_actuales))
    const hora_pico = e.por_hora.reduce((best, p) => p.demanda > best.demanda ? p : best, e.por_hora[0]).hora
    return {
      id: e.id, nombre: e.nombre, capacidad: e.capacidad, bicis_actuales: e.bicis_actuales,
      demanda_dia, demanda_restante, faltan, hora_pico,
      hora_agotamiento: faltan > 0 ? Math.min(22, horaActual + randInt(1, 4)) : null,
      por_hora: e.por_hora, confianza: pick(['alta', 'media', 'baja'] as const),
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

// ── Stock óptimo (próximas 2h, mismo mundo) ─────────────────────────
function estStockDemo() {
  const mundo = obtenerMundo()
  const horaActual = horaLima()
  return mundo.estaciones.map(e => {
    const demanda2h = Math.round(
      e.por_hora.filter(p => p.hora >= horaActual && p.hora < horaActual + 2).reduce((s, p) => s + p.demanda, 0)
    )
    // Si la estación ya está críticamente baja de stock, igual cuenta como
    // demanda a cubrir ahora aunque las próximas 2h de tránsito sean pocas
    // — evita que la simulación dependa de la hora del día para tener algo
    // concreto que mostrar en rutas de rebalanceo.
    const stockPct = e.capacidad > 0 ? e.bicis_actuales / e.capacidad : 1
    const pisoCritico = stockPct <= 0.2 ? Math.max(3, Math.ceil(e.capacidad * 0.2)) : 0
    const demanda_predicha = Math.max(1, demanda2h, pisoCritico)
    // Mismo signo que /api/prediccion/todas: positivo = falta stock (deficit),
    // negativo = exceso de bicis (surplus) — la UI de /operador/stock asume esta convención.
    const diferencia = demanda_predicha - e.bicis_actuales
    const accion = (diferencia > 1 ? 'deficit' : diferencia < -2 ? 'surplus' : 'ok') as 'deficit' | 'surplus' | 'ok'
    return {
      id: e.id, nombre: e.nombre, capacidad: e.capacidad, bicis_actuales: e.bicis_actuales,
      demanda_predicha, diferencia, accion, confianza: pick(['alta', 'media', 'baja'] as const),
    }
  })
}
export const demoStock = estStockDemo

// ── Rutas de rebalanceo (/operador/rutas-rebalanceo) ────────────────
export function demoRutasRebalanceo() {
  const mundo = obtenerMundo()
  const datos = estStockDemo()
  const estaciones = mundo.estaciones.map(e => ({
    id: e.id, nombre: e.nombre, direccion: e.direccion,
    latitud: e.lat, longitud: e.lng, capacidad: e.capacidad,
    foto_url: null, estado: 'activa' as const, created_at: new Date().toISOString(),
    bicicletas_disponibles: e.bicis_actuales,
  }))
  const ordenes = mundo.tecnicos.slice(0, 2).map(t => ({
    tecnico_id: t.id,
    estado: pick(['pendiente', 'en_proceso', 'completada'] as const),
  })) as { tecnico_id: string; estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada' }[]
  return { datos, estaciones, tecnicos: mundo.tecnicos, ordenes }
}

// ── Alertas operativas (/operador/alertas) ──────────────────────────
export function demoAlertas() {
  const mundo = obtenerMundo()
  const NIVELES = ['critica', 'warning', 'info'] as const
  const TIPOS = ['saturacion', 'vacia', 'mantenimiento_urgente', 'bici_sin_retornar', 'stock_bajo', 'sistema'] as const
  const alertas = Array.from({ length: 12 }).map((_, i) => {
    const nivel = pick(NIVELES)
    const tipo = pick(TIPOS)
    const est = pick(mundo.estaciones)
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

export { TECNICOS_DEMO }
