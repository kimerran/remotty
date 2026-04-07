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
COPY --from=builder /app/apps/web/prisma.config.ts ./apps/web/prisma.config.ts
COPY --from=builder /app/apps/web/server.ts ./apps/web/server.ts
RUN pnpm add -g tsx
EXPOSE 3000
CMD ["sh", "-c", "cd apps/web && npx prisma migrate deploy && tsx server.ts"]
