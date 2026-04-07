import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { DaemonMessage } from '@orchestrator/protocol'
import { sessionRouter } from '../session-router.js'

// Skeleton: no auth yet (added in Task 8).
export function registerHostHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    ws.on('message', (raw) => {
      let msg: ReturnType<typeof DaemonMessage.parse>
      try {
        msg = DaemonMessage.parse(JSON.parse(raw.toString()))
      } catch {
        return // ignore malformed
      }

      switch (msg.type) {
        case 'host.hello':
          console.info({ hostName: msg.hostName }, 'daemon connected')
          break

        case 'session.stdout': {
          const payload = JSON.stringify({ type: 'session.stdout', sessionId: msg.sessionId, data: msg.data })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          break
        }

        case 'session.exit': {
          const payload = JSON.stringify({ type: 'session.exit', sessionId: msg.sessionId, exitCode: msg.exitCode })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          sessionRouter.removeHostSession(msg.sessionId)
          break
        }
      }
    })

    ws.on('close', () => {
      for (const sessionId of sessionRouter.getSessionsForDaemon(ws)) {
        sessionRouter.removeHostSession(sessionId)
      }
    })
  })
}

/** Send a spawn request to a daemon WS and register the session mapping. */
export function spawnOnDaemon(
  daemonWs: WebSocket,
  payload: Record<string, unknown>,
): void {
  if (daemonWs.readyState === WebSocket.OPEN) {
    daemonWs.send(JSON.stringify(payload))
  }
}
