import next from 'next'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { registerHostHub } from './src/server/ws/host-hub.js'
import { registerClientHub } from './src/server/ws/client-hub.js'

async function start() {
  const dev = process.env['NODE_ENV'] !== 'production'
  const port = Number(process.env['PORT'] ?? 3000)
  const app = next({ dev })
  const handle = app.getRequestHandler()

  await app.prepare()

  const server = createServer((req, res) => {
    void handle(req, res)
  })

  const hostWss = new WebSocketServer({ noServer: true })
  const clientWss = new WebSocketServer({ noServer: true })
  registerHostHub(hostWss)
  registerClientHub(clientWss)

  server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? ''
    if (url.startsWith('/ws/host')) {
      hostWss.handleUpgrade(req, socket, head, (ws) => hostWss.emit('connection', ws, req))
    } else if (url.startsWith('/ws/client')) {
      clientWss.handleUpgrade(req, socket, head, (ws) => clientWss.emit('connection', ws, req))
    } else {
      socket.destroy()
    }
  })

  server.listen(port, () => {
    console.info(`server listening on http://localhost:${port}`)
  })
}

start().catch((err) => { console.error(err); process.exit(1) })
