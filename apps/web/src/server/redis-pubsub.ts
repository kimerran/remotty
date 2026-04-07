import { Redis } from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  }
  return redis
}

// Subscribe to a session channel for cross-instance broadcast
export async function subscribeToSession(
  sessionId: string,
  handler: (message: string) => void,
): Promise<() => void> {
  const r = getRedis()
  const channel = `session:${sessionId}`
  await r.subscribe(channel)
  const listener = (ch: string, msg: string) => {
    if (ch === channel) handler(msg)
  }
  r.on('message', listener)
  return () => {
    r.off('message', listener)
    void r.unsubscribe(channel)
  }
}

// Publish a message to a session channel
export async function publishToSession(sessionId: string, message: string): Promise<void> {
  const r = getRedis()
  await r.publish(`session:${sessionId}`, message)
}
