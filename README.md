# Remotty — Agent Orchestrator

Spawn and manage coding agents (Claude Code, Codex, etc.) across machines with a live browser terminal.

## Running Locally

**Prerequisites:** Node.js 22+, pnpm 9+, Docker

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local services

```bash
docker compose up -d
# Starts: Postgres 16 (port 5432), Redis 7 (port 6379), MinIO (ports 9000/9001)
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `SESSION_PASSWORD` — any random 32+ character string (e.g. `openssl rand -base64 32`)
- `DEFAULT_HOST_TOKEN` — any random token (e.g. `openssl rand -hex 32`). Copy this value; you'll use it to start the daemon.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your admin login credentials

### 4. Run database migration and seed

The migration and seed commands read env vars from `.env` automatically via Next.js/pnpm.

```bash
# Load the .env file into your shell first
set -a && source .env && set +a

# Create the database schema
pnpm --filter web exec prisma migrate dev --name init

# Seed admin user, Claude Code profile, and local-dev host
pnpm --filter web db:seed
```

### 5. Start the web server

```bash
pnpm dev
# Starts the Next.js server at http://localhost:3000
# Env vars are loaded automatically from .env
```

### 6. Start the daemon (separate terminal)

```bash
set -a && source .env && set +a
pnpm --filter daemon dev
```

The daemon reads `SERVER_WS_URL`, `HOST_NAME`, and `HOST_TOKEN` from the environment (sourced from `.env` above).

### 7. Open the app

Navigate to **http://localhost:3000** and log in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`.

Once logged in, go to **New Session** — the `local-dev` host should appear in the dropdown (the daemon connects on startup). Click **Spawn Agent Session** to launch a live terminal.

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
