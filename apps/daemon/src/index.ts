import 'dotenv/config'
import { parseArgs } from 'node:util'
import { start } from './ws-client.js'

const { values } = parseArgs({
  options: {
    cwd: { type: 'string', short: 'c' },
  },
})

if (values.cwd) {
  try {
    process.chdir(values.cwd)
    console.log(`daemon cwd set to: ${process.cwd()}`)
  } catch (err) {
    console.error({ err }, `failed to chdir to ${values.cwd}`)
    process.exit(1)
  }
}

try {
  start()
} catch (err) {
  console.error({ err }, 'daemon startup failed')
  process.exit(1)
}
