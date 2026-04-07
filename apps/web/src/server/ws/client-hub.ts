import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { sessionRouter } from '../session-router.js'

// Skeleton: no auth yet (added in Task 8).
export function registerClientHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const { query } = parseUrl(req.url ?? '', true)
    const sessionId = String(query['sessionId'] ?? '')

    if (!sessionId) {
      ws.close(1008, 'sessionId required')
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
