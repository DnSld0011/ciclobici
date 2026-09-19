// Genera ~200 viajes realistas de los ciudadanos reales, cubriendo el
// hueco entre el último viaje existente y hoy (histórico completado,
// no viajes activos). Usuarios, estaciones y bicis son los reales de
// la base — no se inventan cuentas nuevas.
// Uso: node scripts/seed-viajes-recientes.mjs
import { readFileSync } from 'fs'

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
const rand   = (a, b) => a + Math.random() * (b - a)
const randInt = (a, b) => Math.floor(rand(a, b + 1))
const pick   = arr => arr[Math.floor(Math.random() * arr.length)]

function haversineKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function main() {
  const [ultimo] = await sb('viajes?select=inicio_at&order=inicio_at.desc&limit=1')
  const desde = new Date(ultimo.inicio_at)
  desde.setUTCDate(desde.getUTCDate() + 1)
  desde.setUTCHours(5, 0, 0, 0) // 00:00 Lima del día siguiente
  const hasta = new Date()
  const dias = Math.max(1, Math.round((hasta - desde) / 86_400_000))
  console.log(`Rango: ${desde.toISOString().slice(0, 10)} → ${hasta.toISOString().slice(0, 10)} (${dias} días)`)

  const estaciones = (await sb('estaciones?select=id,nombre,latitud,longitud&estado=eq.activa&order=nombre'))
    .map(e => ({ id: e.id, nombre: e.nombre, lat: e.latitud, lng: e.longitud }))
  const bicis = await sb('bicicletas?select=id')
  const usuarios = await sb('usuarios?select=id,nombre&rol=eq.ciudadano&estado=eq.activo')

  // Pesos de viajes por usuario (~200 en total) — no todos usan la app igual
  const pesoPorNombre = {
    'prueba prueba': 2,
    'María García': 20, 'paco martinez': 16, 'Alessander Zuloaga': 16,
    'Ana Flores Quispe': 18, 'Carlos Mendoza Rivas': 14, 'Lucía Torres Vargas': 16,
    'Diego Huamán Paredes': 12, 'Valeria Soto Chávez': 20, 'Sebastián Ríos Castillo': 11,
    'Camila Aguilar León': 17, 'Matías Delgado Fuentes': 13, 'Fernanda Núñez Cruz': 15,
    'Rafael Campos Vera': 10,
  }
  const plan = usuarios.map(u => ({ ...u, n: pesoPorNombre[u.nombre] ?? 8 }))
  const totalViajes = plan.reduce((s, u) => s + u.n, 0)
  console.log(`Usuarios: ${usuarios.length} · viajes a crear: ${totalViajes}`)

  // Estaciones ordenadas alfabéticamente → las primeras "ganan" más
  // popularidad con power(random(), 2.2), igual que el resto del seed.
  function estacionPopular() {
    const pos = Math.min(estaciones.length - 1, Math.floor(Math.random() ** 2.2 * estaciones.length))
    return estaciones[pos]
  }
  function horaSegunDia(esFinde) {
    const r = Math.random()
    if (!esFinde) {
      if (r < 0.35) return randInt(7, 9)    // corredor laboral mañana
      if (r < 0.55) return randInt(12, 13)  // almuerzo
      if (r < 0.90) return randInt(17, 19)  // salida laboral
      return randInt(20, 21)
    }
    // fin de semana: uso recreativo, más disperso durante el día
    if (r < 0.10) return randInt(8, 9)
    if (r < 0.70) return randInt(10, 16)
    return randInt(17, 19)
  }

  const filas = []
  for (const u of plan) {
    for (let i = 0; i < u.n; i++) {
      const diaOffset = randInt(0, dias - 1)
      const fecha = new Date(desde)
      fecha.setUTCDate(fecha.getUTCDate() + diaOffset)
      const diaSemanaLima = new Date(fecha.getTime() - LIMA_OFFSET_H * 3_600_000).getUTCDay()
      const esFinde = diaSemanaLima === 0 || diaSemanaLima === 6
      const horaLima = horaSegunDia(esFinde)

      let origen = estacionPopular(), destino = estacionPopular()
      while (destino.id === origen.id) destino = estacionPopular()

      const inicio = new Date(fecha)
      inicio.setUTCHours(horaLima + LIMA_OFFSET_H, randInt(0, 59), 0, 0)
      if (inicio > hasta) continue // no crear viajes en el futuro

      const distanciaDirecta = haversineKm(origen, destino)
      const distanciaKm = Math.round(distanciaDirecta * rand(1.2, 1.5) * 100) / 100
      const velocidadKmh = rand(9, 15) // ciclismo urbano con semáforos
      const duracionMin = Math.max(3, Math.round(distanciaKm / velocidadKmh * 60 + rand(-2, 4)))
      const fin = new Date(inicio.getTime() + duracionMin * 60_000)

      const calificacion = Math.random() < 0.7 ? randInt(3, 5) : null

      filas.push({
        usuario_id: u.id,
        bicicleta_id: pick(bicis).id,
        estacion_origen_id: origen.id,
        estacion_destino_id: destino.id,
        inicio_at: inicio.toISOString(),
        fin_at: fin.toISOString(),
        estado: 'finalizado',
        distancia_km: distanciaKm,
        duracion_min: duracionMin,
        calificacion,
        _origen: origen, _destino: destino, // para waypoints, se limpia antes del insert
      })
    }
  }

  console.log(`Insertando ${filas.length} viajes...`)
  const CHUNK = 25
  let creados = 0
  for (let i = 0; i < filas.length; i += CHUNK) {
    const grupo = filas.slice(i, i + CHUNK)
    const payload = grupo.map(({ _origen, _destino, ...v }) => v)
    const insertados = await sb('viajes?select=id,inicio_at,duracion_min', {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })

    // Waypoints simples interpolados (6 puntos + ruido leve), igual
    // convención que el resto de los seeds de este proyecto.
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
  console.log(`\nListo: ${creados} viajes creados con waypoints básicos.`)
}

main().catch(e => { console.error(e); process.exit(1) })
