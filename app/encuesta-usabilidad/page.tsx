'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bike, CheckCircle, Smile, ShieldCheck, Settings2, Gauge, Database, Sparkles } from 'lucide-react'

type Dimension = 'usabilidad' | 'seguridad' | 'funcionalidad' | 'rendimiento' | 'integridad'

const DIMENSIONES: { id: Dimension; label: string; icon: typeof Sparkles; desc: string }[] = [
  { id: 'usabilidad', label: 'Usabilidad general', icon: Sparkles, desc: 'Qué tan fácil y agradable es usar la app en general.' },
  { id: 'seguridad', label: 'Seguridad y confidencialidad', icon: ShieldCheck, desc: 'Confianza en cómo se protegen tus datos y tu cuenta.' },
  { id: 'funcionalidad', label: 'Funcionalidad y cobertura', icon: Settings2, desc: 'Si la app tiene todo lo que necesitás para tus tareas.' },
  { id: 'rendimiento', label: 'Rendimiento y eficiencia', icon: Gauge, desc: 'Velocidad, fluidez y estabilidad de la app.' },
  { id: 'integridad', label: 'Integridad de datos', icon: Database, desc: 'Precisión y consistencia de la información que muestra.' },
]

const PREGUNTAS: Record<Dimension, string[]> = {
  usabilidad: [
    'Creo que me gustaría usar este sistema con frecuencia.',
    'Encontré el sistema innecesariamente complejo.',
    'Pensé que el sistema era fácil de usar.',
    'Creo que necesitaría el apoyo de un técnico para poder usar este sistema.',
    'Encontré que las diversas funciones de este sistema estaban bien integradas.',
    'Pensé que había demasiada inconsistencia en este sistema.',
    'Imagino que la mayoría de la gente aprendería a usar este sistema muy rápidamente.',
    'Encontré que el sistema era muy incómodo o engorroso de usar.',
    'Me sentí muy seguro al usar el sistema.',
    'Necesité aprender muchas cosas antes de poder seguir adelante con este sistema.',
  ],
  seguridad: [
    'Creo que me sentiría muy seguro realizando transacciones o ingresando datos críticos en este sistema.',
    'Siento que el sistema expone mi información privada de forma innecesaria o descuidada.',
    'Considero que las medidas de autenticación y control de acceso son robustas y confiables.',
    'Me preocupa constantemente que personas no autorizadas puedan acceder a mi cuenta o información.',
    'El sistema me da total claridad y control sobre cómo se manejan mis datos personales.',
    'Encontré que las alertas y políticas de seguridad del sistema son confusas o difíciles de entender.',
    'Confío plenamente en que este sistema protegerá mi información ante cualquier fallo o ataque.',
    'El proceso para recuperar o proteger mis credenciales me pareció muy engorroso e inseguro.',
    'Me sentí completamente tranquilo y respaldado durante todo el tiempo que utilicé el sistema.',
    'Tuve la sensación de que el sistema carece de los estándares básicos de seguridad digital.',
  ],
  funcionalidad: [
    'Creo que las herramientas disponibles en el sistema cubren perfectamente todas mis necesidades.',
    'Sentí que al sistema le faltan funciones esenciales para poder completar mis tareas.',
    'Encontré que las funciones clave están ubicadas de forma muy lógica y accesible.',
    'El sistema me obligó a buscar herramientas externas porque sus funciones son muy limitadas.',
    'Considero que el flujo para ejecutar cualquier acción importante está muy bien estructurado.',
    'Muchas funciones del sistema me parecieron totalmente inútiles o redundantes.',
    'Las opciones avanzadas del sistema son fáciles de activar y configurar cuando se necesitan.',
    'Es innecesariamente difícil encontrar la función exacta que requiero en momentos específicos.',
    'Siento que el sistema aprovecha al máximo su tecnología para ofrecer soluciones útiles.',
    'Tuve que dar demasiados pasos intermedios para lograr un resultado que debería ser directo.',
  ],
  rendimiento: [
    'El sistema responde de manera inmediata y fluida a cada una de mis interacciones.',
    'Encontré que los tiempos de carga y procesamiento son innecesariamente lentos.',
    'El sistema se mantiene estable y veloz incluso cuando realizo operaciones complejas.',
    'Sentí que el sistema consume demasiados recursos de mi dispositivo, congelándolo o ralentizándolo.',
    'La velocidad del sistema me permitió terminar mis actividades mucho más rápido de lo esperado.',
    'Experimenté retrasos persistentes (lag) que interrumpieron mi ritmo de trabajo.',
    'Considero que el procesamiento de datos en segundo plano es sumamente eficiente.',
    'El sistema se bloquea o se cierra de forma inesperada con demasiada frecuencia.',
    'El rendimiento general me pareció impecable en comparación con otras herramientas similares.',
    'Sentí que perdí mucho tiempo esperando a que el sistema terminara de reaccionar.',
  ],
  integridad: [
    'Confío en que la información que muestra el sistema es totalmente precisa, exacta y actualizada.',
    'Noté discrepancias o datos contradictorios al navegar por las diferentes secciones.',
    'El sistema guarda y sincroniza mis cambios de forma automática y sin fallas.',
    'Tuve miedo de perder mi progreso debido a errores de guardado o sincronización.',
    'Los reportes, historiales o estados que genera el sistema reflejan la realidad a la perfección.',
    'Encontré datos duplicados o información huérfana que afectó mi experiencia.',
    'El sistema maneja los formatos de datos (fechas, monedas, textos) de forma impecable y uniforme.',
    'Experimenté fallas donde el sistema borró o alteró información sin mi consentimiento.',
    'Al consultar un dato desde cualquier pantalla o dispositivo, la información siempre fue consistente.',
    'Sentí que la base de datos es inestable y que los registros pueden corromperse fácilmente.',
  ],
}

const ESCALA = [
  { valor: 1, label: 'Muy en desacuerdo' },
  { valor: 2, label: 'En desacuerdo' },
  { valor: 3, label: 'Neutral' },
  { valor: 4, label: 'De acuerdo' },
  { valor: 5, label: 'Muy de acuerdo' },
]

export default function EncuestaUsabilidadPage() {
  const router = useRouter()
  const [dimension, setDimension] = useState<Dimension | null>(null)
  const [respuestas, setRespuestas] = useState<(number | null)[]>(Array(10).fill(null))
  const [nps, setNps] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')

  const completo = respuestas.every(r => r !== null) && (dimension !== 'usabilidad' || nps !== null)

  function elegirDimension(d: Dimension) {
    setDimension(d)
    setRespuestas(Array(10).fill(null))
    setNps(null)
    setComentario('')
    setError('')
  }

  function responderOtraVez() {
    setDimension(null)
    setRespuestas(Array(10).fill(null))
    setNps(null)
    setComentario('')
    setExito(false)
  }

  async function enviar() {
    if (!completo || !dimension) return
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/encuesta-usabilidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimension, respuestas, nps: dimension === 'usabilidad' ? nps : null, comentario }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo enviar la encuesta.'); return }
      setExito(true)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setEnviando(false)
    }
  }

  if (exito) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[#dcfce7] flex items-center justify-center">
          <CheckCircle size={40} className="text-[#166534]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-on-surface">¡Gracias por tu opinión!</h2>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xs">
            Tu respuesta es anónima y ayuda a medir y mejorar San Borja en Bici de verdad.
          </p>
        </div>
        <button onClick={responderOtraVez}
          className="h-12 px-8 rounded-2xl font-bold text-sm"
          style={{ background: '#b2f746', color: '#002117' }}>
          Evaluar otro aspecto / pasar a otra persona
        </button>
        <button onClick={() => router.push('/')} className="text-sm text-outline font-semibold">
          Terminar
        </button>
      </div>
    )
  }

  if (!dimension) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <header className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#002117' }}>
            <Bike size={20} style={{ color: '#b2f746' }} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-on-surface">Encuesta de usabilidad</h1>
            <p className="text-sm text-outline mt-0.5">
              Anónima — no pedimos tu nombre ni tu cuenta. Elegí qué aspecto querés evaluar.
            </p>
          </div>
        </header>
        <div className="space-y-3">
          {DIMENSIONES.map(d => {
            const Icon = d.icon
            return (
              <button key={d.id} onClick={() => elegirDimension(d.id)}
                className="w-full flex items-center gap-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-primary-container/40 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#e5eeff' }}>
                  <Icon size={18} style={{ color: '#1a56db' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">{d.label}</p>
                  <p className="text-xs text-outline mt-0.5">{d.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#002117' }}>
          <Bike size={20} style={{ color: '#b2f746' }} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-on-surface">
            {DIMENSIONES.find(d => d.id === dimension)?.label}
          </h1>
          <p className="text-sm text-outline mt-0.5">10 preguntas, de 1 a 5. Respuesta anónima.</p>
        </div>
      </header>

      <section className="space-y-4">
        {PREGUNTAS[dimension].map((pregunta, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-on-surface mb-3">{i + 1}. {pregunta}</p>
            <div className="flex gap-2 flex-wrap">
              {ESCALA.map(op => (
                <button key={op.valor}
                  onClick={() => setRespuestas(prev => prev.map((v, idx) => idx === i ? op.valor : v))}
                  className={`flex-1 min-w-[18%] py-2 rounded-xl text-xs font-bold transition-colors ${
                    respuestas[i] === op.valor ? 'bg-[#002117] text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                  title={op.label}>
                  {op.valor}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {dimension === 'usabilidad' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Smile size={16} className="text-on-surface" />
            <p className="text-sm font-semibold text-on-surface">
              ¿Qué tan probable es que recomiendes San Borja en Bici a un colega o amigo? (0 = nada probable, 10 = muy probable)
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 11 }, (_, n) => n).map(n => (
              <button key={n} onClick={() => setNps(n)}
                className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${
                  nps === n ? 'bg-[#002117] text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2">
          Comentario adicional (opcional)
        </label>
        <textarea rows={3} value={comentario} onChange={e => setComentario(e.target.value)}
          placeholder="¿Algo que te gustaría que mejoremos?"
          className="w-full px-4 py-3 text-sm border border-outline-variant/50 rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container" />
      </section>

      {error && <p className="text-xs font-semibold text-error">{error}</p>}

      <button onClick={enviar} disabled={!completo || enviando}
        className="w-full h-14 rounded-2xl font-bold text-sm transition-all active:scale-[.98] disabled:opacity-40 shadow-sm"
        style={{ background: '#b2f746', color: '#002117' }}>
        {enviando ? 'Enviando...' : 'Enviar encuesta'}
      </button>
      <button onClick={() => setDimension(null)} className="w-full text-sm text-outline font-semibold -mt-3">
        Elegir otro aspecto a evaluar
      </button>
    </div>
  )
}
