'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface SimulacionState {
  activa: boolean
  activar: () => void
  desactivar: () => void
  toggle: () => void
}

const SimulacionContext = createContext<SimulacionState | null>(null)

const STORAGE_KEY = 'sbb:modo-simulacion'

export function SimulacionProvider({ children }: { children: ReactNode }) {
  const [activa, setActiva] = useState(false)

  // Leer preferencia guardada (por navegador, no sincroniza entre dispositivos)
  useEffect(() => {
    try {
      setActiva(localStorage.getItem(STORAGE_KEY) === '1')
    } catch { /* localStorage no disponible (SSR / privado) */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, activa ? '1' : '0') } catch { /* noop */ }
  }, [activa])

  const value: SimulacionState = {
    activa,
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
