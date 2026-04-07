import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { DaemonMessage } from '@orchestrator/protocol'
import { sessionRouter } from '../session-router.js'
import { db } from '../db.js'
import bcrypt from 'bcrypt'

// Maps hostId → daemon WS (used to route spawn commands)
const daemonByHost = new Map<string, WebSocket>()

export function registerHostHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let authenticatedHostId: string | null = null

    ws.on('message', (raw) => {
      let msg: ReturnType<typeof DaemonMessage.parse>
      try {
        msg = DaemonMessage.parse(JSON.parse(raw.toString()))
      } catch {
        return
      }

      switch (msg.type) {
        case 'host.hello':
          void authenticateHost(ws, msg.hostName, msg.token).then((hostId) => {
            if (!hostId) { ws.close(1008, 'Invalid host token'); return }
            authenticatedHostId = hostId
            daemonByHost.set(hostId, ws)
          })
          break

        case 'session.stdout': {
          if (!authenticatedHostId) { ws.close(1008, 'Not authenticated'); return }
          const payload = JSON.stringify({ type: 'session.stdout', sessionId: msg.sessionId, data: msg.data })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          break
        }

        case 'session.exit': {
          if (!authenticatedHostId) return
          const payload = JSON.stringify({ type: 'session.exit', sessionId: msg.sessionId, exitCode: msg.exitCode })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          sessionRouter.removeHostSession(msg.sessionId)
          void db.session.update({
            where: { id: msg.sessionId },
            data: {
              status: msg.exitCode === 0 ? 'EXITED' : 'ERROR',
              exitCode: msg.exitCode,
              endedAt: new Date(),
            },
          }).catch(() => {
            // Session may not exist if it was already cleaned up
          })
          break
        }
      }
    })

    ws.on('close', () => {
      if (authenticatedHostId) {
        daemonByHost.delete(authenticatedHostId)
        void db.host.update({ where: { id: authenticatedHostId }, data: { online: false } }).catch(() => {})
      }
      for (const sessionId of sessionRouter.getSessionsForDaemon(ws)) {
        sessionRouter.removeHostSession(sessionId)
      }
    })
  })
}

async function authenticateHost(ws: WebSocket, hostName: string, token: string): Promise<string | null> {
  const host = await db.host.findUnique({ where: { name: hostName } })
  if (!host) return null
  const valid = await bcrypt.compare(token, host.token)
  if (!valid) return null
  await db.host.update({ where: { id: host.id }, data: { online: true, lastSeenAt: new Date() } })
  return host.id
}

/**
 * Sends a spawn command to the daemon for the given hostId.
 * Returns the daemon WS if found and online, null otherwise.
 * Also registers the session→daemon mapping in the router.
 */
export function spawnOnDaemon(
  sessionId: string,
  payload: Record<string, unknown>,
): WebSocket | null {
  // For Sprint 1 with a single daemon, pick the first available
  const daemonWs = [...daemonByHost.values()][0]
  if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return null
  sessionRouter.registerHostSession(sessionId, daemonWs)
  daemonWs.send(JSON.stringify(payload))
  return daemonWs
}
