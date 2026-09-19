// Rellena los huecos puntuales donde alguna estación quedó por debajo
// del piso de 20 viajes/día (la generación masiva anterior descartaba
// algún par origen=destino sin reponerlo). Detecta y corrige.
import { readFileSync } from 'fs'

const MIN_POR_ESTACION = 20
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL
const KEY    = env.SUPABASE_SERVICE_ROLE_KEY
const H      = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function sb(path, opts = {}) {
  const res = await fetch(`${URL_SB}/rest/v1/${path}`, { headers: H, ...opts })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const LIMA_OFFSET_H = 5
const rand    = (a, b) => a + Math.random() * (b - a)
const randInt = (a, b) => Math.floor(rand(a, b + 1))

function haversineKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
function horaSegunDia(esFinde) {
  const r = Math.random()
  if (!esFinde) {
    if (r < 0.35) return randInt(7, 9)
    if (r < 0.55) return randInt(12, 13)
    if (r < 0.90) return randInt(17, 19)
    return randInt(20, 21)
  }
  if (r < 0.10) return randInt(8, 9)
  if (r < 0.70) return randInt(10, 16)
  return randInt(17, 19)
}

async function main() {
  const desde = new Date('2026-07-17T05:00:00Z')
  const hasta = new Date()

  const estaciones = (await sb('estaciones?select=id,nombre,latitud,longitud&estado=eq.activa&order=nombre'))
    .map(e => ({ id: e.id, nombre: e.nombre, lat: e.latitud, lng: e.longitud }))
  const eMap = Object.fromEntries(estaciones.map(e => [e.id, e]))
  const bicis = await sb('bicicletas?select=id')
  const usuarios = await sb('usuarios?select=id,nombre&rol=eq.ciudadano&estado=eq.activo')
  const pesoPorNombre = {
    'prueba prueba': 1, 'María García': 20, 'paco martinez': 16, 'Alessander Zuloaga': 16,
    'Ana Flores Quispe': 18, 'Carlos Mendoza Rivas': 14, 'Lucía Torres Vargas': 16,
    'Diego Huamán Paredes': 12, 'Valeria Soto Chávez': 20, 'Sebastián Ríos Castillo': 11,
    'Camila Aguilar León': 17, 'Matías Delgado Fuentes': 13, 'Fernanda Núñez Cruz': 15,
    'Rafael Campos Vera': 10,
  }
  const plan = usuarios.map(u => ({ ...u, peso: pesoPorNombre[u.nombre] ?? 8 }))
  const totalPeso = plan.reduce((s, u) => s + u.peso, 0)
  function usuarioAl() {
    let r = Math.random() * totalPeso
    for (const u of plan) { r -= u.peso; if (r <= 0) return u }
    return plan[plan.length - 1]
  }

  let viajes = []
  for (let from = 0; from < 30000; from += 1000) {
    const data = await sb(`viajes?select=inicio_at,estacion_origen_id,estacion_destino_id&inicio_at=gte.2026-07-17T05:00:00Z&limit=1000&offset=${from}`)
    if (!data?.length) break
    viajes.push(...data)
    if (data.length < 1000) break
  }

  const porEstacionDia = {}
  const dias = new Set()
  for (const v of viajes) {
    const dia = new Date(new Date(v.inicio_at).getTime() - LIMA_OFFSET_H * 3_600_000).toISOString().slice(0, 10)
    dias.add(dia)
    for (const est of [v.estacion_origen_id, v.estacion_destino_id]) {
      const key = `${dia}|${est}`
      porEstacionDia[key] = (porEstacionDia[key] ?? 0) + 1
    }
  }

  // Detectar déficits
  const deficits = [] // { dia, estacion, faltan }
  for (const dia of dias) {
    for (const e of estaciones) {
      const c = porEstacionDia[`${dia}|${e.id}`] ?? 0
      if (c < MIN_POR_ESTACION) deficits.push({ dia, estacion: e, faltan: MIN_POR_ESTACION - c })
    }
  }
  console.log(`Estación/día bajo el piso: ${deficits.length}`)
  if (!deficits.length) { console.log('Todo en regla, nada que rellenar.'); return }

  const filas = []
  for (const { dia, estacion, faltan } of deficits) {
    const diaSemanaLima = new Date(`${dia}T00:00:00Z`).getUTCDay()
    const esFinde = diaSemanaLima === 0 || diaSemanaLima === 6
    for (let i = 0; i < faltan; i++) {
      // Alternar el hueco como origen o destino, emparejado con otra estación al azar
      let otra = estaciones[randInt(0, estaciones.length - 1)]
      while (otra.id === estacion.id) otra = estaciones[randInt(0, estaciones.length - 1)]
      const origen  = i % 2 === 0 ? estacion : otra
      const destino = i % 2 === 0 ? otra : estacion

      const horaLima = horaSegunDia(esFinde)
      const inicio = new Date(`${dia}T00:00:00Z`)
      inicio.setUTCHours(horaLima + LIMA_OFFSET_H, randInt(0, 59), 0, 0)
      if (inicio > hasta) continue

      const distanciaKm = Math.round(haversineKm(origen, destino) * rand(1.2, 1.5) * 100) / 100
      const velocidadKmh = rand(9, 15)
      const duracionMin = Math.max(3, Math.round(distanciaKm / velocidadKmh * 60 + rand(-2, 4)))
      const fin = new Date(inicio.getTime() + duracionMin * 60_000)
      const usuario = usuarioAl()

      filas.push({
        usuario_id: usuario.id,
        bicicleta_id: bicis[randInt(0, bicis.length - 1)].id,
        estacion_origen_id: origen.id,
        estacion_destino_id: destino.id,
        inicio_at: inicio.toISOString(),
        fin_at: fin.toISOString(),
        estado: 'finalizado',
        distancia_km: distanciaKm,
        duracion_min: duracionMin,
        calificacion: Math.random() < 0.7 ? randInt(3, 5) : null,
        _origen: origen, _destino: destino,
      })
    }
  }

  console.log(`Viajes de relleno a crear: ${filas.length}`)
  const CHUNK = 100
  let creados = 0
  for (let i = 0; i < filas.length; i += CHUNK) {
    const grupo = filas.slice(i, i + CHUNK)
    const payload = grupo.map(({ _origen, _destino, ...v }) => v)
    const insertados = await sb('viajes?select=id,inicio_at,duracion_min', {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
    const wpFilas = []
    insertados.forEach((v, idx) => {
      const { _origen: o, _destino: d } = grupo[idx]
      const durS = v.duracion_min * 60
      const inicioMs = new Date(v.inicio_at).getTime()
      for (let wp = 0; wp <= 5; wp++) {
        const t = wp / 5
        wpFilas.push({
          viaje_id: v.id,
          lat: o.lat + (d.lat - o.lat) * t + (wp > 0 && wp < 5 ? rand(-0.001, 0.001) : 0),
          lng: o.lng + (d.lng - o.lng) * t + (wp > 0 && wp < 5 ? rand(-0.001, 0.001) : 0),
          recorded_at: new Date(inicioMs + Math.round(durS * t) * 1000).toISOString(),
        })
      }
    })
    if (wpFilas.length) await sb('viaje_waypoints', { method: 'POST', body: JSON.stringify(wpFilas) })
    creados += insertados.length
    process.stdout.write(`\r${creados}/${filas.length}`)
  }
  console.log(`\nListo: ${creados} viajes de relleno creados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
