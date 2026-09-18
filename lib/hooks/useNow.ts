'use client'

import { useEffect, useState } from 'react'

// Devuelve el timestamp "actual" como estado, refrescado por un efecto
// (no leyendo Date.now() directamente durante el render, que React
// considera una operación impura y puede repetir en modo concurrente).
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
