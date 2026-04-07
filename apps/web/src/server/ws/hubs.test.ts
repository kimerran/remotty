import { describe, it, expect } from 'vitest'
import { sessionRouter } from '../session-router.js'
import type WebSocket from 'ws'

function mockWs(): WebSocket {
  return {
    send: () => {},
    readyState: 1,
  } as unknown as WebSocket
}

describe('sessionRouter', () => {
  it('routes stdout to registered clients', () => {
    const client1 = mockWs()
    const client2 = mockWs()
    sessionRouter.registerClient('sess-1', client1)
    sessionRouter.registerClient('sess-1', client2)

    const clients = sessionRouter.getClientWss('sess-1')
    expect(clients.size).toBeGreaterThanOrEqual(2)
    expect(clients.has(client1)).toBe(true)
    expect(clients.has(client2)).toBe(true)
  })

  it('returns empty set for unknown session', () => {
    expect(sessionRouter.getClientWss('unknown-' + Date.now()).size).toBe(0)
  })

  it('removes a client', () => {
    const client = mockWs()
    const key = 'sess-remove-' + Date.now()
    sessionRouter.registerClient(key, client)
    sessionRouter.removeClient(key, client)
    expect(sessionRouter.getClientWss(key).size).toBe(0)
  })

  it('registers and retrieves host WS', () => {
    const daemonWs = mockWs()
    const key = 'sess-host-' + Date.now()
    sessionRouter.registerHostSession(key, daemonWs)
    expect(sessionRouter.getHostWs(key)).toBe(daemonWs)
  })

  it('returns sessions for a daemon', () => {
    const daemonWs = mockWs()
    const key1 = 'sess-daemon1-' + Date.now()
    const key2 = 'sess-daemon2-' + Date.now()
    sessionRouter.registerHostSession(key1, daemonWs)
    sessionRouter.registerHostSession(key2, daemonWs)
    const sessions = sessionRouter.getSessionsForDaemon(daemonWs)
    expect(sessions).toContain(key1)
    expect(sessions).toContain(key2)
  })
})
