# Remotty Sprint 1 — Implementation Design

**Date:** 2026-04-07
**Scope:** Sprint 1 MVP only — single host, single session, live browser terminal
**Stack:** Next.js 15 App Router · TypeScript strict · pnpm monorepo · Prisma 6 · Postgres 16 · Redis 7 · Tailwind 4 · `ws` · `node-pty` · xterm.js

---

## 1. Build Approach

**Walking Skeleton** — validate the riskiest integration (PTY → WebSocket → xterm.js) before layering in auth and the database. The pipeline is proven at Phase 4; everything after is additive.

Rationale: the PTY ↔ WS ↔ browser streaming path spans three processes, involves binary encoding, and has the most integration risk. Discovering a problem here at Phase 8 (post-auth, post-DB) would be expensive. Auth and Prisma are well-understood; the terminal pipeline is not.

---

## 2. Build Sequence (8 Phases)

### Phase 1 — Monorepo Scaffold
**Deliverable:** `pnpm install` + `pnpm lint` + `pnpm typecheck` all pass at repo root.

- `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- `packages/config/`: shared `tsconfig.base.json` and ESLint 9 flat config
- `packages/protocol/src/index.ts`: all Zod schemas from SPEC.md §6 (HostHello, SpawnRequest, StdinChunk, Resize, Kill, StdoutChunk, SessionExit, ServerMessage, DaemonMessage)
- `.env.example` with all required vars documented
- Root `package.json` with `dev`, `build`, `lint`, `typecheck`, `test` scripts

### Phase 2 — Daemon Core
**Deliverable:** Daemon connects to a test WS server, spawns a PTY, streams stdout, accepts stdin/resize/kill.

- `apps/daemon/src/pty-manager.ts` — `PtyManager` class (spawn/write/resize/kill); strips parent env, injects only `PATH`, `HOME`, `TERM`, plus profile env
- `apps/daemon/src/ws-client.ts` — connects to `SERVER_WS_URL`, sends `host.hello`, handles all `ServerMessage` types, reconnects after 2s on close
- `apps/daemon/src/index.ts` — entry point, reads env vars, calls `start()`
- All PTY output base64-encoded into `session.stdout` JSON messages

### Phase 3 — Web Server + WS Hubs (No Auth)
**Deliverable:** Daemon connects on `/ws/host`; a test browser page can connect on `/ws/client` and receive routed messages.

- `apps/web/server.ts` — custom Next.js server; HTTP upgrade routing to `hostWss` (`/ws/host`) and `clientWss` (`/ws/client`)
- `src/server/ws/host-hub.ts` — accepts daemon connections; on `session.stdout` / `session.exit`, fans out to all registered client WS for that session; sends `session.spawn` / `session.kill` commands to daemon
- `src/server/ws/client-hub.ts` — accepts browser connections (query param `?sessionId=`); on `session.stdin` / `session.resize`, forwards to the daemon WS for that session
- `src/server/session-router.ts` — in-memory Maps: `sessionId → daemonWs` and `sessionId → Set<clientWs>`; no auth checks yet (added in Phase 6)

### Phase 4 — xterm.js Browser Terminal ⭐ Core Milestone
**Deliverable:** Navigate to `/sessions/[hardcoded-id]`, see live PTY output, type back. The full pipeline is proven.

- Next.js app scaffold: Tailwind 4 config with all color tokens from DESIGN.md §2; fonts loaded via `next/font/google` (Space Grotesk, Inter, JetBrains Mono)
- `src/components/ui/`: `Button`, `Card`, `StatusBadge`, `Input`, `Label`, `Icon` primitives per DESIGN.md §6
- `src/lib/xterm-theme.ts` — single exported theme object (bg `#060e20`, fg `#dae2fd`, cursor `#2fd9f4`, selection `#2fd9f440`)
- `src/app/sessions/[id]/Terminal.tsx` — `"use client"` component; mounts xterm.js + FitAddon; opens WS on `/ws/client?sessionId=`; decodes base64 stdout → writes to terminal; encodes keystrokes → sends `session.stdin`; ResizeObserver → sends `session.resize`; cleans up on unmount
- `src/app/sessions/[id]/page.tsx` — Server Component shell rendering `<Terminal sessionId={params.id} />`

### Phase 5 — Docker Compose + Prisma
**Deliverable:** `docker compose up -d` starts Postgres/Redis/MinIO; `prisma migrate dev` applies schema; `prisma db seed` creates admin user + default Claude Code profile.

- `docker-compose.yml` — services: `pgvector/pgvector:pg16`, `redis:7-alpine`, `minio/minio`
- `apps/web/prisma/schema.prisma` — exact schema from SPEC.md §5 (User, Host, Profile, Session, SessionEvent, Role, SessionStatus enums); `pgvector` extension declared
- Initial migration generated via `prisma migrate dev --name init`
- `prisma/seed.ts` — creates admin from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars (bcrypt cost 12); creates default `Profile` for Claude Code (`claude --dangerously-skip-permissions`); creates a default `Host` record named `local-dev` with token sourced from `DEFAULT_HOST_TOKEN` env var (bcrypt-hashed in DB) — this is the Sprint 1 substitute for the Host registration UI (Sprint 2)
- `src/server/db.ts` — Prisma client singleton (dev hot-reload safe)

### Phase 6 — Auth
**Deliverable:** Login page works; unauthenticated requests redirect to `/login`; WS hubs verify session ownership before routing.

- `src/app/login/page.tsx` — Server Component shell
- `src/app/login/LoginForm.tsx` — `"use client"` form; POSTs to `/api/auth/login`; displays error on failure
- `src/app/api/auth/login/route.ts` — validates body with Zod; fetches user by username; bcrypt compare; sets iron-session cookie on success; Redis rate limit (5 attempts / min / IP)
- `src/app/api/auth/logout/route.ts` — destroys iron-session
- `src/server/auth.ts` — `getSession()` helper; `requireAuth()` for route handlers
- `src/app/middleware.ts` — redirects unauthenticated requests to `/login`; sets CSP, `X-Frame-Options: DENY`, HSTS headers
- WS hubs updated: `client-hub.ts` reads iron-session cookie on upgrade, looks up session in DB, verifies `session.userId === user.id` before routing any message

### Phase 7 — Session Lifecycle (DB + /sessions/new)
**Deliverable:** Full user flow — login → `/sessions/new` → spawn → `/sessions/[id]` live terminal; session status tracked in DB.

- `src/app/sessions/new/page.tsx` — Server Component; fetches online hosts + profiles from DB; renders `<SpawnForm />`
- `src/app/sessions/new/SpawnForm.tsx` — `"use client"` form; selects host + profile; POSTs to `/api/sessions`
- `src/app/api/sessions/route.ts` — creates `Session` record (status `PENDING`); sends `session.spawn` to daemon via host-hub; updates status to `RUNNING` + stores PID; redirects to `/sessions/[id]`
- `src/app/api/sessions/[id]/kill/route.ts` — auth check; sends `session.kill` to daemon; updates status to `EXITED`
- Host hub updated: on `session.exit` from daemon, updates `Session.status` to `EXITED` / `ERROR`, sets `exitCode` and `endedAt` in DB
- `/sessions/[id]/page.tsx` updated: fetches real session from DB; passes `sessionId` to `Terminal`

### Phase 8 — Dockerfiles + Railway Deploy
**Deliverable:** Both Docker images build; Railway web service live; local daemon connects via `wss://`; smoke test passes.

- `apps/web/Dockerfile` — multi-stage: `node:22-alpine` builder runs `pnpm build`; production stage copies `.next` + node_modules; runs `prisma migrate deploy` then `node server.js`
- `apps/daemon/Dockerfile` — `node:22-alpine`; copies compiled output; `node dist/index.js`
- Railway config: `web` service (Next.js server on `PORT`), Postgres plugin, Redis plugin
- `README.md` — full bootstrap instructions, env var reference, Railway deploy steps

---

## 3. Core Data Flow

```
Browser (xterm.js)  ←→  /ws/client  ←→  Server (hub)  ←→  /ws/host  ←→  Daemon  ←→  PTY
```

**Outbound (browser → agent):**
1. xterm.js emits keystroke → `Terminal.tsx` sends `{type:"session.stdin", sessionId, data: btoa(input)}`
2. `client-hub` verifies session ownership → forwards to daemon WS for that session
3. Daemon decodes base64 → writes to PTY stdin

**Inbound (agent → browser):**
1. PTY emits output → daemon base64-encodes → sends `{type:"session.stdout", sessionId, data}`
2. `host-hub` fans out to all client WS registered for that sessionId
3. `Terminal.tsx` receives → decodes base64 → `term.write(Uint8Array)`

**Key decisions:**
- **Routing**: in-memory `Map` in Sprint 1; replaced by Redis pub/sub in Sprint 3 for horizontal scaling
- **Encoding**: base64 inside JSON matches the protocol spec exactly; no binary WebSocket frames
- **Auth guard timing**: hubs accept all connections in Phase 3 (skeleton); iron-session verification added in Phase 6 with no interface changes

---

## 4. UI Pages (Sprint 1)

### `/login`
- Centered card layout, no sidebar (unauthenticated state)
- `brand` wordmark + `ORCHESTRATOR` sub-label
- Username + password fields (JetBrains Mono inputs)
- Primary gradient "Sign In" button
- Server Component shell + `"use client"` LoginForm

### `/sessions/new`
- Collapsed icon sidebar (full `w-64` label sidebar deferred to Sprint 2)
- Page title + subtitle
- Host selector (dropdown, seeded with registered hosts)
- Profile selector (dropdown, seeded with profiles)
- Mega CTA: "Spawn Agent Session" with `rocket_launch` icon
- Server Component shell + `"use client"` SpawnForm

### `/sessions/[id]`
- Collapsed icon sidebar
- Sticky header bar: session ID (mono, primary color), Running status badge (pulsing dot), host·profile metadata, kill button (error hover)
- Terminal fills remaining viewport height
- xterm.js theme: bg `#060e20`, fg `#dae2fd`, cursor `#2fd9f4`

---

## 5. File Structure

```
agent-orchestrator/
├── packages/
│   ├── protocol/src/index.ts
│   └── config/
│       ├── tsconfig.base.json
│       └── eslint.config.js
├── apps/daemon/src/
│   ├── index.ts
│   ├── pty-manager.ts
│   ├── ws-client.ts
│   └── profiles.ts
└── apps/web/
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.ts
    ├── server.ts
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── middleware.ts
        │   ├── login/
        │   │   ├── page.tsx
        │   │   └── LoginForm.tsx
        │   ├── sessions/
        │   │   ├── new/
        │   │   │   ├── page.tsx
        │   │   │   └── SpawnForm.tsx
        │   │   └── [id]/
        │   │       ├── page.tsx
        │   │       └── Terminal.tsx
        │   └── api/
        │       ├── auth/login/route.ts
        │       ├── auth/logout/route.ts
        │       └── sessions/
        │           ├── route.ts
        │           └── [id]/kill/route.ts
        ├── server/
        │   ├── ws/
        │   │   ├── host-hub.ts
        │   │   └── client-hub.ts
        │   ├── auth.ts
        │   ├── session-router.ts
        │   └── db.ts
        ├── lib/
        │   └── xterm-theme.ts
        └── components/ui/
            ├── Button.tsx
            ├── Card.tsx
            ├── StatusBadge.tsx
            ├── Input.tsx
            ├── Label.tsx
            └── Icon.tsx
```

---

## 6. Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Protocol schemas | Vitest | Valid + invalid payloads for each Zod schema |
| PtyManager | Vitest | spawn/write/resize/kill with a real `echo` process |
| WS hub routing | Vitest | Message routing via mock WS objects |
| Auth routes | Vitest | Login success, wrong password, rate limit |
| DB seed | Vitest | Admin user created, default profile created |
| E2E smoke | Playwright | login → /sessions/new → spawn → terminal renders |

---

## 7. Security Checklist (Sprint 1)

- [ ] Daemon strips parent env; only injects `PATH`, `HOME`, `TERM` + profile env
- [ ] Host token: `crypto.randomBytes(32).toString('hex')`, stored bcrypt-hashed
- [ ] Passwords: bcrypt cost ≥ 12; never returned from APIs
- [ ] iron-session: `httpOnly`, `secure` (prod), `sameSite: 'lax'`
- [ ] Rate limit on `/api/auth/login`: 5/min/IP via Redis
- [ ] Client hub: verifies user owns session before routing any WS message
- [ ] Zod validation on every WS payload and API route body
- [ ] CSP + `X-Frame-Options: DENY` + HSTS via Next.js middleware
- [ ] No `eval`, no `Function()`, no shell string interpolation in spawning

---

## 8. Definition of Done

Per AGENT.md §7 — a sprint is done when all of these pass:

- [ ] `pnpm build` succeeds at repo root
- [ ] `pnpm test` passes
- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] Docker images build for `web` and `daemon`
- [ ] `railway up` deploys without manual steps beyond env vars
- [ ] README updated; all new env vars in `.env.example`
- [ ] Manual smoke test: login → spawn → live terminal in browser ✓
