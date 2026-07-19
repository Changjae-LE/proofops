# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY contract/src ./contract/src
COPY contract/dist ./contract/dist

RUN npm run build

# ---- Runtime stage ----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/contract/dist ./contract/dist

# @midnight-ntwrk/testkit-js (a transitive dependency pulled in by server/midnight/wallet.ts)
# unconditionally creates a default file logger under ./logs/tests the moment it is
# loaded into memory - even in local-demo-only deployments that never call an
# /api/midnight/* route, because esbuild's single-file bundling only defers the *result*
# of a dynamic import(), not the target module's own top-level side effects. Pre-create
# and own the directory so that logger construction succeeds instead of crashing the
# entire process with EACCES.
RUN addgroup -S proofops && adduser -S proofops -G proofops \
  && mkdir -p /app/logs/tests && chown -R proofops:proofops /app/logs
USER proofops

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist-server/index.js"]
