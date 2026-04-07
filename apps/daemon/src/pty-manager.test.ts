import { describe, it, expect, afterEach } from 'vitest'
import { PtyManager } from './pty-manager.js'

describe('PtyManager', () => {
  const pm = new PtyManager()
  afterEach(() => {
    try { pm.kill('test') } catch { /* ignore */ }
  })

  it('spawns a process and receives stdout', async () => {
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      pm.spawn(
        'test',
        { command: 'echo', args: ['hello'], env: {}, cols: 80, rows: 24 },
        (buf) => { chunks.push(buf) },
        (exitCode) => {
          expect(exitCode).toBe(0)
          const output = Buffer.concat(chunks).toString()
          expect(output).toContain('hello')
          resolve()
        },
      )
      setTimeout(() => { reject(new Error('timeout')) }, 5000)
    })
  })

  it('forwards stdin to the process', async () => {
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      pm.spawn(
        'stdin-test',
        { command: 'cat', args: [], env: {}, cols: 80, rows: 24 },
        (buf) => { chunks.push(buf) },
        () => {
          const output = Buffer.concat(chunks).toString()
          expect(output).toContain('ping')
          resolve()
        },
      )
      setTimeout(() => {
        pm.write('stdin-test', Buffer.from('ping\n'))
        pm.kill('stdin-test', 'SIGTERM')
      }, 100)
      setTimeout(() => { reject(new Error('timeout')) }, 5000)
    })
  })

  it('resizes the PTY', () => {
    pm.spawn('resize-test', { command: 'sleep', args: ['10'], env: {}, cols: 80, rows: 24 }, () => { /* noop */ }, () => { /* noop */ })
    expect(() => { pm.resize('resize-test', 120, 40) }).not.toThrow()
    pm.kill('resize-test')
  })

  it('kills a session', () => {
    pm.spawn('kill-test', { command: 'sleep', args: ['60'], env: {}, cols: 80, rows: 24 }, () => { /* noop */ }, () => { /* noop */ })
    expect(() => { pm.kill('kill-test', 'SIGTERM') }).not.toThrow()
  })

  it('ignores write/resize/kill on unknown session', () => {
    expect(() => { pm.write('nonexistent', Buffer.from('x')) }).not.toThrow()
    expect(() => { pm.resize('nonexistent', 80, 24) }).not.toThrow()
    expect(() => { pm.kill('nonexistent') }).not.toThrow()
  })
})
