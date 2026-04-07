import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { getDb } from '@/server/db'
import { getSessionFromWsRequest } from '@/server/auth'
import { sessionRouter } from '@/server/session-router'

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

  sessionRouter.registerClient(sessionId, ws)

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
  })
}
