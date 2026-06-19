import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_EMAIL   = process.env.VAPID_EMAIL ?? 'mailto:admin@ciclobici.pe'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
}

export async function POST(request: NextRequest) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: 'Push no configurado (VAPID keys faltantes)' }, { status: 503 })
  }

  const { usuario_id, titulo, cuerpo, url } = await request.json() as {
    usuario_id: string
    titulo: string
    cuerpo: string
    url?: string
  }

  if (!usuario_id || !titulo) {
    return NextResponse.json({ error: 'usuario_id y titulo requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('usuario_id', usuario_id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, enviadas: 0 })
  }

  const payload = JSON.stringify({ titulo, cuerpo, url: url ?? '/' })
  let enviadas = 0
  const stale: string[] = []

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 }
        )
        enviadas++
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) stale.push(s.endpoint)
      }
    })
  )

  if (stale.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', stale)
  }

  return NextResponse.json({ ok: true, enviadas })
}
