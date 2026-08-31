# syntax=docker/dockerfile:1.7
FROM node:24.12.0-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    MIGRATION_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    SHADOW_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build_shadow \
    BETTER_AUTH_URL=http://localhost:3000 \
    BETTER_AUTH_SECRET=build-only-placeholder-secret-at-least-32-characters
RUN npm run db:generate && npm run build

FROM builder AS acceptance-tools
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "db:fixtures:acceptance"]

FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src/lib/database-url.ts src/lib/environment.ts ./src/lib/
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /var/lib/humanum/documents \
    && chown -R nextjs:nodejs /var/lib/humanum
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
