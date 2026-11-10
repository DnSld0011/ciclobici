'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  ShieldCheck, Download, CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Link2,
} from 'lucide-react'
import {
  construirValidacion, CASOS_FUNCIONALES, HALLAZGOS_SEGURIDAD, METRICAS_MODELO_PREDICTIVO,
  type ResumenEncuestaReal, type ResultadoValidacion,
} from '@/lib/validacion/datosValidacion'
import { exportarInformeValidacion } from '@/lib/utils/exportValidacionPdf'

const ETIQUETA_RESULTADO: Record<string, { label: string; color: string; bg: string }> = {
  aprobado: { label: 'Aprobado', color: '#166534', bg: '#dcfce7' },
  aprobado_advertencia: { label: 'Aprobado, con advertencia', color: '#854d0e', bg: '#fef9c3' },
  corregido: { label: 'Corregido en esta validación', color: '#1e40af', bg: '#dbeafe' },
}

interface ProyeccionPredictiva {
  totalViajesSinteticos: number
  metricas: { test: { r2: number; rmse: number; mae: number } }
}

export default function ValidacionSoftwarePage() {
  const [verDetalleFuncional, setVerDetalleFuncional] = useState(false)
  const [resumenReal, setResumenReal] = useState<ResumenEncuestaReal | null>(null)
  const [cargandoEncuesta, setCargandoEncuesta] = useState(true)
  const [proyeccion, setProyeccion] = useState<ProyeccionPredictiva | null>(null)
  const [corriendoProyeccion, setCorriendoProyeccion] = useState(false)

  useEffect(() => {
    fetch('/api/encuesta-usabilidad/resumen')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.n > 0) setResumenReal(d) })
      .catch(() => {})
      .finally(() => setCargandoEncuesta(false))
  }, [])

  async function correrProyeccion() {
    setCorriendoProyeccion(true)
    try {
      const res = await fetch('/api/operador/modelo-predictivo/proyeccion', { method: 'POST' })
      if (res.ok) setProyeccion(await res.json())
    } catch {
      // silencioso: es una proyección opcional, no bloquea el resto del informe
    } finally {
      setCorriendoProyeccion(false)
    }
  }

  const validacion: ResultadoValidacion = construirValidacion(resumenReal)
  const { DIMENSIONES, IQC, REGLAS_VETO, APROBADO, usabilidadEsReal } = validacion

  const datosRadar = DIMENSIONES.map(d => ({ dimension: d.nombre, valor: Math.round(d.valor * 100) }))
  const datosBarras = DIMENSIONES.map(d => ({
    dimension: d.nombre, 'Aporte al IQC': Math.round(d.peso * d.valor * 1000) / 1000, 'Valor crudo': d.valor,
  }))
  const dimUsabilidad = DIMENSIONES.find(d => d.nombre === 'Usabilidad')!

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#002117' }}>
          <ShieldCheck size={20} style={{ color: '#b2f746' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-on-surface">Validación de Software Antes de Producción</h1>
          <p className="text-sm text-outline mt-0.5">
            Índice de Calidad Compuesto (IQC) sobre 6 dimensiones — ISO/IEC 25010, SUS/NPS y reglas de veto.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="/api/operador/validacion-software/exportar-excel"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'white', color: '#002117', border: '1px solid #e5e7eb' }}>
            <Download size={15} />Descargar Excel (SUS/NPS)
          </a>
          <button onClick={() => exportarInformeValidacion(validacion)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#b2f746', color: '#002117' }}>
            <Download size={15} />Descargar informe (PDF)
          </button>
        </div>
      </header>

      {/* Link para compartir la encuesta real */}
      <section className="rounded-xl bg-surface-container-low px-4 py-3 flex items-center gap-2.5 text-xs">
        <Link2 size={14} className="text-on-surface-variant shrink-0" />
        <p className="text-on-surface-variant">
          Comparte <code className="font-mono font-bold">/encuesta-usabilidad</code> con usuarios reales — cada respuesta
          recalcula automáticamente la dimensión Usabilidad con datos reales.
        </p>
      </section>

      {/* Veredicto */}
      <section className="rounded-2xl border p-5 shadow-sm"
        style={{ background: APROBADO ? '#dcfce7' : '#ffdad6', borderColor: APROBADO ? '#86efac' : '#ffb4ab' }}>
        <div className="flex items-center gap-3">
          {APROBADO ? <CheckCircle2 size={28} className="text-[#166534] shrink-0" /> : <XCircle size={28} className="text-error shrink-0" />}
          <div>
            <p className="font-extrabold text-lg" style={{ color: APROBADO ? '#166534' : '#ba1a1a' }}>
              IQC = {(IQC * 100).toFixed(1)} / 100 — {APROBADO ? 'Aprobado para producción' : 'No aprobado para producción'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: APROBADO ? '#166534' : '#ba1a1a' }}>
              {APROBADO
                ? 'Cumple el umbral (≥ 85) y todas las reglas de veto.'
                : 'No cumple el umbral (≥ 85) y/o alguna regla de veto — ver detalle abajo.'}
            </p>
          </div>
        </div>
      </section>

      {/* Reglas de veto */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-on-surface mb-3">Reglas de veto</h2>
        <div className="space-y-2">
          {REGLAS_VETO.map(r => (
            <div key={r.regla} className="flex items-start gap-2.5 text-xs">
              {r.cumple ? <CheckCircle2 size={15} className="text-[#166534] shrink-0 mt-0.5" /> : <XCircle size={15} className="text-error shrink-0 mt-0.5" />}
              <div>
                <span className="font-bold text-on-surface">{r.regla}</span>
                <span className="text-outline"> — {r.detalle}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Radar + barras */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-on-surface mb-3">Perfil de calidad por dimensión</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <RadarChart data={datosRadar}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar dataKey="valor" stroke="#002117" fill="#b2f746" fillOpacity={0.55} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-on-surface mb-3">Aporte de cada dimensión al IQC</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={datosBarras} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 0.3]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="dimension" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="Aporte al IQC" fill="#002117" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Tabla de dimensiones */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-on-surface mb-3">Detalle por dimensión</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-outline border-b border-gray-100">
                <th className="py-2 pr-3">Dimensión</th>
                <th className="py-2 pr-3">Peso</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Aporte</th>
                <th className="py-2 pr-3">Evidencia</th>
                <th className="py-2 pr-3">Límite de esta validación</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONES.map(d => (
                <tr key={d.nombre} className={`border-b border-gray-50 ${d.valor < 0.70 ? 'bg-[#ffdad6]/40' : ''}`}>
                  <td className="py-2.5 pr-3 font-bold">{d.nombre}</td>
                  <td className="py-2.5 pr-3">{(d.peso * 100).toFixed(0)}%</td>
                  <td className="py-2.5 pr-3 font-bold">{(d.valor * 100).toFixed(1)}{d.valor < 0.70 && <span className="text-error"> ⚠</span>}</td>
                  <td className="py-2.5 pr-3">{(d.peso * d.valor * 100).toFixed(1)}</td>
                  <td className="py-2.5 pr-3 max-w-xs text-on-surface-variant">{d.evidencia}</td>
                  <td className="py-2.5 pr-3 max-w-xs text-outline">{d.limitacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Usabilidad: SUS/NPS */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-on-surface mb-3">
          Usabilidad — SUS y NPS {usabilidadEsReal && <span className="text-[#166534]">(datos reales)</span>}
        </h2>
        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="text-xs font-bold text-on-surface">SUS</p>
          <p className="text-2xl font-extrabold mt-1" style={{ color: '#002117' }}>{(dimUsabilidad.valor * 100).toFixed(1)}</p>
          <p className="text-xs text-outline mt-0.5">{dimUsabilidad.evidencia}</p>
        </div>
        <p className="text-[11px] text-outline mt-3 flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          {cargandoEncuesta
            ? 'Buscando respuestas reales de la encuesta de usabilidad…'
            : dimUsabilidad.limitacion}
        </p>
      </section>

      {/* Predictiva: modelo ML */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-on-surface mb-3">Predictiva — Modelo de demanda (Gradient Boosting)</h2>
        <p className="text-xs text-on-surface-variant">{METRICAS_MODELO_PREDICTIVO.metodologia}</p>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="rounded-xl bg-surface-container-low p-3 text-center">
            <p className="text-[10px] text-outline uppercase font-bold">n</p>
            <p className="font-extrabold text-on-surface">{METRICAS_MODELO_PREDICTIVO.n}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-3 text-center">
            <p className="text-[10px] text-outline uppercase font-bold">R² test</p>
            <p className="font-extrabold text-on-surface">{METRICAS_MODELO_PREDICTIVO.r2Test}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-3 text-center">
            <p className="text-[10px] text-outline uppercase font-bold">RMSE test</p>
            <p className="font-extrabold text-on-surface">{METRICAS_MODELO_PREDICTIVO.rmseTest}</p>
          </div>
        </div>
        <p className="text-[11px] text-outline mt-3 flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          {METRICAS_MODELO_PREDICTIVO.limitacion}
        </p>

        {/* Proyección con datos simulados — NO forma parte del IQC real */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-bold text-on-surface">Proyección con datos simulados</p>
              <p className="text-[11px] text-outline mt-0.5 max-w-md">
                Genera viajes sintéticos en memoria (nunca se guardan en la base real) con un volumen similar
                al del paper de referencia, para ver cómo rendiría el mismo modelo con más datos.
              </p>
            </div>
            <button onClick={correrProyeccion} disabled={corriendoProyeccion}
              className="px-4 py-2 rounded-xl text-xs font-bold shrink-0 disabled:opacity-50"
              style={{ background: '#002117', color: '#b2f746' }}>
              {corriendoProyeccion ? 'Simulando…' : 'Ejecutar proyección'}
            </button>
          </div>
          {proyeccion && (
            <div className="mt-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#e5eeff] p-3 text-center">
                  <p className="text-[10px] text-outline uppercase font-bold">Viajes sintéticos</p>
                  <p className="font-extrabold text-on-surface">{proyeccion.totalViajesSinteticos.toLocaleString('es-PE')}</p>
                </div>
                <div className="rounded-xl bg-[#e5eeff] p-3 text-center">
                  <p className="text-[10px] text-outline uppercase font-bold">R² test</p>
                  <p className="font-extrabold text-on-surface">{proyeccion.metricas.test.r2.toFixed(3)}</p>
                </div>
                <div className="rounded-xl bg-[#e5eeff] p-3 text-center">
                  <p className="text-[10px] text-outline uppercase font-bold">RMSE test</p>
                  <p className="font-extrabold text-on-surface">{proyeccion.metricas.test.rmse.toFixed(3)}</p>
                </div>
              </div>
              <p className="text-[11px] text-outline mt-2 flex items-start gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5" />
                Escenario hipotético, no sustituye la validación real — sirve para mostrar que el mismo método
                mejora sustancialmente cuando hay más volumen de datos.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Hallazgos de seguridad */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-on-surface mb-3">Hallazgos de seguridad (encontrados y corregidos)</h2>
        <div className="space-y-2.5">
          {HALLAZGOS_SEGURIDAD.map(h => (
            <div key={h.endpoint} className="rounded-xl p-3 border" style={{
              background: h.severidad === 'critica' ? '#ffdad6' : '#fef9c3',
              borderColor: h.severidad === 'critica' ? '#ffb4ab' : '#fde68a',
            }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase"
                  style={{ background: h.severidad === 'critica' ? '#ba1a1a' : '#854d0e', color: 'white' }}>
                  {h.severidad}
                </span>
                <span className="font-mono text-xs font-bold text-on-surface">{h.endpoint}</span>
                <CheckCircle2 size={13} className="text-[#166534] ml-auto shrink-0" />
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5">{h.descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Matriz funcional */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <button onClick={() => setVerDetalleFuncional(v => !v)}
          className="w-full flex items-center justify-between">
          <h2 className="text-sm font-bold text-on-surface">Matriz de casos funcionales ({CASOS_FUNCIONALES.length})</h2>
          {verDetalleFuncional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {verDetalleFuncional && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-outline border-b border-gray-100">
                  <th className="py-2 pr-3">Caso</th>
                  <th className="py-2 pr-3">Resultado</th>
                  <th className="py-2 pr-3">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {CASOS_FUNCIONALES.map(c => {
                  const e = ETIQUETA_RESULTADO[c.resultado]
                  return (
                    <tr key={c.caso} className="border-b border-gray-50">
                      <td className="py-2.5 pr-3 font-semibold">{c.caso}</td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: e.bg, color: e.color }}>
                          {e.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-on-surface-variant">{c.detalle}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
