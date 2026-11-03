# syntax=docker/dockerfile:1
# Image for the Railway cron service "pgbackup" (WP-13, 06-infrastructure 5.3): pg_dump and pg_restore 18 plus the
# bundled server/dist/pgbackup.js, which counts rows, dumps, encrypts with age (the age-encryption npm package, no age
# binary) and uploads to R2. It holds DATABASE_BACKUP_URL and the backups bucket token, never an age private key.
# Build context is the repo root: docker build -f ops/pgbackup/Dockerfile .

FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS base
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
COPY extension/package.json extension/

FROM base AS build
# No lifecycle scripts run during install (supply chain); esbuild is the one package whose binary the build needs.
RUN npm ci --ignore-scripts --workspace @auto-career/server --include-workspace-root=false \
 && npm rebuild esbuild
COPY shared shared
COPY server server
RUN npm run build --workspace @auto-career/server

FROM base AS prod-deps
# The same pruning as server/Dockerfile: optional peers and build tools no process imports at runtime.
RUN npm ci --omit=dev --ignore-scripts --workspace @auto-career/server --include-workspace-root=false \
 && rm -rf node_modules/next node_modules/@next node_modules/react node_modules/react-dom node_modules/styled-jsx \
      node_modules/vitest node_modules/@vitest node_modules/vite node_modules/drizzle-kit node_modules/@esbuild-kit \
      node_modules/esbuild node_modules/@esbuild node_modules/tsx node_modules/sharp node_modules/@img \
      node_modules/sentry node_modules/@sentry/bundler-plugins node_modules/oxc-parser node_modules/@oxc-parser

FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runtime
# pg_dump must be at least the server's major version, so the client comes from the PostgreSQL project's own signed apt
# repository (postgresql.org's instructions); the base image's Debian ships an older major. Railway cannot pin the
# server's minor version with PITR on, so the client takes the repository's current 18.x at each build.
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates curl \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && . /etc/os-release \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY server/package.json ./server/package.json
WORKDIR /app/server
# The plaintext dump lives in /tmp (mode 0600) for the length of one run; Railway gives cron containers ephemeral disk.
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/pgbackup.js", "auto"]
