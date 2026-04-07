import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { getDb } from '@/server/db'
import { getSessionFromWsRequest } from '@/server/auth'
import { sessionRouter } from '@/server/session-router'
import { subscribeToSession } from '@/server/redis-pubsub'

// Tracks the Redis unsubscribe function per sessionId (for this instance)
// Stored on globalThis so the custom server and Next.js route handlers share the same instance
if (!globalThis.redisUnsubMap) globalThis.redisUnsubMap = new Map<string, () => void>()
const redisUnsubMap = globalThis.redisUnsubMap as Map<string, () => void>

export function registerClientHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    void handleConnection(ws, req)
  })
}

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const { query } = parseUrl(req.url ?? '', true)
  const sessionId = String(query['sessionId'] ?? '')

  if (!sessionId) {
    ws.close(1008, 'sessionId required')
    return
  }

  // Auth: verify the requesting user owns this session
  const sessionData = await getSessionFromWsRequest(req)
  if (!sessionData?.userId) {
    ws.close(1008, 'Unauthorized')
    return
  }

  const dbSession = await getDb().session.findUnique({ where: { id: sessionId } })
  if (!dbSession || dbSession.userId !== sessionData.userId) {
    ws.close(1008, 'Forbidden')
    return
  }

  // Register the client and subscribe to Redis channel if first client for this session
  sessionRouter.registerClient(sessionId, ws)

  // Subscribe to Redis pub/sub for this session (cross-instance broadcast)
  let unsubscribe: (() => void) | undefined
  if (!redisUnsubMap.has(sessionId)) {
    unsubscribe = await subscribeToSession(sessionId, (msg: string) => {
      // Broadcast Redis messages to all local browser clients for this session
      for (const client of sessionRouter.getClientWss(sessionId)) {
        if (client.readyState === WebSocket.OPEN) client.send(msg)
      }
    })
    redisUnsubMap.set(sessionId, unsubscribe)
  }

  ws.on('message', (raw) => {
    const daemonWs = sessionRouter.getHostWs(sessionId)
    if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return
    const rawStr = Buffer.isBuffer(raw)
      ? raw.toString('utf8')
      : Array.isArray(raw)
        ? Buffer.concat(raw).toString('utf8')
        : Buffer.from(raw).toString('utf8')
    daemonWs.send(rawStr)
  })

  ws.on('close', () => {
    sessionRouter.removeClient(sessionId, ws)
    // If no more clients for this session, unsubscribe from Redis
    if (sessionRouter.getClientWss(sessionId).size === 0) {
      const unsub = redisUnsubMap.get(sessionId)
      if (unsub) {
        unsub()
        redisUnsubMap.delete(sessionId)
      }
    }
  })
}
