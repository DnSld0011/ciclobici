// Reescribe los waypoints de los viajes de HOY que tienen trazo denso
// (los 30 del seed con ≥20 puntos) usando rutas reales por calle vía OSRM.
// Uso:  node scripts/mejorar-trazos.mjs
import { readFileSync } from 'fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL
const KEY    = env.SUPABASE_SERVICE_ROLE_KEY
const H      = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function sb(path, opts = {}) {
  const res = await fetch(`${URL_SB}/rest/v1/${path}`, { headers: H, ...opts })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null   // POST/DELETE devuelven cuerpo vacío
}

// Ruta real por calles con OSRM (servidor público, sin API key)
async function rutaOSRM(o, d) {
  const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM ${res.status}`)
  const json = await res.json()
  const coords = json.routes?.[0]?.geometry?.coordinates
  if (!coords?.length) throw new Error('OSRM sin ruta')
  return coords.map(([lng, lat]) => ({ lat, lng }))
}

// Remuestrear la geometría a ~n puntos equidistantes
function remuestrear(pts, n) {
  if (pts.length <= n) return pts
  const dist = (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng)
  const acum = [0]
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + dist(pts[i - 1], pts[i]))
  const total = acum[acum.length - 1]
  const out = [pts[0]]
  let j = 0
  for (let k = 1; k < n - 1; k++) {
    const objetivo = (total * k) / (n - 1)
    while (j < acum.length - 2 && acum[j + 1] < objetivo) j++
    const t = (objetivo - acum[j]) / Math.max(acum[j + 1] - acum[j], 1e-12)
    out.push({
      lat: pts[j].lat + (pts[j + 1].lat - pts[j].lat) * t,
      lng: pts[j].lng + (pts[j + 1].lng - pts[j].lng) * t,
    })
  }
  out.push(pts[pts.length - 1])
  return out
}

async function main() {
  // Inicio de hoy en Lima (UTC-5)
  const hoyLima = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)
  const desdeUTC = `${hoyLima}T05:00:00Z`

  const estaciones = await sb('estaciones?select=id,latitud,longitud')
  const eMap = Object.fromEntries(estaciones.map(e => [e.id, { lat: e.latitud, lng: e.longitud }]))

  const viajes = await sb(
    `viajes?select=id,estacion_origen_id,estacion_destino_id,inicio_at,duracion_min` +
    `&estado=eq.finalizado&inicio_at=gte.${desdeUTC}&limit=200`)
  console.log(`Viajes de hoy: ${viajes.length}`)

  let mejorados = 0, saltados = 0, errores = 0
  for (const v of viajes) {
    // Solo los del seed nuevo (trazo denso ≥20 puntos); los antiguos (6 pts) se dejan
    const wps = await sb(`viaje_waypoints?select=id&viaje_id=eq.${v.id}&limit=100`)
    if (wps.length < 20) { saltados++; continue }

    const o = eMap[v.estacion_origen_id], d = eMap[v.estacion_destino_id]
    if (!o || !d) { saltados++; continue }

    try {
      const geometria = await rutaOSRM(o, d)
      const n = Math.min(40, Math.max(25, geometria.length))
      const ruta = remuestrear(geometria, n)

      // Ruido GPS leve (±4m) salvo en los extremos
      const puntos = ruta.map((p, i) =>
        i === 0 || i === ruta.length - 1 ? p : {
          lat: p.lat + (Math.random() - 0.5) * 0.00008,
          lng: p.lng + (Math.random() - 0.5) * 0.00008,
        })

      // Pausa en el 50% de los viajes: 3 puntos casi idénticos a mitad de ruta
      if (Math.random() < 0.5) {
        const idx = 5 + Math.floor(Math.random() * (puntos.length - 10))
        const base = puntos[idx]
        puntos.splice(idx, 0,
          { lat: base.lat + 0.00002, lng: base.lng - 0.00002 },
          { lat: base.lat - 0.00002, lng: base.lng + 0.00002 },
          { lat: base.lat, lng: base.lng })
      }

      const inicio = new Date(v.inicio_at).getTime()
      const durS   = (v.duracion_min ?? 15) * 60
      const filas  = puntos.map((p, i) => ({
        viaje_id: v.id,
        lat: p.lat, lng: p.lng,
        recorded_at: new Date(inicio + Math.round((durS * i) / (puntos.length - 1)) * 1000).toISOString(),
      }))

      await sb(`viaje_waypoints?viaje_id=eq.${v.id}`, { method: 'DELETE' })
      await sb('viaje_waypoints', { method: 'POST', body: JSON.stringify(filas) })
      mejorados++
      process.stdout.write(`✓ ${v.id.slice(0, 8)} (${puntos.length} pts)  `)
    } catch (e) {
      errores++
      console.log(`\n✗ ${v.id.slice(0, 8)}: ${e.message}`)
    }
    await sleep(600)  // respetar el rate limit del servidor OSRM público
  }

  console.log(`\n\nListo: ${mejorados} viajes con ruta real por calles · ${saltados} saltados (trazo antiguo) · ${errores} errores`)
}

main().catch(e => { console.error(e); process.exit(1) })
