# ──────────────────────────────────────────────────────────────────────────
# OPTEX API — multi-stage Docker build for a pnpm workspace.
#
# IMPORTANT: build context must be the MONOREPO ROOT, not apps/api, because the
# build needs the root pnpm-workspace.yaml + lockfile to resolve the workspace.
#   docker build -f apps/api/Dockerfile -t optex-api .
# (run from /Users/kalyan/Client-project/OPTEX)
# ──────────────────────────────────────────────────────────────────────────

# ---- Base: enable corepack/pnpm ----
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# No TTY during `docker build` — CI=true skips pnpm's interactive
# confirmation prompt (e.g. removing node_modules before a --prod install).
ENV CI=true
RUN corepack enable
WORKDIR /repo

# ---- Dependencies: install only what @optex/api needs ----
FROM base AS deps
# Workspace manifests + lockfile first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
# `--filter @optex/api...` pulls the api package plus any workspace deps it
# declares. Foundation has none, but this is forward-compatible.
RUN pnpm install --filter @optex/api... --frozen-lockfile

# ---- Build: compile TypeScript -> dist ----
FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api apps/api
RUN pnpm --filter @optex/api build
# Strip dev dependencies for the runtime image.
RUN pnpm --filter @optex/api... install --prod --frozen-lockfile

# ---- Runtime: minimal image ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=4000
# `tini` as PID 1 reaps zombies and forwards SIGTERM cleanly so Nest's
# enableShutdownHooks() can drain in-flight requests on deploy/scale-down.
RUN apk add --no-cache tini
WORKDIR /repo/apps/api
# Copy installed node_modules (root + app) and the compiled output.
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/package.json /repo/apps/api/package.json
# Run as the unprivileged `node` user baked into the official image (never root).
USER node
EXPOSE 4000
# Container-level liveness probe hitting the public /api/health route. busybox
# wget ships in alpine, so no extra dependency is needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1
# tini -> node. SIGTERM reaches node so graceful shutdown fires.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
