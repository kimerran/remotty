import type WebSocket from 'ws'

// Maps sessionId → the daemon WS that owns that session
const hostMap = new Map<string, WebSocket>()
// Maps sessionId → all browser WS connections watching that session
const clientMap = new Map<string, Set<WebSocket>>()

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
