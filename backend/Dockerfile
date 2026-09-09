# syntax=docker/dockerfile:1

# ─── Build ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
# Emits dist/ and copies src/db/migrations into it (scripts/copy-migrations.mjs),
# because tsc does not carry .sql files across.
RUN npm run build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only. The migration runner deliberately uses
# drizzle-orm's migrator rather than drizzle-kit so it survives this prune.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Never run as root, and use the image's existing unprivileged user.
USER node

EXPOSE 3001

# The health check is the same endpoint the load balancer polls: it verifies the
# database round-trips, not merely that the port is open.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
