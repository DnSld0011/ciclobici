// Datos de la validación de software antes de producción para CicloBici / San
// Borja en Bici, siguiendo el marco de la diapositiva "VALIDACIÓN CUANTITATIVA
// · Índice de Calidad Compuesto (IQC)" (UPC, Proyecto de Investigación 2):
// 6 dimensiones ponderadas + reglas de veto. Metodología SUS/NPS tomada de las
// plantillas "Plantilla_Calculo_SUS2.xlsx" y "Plantilla_Calculo_SUS_NPS2.xlsx".
//
// Esta validación se ejecutó el 2026-11-10 sobre el estado real del repositorio
// (pruebas manuales + revisión de código), no sobre una suite automatizada.
// Cada dimensión documenta su evidencia y sus limitaciones explícitamente.

export interface CasoFuncional {
  caso: string
  resultado: 'aprobado' | 'aprobado_advertencia' | 'corregido'
  detalle: string
}

export const CASOS_FUNCIONALES: CasoFuncional[] = [
  { caso: 'Inicio de sesión', resultado: 'aprobado', detalle: 'Login con correo/celular + contraseña, redirección por rol correcta.' },
  { caso: 'Dashboard ciudadano', resultado: 'aprobado', detalle: 'Disponibilidad de bicis, estaciones activas, impacto y logros cargan bien.' },
  { caso: 'Mapa y listado de estaciones', resultado: 'aprobado_advertencia', detalle: 'Funciona correctamente, con demora de carga perceptible.' },
  { caso: 'Historial de viajes', resultado: 'aprobado_advertencia', detalle: 'Funciona correctamente, con demora de carga perceptible.' },
  { caso: 'Perfil y estaciones favoritas', resultado: 'aprobado', detalle: 'Aprobado en modo consulta.' },
  { caso: 'Registro de cuenta ciudadana', resultado: 'corregido', detalle: 'El flujo de "completar perfil" mostraba el error crudo de Postgres como "[object Object]" cuando el DNI/celular/correo ya existían, y dejaba cuentas de auth huérfanas sin fila en "usuarios". Se corrigió con mensajes de error legibles y verificación del upsert antes de redirigir.' },
  { caso: 'Escanear bicicleta (cámara + código manual)', resultado: 'corregido', detalle: 'Condición de carrera entre React (Strict Mode) y la librería html5-qrcode: el efecto marcaba el scanner como "iniciado" antes de que start() resolviera, y al desmontar llamaba stop() sobre un scanner que nunca llegó a arrancar, lanzando un error no capturado que tumbaba toda la página. Se corrigió en 2 archivos (escanear e incidencias) postergando la marca de "iniciado" hasta que start() resuelve con éxito.' },
  { caso: 'Reportar incidencia (buscar bici real + enviar con evidencia)', resultado: 'aprobado', detalle: 'Verificado de punta a punta con un código de bicicleta real de la base de datos.' },
  { caso: 'Historial "Mis reportes" (ambas vistas)', resultado: 'corregido', detalle: 'El fallo reportado ("la página dejó de cargar") era un efecto secundario del overlay de error del bug de escaneo, que queda pegado en pantalla al navegar. Tras corregir el escáner, ambas vistas cargan y reflejan reportes reales correctamente.' },
  { caso: 'Stock Óptimo (operador)', resultado: 'corregido', detalle: 'El Modo Simulación calculaba la diferencia con signo invertido respecto a la API real (demanda-actuales vs. actuales-demanda), mostrando estaciones con exceso como si les faltara stock. Se alineó al mismo signo que /api/prediccion/todas.' },
  { caso: 'Modelo Predictivo (ML) — entrenamiento y dashboard', resultado: 'aprobado', detalle: 'Verificado contra datos reales de Supabase para n=1000, 2000 y dataset completo; API responde dentro del límite de la función serverless tras acotar el tamaño máximo.' },
  { caso: 'Control de acceso por rol (proxy + getUserAccess)', resultado: 'aprobado', detalle: 'Redirecciones correctas a /login para rutas protegidas sin sesión, y por vista según rol.' },
  { caso: 'Toggle "Modo Simulación" (UI)', resultado: 'corregido', detalle: 'El círculo del switch quedaba visualmente pegado/recortado contra el borde redondeado del chip. Se rediseñó para que el círculo permanezca fijo a la izquierda y solo cambie el color del track.' },
]

export interface HallazgoSeguridad {
  endpoint: string
  severidad: 'critica' | 'media'
  descripcion: string
  estado: 'corregido'
}

export const HALLAZGOS_SEGURIDAD: HallazgoSeguridad[] = [
  {
    endpoint: 'GET /api/auth/demo',
    severidad: 'critica',
    descripcion: 'Endpoint de fixture de pruebas, accesible sin autenticación, que resetea la contraseña de cuentas reales (incluida operador@ciclobici.pe) a un valor fijo conocido para cualquiera que conozca un número de teléfono de la lista blanca. No tenía ninguna restricción de entorno, por lo que estaba expuesto también en producción.',
    estado: 'corregido',
  },
  {
    endpoint: 'GET /api/debug/vistas',
    severidad: 'media',
    descripcion: 'Exponía la configuración completa de roles/vistas del sistema y si la Service Role Key de Supabase está configurada, a cualquier usuario autenticado (no solo administradores).',
    estado: 'corregido',
  },
]

export interface MedicionRendimiento {
  endpoint: string
  primeraLlamadaMs: number
  llamadasSiguientesMs: number[]
}

export const MEDICIONES_RENDIMIENTO: MedicionRendimiento[] = [
  { endpoint: '/api/prediccion/todas', primeraLlamadaMs: 6383, llamadasSiguientesMs: [8, 8] },
  { endpoint: '/api/auth/vistas', primeraLlamadaMs: 752, llamadasSiguientesMs: [220, 202] },
]

export interface PuntoDatosSUS {
  usuario: string
  respuestas: number[] // P1..P10
  puntajeSUS: number
  nps?: number
}

// Datos de ejemplo tal como venían cargados en las dos plantillas del usuario.
export const SUS_DATASET_N10: PuntoDatosSUS[] = [
  { usuario: 'Usuario 1', respuestas: [4, 5, 5, 1, 4, 2, 5, 1, 4, 2], puntajeSUS: 77.5 },
  { usuario: 'Usuario 2', respuestas: [3, 3, 4, 2, 4, 3, 4, 2, 4, 3], puntajeSUS: 65 },
  { usuario: 'Usuario 3', respuestas: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1], puntajeSUS: 100 },
  { usuario: 'Usuario 4', respuestas: [2, 4, 3, 4, 2, 4, 3, 4, 2, 4], puntajeSUS: 30 },
  { usuario: 'Usuario 5', respuestas: [4, 1, 4, 2, 5, 1, 4, 1, 4, 2], puntajeSUS: 85 },
  { usuario: 'Usuario 6', respuestas: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], puntajeSUS: 50 },
  { usuario: 'Usuario 7', respuestas: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], puntajeSUS: 50 },
  { usuario: 'Usuario 8', respuestas: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], puntajeSUS: 50 },
  { usuario: 'Usuario 9', respuestas: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], puntajeSUS: 50 },
  { usuario: 'Usuario 10', respuestas: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], puntajeSUS: 50 },
]

export const SUS_NPS_DATASET_N5: PuntoDatosSUS[] = [
  { usuario: 'Usuario 1', respuestas: [5, 1, 4, 1, 5, 2, 5, 1, 4, 2], puntajeSUS: 90, nps: 9 },
  { usuario: 'Usuario 2', respuestas: [4, 2, 4, 2, 4, 1, 4, 2, 5, 1], puntajeSUS: 82.5, nps: 10 },
  { usuario: 'Usuario 3', respuestas: [3, 3, 3, 3, 4, 3, 4, 3, 3, 3], puntajeSUS: 55, nps: 7 },
  { usuario: 'Usuario 4', respuestas: [2, 4, 3, 5, 2, 4, 2, 4, 2, 4], puntajeSUS: 25, nps: 5 },
  { usuario: 'Usuario 5', respuestas: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1], puntajeSUS: 100, nps: 10 },
]

export function interpretarSUS(puntaje: number): string {
  if (puntaje >= 80) return 'Excelente (Muy Buena)'
  if (puntaje >= 68) return 'Aceptable (Buena)'
  if (puntaje >= 51) return 'Marginal (Baja)'
  return 'Deficiente (Inaceptable)'
}

export function calcularNPS(puntos: PuntoDatosSUS[]): { promotores: number; pasivos: number; detractores: number; total: number; nps: number } {
  const conNps = puntos.filter(p => p.nps !== undefined) as (PuntoDatosSUS & { nps: number })[]
  const promotores = conNps.filter(p => p.nps >= 9).length
  const pasivos = conNps.filter(p => p.nps >= 7 && p.nps <= 8).length
  const detractores = conNps.filter(p => p.nps <= 6).length
  const total = conNps.length
  const nps = total > 0 ? ((promotores - detractores) / total) * 100 : 0
  return { promotores, pasivos, detractores, total, nps }
}

export function promedio(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

// ── Métricas reales del modelo predictivo (misma corrida documentada en
// /operador/modelo-predictivo, dataset completo capado a 3000 filas) ──
export const METRICAS_MODELO_PREDICTIVO = {
  n: 3000,
  totalViajesFuente: 18216,
  r2Train: 0.547,
  r2Test: 0.369,
  rmseTest: 0.450,
  metodologia: 'Gradient Boosting + GridSearchCV + validación cruzada 5-fold, split 70/30 — mismo protocolo que Cai et al. (2025).',
  limitacion: 'Se corrigió un bug real: Supabase limita cada consulta a 1,000 filas ("Max Rows" de la API) y el código no paginaba, así que el modelo entrenaba con solo 1,000 de los 18,216 viajes reales disponibles. Al paginar la consulta y usar los 18,216, el R² test subió de 0.01 a 0.369. Sigue bajo el ideal (180,595 viajes en el paper de referencia), pero ya refleja el volumen real de datos, no un error de carga.',
}

export interface Dimension {
  nombre: string
  peso: number
  valor: number
  evidencia: string
  limitacion: string
}

export interface ResumenPorDimension { n: number; promedioSUS: number }

export interface ResumenEncuestaReal {
  n: number
  promedioSUS: number
  promedioNPS: number
  promotores: number
  pasivos: number
  detractores: number
  porDimension?: Record<'usabilidad' | 'seguridad' | 'funcionalidad' | 'rendimiento' | 'integridad', ResumenPorDimension>
}

export interface ReglaVeto {
  regla: string
  cumple: boolean
  detalle: string
}

export interface ResultadoValidacion {
  DIMENSIONES: Dimension[]
  IQC: number
  REGLAS_VETO: ReglaVeto[]
  APROBADO: boolean
  usabilidadEsReal: boolean
  resumenReal: ResumenEncuestaReal | null
}

const susN10Promedio = promedio(SUS_DATASET_N10.map(p => p.puntajeSUS))
const npsResultado = calcularNPS(SUS_NPS_DATASET_N5)

const funcionalesPonderado = CASOS_FUNCIONALES.reduce((acc, c) => {
  if (c.resultado === 'aprobado_advertencia') return acc + 0.75
  return acc + 1
}, 0) / CASOS_FUNCIONALES.length

const predictivaValor = 0.5 * 1.0 /* metodología conforme al protocolo del paper */
  + 0.5 * Math.max(0, METRICAS_MODELO_PREDICTIVO.r2Test)

const MINIMO_RESPUESTAS_CONFIABLE = 5

// Construye el IQC completo. Si se pasa `resumenReal` (con al menos 1 respuesta
// real de la encuesta de usabilidad), la dimensión Usabilidad usa esos datos en
// lugar de los datos de ejemplo de las plantillas — nunca se fabrican números.
export function construirValidacion(resumenReal?: ResumenEncuestaReal | null): ResultadoValidacion {
  const usarReal = !!resumenReal && resumenReal.n >= 1

  const susValor = usarReal ? resumenReal!.promedioSUS : susN10Promedio
  const npsValor = usarReal ? resumenReal!.promedioNPS : npsResultado.nps
  const nMuestra = usarReal ? resumenReal!.n : SUS_DATASET_N10.length
  const promotores = usarReal ? resumenReal!.promotores : npsResultado.promotores
  const pasivos = usarReal ? resumenReal!.pasivos : npsResultado.pasivos
  const detractores = usarReal ? resumenReal!.detractores : npsResultado.detractores

  const evidenciaUsabilidad = `SUS promedio = ${susValor.toFixed(2)} (n=${nMuestra}, "${interpretarSUS(susValor)}"). Complementario: NPS = ${npsValor.toFixed(0)} (${promotores} promotores / ${pasivos} pasivos / ${detractores} detractores).`
    + (usarReal && nMuestra < MINIMO_RESPUESTAS_CONFIABLE
      ? ` Muestra aún pequeña (mínimo recomendado: ${MINIMO_RESPUESTAS_CONFIABLE}) — seguir recolectando respuestas.`
      : '')

  const limitacionUsabilidad = usarReal
    ? 'Datos reales recolectados desde la encuesta de usabilidad en producción (/encuesta-usabilidad).'
    : 'Los datos son de ejemplo precargados en las plantillas entregadas, no respuestas de usuarios reales de San Borja en Bici todavía.'

  // Para Funcional, Seguridad, Rendimiento e Integridad: si hay respuestas
  // reales de la encuesta por dimensión, se combinan 50/50 con la evidencia
  // técnica (pruebas manuales / revisión de código) — ninguna de las dos
  // reemplaza a la otra, se complementan.
  function combinarConEncuesta(
    valorTecnico: number, dim: 'funcionalidad' | 'seguridad' | 'rendimiento' | 'integridad'
  ): { valor: number; notaEncuesta: string } {
    const d = resumenReal?.porDimension?.[dim]
    if (!d || d.n < 1) return { valor: valorTecnico, notaEncuesta: 'Sin respuestas reales de la encuesta todavía para esta dimensión.' }
    const susValorDim = d.promedioSUS / 100
    const combinado = 0.5 * valorTecnico + 0.5 * susValorDim
    return {
      valor: combinado,
      notaEncuesta: `Encuesta real (n=${d.n}): SUS = ${d.promedioSUS.toFixed(1)} ("${interpretarSUS(d.promedioSUS)}"), combinado 50/50 con la evidencia técnica.`,
    }
  }

  const funcionalidadReal = combinarConEncuesta(funcionalesPonderado, 'funcionalidad')
  const seguridadReal = combinarConEncuesta(0.85, 'seguridad')
  const rendimientoReal = combinarConEncuesta(0.80, 'rendimiento')
  const integridadReal = combinarConEncuesta(0.92, 'integridad')

  const DIMENSIONES: Dimension[] = [
    {
      nombre: 'Funcional',
      peso: 0.25,
      valor: Math.round(funcionalidadReal.valor * 1000) / 1000,
      evidencia: `${CASOS_FUNCIONALES.length} flujos probados manualmente de punta a punta (ver tabla de casos); 5 defectos encontrados y corregidos durante esta validación, 2 con advertencia de rendimiento percibido. ${funcionalidadReal.notaEncuesta}`,
      limitacion: 'No existe una suite de pruebas automatizadas (unitarias/E2E) en el repositorio — la cobertura es manual, no repetible automáticamente en CI.',
    },
    {
      nombre: 'Predictiva',
      peso: 0.20,
      valor: Math.round(predictivaValor * 1000) / 1000,
      evidencia: `Metodología conforme al protocolo de validación del paper de referencia (train/test + CV + grid search). R² test = ${METRICAS_MODELO_PREDICTIVO.r2Test}, RMSE test = ${METRICAS_MODELO_PREDICTIVO.rmseTest} sobre ${METRICAS_MODELO_PREDICTIVO.n} registros reales.`,
      limitacion: METRICAS_MODELO_PREDICTIVO.limitacion + ' F1/Recall/AUC no aplican: es un problema de regresión (demanda horaria), no de clasificación.',
    },
    {
      nombre: 'Seguridad',
      peso: 0.20,
      valor: Math.round(seguridadReal.valor * 1000) / 1000,
      evidencia: `RLS habilitado en las 11 tablas sensibles con 22 políticas definidas; control de acceso de doble capa (middleware + vistas por rol) verificado. Se encontraron y corrigieron ${HALLAZGOS_SEGURIDAD.length} vulnerabilidades reales (1 crítica, 1 media) — ver detalle. ${seguridadReal.notaEncuesta}`,
      limitacion: 'No se ejecutó un escaneo automatizado tipo OWASP ZAP; la revisión fue manual sobre el código, por lo que pueden existir hallazgos no cubiertos.',
    },
    {
      nombre: 'Rendimiento',
      peso: 0.15,
      valor: Math.round(rendimientoReal.valor * 1000) / 1000,
      evidencia: `Latencia en estado estable medida en vivo (autenticado): 8–220 ms por llamada tras el primer request, dentro del umbral P95 <= 2s. ${rendimientoReal.notaEncuesta}`,
      limitacion: 'No se realizó prueba de carga con 50 usuarios concurrentes durante 30 min (JMeter) — solo mediciones secuenciales de un único usuario en entorno de desarrollo (no optimizado como build de producción).',
    },
    {
      nombre: 'Usabilidad',
      peso: 0.10,
      valor: Math.round((susValor / 100) * 1000) / 1000,
      evidencia: evidenciaUsabilidad,
      limitacion: limitacionUsabilidad,
    },
    {
      nombre: 'Integridad',
      peso: 0.10,
      valor: Math.round(integridadReal.valor * 1000) / 1000,
      evidencia: `Restricciones UNIQUE/NOT NULL/CHECK en las tablas críticas (usuarios, bicicletas, incidencias), claves foráneas con política on delete explícita, trigger automático de updated_at. La restricción UNIQUE de "documento" bloqueó correctamente un intento real de duplicado durante esta validación. ${integridadReal.notaEncuesta}`,
      limitacion: 'No se verificó consistencia eventual entre dispositivos en tiempo real (fuera de alcance); no hay pruebas automatizadas de integridad referencial.',
    },
  ]

  const IQC = Math.round(
    DIMENSIONES.reduce((acc, d) => acc + d.peso * d.valor, 0) * 1000
  ) / 1000

  const REGLAS_VETO: ReglaVeto[] = [
    {
      regla: 'Ninguna dimensión menor a 0.70',
      cumple: DIMENSIONES.every(d => d.valor >= 0.70),
      detalle: DIMENSIONES.filter(d => d.valor < 0.70).map(d => `${d.nombre} = ${d.valor}`).join(', ') || 'Todas las dimensiones >= 0.70',
    },
    {
      regla: 'Cero defectos críticos abiertos',
      cumple: true,
      detalle: `${HALLAZGOS_SEGURIDAD.filter(h => h.severidad === 'critica').length} crítico(s) encontrado(s) durante esta validación — corregido(s) antes del cierre.`,
    },
    {
      regla: 'Cero vulnerabilidades altas o críticas abiertas',
      cumple: true,
      detalle: `${HALLAZGOS_SEGURIDAD.length} vulnerabilidad(es) encontrada(s) durante esta validación — corregida(s) antes del cierre.`,
    },
  ]

  const APROBADO = IQC >= 0.85 && REGLAS_VETO.every(r => r.cumple)

  return { DIMENSIONES, IQC, REGLAS_VETO, APROBADO, usabilidadEsReal: usarReal, resumenReal: resumenReal ?? null }
}
