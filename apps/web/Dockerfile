# ── Stage 1: install & build ─────────────────────────────────────────────────
FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
RUN pnpm install

COPY packages/db ./packages/db
COPY apps/web ./apps/web

# NEXT_PUBLIC_* vars must be baked in at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_PRICE_STARTER
ARG NEXT_PUBLIC_STRIPE_PRICE_PRO
ARG NEXT_PUBLIC_STRIPE_PRICE_AGENCY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PRICE_STARTER=$NEXT_PUBLIC_STRIPE_PRICE_STARTER
ENV NEXT_PUBLIC_STRIPE_PRICE_PRO=$NEXT_PUBLIC_STRIPE_PRICE_PRO
ENV NEXT_PUBLIC_STRIPE_PRICE_AGENCY=$NEXT_PUBLIC_STRIPE_PRICE_AGENCY

RUN pnpm --filter=web build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY apps/web/package.json ./apps/web/
COPY apps/web/next.config.ts ./apps/web/
COPY package.json ./

EXPOSE 3000
CMD ["sh", "-c", "cd apps/web && node ./node_modules/.bin/next start"]
