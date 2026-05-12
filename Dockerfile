# ── Stage 1: install & build ─────────────────────────────────────────────────
FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy manifests first — better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Generate Prisma client, then compile NestJS
RUN pnpm --filter=api exec prisma generate --schema=../../packages/db/prisma/schema.prisma
RUN pnpm --filter=api build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy the full node_modules from builder so prisma CLI is available for migrations
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy compiled app
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema (needed by migrate deploy at startup)
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# package.json files needed for module resolution
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Startup script
COPY scripts/start.sh ./
RUN chmod +x start.sh

EXPOSE 3001
CMD ["sh", "start.sh"]
