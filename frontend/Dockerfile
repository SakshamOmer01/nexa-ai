# syntax=docker/dockerfile:1

# --- Dependencies -----------------------------------------------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# The npm cache mount survives rebuilds, so a lockfile change re-downloads less; the layer itself
# is still keyed only on package.json + package-lock.json.
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# --- Build ------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Public values are inlined at build time; pass them as build args, never as secrets.
ARG NEXT_PUBLIC_APP_NAME="Nexa AI"
ARG NEXT_PUBLIC_APP_VERSION="0.1.0"
ARG NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Turbopack's incremental build cache lives in .next/cache (~44 MB on a cold build). Keeping it in
# a cache mount makes rebuilds after a source change incremental instead of a full recompile.
# It is never part of the image: only .next/standalone and .next/static are copied to the runtime.
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# --- Runtime ----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
