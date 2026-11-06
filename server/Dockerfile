# syntax=docker/dockerfile:1
# Image for the Railway "api" and "worker" services (same image, different start command).
# Build context is the repo root: docker build -f server/Dockerfile .

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
# better-auth lists next, react, vitest and drizzle-kit as optional peers. Because the web workspace and the
# dev tools share this lockfile, npm installs them here too. No service imports them at runtime (api, worker,
# applier and migrate all boot without them), so they are removed: about 120 MB of node_modules instead of 620 MB.
# @sentry/node's build-time half (the Sentry CLI, its bundler plugins and their native oxc parser) goes too.
RUN npm ci --omit=dev --ignore-scripts --workspace @auto-career/server --include-workspace-root=false \
 && rm -rf node_modules/next node_modules/@next node_modules/react node_modules/react-dom node_modules/styled-jsx \
      node_modules/vitest node_modules/@vitest node_modules/vite node_modules/drizzle-kit node_modules/@esbuild-kit \
      node_modules/esbuild node_modules/@esbuild node_modules/tsx node_modules/sharp node_modules/@img \
      node_modules/sentry node_modules/@sentry/bundler-plugins node_modules/oxc-parser node_modules/@oxc-parser

# The resume renderer (CISO mustFix 8). Pinned by the SHA-256 GitHub publishes for this release asset (the `digest` field of
# GET repos/typst/typst/releases/tags/v0.15.1). Re-pin with TYPST_VERSION in src/services/render.ts and ci.yml; a test holds all three.
FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS typst
ADD --checksum=sha256:a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz /tmp/typst.tar.xz
RUN apt-get update && apt-get install -y --no-install-recommends xz-utils && rm -rf /var/lib/apt/lists/* \
 && tar -xJf /tmp/typst.tar.xz -C /tmp && install -m 0755 /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/typst

FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runtime
# tini is PID 1 so SIGTERM reaches node and orphaned child processes are reaped; ca-certificates for TLS.
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=typst /usr/local/bin/typst /usr/local/bin/typst
# The worker renders; both must be here or the image does not build. prlimit is util-linux, part of the base image.
RUN typst --version && prlimit --version
# Stack traces (logs and Sentry) name src/*.ts lines through dist/*.js.map; no source-map upload needed.
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/drizzle ./server/drizzle
COPY server/package.json ./server/package.json
WORKDIR /app/server
USER node
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/api.js"]
