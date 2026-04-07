import type WebSocket from 'ws'

// Stored on globalThis so the custom server and Next.js route handlers share the same instance
const g = globalThis as unknown as { srHostMap?: Map<string, WebSocket>; srClientMap?: Map<string, Set<WebSocket>> }
if (!g.srHostMap) g.srHostMap = new Map<string, WebSocket>()
if (!g.srClientMap) g.srClientMap = new Map<string, Set<WebSocket>>()
// Maps sessionId → the daemon WS that owns that session
const hostMap = g.srHostMap
// Maps sessionId → all browser WS connections watching that session
const clientMap = g.srClientMap

export const sessionRouter = {
  registerHostSession(sessionId: string, ws: WebSocket): void {
    hostMap.set(sessionId, ws)
  },

  registerClient(sessionId: string, ws: WebSocket): void {
    if (!clientMap.has(sessionId)) clientMap.set(sessionId, new Set())
    clientMap.get(sessionId)?.add(ws)
  },

  getHostWs(sessionId: string): WebSocket | undefined {
    return hostMap.get(sessionId)
  },

  getClientWss(sessionId: string): Set<WebSocket> {
    return clientMap.get(sessionId) ?? new Set()
  },

  removeHostSession(sessionId: string): void {
    hostMap.delete(sessionId)
  },

  removeClient(sessionId: string, ws: WebSocket): void {
    clientMap.get(sessionId)?.delete(ws)
  },

  /** Returns all sessionIds owned by a given daemon WS */
  getSessionsForDaemon(daemonWs: WebSocket): string[] {
    return [...hostMap.entries()]
      .filter(([, ws]) => ws === daemonWs)
      .map(([id]) => id)
  },
}
