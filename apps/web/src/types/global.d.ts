import type { PrismaClient } from '@prisma/client'
import type WebSocket from 'ws'

interface RingBufferEntry {
  chunks: Buffer[]
  totalBytes: number
  lastFlushMs: number
}

declare global {
  var prisma: PrismaClient | undefined
  var srHostMap: Map<string, WebSocket> | undefined
  var srClientMap: Map<string, Set<WebSocket>> | undefined
  var daemonByHost: Map<string, WebSocket> | undefined
  var sessionHostMap: Map<string, string> | undefined
  var sessionRingBuffer: Map<string, RingBufferEntry> | undefined
  var redisUnsubMap: Map<string, () => void> | undefined
}
