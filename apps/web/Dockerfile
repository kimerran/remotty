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
# Bundle server.ts and all its local imports into a single ESM file
RUN cd apps/web && node_modules/.bin/esbuild server.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --outfile=.next/standalone/apps/web/server.mjs \
    --external:next \
    --external:@prisma/client \
    --external:@prisma/adapter-pg \
    --external:ws \
    --external:bcrypt \
    --external:iron-session \
    --external:ioredis \
    --external:@orchestrator/protocol

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/prisma.config.ts ./apps/web/prisma.config.ts
# Copy prisma CLI so migrate deploy works without network access
COPY --from=builder /app/apps/web/node_modules/.bin/prisma ./apps/web/node_modules/.bin/prisma
COPY --from=builder /app/apps/web/node_modules/prisma ./apps/web/node_modules/prisma
EXPOSE 3000
CMD ["sh", "-c", "cd apps/web && node_modules/.bin/prisma migrate deploy && node server.mjs"]
