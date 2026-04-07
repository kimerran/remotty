import { Redis } from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379')
  return redis
}

/** Returns true if the request is allowed, false if rate-limited.
 *  Uses a fixed window: max `limit` attempts per `windowSecs` per `key`.
 *  Note: up to 2x the limit is possible at window boundaries.
 */
export async function checkRateLimit(
  key: string,
  limit = 5,
  windowSecs = 60,
): Promise<boolean> {
  const r = getRedis()
  const now = Date.now()
  const windowKey = `rl:${key}:${Math.floor(now / (windowSecs * 1000))}`
  const count = await r.incr(windowKey)
  if (count === 1) await r.expire(windowKey, windowSecs)
  return count <= limit
}
