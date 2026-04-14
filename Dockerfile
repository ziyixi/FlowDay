# ---- Base ----
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat su-exec
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create db directory with correct permissions
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Ensure db dir is writable when a volume is mounted (may arrive as root),
# then drop to non-root user.
CMD ["sh", "-c", "chown nextjs:nodejs /app/db && exec su-exec nextjs node server.js"]
