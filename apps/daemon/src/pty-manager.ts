import * as pty from 'node-pty'
import { buildSafeEnv } from './profiles.js'

export interface SpawnOpts {
  command: string
  args: string[]
  env: Record<string, string>
  cwd?: string
  cols: number
  rows: number
}

export class PtyManager {
  private readonly sessions = new Map<string, pty.IPty>()

  spawn(
    id: string,
    opts: SpawnOpts,
    onData: (buf: Buffer) => void,
    onExit: (exitCode: number | null, signal: string | null) => void,
  ): number {
    const safeEnv = buildSafeEnv(opts.env)
    const p = pty.spawn(opts.command, opts.args, {
      name: 'xterm-256color',
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd ?? process.env['HOME'] ?? '/tmp',
      env: safeEnv,
    })
    p.onData((d) => { onData(Buffer.from(d, 'utf8')) })
    p.onExit(({ exitCode, signal }) => {
      this.sessions.delete(id)
      onExit(exitCode, signal ? String(signal) : null)
    })
    this.sessions.set(id, p)
    return p.pid
  }

  write(id: string, data: Buffer): void {
    this.sessions.get(id)?.write(data.toString('utf8'))
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.resize(cols, rows)
  }

  kill(id: string, signal = 'SIGTERM'): void {
    this.sessions.get(id)?.kill(signal)
  }
}
