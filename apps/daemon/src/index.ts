import 'dotenv/config'
import { start } from './ws-client.js'

try {
  start()
} catch (err) {
  console.error({ err }, 'daemon startup failed')
  process.exit(1)
}
