import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { db } from '../db.js'
import { getSessionFromWsRequest } from '../auth.js'
import { sessionRouter } from '../session-router.js'

export function registerClientHub(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
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

    const dbSession = await db.session.findUnique({ where: { id: sessionId } })
    if (!dbSession || dbSession.userId !== sessionData.userId) {
      ws.close(1008, 'Forbidden')
      return
    }

    sessionRouter.registerClient(sessionId, ws)

    ws.on('message', (raw) => {
      const daemonWs = sessionRouter.getHostWs(sessionId)
      if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return
      daemonWs.send(raw.toString())
    })

    ws.on('close', () => {
      sessionRouter.removeClient(sessionId, ws)
    })
  })
}
