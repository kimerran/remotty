# Remotty Sprint 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a walking-skeleton Agent Orchestrator where a logged-in user can spawn a Claude Code session on a local daemon and interact with it via a live xterm.js terminal in the browser.

**Architecture:** Walking skeleton — validate the PTY → WebSocket → browser pipeline first (Phases 1–4), then layer in Prisma, auth, and the full session lifecycle (Phases 5–7), finishing with Dockerfiles and Railway deploy (Phase 8). The in-memory session router handles fanout in Sprint 1; Redis pub/sub replaces it in Sprint 3.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · pnpm 9 workspaces · Prisma 6 · PostgreSQL 16 + pgvector · Redis 7 · Tailwind CSS 4 · `ws` · `node-pty` · `@xterm/xterm` · iron-session v8 · bcrypt · Zod · Pino · Vitest · Playwright

---

## File Map

```
agent-orchestrator/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json                          # root — workspace scripts only
├── pnpm-workspace.yaml
├── packages/
│   ├── config/
│   │   ├── package.json
│   │   ├── tsconfig.base.json
│   │   └── eslint.config.js
│   └── protocol/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts                  # all Zod wire-protocol schemas
├── apps/
│   ├── daemon/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  # entry: reads env, calls start()
│   │       ├── profiles.ts               # env sanitisation helpers
│   │       ├── pty-manager.ts            # PtyManager class
│   │       └── ws-client.ts              # WS reconnect loop
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── postcss.config.mjs
│       ├── next.config.ts
│       ├── server.ts                     # custom Next.js HTTP+WS server
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── src/
│           ├── app/
│           │   ├── globals.css           # Tailwind v4 @theme tokens
│           │   ├── layout.tsx            # root layout — fonts, CSP meta
│           │   ├── middleware.ts         # auth redirect + security headers
│           │   ├── login/
│           │   │   ├── page.tsx          # Server Component shell
│           │   │   └── LoginForm.tsx     # "use client" form
│           │   ├── sessions/
│           │   │   ├── new/
│           │   │   │   ├── page.tsx      # Server Component — fetches hosts+profiles
│           │   │   │   └── SpawnForm.tsx # "use client" spawn form
│           │   │   └── [id]/
│           │   │       ├── page.tsx      # Server Component — fetches session
│           │   │       └── Terminal.tsx  # "use client" xterm.js mount
│           │   └── api/
│           │       ├── auth/
│           │       │   ├── login/route.ts
│           │       │   └── logout/route.ts
│           │       └── sessions/
│           │           ├── route.ts           # POST /api/sessions
│           │           └── [id]/kill/route.ts
│           ├── server/
│           │   ├── db.ts                 # Prisma singleton
│           │   ├── auth.ts               # iron-session helpers
│           │   ├── session-router.ts     # in-memory Map routing
│           │   └── ws/
│           │       ├── host-hub.ts       # daemon WS connections
│           │       └── client-hub.ts     # browser WS connections
│           ├── lib/
│           │   └── xterm-theme.ts        # shared xterm.js theme object
│           └── components/ui/
│               ├── Button.tsx
│               ├── Card.tsx
│               ├── StatusBadge.tsx
│               ├── Input.tsx
│               ├── Label.tsx
│               └── Icon.tsx
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/eslint.config.js`
- Create: `prettier.config.js` (root)
- Create: `.prettierignore`

- [ ] **Step 1: Initialise the repo root**

```bash
mkdir agent-orchestrator && cd agent-orchestrator
git init
pnpm init
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "agent-orchestrator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter '*' build",
    "lint": "pnpm --filter '*' lint",
    "typecheck": "pnpm --filter '*' typecheck",
    "test": "pnpm --filter '*' test"
  },
  "engines": { "node": ">=22", "pnpm": ">=9" }
}
```

- [ ] **Step 4: Write `packages/config/package.json`**

```json
{
  "name": "@orchestrator/config",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./eslint.config.js": "./eslint.config.js"
  }
}
```

- [ ] **Step 5: Write `packages/config/tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 6: Write `packages/config/eslint.config.js`**

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  { ignores: ['dist/**', '.next/**', 'node_modules/**'] },
)
```

- [ ] **Step 7: Write `.gitignore`**

```
node_modules/
dist/
.next/
.env
*.env.local
.superpowers/
```

- [ ] **Step 8: Write `.env.example`**

```env
# --- web ---
DATABASE_URL=postgresql://orch:orch@localhost:5432/orch
REDIS_URL=redis://localhost:6379
SESSION_PASSWORD=change-me-32-chars-minimum-please!!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin-change-me
DEFAULT_HOST_TOKEN=replace-with-32-byte-hex-from-openssl-rand-hex-32
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=orchestrator
NODE_ENV=development
PORT=3000

# --- daemon ---
SERVER_WS_URL=ws://localhost:3000/ws/host
HOST_NAME=local-dev
HOST_TOKEN=replace-with-token-from-admin-ui
```

- [ ] **Step 9: Write `prettier.config.js`** (root)

```js
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
}
```

- [ ] **Step 10: Write `.prettierignore`**

```
dist/
.next/
node_modules/
pnpm-lock.yaml
```

- [ ] **Step 11: Install config package deps**

```bash
cd packages/config
pnpm add -D @eslint/js typescript-eslint typescript
```

- [ ] **Step 12: Install Prettier at root**

```bash
cd ../..
pnpm add -D -w prettier prettier-plugin-tailwindcss
```

Add to root `package.json` scripts:
```json
"format": "prettier --write ."
```

- [ ] **Step 10: Verify root install**

```bash
cd ../..
pnpm install
```

Expected: no errors, `node_modules` present at root and in `packages/config`.

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "chore: initialise pnpm monorepo scaffold"
```

---

## Task 2: Protocol Package

**Files:**
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`
- Test: `packages/protocol/src/index.test.ts`

- [ ] **Step 1: Write `packages/protocol/package.json`**

```json
{
  "name": "@orchestrator/protocol",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  }
}
```

- [ ] **Step 2: Write `packages/protocol/tsconfig.json`**

```json
{
  "extends": "@orchestrator/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install protocol deps**

```bash
cd packages/protocol
pnpm add zod
pnpm add -D typescript vitest @orchestrator/config
```

- [ ] **Step 4: Write the failing tests for all schemas**

`packages/protocol/src/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  HostHello, SpawnRequest, StdinChunk, Resize, Kill,
  StdoutChunk, SessionExit, ServerMessage, DaemonMessage,
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
```

- [ ] **Step 5: Run tests — expect failure (module not found)**

```bash
pnpm test
```

Expected: `Cannot find module './index.js'`

- [ ] **Step 6: Write `packages/protocol/src/index.ts`**

```ts
import { z } from 'zod'

export const HostHello = z.object({
  type: z.literal('host.hello'),
  hostName: z.string(),
  token: z.string(),
  version: z.string(),
})

export const SpawnRequest = z.object({
  type: z.literal('session.spawn'),
  sessionId: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()),
  cwd: z.string().optional(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
})

export const StdinChunk = z.object({
  type: z.literal('session.stdin'),
  sessionId: z.string(),
  data: z.string(), // base64
})

export const Resize = z.object({
  type: z.literal('session.resize'),
  sessionId: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
})

export const Kill = z.object({
  type: z.literal('session.kill'),
  sessionId: z.string(),
  signal: z.string().default('SIGTERM'),
})

export const StdoutChunk = z.object({
  type: z.literal('session.stdout'),
  sessionId: z.string(),
  data: z.string(), // base64
})

export const SessionExit = z.object({
  type: z.literal('session.exit'),
  sessionId: z.string(),
  exitCode: z.number().nullable(),
  signal: z.string().nullable(),
})

export const ServerMessage = z.discriminatedUnion('type', [
  SpawnRequest, StdinChunk, Resize, Kill,
])

export const DaemonMessage = z.discriminatedUnion('type', [
  HostHello, StdoutChunk, SessionExit,
])

export type THostHello = z.infer<typeof HostHello>
export type TSpawnRequest = z.infer<typeof SpawnRequest>
export type TStdinChunk = z.infer<typeof StdinChunk>
export type TResize = z.infer<typeof Resize>
export type TKill = z.infer<typeof Kill>
export type TStdoutChunk = z.infer<typeof StdoutChunk>
export type TSessionExit = z.infer<typeof SessionExit>
export type TServerMessage = z.infer<typeof ServerMessage>
export type TDaemonMessage = z.infer<typeof DaemonMessage>
```

- [ ] **Step 7: Run tests — expect pass**

```bash
pnpm test
```

Expected: `5 tests passed`

- [ ] **Step 8: Build the package**

```bash
pnpm build
```

Expected: `dist/index.js` and `dist/index.d.ts` created.

- [ ] **Step 9: Commit**

```bash
cd ../..
git add packages/protocol
git commit -m "feat: add protocol package with Zod wire-protocol schemas"
```

---

## Task 3: Daemon — PtyManager

**Files:**
- Create: `apps/daemon/package.json`
- Create: `apps/daemon/tsconfig.json`
- Create: `apps/daemon/src/profiles.ts`
- Create: `apps/daemon/src/pty-manager.ts`
- Test: `apps/daemon/src/pty-manager.test.ts`

- [ ] **Step 1: Write `apps/daemon/package.json`**

```json
{
  "name": "@orchestrator/daemon",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  }
}
```

- [ ] **Step 2: Write `apps/daemon/tsconfig.json`**

```json
{
  "extends": "@orchestrator/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install daemon deps**

```bash
cd apps/daemon
pnpm add node-pty ws @orchestrator/protocol
pnpm add -D typescript tsx vitest @types/node @types/ws @orchestrator/config
```

Note: `node-pty` contains native addons. On Linux/macOS it builds automatically. If build fails, run `pnpm rebuild node-pty`.

- [ ] **Step 4: Write `apps/daemon/src/profiles.ts`**

```ts
// Builds a safe env for PTY spawn — strips parent process env,
// injects only what the profile explicitly declares.
export function buildSafeEnv(profileEnv: Record<string, string>): Record<string, string> {
  return {
    PATH: process.env['PATH'] ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env['HOME'] ?? '/root',
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    ...profileEnv,
  }
}
```

- [ ] **Step 5: Write the failing PtyManager tests**

`apps/daemon/src/pty-manager.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PtyManager } from './pty-manager.js'

describe('PtyManager', () => {
  const pm = new PtyManager()
  afterEach(() => { try { pm.kill('test') } catch {} })

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
      setTimeout(() => reject(new Error('timeout')), 5000)
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
      setTimeout(() => reject(new Error('timeout')), 5000)
    })
  })

  it('resizes the PTY', () => {
    pm.spawn('resize-test', { command: 'sleep', args: ['10'], env: {}, cols: 80, rows: 24 }, () => {}, () => {})
    expect(() => pm.resize('resize-test', 120, 40)).not.toThrow()
    pm.kill('resize-test')
  })

  it('kills a session', () => {
    pm.spawn('kill-test', { command: 'sleep', args: ['60'], env: {}, cols: 80, rows: 24 }, () => {}, () => {})
    expect(() => pm.kill('kill-test', 'SIGTERM')).not.toThrow()
  })

  it('ignores write/resize/kill on unknown session', () => {
    expect(() => pm.write('nonexistent', Buffer.from('x'))).not.toThrow()
    expect(() => pm.resize('nonexistent', 80, 24)).not.toThrow()
    expect(() => pm.kill('nonexistent')).not.toThrow()
  })
})
```

- [ ] **Step 6: Run tests — expect failure**

```bash
pnpm test
```

Expected: `Cannot find module './pty-manager.js'`

- [ ] **Step 7: Write `apps/daemon/src/pty-manager.ts`**

```ts
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
    p.onData((d) => onData(Buffer.from(d, 'utf8')))
    p.onExit(({ exitCode, signal }) => {
      this.sessions.delete(id)
      onExit(exitCode ?? null, signal ? String(signal) : null)
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
```

- [ ] **Step 8: Run tests — expect pass**

```bash
pnpm test
```

Expected: `5 tests passed`

- [ ] **Step 9: Commit**

```bash
cd ../..
git add apps/daemon
git commit -m "feat(daemon): add PtyManager with env sanitisation"
```

---

## Task 4: Daemon — WS Client + Entry Point

**Files:**
- Create: `apps/daemon/src/ws-client.ts`
- Create: `apps/daemon/src/index.ts`

- [ ] **Step 1: Write `apps/daemon/src/ws-client.ts`**

```ts
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
```

- [ ] **Step 2: Write `apps/daemon/src/index.ts`**

```ts
import 'dotenv/config'
import { start } from './ws-client.js'

try {
  start()
} catch (err) {
  console.error({ err }, 'daemon startup failed')
  process.exit(1)
}
```

- [ ] **Step 3: Install dotenv**

```bash
cd apps/daemon
pnpm add dotenv
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/daemon
git commit -m "feat(daemon): add WS client with reconnect loop and entry point"
```

---

## Task 5: Web Server + WS Hubs (No Auth — Walking Skeleton)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/server.ts`
- Create: `apps/web/src/server/session-router.ts`
- Create: `apps/web/src/server/ws/host-hub.ts`
- Create: `apps/web/src/server/ws/client-hub.ts`
- Test: `apps/web/src/server/ws/hubs.test.ts`

- [ ] **Step 1: Scaffold Next.js 15 app**

```bash
cd apps/web
pnpm add next@latest react@latest react-dom@latest
pnpm add ws
pnpm add -D typescript @types/node @types/react @types/react-dom @types/ws tsx vitest tailwindcss @tailwindcss/postcss postcss @orchestrator/config
```

- [ ] **Step 2: Write `apps/web/package.json`**

```json
{
  "name": "@orchestrator/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build && tsc --project tsconfig.server.json",
    "start": "NODE_ENV=production tsx server.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  }
}
```

- [ ] **Step 3: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "@orchestrator/config/tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "server.ts"]
}
```

- [ ] **Step 4: Write `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
}

export default config
```

- [ ] **Step 5: Write `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 6: Write `apps/web/src/server/session-router.ts`**

```ts
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
    clientMap.get(sessionId)!.add(ws)
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
```

- [ ] **Step 7: Write the failing hub routing tests**

`apps/web/src/server/ws/hubs.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { sessionRouter } from '../session-router.js'
import type WebSocket from 'ws'

// Minimal mock WebSocket — enough for routing tests
function mockWs(): WebSocket {
  const messages: string[] = []
  return {
    send: (data: string) => { messages.push(data) },
    readyState: 1, // OPEN
    _messages: messages,
  } as unknown as WebSocket
}

describe('sessionRouter', () => {
  beforeEach(() => {
    // Clear maps between tests by removing any registered sessions
    // (Maps are module-level; in real tests use dependency injection)
  })

  it('routes stdout to registered clients', () => {
    const client1 = mockWs()
    const client2 = mockWs()
    sessionRouter.registerClient('sess-1', client1)
    sessionRouter.registerClient('sess-1', client2)

    const clients = sessionRouter.getClientWss('sess-1')
    expect(clients.size).toBe(2)
    expect(clients.has(client1)).toBe(true)
    expect(clients.has(client2)).toBe(true)
  })

  it('returns empty set for unknown session', () => {
    expect(sessionRouter.getClientWss('unknown').size).toBe(0)
  })

  it('removes a client', () => {
    const client = mockWs()
    sessionRouter.registerClient('sess-2', client)
    sessionRouter.removeClient('sess-2', client)
    expect(sessionRouter.getClientWss('sess-2').size).toBe(0)
  })

  it('registers and retrieves host WS', () => {
    const daemonWs = mockWs()
    sessionRouter.registerHostSession('sess-3', daemonWs)
    expect(sessionRouter.getHostWs('sess-3')).toBe(daemonWs)
  })

  it('returns sessions for a daemon', () => {
    const daemonWs = mockWs()
    sessionRouter.registerHostSession('sess-4', daemonWs)
    sessionRouter.registerHostSession('sess-5', daemonWs)
    const sessions = sessionRouter.getSessionsForDaemon(daemonWs)
    expect(sessions).toContain('sess-4')
    expect(sessions).toContain('sess-5')
  })
})
```

- [ ] **Step 8: Run tests — expect failure**

```bash
cd apps/web
pnpm test
```

Expected: `Cannot find module '../session-router.js'`

- [ ] **Step 9: Run tests again now that session-router exists — expect pass**

```bash
pnpm test
```

Expected: `5 tests passed`

- [ ] **Step 10: Write `apps/web/src/server/ws/host-hub.ts`**

```ts
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { DaemonMessage } from '@orchestrator/protocol'
import { sessionRouter } from '../session-router.js'

// Skeleton: no auth yet (added in Task 8).
// In Phase 3 we accept any daemon connection and trust all messages.
export function registerHostHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    ws.on('message', (raw) => {
      let msg: ReturnType<typeof DaemonMessage.parse>
      try {
        msg = DaemonMessage.parse(JSON.parse(raw.toString()))
      } catch {
        return // ignore malformed
      }

      switch (msg.type) {
        case 'host.hello':
          // Phase 3: log but don't authenticate yet
          console.info({ hostName: msg.hostName }, 'daemon connected')
          break

        case 'session.stdout': {
          // Fan stdout out to all browser clients watching this session
          const payload = JSON.stringify({ type: 'session.stdout', sessionId: msg.sessionId, data: msg.data })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          break
        }

        case 'session.exit': {
          const payload = JSON.stringify({ type: 'session.exit', sessionId: msg.sessionId, exitCode: msg.exitCode })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          sessionRouter.removeHostSession(msg.sessionId)
          break
        }
      }
    })

    ws.on('close', () => {
      // Clean up all sessions owned by this daemon
      for (const sessionId of sessionRouter.getSessionsForDaemon(ws)) {
        sessionRouter.removeHostSession(sessionId)
      }
    })
  })
}

/** Send a spawn request to whichever daemon is registered for a session. */
export function spawnOnDaemon(
  daemonWs: WebSocket,
  payload: Record<string, unknown>,
): void {
  if (daemonWs.readyState === WebSocket.OPEN) {
    daemonWs.send(JSON.stringify(payload))
  }
}
```

- [ ] **Step 11: Write `apps/web/src/server/ws/client-hub.ts`**

```ts
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { sessionRouter } from '../session-router.js'

// Skeleton: no auth yet (added in Task 8).
export function registerClientHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const { query } = parseUrl(req.url ?? '', true)
    const sessionId = String(query['sessionId'] ?? '')

    if (!sessionId) {
      ws.close(1008, 'sessionId required')
      return
    }

    sessionRouter.registerClient(sessionId, ws)

    ws.on('message', (raw) => {
      // Forward stdin and resize to the daemon for this session
      const daemonWs = sessionRouter.getHostWs(sessionId)
      if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return
      daemonWs.send(raw.toString())
    })

    ws.on('close', () => {
      sessionRouter.removeClient(sessionId, ws)
    })
  })
}
```

- [ ] **Step 12: Write `apps/web/server.ts`**

```ts
import next from 'next'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { registerHostHub } from './src/server/ws/host-hub.js'
import { registerClientHub } from './src/server/ws/client-hub.js'

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
```

- [ ] **Step 13: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 14: Commit**

```bash
cd ../..
git add apps/web
git commit -m "feat(web): add custom Next.js server with WS hubs (no auth)"
```

---

## Task 6: xterm.js Terminal Page ⭐ Phase 4 Milestone

**Files:**
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/lib/xterm-theme.ts`
- Create: `apps/web/src/components/ui/Icon.tsx`
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/StatusBadge.tsx`
- Create: `apps/web/src/app/sessions/[id]/Terminal.tsx`
- Create: `apps/web/src/app/sessions/[id]/page.tsx`

- [ ] **Step 1: Install xterm.js and UI deps**

```bash
cd apps/web
pnpm add @xterm/xterm @xterm/addon-fit cva class-variance-authority
```

- [ ] **Step 2: Write `apps/web/src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-surface-container-lowest: #060e20;
  --color-surface: #0b1326;
  --color-background: #0b1326;
  --color-surface-dim: #0b1326;
  --color-surface-container-low: #131b2e;
  --color-surface-container: #171f33;
  --color-surface-container-high: #222a3d;
  --color-surface-container-highest: #2d3449;
  --color-surface-variant: #2d3449;
  --color-surface-bright: #31394d;

  /* On-surface */
  --color-on-surface: #dae2fd;
  --color-on-background: #dae2fd;
  --color-on-surface-variant: #bcc9cd;
  --color-inverse-surface: #dae2fd;
  --color-inverse-on-surface: #283044;

  /* Primary */
  --color-primary: #2fd9f4;
  --color-primary-container: #00b7cf;
  --color-primary-fixed: #a2eeff;
  --color-primary-fixed-dim: #2fd9f4;
  --color-on-primary: #00363e;
  --color-on-primary-container: #00424c;
  --color-on-primary-fixed: #001f25;
  --color-on-primary-fixed-variant: #004e5a;
  --color-inverse-primary: #006877;
  --color-surface-tint: #2fd9f4;

  /* Secondary */
  --color-secondary: #b9c7e0;
  --color-secondary-container: #3c4a5e;
  --color-on-secondary: #233144;
  --color-on-secondary-container: #abb9d2;

  /* Tertiary */
  --color-tertiary: #4edea3;
  --color-tertiary-container: #1bbd85;
  --color-on-tertiary: #003824;
  --color-on-tertiary-container: #00452e;

  /* Error */
  --color-error: #ffb4ab;
  --color-error-container: #93000a;
  --color-on-error: #690005;
  --color-on-error-container: #ffdad6;

  /* Outlines */
  --color-outline: #869397;
  --color-outline-variant: #3d494c;

  /* Fonts */
  --font-headline: "Space Grotesk", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-label: "Space Grotesk", sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Radii — override Tailwind defaults */
  --radius-DEFAULT: 0.125rem;
  --radius-lg: 0.25rem;
  --radius-xl: 0.5rem;
  --radius-full: 0.75rem;
}
```

- [ ] **Step 3: Write `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--loaded-headline',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  variable: '--loaded-body',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--loaded-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Remotty',
  description: 'Agent Orchestrator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body className="bg-background text-on-surface font-body antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Write `apps/web/src/lib/xterm-theme.ts`**

```ts
import type { ITheme } from '@xterm/xterm'

export const xtermTheme: ITheme = {
  background: '#060e20',
  foreground: '#dae2fd',
  cursor: '#2fd9f4',
  cursorAccent: '#00363e',
  selectionBackground: '#2fd9f440',
  black: '#0b1326',
  red: '#ffb4ab',
  green: '#4edea3',
  yellow: '#ffd080',
  blue: '#2fd9f4',
  magenta: '#b9c7e0',
  cyan: '#2fd9f4',
  white: '#dae2fd',
  brightBlack: '#3d494c',
  brightRed: '#ffb4ab',
  brightGreen: '#4edea3',
  brightYellow: '#ffd080',
  brightBlue: '#2fd9f4',
  brightMagenta: '#b9c7e0',
  brightCyan: '#2fd9f4',
  brightWhite: '#dae2fd',
}
```

- [ ] **Step 5: Write `apps/web/src/components/ui/Icon.tsx`**

```tsx
interface IconProps {
  name: string
  className?: string
  'aria-label'?: string
}

export function Icon({ name, className = '', 'aria-label': ariaLabel }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
    >
      {name}
    </span>
  )
}
```

- [ ] **Step 6: Write `apps/web/src/components/ui/Button.tsx`**

```tsx
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-bold uppercase transition-all active:scale-95 focus:ring-1 focus:ring-primary focus:outline-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-lg text-xs tracking-widest py-3 px-4',
        mega:
          'w-full bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-xl py-6 font-headline font-black text-2xl tracking-tighter active:scale-[0.98] group relative overflow-hidden',
        outline:
          'border border-primary/30 text-primary rounded-lg text-xs tracking-widest py-2 px-4 hover:bg-primary/5',
        icon: 'text-on-surface-variant hover:text-primary p-1 rounded',
        destructive: 'text-on-surface-variant hover:text-error p-1 rounded',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ variant, className = '', children, ...props }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, className })} {...props}>
      {children}
    </button>
  )
}
```

- [ ] **Step 7: Write `apps/web/src/components/ui/StatusBadge.tsx`**

```tsx
import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase',
  {
    variants: {
      status: {
        running: 'bg-tertiary/10 text-tertiary',
        completed: 'bg-primary/10 text-primary',
        errored: 'bg-error/10 text-error',
        pending: 'bg-on-surface-variant/10 text-on-surface-variant',
      },
    },
  },
)

const dotVariants = cva('w-1.5 h-1.5 rounded-full', {
  variants: {
    status: {
      running: 'bg-tertiary animate-pulse',
      completed: 'bg-primary',
      errored: 'bg-error',
      pending: 'bg-on-surface-variant',
    },
  },
})

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={badgeVariants({ status })}>
      <span className={dotVariants({ status })} />
      {label ?? status}
    </span>
  )
}
```

- [ ] **Step 8: Write `apps/web/src/app/sessions/[id]/Terminal.tsx`**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { xtermTheme } from '@/lib/xterm-theme'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
}

export function Terminal({ sessionId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      theme: xtermTheme,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${location.host}/ws/client?sessionId=${sessionId}`)
    ws.binaryType = 'arraybuffer'

    ws.onmessage = (e) => {
      try {
        const msg: unknown = JSON.parse(
          typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer),
        )
        if (
          msg !== null &&
          typeof msg === 'object' &&
          'type' in msg &&
          (msg as Record<string, unknown>)['type'] === 'session.stdout' &&
          'data' in msg
        ) {
          const data = (msg as Record<string, unknown>)['data'] as string
          term.write(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)))
        }
      } catch {
        // ignore malformed messages
      }
    }

    term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'session.stdin', sessionId, data: btoa(d) }))
      }
    })

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'session.resize', sessionId, cols: term.cols, rows: term.rows }))
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ws.close()
      term.dispose()
      ro.disconnect()
    }
  }, [sessionId])

  return <div ref={containerRef} className="h-full w-full bg-surface-container-lowest" />
}
```

- [ ] **Step 9: Write `apps/web/src/app/sessions/[id]/page.tsx`** (Phase 4 skeleton — no DB yet)

```tsx
import { Terminal } from './Terminal'

// In Phase 4 the sessionId comes from the URL and we don't validate it against
// the DB yet. That validation is added in Task 9 when Prisma is wired in.
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="flex h-screen bg-background">
      {/* Collapsed icon sidebar */}
      <aside className="w-14 bg-surface-container flex flex-col items-center py-8 gap-6 border-r border-outline-variant/10">
        <span className="text-[10px] font-headline font-black text-primary tracking-tighter">R</span>
        <nav className="flex flex-col gap-4 mt-4">
          {['dashboard', 'terminal', 'dns', 'menu_book'].map((icon) => (
            <span key={icon} className="material-symbols-outlined text-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
              {icon}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">{id}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/10 text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              Running
            </span>
          </div>
          <button
            className="text-on-surface-variant hover:text-error transition-colors p-1"
            aria-label="Kill session"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </header>

        {/* Terminal fills remaining height */}
        <main className="flex-1 overflow-hidden">
          <Terminal sessionId={id} />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Smoke test the walking skeleton**

In one terminal:
```bash
cd apps/daemon
HOST_NAME=local-dev HOST_TOKEN=dev-token SERVER_WS_URL=ws://localhost:3000/ws/host pnpm dev
```

In another terminal:
```bash
cd apps/web
DATABASE_URL='' REDIS_URL='' SESSION_PASSWORD=test-password-32-chars-here NODE_ENV=development pnpm dev
```

Trigger a spawn manually from a third terminal (replace with a real WS test client or `websocat`):
```bash
# From the host hub perspective: the daemon is connected.
# Open browser at http://localhost:3000/sessions/test-session
# The terminal should attempt to connect to /ws/client?sessionId=test-session
```

Expected: terminal renders in browser, no crash in either process.

- [ ] **Step 11: Commit**

```bash
cd ../..
git add apps/web
git commit -m "feat(web): add xterm.js terminal page with Tailwind v4 design system"
```

---

## Task 7: Docker Compose + Prisma

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/seed.ts`
- Create: `apps/web/src/server/db.ts`
- Test: `apps/web/src/server/db.test.ts`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: orch
      POSTGRES_PASSWORD: orch
      POSTGRES_DB: orch
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes: ["miniodata:/data"]

volumes:
  pgdata: {}
  miniodata: {}
```

- [ ] **Step 2: Start Docker services**

```bash
docker compose up -d
```

Expected: postgres, redis, minio containers running.

- [ ] **Step 3: Install Prisma in web app**

```bash
cd apps/web
pnpm add @prisma/client
pnpm add -D prisma
```

- [ ] **Step 4: Write `apps/web/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String
  role         Role      @default(ADMIN)
  createdAt    DateTime  @default(now())
  sessions     Session[]
}

enum Role { ADMIN USER }

model Host {
  id         String     @id @default(cuid())
  name       String     @unique
  token      String     @unique
  lastSeenAt DateTime?
  online     Boolean    @default(false)
  createdAt  DateTime   @default(now())
  sessions   Session[]
}

model Profile {
  id        String    @id @default(cuid())
  name      String    @unique
  command   String
  args      String[]
  env       Json
  cwd       String?
  createdAt DateTime  @default(now())
  sessions  Session[]
}

model Session {
  id        String        @id @default(cuid())
  hostId    String
  profileId String
  userId    String
  status    SessionStatus @default(PENDING)
  pid       Int?
  startedAt DateTime      @default(now())
  endedAt   DateTime?
  exitCode  Int?
  host      Host          @relation(fields: [hostId], references: [id])
  profile   Profile       @relation(fields: [profileId], references: [id])
  user      User          @relation(fields: [userId], references: [id])
  events    SessionEvent[]
}

enum SessionStatus { PENDING RUNNING EXITED ERROR }

model SessionEvent {
  id        BigInt   @id @default(autoincrement())
  sessionId String
  ts        DateTime @default(now())
  kind      String
  data      Bytes
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, ts])
}
```

- [ ] **Step 5: Run initial migration**

```bash
cd apps/web
DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm prisma migrate dev --name init
```

Expected: `Applying migration 'init'` and Prisma client generated.

- [ ] **Step 6: Write `apps/web/src/server/db.ts`**

```ts
import { PrismaClient } from '@prisma/client'

// Singleton pattern: prevents multiple PrismaClient instances in dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env['NODE_ENV'] !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 7: Write the failing seed test**

`apps/web/src/server/db.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from './db.js'

// These tests require a real database. Run: docker compose up -d
// then: DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm test

describe('seed data', () => {
  beforeAll(async () => {
    // Ensure seed has been run before this test
    await db.$connect()
  })

  afterAll(async () => {
    await db.$disconnect()
  })

  it('admin user exists', async () => {
    const user = await db.user.findUnique({ where: { username: 'admin' } })
    expect(user).not.toBeNull()
    expect(user?.role).toBe('ADMIN')
    expect(user?.passwordHash).not.toBe('') // never store plaintext
    expect(user?.passwordHash).not.toBe(process.env['ADMIN_PASSWORD']) // must be hashed
  })

  it('default Claude Code profile exists', async () => {
    const profile = await db.profile.findUnique({ where: { name: 'Claude Code (native)' } })
    expect(profile).not.toBeNull()
    expect(profile?.command).toBe('claude')
    expect(profile?.args).toContain('--dangerously-skip-permissions')
  })

  it('default local-dev host exists', async () => {
    const host = await db.host.findUnique({ where: { name: 'local-dev' } })
    expect(host).not.toBeNull()
    expect(host?.token).not.toBe(process.env['DEFAULT_HOST_TOKEN']) // must be hashed
  })
})
```

- [ ] **Step 8: Run test — expect failure (no seed data)**

```bash
DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm test -- src/server/db.test.ts
```

Expected: `admin user exists — FAIL` (no rows yet)

- [ ] **Step 9: Write `apps/web/prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const db = new PrismaClient()

async function main() {
  const adminUsername = process.env['ADMIN_USERNAME']
  const adminPassword = process.env['ADMIN_PASSWORD']
  const defaultHostToken = process.env['DEFAULT_HOST_TOKEN']

  if (!adminUsername || !adminPassword || !defaultHostToken) {
    throw new Error('ADMIN_USERNAME, ADMIN_PASSWORD, and DEFAULT_HOST_TOKEN are required for seeding')
  }

  const BCRYPT_COST = 12

  // Admin user
  await db.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, BCRYPT_COST),
      role: 'ADMIN',
    },
  })

  // Default Claude Code profile
  await db.profile.upsert({
    where: { name: 'Claude Code (native)' },
    update: {},
    create: {
      name: 'Claude Code (native)',
      command: 'claude',
      args: ['--dangerously-skip-permissions'],
      env: {},
      cwd: process.env['HOME'] ?? '/root',
    },
  })

  // Default local-dev host (Sprint 1 substitute for Host registration UI)
  await db.host.upsert({
    where: { name: 'local-dev' },
    update: {},
    create: {
      name: 'local-dev',
      token: await bcrypt.hash(defaultHostToken, BCRYPT_COST),
    },
  })

  console.info('seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
```

- [ ] **Step 10: Add seed script to `apps/web/package.json`**

Add to `scripts`:
```json
"db:seed": "tsx prisma/seed.ts"
```

- [ ] **Step 11: Install bcrypt in web**

```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt
```

- [ ] **Step 12: Run seed**

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-change-me DEFAULT_HOST_TOKEN=dev-token-32-chars-xxxxxxxxxx \
  DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm db:seed
```

Expected: `seed complete`

- [ ] **Step 13: Run tests — expect pass**

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-change-me DEFAULT_HOST_TOKEN=dev-token-32-chars-xxxxxxxxxx \
  DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm test -- src/server/db.test.ts
```

Expected: `3 tests passed`

- [ ] **Step 14: Commit**

```bash
cd ../..
git add docker-compose.yml apps/web/prisma apps/web/src/server/db.ts apps/web/src/server/db.test.ts
git commit -m "feat: add Docker Compose services, Prisma schema, migration, and seed"
```

---

## Task 8: Auth — Login, iron-session, Rate Limiting, WS Auth Guard

**Files:**
- Create: `apps/web/src/server/auth.ts`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/login/LoginForm.tsx`
- Create: `apps/web/src/app/api/auth/login/route.ts`
- Create: `apps/web/src/app/api/auth/logout/route.ts`
- Create: `apps/web/src/app/middleware.ts`
- Modify: `apps/web/src/server/ws/client-hub.ts`
- Test: `apps/web/src/app/api/auth/login/route.test.ts`

- [ ] **Step 1: Install auth deps**

```bash
cd apps/web
pnpm add iron-session ioredis
pnpm add -D @types/bcrypt
```

- [ ] **Step 2: Write `apps/web/src/server/auth.ts`**

```ts
import { getIronSession, type IronSessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { unsealData } from 'iron-session'
import type { IncomingMessage } from 'node:http'
import { parse as parseCookie } from 'node:querystring'

export interface SessionData {
  userId?: string
  username?: string
}

export const sessionOptions: IronSessionOptions = {
  password: process.env['SESSION_PASSWORD']!,
  cookieName: 'remotty-session',
  cookieOptions: {
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}

/** Use in Server Components and Route Handlers (App Router) */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}

/** Returns session or null; never throws */
export async function requireAuth(): Promise<SessionData | null> {
  const session = await getSession()
  if (!session.userId) return null
  return { userId: session.userId, username: session.username }
}

/** Extract iron-session data from a raw HTTP upgrade request (WS context).
 *  Uses `unsealData` directly since `next/headers` is unavailable in WS handlers.
 */
export async function getSessionFromWsRequest(req: IncomingMessage): Promise<SessionData | null> {
  const cookieHeader = req.headers['cookie'] ?? ''
  // Parse cookies manually: "key=val; key2=val2"
  const cookieMap: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) cookieMap[k.trim()] = decodeURIComponent(v.join('=').trim())
  }
  const sealed = cookieMap['remotty-session']
  if (!sealed) return null
  try {
    return await unsealData<SessionData>(sealed, { password: process.env['SESSION_PASSWORD']! })
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Write failing auth route tests**

`apps/web/src/app/api/auth/login/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('@/server/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock iron-session
vi.mock('iron-session', () => ({
  getIronSession: vi.fn().mockResolvedValue({
    userId: undefined,
    username: undefined,
    save: vi.fn(),
  }),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}))

import { POST } from './route.js'
import { db } from '@/server/db'
import bcrypt from 'bcrypt'

describe('POST /api/auth/login', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 on invalid body', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 on unknown username', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'nobody', password: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 on wrong password', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: '1', username: 'admin', passwordHash: await bcrypt.hash('correct', 12),
      role: 'ADMIN', createdAt: new Date(), sessions: [],
    } as never)
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 on correct credentials', async () => {
    const hash = await bcrypt.hash('correct', 12)
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1', username: 'admin', passwordHash: hash,
      role: 'ADMIN', createdAt: new Date(), sessions: [],
    } as never)
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'correct' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 4: Run tests — expect failure**

```bash
pnpm test -- src/app/api/auth/login/route.test.ts
```

Expected: `Cannot find module './route.js'`

- [ ] **Step 5: Write `apps/web/src/server/rate-limit.ts`**

```ts
import { Redis } from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379')
  return redis
}

/** Returns true if the request is allowed, false if rate-limited.
 *  Uses a sliding window: max `limit` attempts per `windowSecs` per `key`.
 */
export async function checkRateLimit(
  key: string,
  limit = 5,
  windowSecs = 60,
): Promise<boolean> {
  const r = getRedis()
  const now = Date.now()
  const windowKey = `rl:${key}:${Math.floor(now / (windowSecs * 1000))}`
  const count = await r.incr(windowKey)
  if (count === 1) await r.expire(windowKey, windowSecs)
  return count <= limit
}
```

- [ ] **Step 6: Write `apps/web/src/app/api/auth/login/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { db } from '@/server/db'
import { getSession } from '@/server/auth'
import { checkRateLimit } from '@/server/rate-limit'

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit: 5 attempts per minute per IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const allowed = await checkRateLimit(`login:${ip}`)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })
  }

  const body: unknown = await req.json()
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { username, password } = parsed.data

  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    // Constant-time response to prevent username enumeration
    await bcrypt.hash('dummy', 12)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const session = await getSession()
  session.userId = user.id
  session.username = user.username
  await session.save()

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Run tests — expect pass**

```bash
pnpm test -- src/app/api/auth/login/route.test.ts
```

Expected: `4 tests passed`

- [ ] **Step 8: Write `apps/web/src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/server/auth'

export async function POST(): Promise<NextResponse> {
  const session = await getSession()
  session.destroy()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 9: Write `apps/web/src/app/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from './server/auth'
import { sessionOptions } from './server/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.next()

  // Security headers
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (process.env['NODE_ENV'] === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:; img-src 'self' data:;",
  )

  // Auth guard
  const path = req.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p))
  if (isPublic) return res

  const session = await getIronSession<SessionData>(req.cookies, sessionOptions)
  if (!session.userId) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 10: Write `apps/web/src/app/login/LoginForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
    })

    if (res.ok) {
      router.push('/sessions/new')
    } else {
      const data = (await res.json()) as { error?: string }
      setError(data.error ?? 'Login failed')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="username" className="block text-xs font-bold text-primary font-label uppercase tracking-widest mb-3">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/40"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-bold text-primary font-label uppercase tracking-widest mb-3">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/40"
        />
      </div>
      {error && (
        <p className="text-xs text-error font-mono">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed py-3 rounded-lg font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
```

- [ ] **Step 11: Write `apps/web/src/app/login/page.tsx`**

```tsx
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline font-black text-2xl text-primary tracking-tighter">Remotty v1.0</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-on-surface-variant mt-1">Agent Orchestrator</p>
        </div>
        <div className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/10">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 12: Update `client-hub.ts` with auth guard**

Replace the connection handler in `apps/web/src/server/ws/client-hub.ts`:

```ts
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { db } from '../db.js'
import { getSessionFromWsRequest } from '../auth.js'
import { sessionRouter } from '../session-router.js'

export function registerClientHub(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const { query } = parseUrl(req.url ?? '', true)
    const sessionId = String(query['sessionId'] ?? '')

    if (!sessionId) {
      ws.close(1008, 'sessionId required')
      return
    }

    // Auth: verify the requesting user owns this session
    const sessionData = await getSessionFromWsRequest(req)
    if (!sessionData?.userId) {
      ws.close(1008, 'Unauthorized')
      return
    }

    const dbSession = await db.session.findUnique({ where: { id: sessionId } })
    if (!dbSession || dbSession.userId !== sessionData.userId) {
      ws.close(1008, 'Forbidden')
      return
    }

    sessionRouter.registerClient(sessionId, ws)

    ws.on('message', (raw) => {
      const daemonWs = sessionRouter.getHostWs(sessionId)
      if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return
      daemonWs.send(raw.toString())
    })

    ws.on('close', () => {
      sessionRouter.removeClient(sessionId, ws)
    })
  })
}
```

- [ ] **Step 13: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 14: Commit**

```bash
cd ../..
git add apps/web/src/server/auth.ts apps/web/src/server/rate-limit.ts apps/web/src/app/login apps/web/src/app/api/auth apps/web/src/app/middleware.ts apps/web/src/server/ws/client-hub.ts
git commit -m "feat(web): add auth — login page, iron-session, bcrypt, Redis rate limit, WS auth guard"
```

---

## Task 9: Session Lifecycle — /sessions/new, API Routes, DB Updates

**Files:**
- Create: `apps/web/src/app/sessions/new/SpawnForm.tsx`
- Create: `apps/web/src/app/sessions/new/page.tsx`
- Create: `apps/web/src/app/api/sessions/route.ts`
- Create: `apps/web/src/app/api/sessions/[id]/kill/route.ts`
- Modify: `apps/web/src/server/ws/host-hub.ts`
- Modify: `apps/web/src/app/sessions/[id]/page.tsx`

- [ ] **Step 1: Write `apps/web/src/app/api/sessions/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { spawnOnDaemon } from '@/server/ws/host-hub'

const CreateSessionBody = z.object({
  hostId: z.string().cuid(),
  profileId: z.string().cuid(),
  cols: z.number().int().positive().default(220),
  rows: z.number().int().positive().default(50),
})

export async function POST(req: Request): Promise<NextResponse> {
  const authSession = await requireAuth()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json()
  const parsed = CreateSessionBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { hostId, profileId, cols, rows } = parsed.data

  // Verify host is online
  const host = await db.host.findUnique({ where: { id: hostId } })
  if (!host?.online) return NextResponse.json({ error: 'Host not available' }, { status: 409 })

  const profile = await db.profile.findUnique({ where: { id: profileId } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Create session record
  const session = await db.session.create({
    data: {
      hostId,
      profileId,
      userId: authSession.userId!,
      status: 'PENDING',
    },
  })

  // Send spawn command to daemon via host-hub
  const daemonWs = spawnOnDaemon(session.id, {
    type: 'session.spawn',
    sessionId: session.id,
    command: profile.command,
    args: profile.args,
    env: profile.env as Record<string, string>,
    cwd: profile.cwd ?? undefined,
    cols,
    rows,
  })

  if (!daemonWs) {
    await db.session.update({ where: { id: session.id }, data: { status: 'ERROR' } })
    return NextResponse.json({ error: 'No daemon available for this host' }, { status: 503 })
  }

  // Optimistically mark as RUNNING — the daemon will send session.exit when it actually ends
  await db.session.update({ where: { id: session.id }, data: { status: 'RUNNING' } })

  return NextResponse.json({ sessionId: session.id })
}
```

- [ ] **Step 2: Update `host-hub.ts` — add `spawnOnDaemon` + DB status updates**

Replace `apps/web/src/server/ws/host-hub.ts`:

```ts
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { DaemonMessage } from '@orchestrator/protocol'
import { sessionRouter } from '../session-router.js'
import { db } from '../db.js'
import bcrypt from 'bcrypt'

// Maps hostId → daemon WS (used to route spawn commands)
const daemonByHost = new Map<string, WebSocket>()

export function registerHostHub(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    let authenticatedHostId: string | null = null

    ws.on('message', (raw) => {
      let msg: ReturnType<typeof DaemonMessage.parse>
      try {
        msg = DaemonMessage.parse(JSON.parse(raw.toString()))
      } catch {
        return
      }

      switch (msg.type) {
        case 'host.hello':
          void authenticateHost(ws, msg.hostName, msg.token).then((hostId) => {
            if (!hostId) { ws.close(1008, 'Invalid host token'); return }
            authenticatedHostId = hostId
            daemonByHost.set(hostId, ws)
          })
          break

        case 'session.stdout': {
          if (!authenticatedHostId) { ws.close(1008, 'Not authenticated'); return }
          const payload = JSON.stringify({ type: 'session.stdout', sessionId: msg.sessionId, data: msg.data })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          break
        }

        case 'session.exit': {
          if (!authenticatedHostId) return
          const payload = JSON.stringify({ type: 'session.exit', sessionId: msg.sessionId, exitCode: msg.exitCode })
          for (const client of sessionRouter.getClientWss(msg.sessionId)) {
            if (client.readyState === WebSocket.OPEN) client.send(payload)
          }
          sessionRouter.removeHostSession(msg.sessionId)
          void db.session.update({
            where: { id: msg.sessionId },
            data: {
              status: msg.exitCode === 0 ? 'EXITED' : 'ERROR',
              exitCode: msg.exitCode,
              endedAt: new Date(),
            },
          })
          break
        }
      }
    })

    ws.on('close', () => {
      if (authenticatedHostId) {
        daemonByHost.delete(authenticatedHostId)
        void db.host.update({ where: { id: authenticatedHostId }, data: { online: false } })
      }
      for (const sessionId of sessionRouter.getSessionsForDaemon(ws)) {
        sessionRouter.removeHostSession(sessionId)
      }
    })
  })
}

async function authenticateHost(ws: WebSocket, hostName: string, token: string): Promise<string | null> {
  const host = await db.host.findUnique({ where: { name: hostName } })
  if (!host) return null
  const valid = await bcrypt.compare(token, host.token)
  if (!valid) return null
  await db.host.update({ where: { id: host.id }, data: { online: true, lastSeenAt: new Date() } })
  return host.id
}

/**
 * Sends a spawn command to the daemon for the given hostId.
 * Returns the daemon WS if found and online, null otherwise.
 * Also registers the session→daemon mapping in the router.
 */
export function spawnOnDaemon(
  sessionId: string,
  payload: Record<string, unknown>,
): WebSocket | null {
  // For Sprint 1 with a single daemon, pick the first available
  const daemonWs = [...daemonByHost.values()][0]
  if (!daemonWs || daemonWs.readyState !== WebSocket.OPEN) return null
  sessionRouter.registerHostSession(sessionId, daemonWs)
  daemonWs.send(JSON.stringify(payload))
  return daemonWs
}
```

- [ ] **Step 3: Write `apps/web/src/app/api/sessions/[id]/kill/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { sessionRouter } from '@/server/session-router'
import { WebSocket } from 'ws'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authSession = await requireAuth()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  const session = await db.session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.userId !== authSession.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const daemonWs = sessionRouter.getHostWs(sessionId)
  if (daemonWs?.readyState === WebSocket.OPEN) {
    daemonWs.send(JSON.stringify({ type: 'session.kill', sessionId, signal: 'SIGTERM' }))
  }

  await db.session.update({
    where: { id: sessionId },
    data: { status: 'EXITED', endedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Write `apps/web/src/app/sessions/new/SpawnForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'

interface Host { id: string; name: string }
interface Profile { id: string; name: string }

export function SpawnForm({ hosts, profiles }: { hosts: Host[]; profiles: Profile[] }) {
  const [hostId, setHostId] = useState(hosts[0]?.id ?? '')
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId, profileId }),
    })

    if (res.ok) {
      const data = (await res.json()) as { sessionId: string }
      router.push(`/sessions/${data.sessionId}`)
    } else {
      const data = (await res.json()) as { error?: string }
      setError(data.error ?? 'Failed to spawn session')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">Host</h3>
        <p className="text-sm text-on-surface-variant mb-3">Where the agent will run</p>
        <div className="relative">
          <select
            value={hostId}
            onChange={(e) => setHostId(e.target.value)}
            className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
          >
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">Profile</h3>
        <p className="text-sm text-on-surface-variant mb-3">Agent command + environment</p>
        <div className="relative">
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
        </div>
      </div>

      {error && <p className="text-xs text-error font-mono">{error}</p>}

      <button
        type="submit"
        disabled={loading || !hostId || !profileId}
        className="group relative w-full overflow-hidden bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-xl py-6 font-headline font-black text-2xl tracking-tighter uppercase active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
      >
        <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Icon name="rocket_launch" className="text-3xl group-hover:translate-x-2 transition-transform" />
        {loading ? 'Spawning…' : 'Spawn Agent Session'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Write `apps/web/src/app/sessions/new/page.tsx`**

```tsx
import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { redirect } from 'next/navigation'
import { SpawnForm } from './SpawnForm'

export default async function NewSessionPage() {
  const auth = await requireAuth()
  if (!auth) redirect('/login')

  const [hosts, profiles] = await Promise.all([
    db.host.findMany({ where: { online: true }, select: { id: true, name: true } }),
    db.profile.findMany({ select: { id: true, name: true } }),
  ])

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-14 bg-surface-container flex flex-col items-center py-8 gap-6 border-r border-outline-variant/10">
        <span className="text-[10px] font-headline font-black text-primary tracking-tighter">R</span>
        <nav className="flex flex-col gap-4 mt-4">
          {['dashboard', 'terminal', 'dns', 'menu_book'].map((icon) => (
            <span key={icon} className="material-symbols-outlined text-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
              {icon}
            </span>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8 max-w-2xl">
        <h1 className="text-4xl font-headline font-bold tracking-tighter mb-2">
          New <span className="text-primary">Session</span>
        </h1>
        <p className="text-sm text-on-surface-variant mb-8">Spawn a coding agent on a connected host</p>

        {hosts.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
            <p className="text-sm text-on-surface-variant font-mono">No hosts online. Start the daemon and wait for it to connect.</p>
          </div>
        ) : (
          <SpawnForm hosts={hosts} profiles={profiles} />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 6: Update `/sessions/[id]/page.tsx` to fetch real session from DB**

Replace `apps/web/src/app/sessions/[id]/page.tsx`:

```tsx
import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { redirect, notFound } from 'next/navigation'
import { Terminal } from './Terminal'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth) redirect('/login')

  const { id } = await params
  const session = await db.session.findUnique({
    where: { id },
    include: { host: true, profile: true },
  })

  if (!session || session.userId !== auth.userId) notFound()

  const statusLabel = session.status.toLowerCase() as 'running' | 'pending' | 'completed' | 'errored'

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-14 bg-surface-container flex flex-col items-center py-8 gap-6 border-r border-outline-variant/10">
        <span className="text-[10px] font-headline font-black text-primary tracking-tighter">R</span>
        <nav className="flex flex-col gap-4 mt-4">
          {['dashboard', 'terminal', 'dns', 'menu_book'].map((icon) => (
            <span key={icon} className="material-symbols-outlined text-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
              {icon}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">{id.slice(0, 12)}…</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
              session.status === 'RUNNING' ? 'bg-tertiary/10 text-tertiary' :
              session.status === 'EXITED' ? 'bg-primary/10 text-primary' :
              'bg-error/10 text-error'
            }`}>
              {session.status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />}
              {session.status}
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {session.host.name} · {session.profile.name}
            </span>
          </div>
          <form action={`/api/sessions/${id}/kill`} method="POST">
            <button
              type="submit"
              className="text-on-surface-variant hover:text-error transition-colors p-1"
              aria-label="Kill session"
              disabled={session.status !== 'RUNNING' && session.status !== 'PENDING'}
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </form>
        </header>

        <main className="flex-1 overflow-hidden">
          <Terminal sessionId={id} />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify typecheck**

```bash
cd apps/web
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 8: Full smoke test**

```bash
# Terminal 1: start docker services
docker compose up -d

# Terminal 2: seed the DB
cd apps/web
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-change-me DEFAULT_HOST_TOKEN=dev-token-32-chars-xxxxxxxxxx \
  DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm prisma migrate dev
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-change-me DEFAULT_HOST_TOKEN=dev-token-32-chars-xxxxxxxxxx \
  DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm db:seed

# Terminal 3: start daemon
cd apps/daemon
HOST_NAME=local-dev HOST_TOKEN=dev-token-32-chars-xxxxxxxxxx \
  SERVER_WS_URL=ws://localhost:3000/ws/host pnpm dev

# Terminal 4: start web server (copy all vars from .env or set inline)
cd apps/web
DATABASE_URL=postgresql://orch:orch@localhost:5432/orch \
  REDIS_URL=redis://localhost:6379 \
  SESSION_PASSWORD="change-me-32-chars-minimum-please!!" \
  ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-change-me \
  DEFAULT_HOST_TOKEN=dev-token-32-chars-xxxxxxxxxx \
  NODE_ENV=development pnpm dev
```

Expected flow:
1. Open http://localhost:3000 → redirected to /login
2. Login with admin / admin-change-me → redirected to /sessions/new
3. Host "local-dev" appears in dropdown (online: true after daemon connects)
4. Click "Spawn Agent Session" → redirected to /sessions/[id]
5. xterm.js terminal appears with live PTY output

- [ ] **Step 9: Commit**

```bash
cd ../..
git add apps/web/src
git commit -m "feat(web): add session lifecycle — spawn, kill, /sessions/new, auth-guarded terminal"
```

---

## Task 10: Dockerfiles, Railway Deploy, README, E2E Test

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/daemon/Dockerfile`
- Create: `apps/web/tests/e2e/smoke.test.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `README.md`

- [ ] **Step 1: Write `apps/web/Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/protocol/package.json ./packages/protocol/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter protocol build
RUN cd apps/web && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/server.ts ./apps/web/server.ts
RUN pnpm add -g tsx
EXPOSE 3000
CMD ["sh", "-c", "cd apps/web && npx prisma migrate deploy && tsx server.ts"]
```

- [ ] **Step 2: Write `apps/daemon/Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/protocol/package.json ./packages/protocol/
COPY apps/daemon/package.json ./apps/daemon/
RUN pnpm install --frozen-lockfile
RUN pnpm rebuild node-pty

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter protocol build
RUN pnpm --filter daemon build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/daemon/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 0
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Install Playwright**

```bash
cd apps/web
pnpm add -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 4: Write `apps/web/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
  },
  webServer: process.env['CI'] ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 5: Write the failing E2E smoke test**

`apps/web/tests/e2e/smoke.test.ts`:
```ts
import { test, expect } from '@playwright/test'

test('redirects unauthenticated user to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('login page renders brand', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Remotty v1.0')).toBeVisible()
  await expect(page.getByText('Agent Orchestrator')).toBeVisible()
})

test('login with wrong credentials shows error', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="username"]', 'admin')
  await page.fill('input[name="password"]', 'wrong-password')
  await page.click('button[type="submit"]')
  await expect(page.getByText(/invalid credentials/i)).toBeVisible()
})

test('login with correct credentials reaches /sessions/new', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="username"]', process.env['ADMIN_USERNAME'] ?? 'admin')
  await page.fill('input[name="password"]', process.env['ADMIN_PASSWORD'] ?? 'admin-change-me')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/sessions\/new/)
  await expect(page.getByText(/new session/i)).toBeVisible()
})
```

- [ ] **Step 6: Run E2E tests (requires running server + seeded DB)**

```bash
cd apps/web
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-change-me BASE_URL=http://localhost:3000 npx playwright test
```

Expected: `4 tests passed`

- [ ] **Step 7: Write `README.md`**

Create at repo root:

```markdown
# Remotty — Agent Orchestrator

Spawn and manage coding agents (Claude Code, Codex, etc.) across machines with a live browser terminal.

## Quick Start

**Prerequisites:** Node.js 22+, pnpm 9+, Docker

```bash
# 1. Install deps
pnpm install

# 2. Start local services (Postgres, Redis, MinIO)
docker compose up -d

# 3. Copy and fill env vars
cp .env.example .env
# Edit .env — set SESSION_PASSWORD (32+ chars) and DEFAULT_HOST_TOKEN

# 4. Run DB migration and seed
pnpm --filter web prisma migrate dev
pnpm --filter web db:seed

# 5. Start the web server
pnpm dev

# 6. In a separate terminal, start the daemon
cd apps/daemon
HOST_NAME=local-dev HOST_TOKEN=<your DEFAULT_HOST_TOKEN> \
  SERVER_WS_URL=ws://localhost:3000/ws/host pnpm dev
```

Open http://localhost:3000 and log in with the admin credentials from `.env`.

## Railway Deploy

1. Create a Railway project with a Postgres plugin.
2. Set all env vars from `.env.example` on the web service.
3. Push — Railway builds from `apps/web/Dockerfile`.
4. Run the daemon locally, pointing `SERVER_WS_URL` at your Railway `wss://` URL.

## Monorepo

| Package | Purpose |
|---|---|
| `packages/protocol` | Shared Zod wire-protocol schemas |
| `packages/config` | Shared tsconfig + ESLint config |
| `apps/web` | Next.js 15 app (UI + API + WS hub + Prisma) |
| `apps/daemon` | Host PTY daemon |

## Scripts

```bash
pnpm build      # build all packages
pnpm test       # run all tests
pnpm lint       # lint all packages
pnpm typecheck  # typecheck all packages
```
```

- [ ] **Step 8: Verify Docker builds**

```bash
# From repo root
docker build -f apps/web/Dockerfile -t remotty-web .
docker build -f apps/daemon/Dockerfile -t remotty-daemon .
```

Expected: both images build without error.

- [ ] **Step 9: Run full DoD checklist**

```bash
pnpm build       # must pass
pnpm test        # must pass
pnpm lint        # must pass
pnpm typecheck   # must pass
```

- [ ] **Step 10: Commit**

```bash
git add apps/web/Dockerfile apps/daemon/Dockerfile apps/web/tests apps/web/playwright.config.ts README.md
git commit -m "feat: add Dockerfiles, Playwright E2E smoke test, README"
```

---

## Self-Review Checklist

Before marking Sprint 1 complete, verify against SPEC.md and AGENT.md §7:

- [ ] `pnpm build` passes at repo root
- [ ] `pnpm test` passes (unit tests for protocol schemas, PtyManager, WS routing, auth routes, DB seed)
- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `docker build` succeeds for both `web` and `daemon`
- [ ] `railway up` deploys the web service without manual steps beyond env vars
- [ ] README updated with all env vars in `.env.example`
- [ ] Manual smoke test: login → /sessions/new → spawn → live terminal in browser ✓
- [ ] `pnpm audit` — no high/critical vulnerabilities
- [ ] No TypeScript `any` without justification comment
- [ ] No secrets in git history (`git log --all --oneline -- .env`)
