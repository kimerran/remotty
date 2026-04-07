import { WebSocketServer, WebSocket } from 'ws'
import { Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { DaemonMessage } from '@orchestrator/protocol'
import { sessionRouter } from '@/server/session-router'
import { getDb } from '@/server/db'
import bcrypt from 'bcrypt'
import { publishToSession } from '@/server/redis-pubsub'
import { parseClaudeCodeLine, generateSummary, type ParsedEvent } from '@/server/agent-parser'
import { notifyWebhooks } from '@/server/webhooks'

// Maps hostId → daemon WS (used to route spawn commands)
// Stored on globalThis so the custom server and Next.js route handlers share the same instance
if (!globalThis.daemonByHost) globalThis.daemonByHost = new Map<string, WebSocket>()
const daemonByHost = globalThis.daemonByHost

// Maps sessionId → hostId (used to route client stdin back to the right daemon)
if (!globalThis.sessionHostMap) globalThis.sessionHostMap = new Map<string, string>()
const sessionHostMap = globalThis.sessionHostMap

// Ring buffer for PTY output — batches chunks before flushing to SessionEvent table
// Key: sessionId. Value: accumulated buffer + metadata
interface RingBufferEntry {
  chunks: Buffer[]
  totalBytes: number
  lastFlushMs: number
}
if (!globalThis.sessionRingBuffer) globalThis.sessionRingBuffer = new Map<string, RingBufferEntry>()
const ringBuffer = globalThis.sessionRingBuffer as Map<string, RingBufferEntry>

const RING_BUFFER_MAX_BYTES = 4096 // flush when buffer reaches this size
const RING_BUFFER_FLUSH_INTERVAL_MS = 500 // also flush after this idle period

async function flushRingBuffer(sessionId: string): Promise<void> {
  const entry = ringBuffer.get(sessionId)
  if (!entry || entry.chunks.length === 0) return

  const data = Buffer.concat(entry.chunks)
  entry.chunks = []
  entry.totalBytes = 0
  entry.lastFlushMs = Date.now()

  try {
    const db: PrismaClient = getDb()

    // Store raw stdout event
    await db.sessionEvent.create({
      data: {
        sessionId,
        kind: 'stdout',
        data,
      },
    })

    // Parse and store agent-aware events
    const text = data.toString('utf8')
    const lines = text.split('\n')
    const parsedEvents: ParsedEvent[] = []

    for (const line of lines) {
      const parsed = parseClaudeCodeLine(line, new Date())
      if (parsed) {
        parsedEvents.push(parsed)
      }
    }

    if (parsedEvents.length > 0) {
      await db.parsedEvent.createMany({
        data: parsedEvents.map((e) => ({
          sessionId,
          kind: e.kind,
          data: JSON.parse(JSON.stringify(e.data)) as Prisma.InputJsonValue,
          ts: e.ts,
        })),
      })

      // Generate and store summary if we have events
      if (parsedEvents.length > 0) {
        const summary = generateSummary(
          parsedEvents.map((e) => ({ kind: e.kind, data: e.data, ts: e.ts })),
        )
        await db.sessionMetric.upsert({
          where: { sessionId },
          create: { sessionId, summary },
          update: { summary },
        })
      }
    }
  } catch (err) {
    console.error(`[host-hub] failed to flush ring buffer for session ${sessionId}:`, err)
  }
}

function bufferStdout(sessionId: string, chunk: Buffer): void {
  const now = Date.now()
  let entry = ringBuffer.get(sessionId)
  if (!entry) {
    entry = { chunks: [], totalBytes: 0, lastFlushMs: now }
    ringBuffer.set(sessionId, entry)
  }
  entry.chunks.push(chunk)
  entry.totalBytes += chunk.length

  // Flush if buffer is full
  if (entry.totalBytes >= RING_BUFFER_MAX_BYTES) {
    void flushRingBuffer(sessionId)
    return
  }

  // Lazy timer: if no flush in a while, drain the buffer
  // We don't create a real timer per session to avoid resource leaks.
  // Instead, we check on each write and flush if stale.
  if (now - entry.lastFlushMs > RING_BUFFER_FLUSH_INTERVAL_MS) {
    void flushRingBuffer(sessionId)
  }
}

export function registerHostHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
    let authenticatedHostId: string | null = null

    ws.on('message', (raw: Buffer | Buffer[] | string) => {
      void handleMessage(raw)
    })

    async function handleMessage(raw: Buffer | Buffer[] | string): Promise<void> {
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
          // Buffer and flush PTY output to SessionEvent table
          const decoded = Buffer.from(msg.data, 'base64')
          bufferStdout(msg.sessionId, decoded)
          // Publish to Redis for horizontal scaling (other instances broadcast to their clients)
          void publishToSession(msg.sessionId, payload)
          break
        }

        case 'session.exit': {
          if (!authenticatedHostId) return
          const payload = JSON.stringify({ type: 'session.exit', sessionId: msg.sessionId, exitCode: msg.exitCode })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          sessionRouter.removeHostSession(msg.sessionId)
          sessionHostMap.delete(msg.sessionId)
          // Flush any remaining buffered output before marking session as done
          await flushRingBuffer(msg.sessionId)
          ringBuffer.delete(msg.sessionId)
          // Publish to Redis for horizontal scaling
          void publishToSession(msg.sessionId, payload)

          // Get session for webhook notification
          const session = await getDb().session.findUnique({
            where: { id: msg.sessionId },
            select: { hostId: true, profileId: true, userId: true },
          })

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

          // Send webhook notifications
          if (session) {
            const eventType = msg.exitCode === 0 ? 'session.exit' : 'session.error'
            void notifyWebhooks(eventType, msg.sessionId, session.hostId, session.profileId, session.userId, msg.exitCode)
          }
          break
        }
      }
    }

    ws.on('close', () => {
      if (authenticatedHostId) {
        daemonByHost.delete(authenticatedHostId)
        void getDb().host.update({ where: { id: authenticatedHostId }, data: { online: false } }).catch(() => {})
      }
      for (const sessionId of sessionRouter.getSessionsForDaemon(ws)) {
        sessionRouter.removeHostSession(sessionId)
        sessionHostMap.delete(sessionId)
        void flushRingBuffer(sessionId)
        ringBuffer.delete(sessionId)
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
  hostId: string,
  payload: Record<string, unknown>,
): WebSocket | null {
  const daemonWs = daemonByHost.get(hostId)
  if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return null
  sessionRouter.registerHostSession(sessionId, daemonWs)
  sessionHostMap.set(sessionId, hostId)
  daemonWs.send(JSON.stringify(payload))
  return daemonWs
}

export function getHostIdForSession(sessionId: string): string | undefined {
  return sessionHostMap.get(sessionId)
}
