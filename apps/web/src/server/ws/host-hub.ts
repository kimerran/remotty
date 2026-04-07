import { WebSocketServer, WebSocket } from 'ws'
import { DaemonMessage } from '@orchestrator/protocol'
import { sessionRouter } from '@/server/session-router'
import { getDb } from '@/server/db'
import bcrypt from 'bcrypt'

// Maps hostId → daemon WS (used to route spawn commands)
// Stored on globalThis so the custom server and Next.js route handlers share the same instance
if (!globalThis.daemonByHost) globalThis.daemonByHost = new Map<string, WebSocket>()
const daemonByHost = globalThis.daemonByHost

export function registerHostHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
    let authenticatedHostId: string | null = null

    ws.on('message', (raw) => {
      let msg: ReturnType<typeof DaemonMessage.parse>
      const rawStr = Buffer.isBuffer(raw)
        ? raw.toString('utf8')
        : Array.isArray(raw)
          ? Buffer.concat(raw).toString('utf8')
          : Buffer.from(raw).toString('utf8')
      try {
        msg = DaemonMessage.parse(JSON.parse(rawStr))
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
          void getDb().session.update({
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
        void getDb().host.update({ where: { id: authenticatedHostId }, data: { online: false } }).catch(() => {})
      }
      for (const sessionId of sessionRouter.getSessionsForDaemon(ws)) {
        sessionRouter.removeHostSession(sessionId)
      }
    })
  })
}

async function authenticateHost(ws: WebSocket, hostName: string, token: string): Promise<string | null> {
  const host = await getDb().host.findUnique({ where: { name: hostName } })
  if (!host) return null
  const valid = await bcrypt.compare(token, host.token)
  if (!valid) return null
  // Known TOCTOU: host could be deleted between findUnique and update. If that happens,
  // Prisma's update silently no-ops (no row matched), which is acceptable — the daemon
  // will be rejected on its next heartbeat or reconnect.
  await getDb().host.update({ where: { id: host.id }, data: { online: true, lastSeenAt: new Date() } })
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
  const daemonWs: WebSocket | undefined = [...daemonByHost.values()][0]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return null
  sessionRouter.registerHostSession(sessionId, daemonWs)
  daemonWs.send(JSON.stringify(payload))
  return daemonWs
}
