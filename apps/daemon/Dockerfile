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
