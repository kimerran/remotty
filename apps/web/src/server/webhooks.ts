import crypto from 'node:crypto'
import type { Webhook } from '@prisma/client'
import { getDb } from '@/server/db'

export interface WebhookPayload {
  event: 'session.exit' | 'session.error'
  sessionId: string
  hostId: string
  profileId: string
  userId: string
  exitCode: number | null
  timestamp: string
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export async function notifyWebhooks(
  event: 'session.exit' | 'session.error',
  sessionId: string,
  hostId: string,
  profileId: string,
  userId: string,
  exitCode: number | null,
): Promise<void> {
  const db = getDb()

  const webhooks = await db.webhook.findMany({
    where: {
      active: true,
      events: { has: event },
    },
  })

  if (webhooks.length === 0) return

  const payload: WebhookPayload = {
    event,
    sessionId,
    hostId,
    profileId,
    userId,
    exitCode,
    timestamp: new Date().toISOString(),
  }
  const payloadStr = JSON.stringify(payload)

  await Promise.allSettled(
    webhooks.map(async (wh: Webhook) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': payload.timestamp,
      }
      if (wh.secret) {
        headers['X-Webhook-Signature'] = signPayload(payloadStr, wh.secret)
      }

      try {
        const res = await fetch(wh.url, {
          method: 'POST',
          headers,
          body: payloadStr,
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) {
          console.warn(`[webhooks] webhook ${wh.id} failed with status ${String(res.status)}`)
        }
      } catch (err) {
        console.warn(`[webhooks] webhook ${wh.id} failed:`, err)
      }
    }),
  )
}
