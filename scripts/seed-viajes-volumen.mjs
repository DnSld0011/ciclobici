// Genera viajes garantizando un PISO real por día: cada estación activa
// participa (como origen o destino) en al menos MIN_POR_ESTACION viajes,
// lo que fuerza un volumen diario de ~150-175 viajes en total (15
// estaciones activas * 20 touches / 2 touches por viaje ≈ 150 mínimo).
// Se suma sobre lo que ya existe en el rango (no reemplaza nada).
// Uso:
//   node scripts/seed-viajes-volumen.mjs --dry-run   (solo calcula y muestra números)
//   node scripts/seed-viajes-volumen.mjs             (inserta de verdad)
import { readFileSync } from 'fs'

const DRY_RUN = process.argv.includes('--dry-run')
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

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

// Arma los pares origen/destino de un día garantizando que cada estación
// llegue al piso de touches (origen+destino), y reparte el resto con
// sesgo de popularidad hacia las primeras estaciones.
function construirDiaParejas(estaciones) {
  const n = estaciones.length
  const targetTrips = randInt(150, 175)
  const totalTouches = targetTrips * 2
  const touches = estaciones.map(() => MIN_POR_ESTACION)
  let restante = totalTouches - MIN_POR_ESTACION * n
  while (restante > 0) {
    const pos = Math.min(n - 1, Math.floor(Math.random() ** 1.5 * n))
    touches[pos]++
    restante--
  }

  const origenPool = [], destinoPool = []
  estaciones.forEach((e, i) => {
    const oCount = Math.round(touches[i] * rand(0.4, 0.6))
    const dCount = touches[i] - oCount
    for (let k = 0; k < oCount; k++) origenPool.push(e)
    for (let k = 0; k < dCount; k++) destinoPool.push(e)
  })
  shuffle(origenPool)
  shuffle(destinoPool)
  while (origenPool.length < destinoPool.length) origenPool.push(estaciones[randInt(0, n - 1)])
  while (destinoPool.length < origenPool.length) destinoPool.push(estaciones[randInt(0, n - 1)])

  const pares = []
  for (let i = 0; i < origenPool.length; i++) {
    let o = origenPool[i], d = destinoPool[i]
    if (o.id === d.id) {
      const j = (i + 1) % destinoPool.length
      ;[destinoPool[i], destinoPool[j]] = [destinoPool[j], destinoPool[i]]
      d = destinoPool[i]
      if (o.id === d.id) continue
    }
    pares.push({ origen: o, destino: d })
  }
  return pares
}

function pickUsuarioPonderado(plan, totalPeso) {
  let r = Math.random() * totalPeso
  for (const u of plan) {
    r -= u.peso
    if (r <= 0) return u
  }
  return plan[plan.length - 1]
}

async function main() {
  const desde = new Date('2026-07-17T05:00:00Z')
  const hasta = new Date()
  const dias = Math.max(1, Math.ceil((hasta - desde) / 86_400_000))
  console.log(`Rango: ${desde.toISOString().slice(0, 10)} → ${hasta.toISOString().slice(0, 10)} (${dias} días) · piso ${MIN_POR_ESTACION}/estación/día`)

  const estaciones = (await sb('estaciones?select=id,nombre,latitud,longitud&estado=eq.activa&order=nombre'))
    .map(e => ({ id: e.id, nombre: e.nombre, lat: e.latitud, lng: e.longitud }))
  const bicis = await sb('bicicletas?select=id')
  const usuarios = await sb('usuarios?select=id,nombre&rol=eq.ciudadano&estado=eq.activo')

  const pesoPorNombre = {
    'prueba prueba': 1,
    'María García': 20, 'paco martinez': 16, 'Alessander Zuloaga': 16,
    'Ana Flores Quispe': 18, 'Carlos Mendoza Rivas': 14, 'Lucía Torres Vargas': 16,
    'Diego Huamán Paredes': 12, 'Valeria Soto Chávez': 20, 'Sebastián Ríos Castillo': 11,
    'Camila Aguilar León': 17, 'Matías Delgado Fuentes': 13, 'Fernanda Núñez Cruz': 15,
    'Rafael Campos Vera': 10,
  }
  const plan = usuarios.map(u => ({ ...u, peso: pesoPorNombre[u.nombre] ?? 8 }))
  const totalPeso = plan.reduce((s, u) => s + u.peso, 0)

  console.log(`Estaciones activas: ${estaciones.length} · usuarios: ${usuarios.length} · bicis: ${bicis.length}`)

  const filas = []
  for (let dia = 0; dia < dias; dia++) {
    const fecha = new Date(desde)
    fecha.setUTCDate(fecha.getUTCDate() + dia)
    const diaSemanaLima = new Date(fecha.getTime() - LIMA_OFFSET_H * 3_600_000).getUTCDay()
    const esFinde = diaSemanaLima === 0 || diaSemanaLima === 6

    const pares = construirDiaParejas(estaciones)
    for (const { origen, destino } of pares) {
      const horaLima = horaSegunDia(esFinde)
      const inicio = new Date(fecha)
      inicio.setUTCHours(horaLima + LIMA_OFFSET_H, randInt(0, 59), 0, 0)
      if (inicio > hasta) continue

      const distanciaKm = Math.round(haversineKm(origen, destino) * rand(1.2, 1.5) * 100) / 100
      const velocidadKmh = rand(9, 15)
      const duracionMin = Math.max(3, Math.round(distanciaKm / velocidadKmh * 60 + rand(-2, 4)))
      const fin = new Date(inicio.getTime() + duracionMin * 60_000)
      const usuario = pickUsuarioPonderado(plan, totalPeso)

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

  console.log(`Viajes a crear: ${filas.length} (~${Math.round(filas.length / dias)}/día)`)
  if (DRY_RUN) { console.log('Dry run — no se insertó nada.'); return }

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
    await sb('viaje_waypoints', { method: 'POST', body: JSON.stringify(wpFilas) })

    creados += insertados.length
    process.stdout.write(`\r${creados}/${filas.length} viajes creados`)
  }
  console.log(`\nListo: ${creados} viajes creados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
