import WebSocket from 'ws'
import { PtyManager } from './pty-manager.js'
import { ServerMessage } from '@orchestrator/protocol'

const RECONNECT_DELAY_MS = 2000

export function start(): void {
  const serverUrl = process.env['SERVER_WS_URL']
  const hostName = process.env['HOST_NAME']
  const hostToken = process.env['HOST_TOKEN']

  if (!serverUrl || !hostName || !hostToken) {
    throw new Error('SERVER_WS_URL, HOST_NAME, and HOST_TOKEN are required')
  }

  const pm = new PtyManager()
  connect(serverUrl, hostName, hostToken, pm)
}

function connect(url: string, hostName: string, token: string, pm: PtyManager): void {
  const ws = new WebSocket(url, {
    headers: { 'x-host-token': token },
  })

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'host.hello',
      hostName,
      token,
      version: '0.1.0',
    }))
  })

  ws.on('message', (raw) => {
    let msg: ReturnType<typeof ServerMessage.parse>
    try {
      msg = ServerMessage.parse(JSON.parse(raw.toString()))
    } catch (err) {
      console.error({ err, raw: raw.toString() }, 'invalid server message — ignoring')
      return
    }

    switch (msg.type) {
      case 'session.spawn':
        pm.spawn(
          msg.sessionId,
          { command: msg.command, args: msg.args, env: msg.env, cwd: msg.cwd, cols: msg.cols, rows: msg.rows },
          (buf) => ws.send(JSON.stringify({ type: 'session.stdout', sessionId: msg.sessionId, data: buf.toString('base64') })),
          (exitCode, signal) => ws.send(JSON.stringify({ type: 'session.exit', sessionId: msg.sessionId, exitCode, signal })),
        )
        break
      case 'session.stdin':
        pm.write(msg.sessionId, Buffer.from(msg.data, 'base64'))
        break
      case 'session.resize':
        pm.resize(msg.sessionId, msg.cols, msg.rows)
        break
      case 'session.kill':
        pm.kill(msg.sessionId, msg.signal)
        break
    }
  })

  ws.on('error', (err) => {
    console.error({ err }, 'daemon WS error')
  })

  ws.on('close', () => {
    console.warn(`daemon disconnected — reconnecting in ${RECONNECT_DELAY_MS}ms`)
    setTimeout(() => connect(url, hostName, token, pm), RECONNECT_DELAY_MS)
  })
}
