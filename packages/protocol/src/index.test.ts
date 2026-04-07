import { describe, it, expect } from 'vitest'
import {
  HostHello, SpawnRequest,
  ServerMessage, DaemonMessage,
} from './index.js'

describe('HostHello', () => {
  it('accepts valid payload', () => {
    expect(HostHello.parse({
      type: 'host.hello', hostName: 'local', token: 'tok', version: '0.1.0',
    })).toBeTruthy()
  })
  it('rejects missing token', () => {
    expect(() => HostHello.parse({ type: 'host.hello', hostName: 'x', version: '1' })).toThrow()
  })
})

describe('SpawnRequest', () => {
  it('accepts valid payload', () => {
    expect(SpawnRequest.parse({
      type: 'session.spawn', sessionId: 'abc', command: 'echo',
      args: ['hi'], env: { FOO: 'bar' }, cols: 80, rows: 24,
    })).toBeTruthy()
  })
  it('rejects non-positive cols', () => {
    expect(() => SpawnRequest.parse({
      type: 'session.spawn', sessionId: 'abc', command: 'echo',
      args: [], env: {}, cols: 0, rows: 24,
    })).toThrow()
  })
})

describe('ServerMessage discriminated union', () => {
  it('parses session.stdin', () => {
    const msg = ServerMessage.parse({ type: 'session.stdin', sessionId: 'x', data: 'aGk=' })
    expect(msg.type).toBe('session.stdin')
  })
  it('rejects unknown type', () => {
    expect(() => ServerMessage.parse({ type: 'unknown', sessionId: 'x' })).toThrow()
  })
})

describe('DaemonMessage discriminated union', () => {
  it('parses session.stdout', () => {
    const msg = DaemonMessage.parse({ type: 'session.stdout', sessionId: 'x', data: 'aGk=' })
    expect(msg.type).toBe('session.stdout')
  })
  it('parses session.exit with null exitCode', () => {
    const msg = DaemonMessage.parse({ type: 'session.exit', sessionId: 'x', exitCode: null, signal: null })
    expect(msg.type).toBe('session.exit')
  })
})
