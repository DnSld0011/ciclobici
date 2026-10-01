'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface SimulacionState {
  activa: boolean
  /** true recién después de leer localStorage — hasta entonces no se sabe si activa es real o el default */
  listo: boolean
  activar: () => void
  desactivar: () => void
  toggle: () => void
}

const SimulacionContext = createContext<SimulacionState | null>(null)

const STORAGE_KEY = 'sbb:modo-simulacion'

export function SimulacionProvider({ children }: { children: ReactNode }) {
  const [activa, setActiva] = useState(false)
  // Evita que el efecto de escritura pise localStorage con el valor
  // inicial (false) antes de que termine de leerse la preferencia guardada
  const [cargado, setCargado] = useState(false)

  // Leer preferencia guardada (por navegador, no sincroniza entre dispositivos)
  useEffect(() => {
    try {
      setActiva(localStorage.getItem(STORAGE_KEY) === '1')
    } catch { /* localStorage no disponible (SSR / privado) */ }
    setCargado(true)
  }, [])

  useEffect(() => {
    if (!cargado) return
    try { localStorage.setItem(STORAGE_KEY, activa ? '1' : '0') } catch { /* noop */ }
  }, [activa, cargado])

  const value: SimulacionState = {
    activa,
    listo: cargado,
    activar: () => setActiva(true),
    desactivar: () => setActiva(false),
    toggle: () => setActiva(v => !v),
  }

  return <SimulacionContext.Provider value={value}>{children}</SimulacionContext.Provider>
}

export function useSimulacion(): SimulacionState {
  const ctx = useContext(SimulacionContext)
  if (!ctx) throw new Error('useSimulacion debe usarse dentro de <SimulacionProvider>')
  return ctx
}
