# syntax=docker/dockerfile:1
# Image for the Railway "api" and "worker" services (same image, different start command).
# Build context is the repo root: docker build -f server/Dockerfile .

FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
COPY extension/package.json extension/

FROM base AS build
RUN npm ci --workspace @auto-career/server --include-workspace-root=false
COPY shared shared
COPY server server
RUN npm run build --workspace @auto-career/server

FROM base AS prod-deps
# better-auth lists next, react, vitest and drizzle-kit as optional peers. Because the web workspace and the
# dev tools share this lockfile, npm installs them here too. No service imports them at runtime (api, worker,
# applier and migrate all boot without them), so they are removed: about 120 MB of node_modules instead of 620 MB.
RUN npm ci --omit=dev --workspace @auto-career/server --include-workspace-root=false \
 && rm -rf node_modules/next node_modules/@next node_modules/react node_modules/react-dom node_modules/styled-jsx \
      node_modules/vitest node_modules/@vitest node_modules/vite node_modules/drizzle-kit node_modules/@esbuild-kit \
      node_modules/esbuild node_modules/@esbuild node_modules/tsx node_modules/sharp node_modules/@img

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/drizzle ./server/drizzle
COPY server/package.json ./server/package.json
WORKDIR /app/server
USER node
EXPOSE 4000
CMD ["node", "dist/api.js"]
