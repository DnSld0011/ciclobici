// Script de datos de prueba para CicloBici
// Ejecutar con: node scripts/seed.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan variables de entorno. Crea un archivo .env.local con:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=...')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=...')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── Datos de prueba ────────────────────────────────────────────────

const ESTACIONES = [
  { nombre: 'Estación Miraflores Centro',     direccion: 'Av. Larco 1150, Miraflores, Lima',           latitud: -12.1219, longitud: -77.0282, capacidad: 15, estado: 'activa' },
  { nombre: 'Estación San Isidro Financiero', direccion: 'Av. Javier Prado Este 500, San Isidro, Lima', latitud: -12.0951, longitud: -77.0280, capacidad: 12, estado: 'activa' },
  { nombre: 'Estación Barranco Malecón',      direccion: 'Malecón Cisneros s/n, Barranco, Lima',        latitud: -12.1453, longitud: -77.0219, capacidad: 10, estado: 'activa' },
  { nombre: 'Estación Surco Primavera',       direccion: 'Av. Primavera 650, Santiago de Surco, Lima',  latitud: -12.1280, longitud: -77.0019, capacidad: 12, estado: 'activa' },
  { nombre: 'Estación Pueblo Libre',          direccion: 'Av. Sucre 200, Pueblo Libre, Lima',           latitud: -12.0745, longitud: -77.0585, capacidad: 8,  estado: 'mantenimiento' },
  { nombre: 'Estación La Molina',             direccion: 'Av. La Molina 1200, La Molina, Lima',         latitud: -12.0839, longitud: -76.9385, capacidad: 10, estado: 'activa' },
]

const USUARIOS_TEST = [
  { nombre: 'Admin Operador',    celular: '3001000001', correo: 'operador@ciclobici.co',  documento: '1000000001', rol: 'operador',  estado: 'activo' },
  { nombre: 'Carlos Técnico',    celular: '3001000002', correo: 'tecnico@ciclobici.co',   documento: '1000000002', rol: 'tecnico',   estado: 'activo' },
  { nombre: 'María Ciudadana',   celular: '3001000003', correo: 'maria@example.com',      documento: '1000000003', rol: 'ciudadano', estado: 'activo' },
  { nombre: 'Juan Ciudadano',    celular: '3001000004', correo: 'juan@example.com',       documento: '1000000004', rol: 'ciudadano', estado: 'activo' },
  { nombre: 'Laura Usuario',     celular: '3001000005', correo: 'laura@example.com',      documento: '1000000005', rol: 'ciudadano', estado: 'activo' },
]

// ─── Helpers ────────────────────────────────────────────────────────

function generarCodigo(i) {
  const hoy = new Date()
  const yyyy = hoy.getFullYear()
  const mm   = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd   = String(hoy.getDate()).padStart(2, '0')
  return `BC-${yyyy}${mm}${dd}-${String(i).padStart(4, '0')}`
}

function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function horasAtras(n) {
  return new Date(Date.now() - n * 3600000).toISOString()
}

// ─── Main ────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Iniciando seed de CicloBici...\n')

  // 1. Estaciones
  console.log('📍 Creando estaciones...')
  const { data: estaciones, error: eErr } = await supabase
    .from('estaciones').insert(ESTACIONES).select()
  if (eErr) { console.error('Error estaciones:', eErr.message); process.exit(1) }
  console.log(`   ✓ ${estaciones.length} estaciones creadas`)

  const estIds = estaciones.map(e => e.id)

  // 2. Usuarios (via Admin Auth)
  console.log('\n👤 Creando usuarios...')
  const usuariosCreados = []
  for (const u of USUARIOS_TEST) {
    const { data, error } = await supabase.auth.admin.createUser({
      phone: `+51${u.celular}`,
      phone_confirm: true,
      user_metadata: { nombre: u.nombre },
    })
    if (error) {
      if (error.message.includes('already')) {
        console.log(`   ⚠ ${u.nombre} ya existe, saltando...`)
        continue
      }
      console.error(`   ✗ Error creando ${u.nombre}:`, error.message)
      continue
    }
    const { error: pErr } = await supabase.from('usuarios').upsert({
      id: data.user.id,
      nombre: u.nombre,
      documento: u.documento,
      correo: u.correo,
      celular: u.celular,
      rol: u.rol,
      estado: u.estado,
    })
    if (pErr) console.error(`   ✗ Perfil ${u.nombre}:`, pErr.message)
    else {
      usuariosCreados.push({ ...u, id: data.user.id })
      console.log(`   ✓ ${u.nombre} (${u.rol}) — celular: +51${u.celular}`)
    }
  }

  // 3. Bicicletas
  console.log('\n🚲 Creando bicicletas...')
  const tiposBici = [
    { tipo: 'Urbana', marca: 'Trek',  modelo: 'FX3' },
    { tipo: 'Urbana', marca: 'Giant', modelo: 'Escape 3' },
    { tipo: 'MTB',    marca: 'Trek',  modelo: 'Marlin 5' },
    { tipo: 'Urbana', marca: 'Bianchi', modelo: 'C-Sport 2' },
    { tipo: 'Eléctrica', marca: 'Specialized', modelo: 'Turbo Vado' },
  ]
  const bicis = []
  for (let i = 1; i <= 20; i++) {
    const tipo = tiposBici[(i - 1) % tiposBici.length]
    const estacion = i <= 16 ? estIds[(i - 1) % (estIds.length - 1)] : null // últimas 4 sin estación
    const estados = ['disponible','disponible','disponible','disponible','mantenimiento','en_viaje']
    bicis.push({
      codigo: generarCodigo(i),
      tipo: tipo.tipo,
      marca: tipo.marca,
      modelo: tipo.modelo,
      estado: estados[i % estados.length],
      estacion_id: estacion,
    })
  }
  const { data: bicicletasCreadas, error: bErr } = await supabase
    .from('bicicletas').insert(bicis).select()
  if (bErr) { console.error('Error bicicletas:', bErr.message); process.exit(1) }
  console.log(`   ✓ ${bicicletasCreadas.length} bicicletas creadas`)

  const biciIds = bicicletasCreadas.map(b => b.id)

  // 4. Mantenimientos
  console.log('\n🔧 Creando registros de mantenimiento...')
  const tiposIntervencion = [
    'Mantenimiento Preventivo', 'Reparación de Frenos',
    'Cambio de Neumático', 'Lubricación de Cadena', 'Revisión General',
  ]
  const tecnicos = ['Carlos Rodríguez', 'Ana Martínez', 'Pedro Gómez']
  const mantenimientos = []
  for (let i = 0; i < 8; i++) {
    mantenimientos.push({
      bicicleta_id: biciIds[i % biciIds.length],
      tipo_intervencion: tiposIntervencion[i % tiposIntervencion.length],
      descripcion: `Intervención de rutina #${i + 1} — todo en orden`,
      responsable: tecnicos[i % tecnicos.length],
      fecha: diasAtras(i * 3 + 1),
    })
  }
  const { data: mantCreados, error: mErr } = await supabase
    .from('mantenimientos').insert(mantenimientos).select()
  if (mErr) console.error('Error mantenimientos:', mErr.message)
  else console.log(`   ✓ ${mantCreados.length} mantenimientos registrados`)

  // 5. Viajes históricos (para modelo predictivo)
  console.log('\n🗺  Creando viajes históricos...')
  const ciudadanos = usuariosCreados.filter(u => u.rol === 'ciudadano')
  const viajes = []
  const horas = [7,8,9,12,13,17,18,19,20] // horas pico típicas

  for (let dia = 30; dia >= 1; dia--) {
    for (const hora of horas) {
      const cantViajes = Math.floor(Math.random() * 3) + 1
      for (let v = 0; v < cantViajes; v++) {
        const origen = estIds[Math.floor(Math.random() * (estIds.length - 1))]
        let destino = estIds[Math.floor(Math.random() * (estIds.length - 1))]
        while (destino === origen) destino = estIds[Math.floor(Math.random() * (estIds.length - 1))]
        const inicioAt = new Date()
        inicioAt.setDate(inicioAt.getDate() - dia)
        inicioAt.setHours(hora, Math.floor(Math.random() * 60), 0, 0)
        const finAt = new Date(inicioAt.getTime() + (15 + Math.random() * 30) * 60000)
        viajes.push({
          usuario_id: ciudadanos.length > 0 ? ciudadanos[v % ciudadanos.length].id : null,
          bicicleta_id: biciIds[Math.floor(Math.random() * biciIds.length)],
          estacion_origen_id: origen,
          estacion_destino_id: destino,
          inicio_at: inicioAt.toISOString(),
          fin_at: finAt.toISOString(),
          estado: 'finalizado',
        })
      }
    }
  }
  // Insert in batches of 50
  let viajesCreados = 0
  for (let i = 0; i < viajes.length; i += 50) {
    const batch = viajes.slice(i, i + 50)
    const { error: vErr } = await supabase.from('viajes').insert(batch)
    if (vErr) console.error('Error viajes batch:', vErr.message)
    else viajesCreados += batch.length
  }
  console.log(`   ✓ ${viajesCreados} viajes históricos creados`)

  // ─── Resumen ────────────────────────────────────────────────────
  console.log('\n✅ Seed completado!\n')
  console.log('═══════════════════════════════════════════════')
  console.log('  USUARIOS DE PRUEBA')
  console.log('═══════════════════════════════════════════════')
  for (const u of USUARIOS_TEST) {
    console.log(`  ${u.rol.padEnd(10)} │ +51${u.celular} │ ${u.nombre}`)
  }
  console.log('═══════════════════════════════════════════════')
  console.log('\n  Para iniciar sesión: ingresa el celular en la app')
  console.log('  El OTP aparecerá en Supabase → Authentication → Logs\n')
}

seed().catch(console.error)
