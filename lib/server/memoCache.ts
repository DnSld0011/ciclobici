// Caché en memoria por instancia serverless (Vercel mantiene las
// instancias "calientes" entre requests). TTL corto: acelera las
// consultas pesadas repetidas sin sacrificar frescura.

const store = new Map<string, { exp: number; data: unknown }>()

export function getCache<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  if (hit.exp < Date.now()) {
    store.delete(key)
    return null
  }
  return hit.data as T
}

export function setCache(key: string, data: unknown, ttlMs: number) {
  // Evitar crecimiento sin límite
  if (store.size > 500) {
    const ahora = Date.now()
    for (const [k, v] of store) if (v.exp < ahora) store.delete(k)
  }
  store.set(key, { exp: Date.now() + ttlMs, data })
}
