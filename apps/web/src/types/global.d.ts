import type { PrismaClient } from '@prisma/client'
import type WebSocket from 'ws'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
  // Maps sessionId → the daemon WS that owns that session
  // eslint-disable-next-line no-var
  var srHostMap: Map<string, WebSocket> | undefined
  // Maps sessionId → all browser WS connections watching that session
  // eslint-disable-next-line no-var
  var srClientMap: Map<string, Set<WebSocket>> | undefined
  // Maps hostId → daemon WS (used to route spawn commands)
  // eslint-disable-next-line no-var
  var daemonByHost: Map<string, WebSocket> | undefined
}
