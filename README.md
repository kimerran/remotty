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

## Environment Variables

See `.env.example` for a full list. Required vars:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_PASSWORD` | iron-session encryption key (32+ chars) |
| `ADMIN_USERNAME` | Initial admin username (seed) |
| `ADMIN_PASSWORD` | Initial admin password (seed) |
| `DEFAULT_HOST_TOKEN` | Token for the local-dev daemon (seed) |
| `SERVER_WS_URL` | (daemon) WS URL of the web server |
| `HOST_NAME` | (daemon) Name of this host |
| `HOST_TOKEN` | (daemon) Token matching DEFAULT_HOST_TOKEN |
