# ──────────────────────────────────────────────────────────────────────────
# OPTEX ADMIN — multi-stage Docker build for a pnpm workspace.
#
# IMPORTANT: build context must be the MONOREPO ROOT, not apps/admin, because the
# build needs the root pnpm-workspace.yaml + lockfile to resolve the workspace
# packages this app transpiles (@optex/ui, @optex/db, @optex/config, ...).
#   docker build -f apps/admin/Dockerfile -t optex-admin .
# (run from the repo root)
#
# Relies on `output: 'standalone'` in next.config — see the comment there.
# ──────────────────────────────────────────────────────────────────────────

# ---- Base: enable corepack/pnpm ----
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# No TTY during `docker build` — CI=true skips pnpm's interactive prompts.
ENV CI=true
RUN corepack enable
WORKDIR /repo

# ---- Dependencies ----
FROM base AS deps
# Manifests and lockfile first, for better layer caching: they change far less
# often than source does, so a code-only edit reuses the install layer.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages packages
RUN pnpm install --filter @optex/admin... --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/admin apps/admin
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# are build args rather than runtime env. A different Supabase project or API
# origin means a different image — which is why the CD workflow builds per
# environment rather than promoting one image across all of them.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @optex/admin build

# ---- Runtime: minimal image ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=1113
ENV HOSTNAME=0.0.0.0
# `tini` as PID 1 reaps zombies and forwards SIGTERM so Next can drain
# in-flight requests instead of being killed mid-response on deploy.
RUN apk add --no-cache tini
WORKDIR /repo/apps/admin

# The standalone bundle carries its own minimal node_modules and server.js.
# `static` and `public` are NOT part of it and must be copied separately —
# omitting them yields an app that boots and then 404s every asset.
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /repo/apps/admin/public ./apps/admin/public

# Run as the unprivileged `node` user baked into the official image, never root.
USER node
EXPOSE 1113
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# standalone emits the server at the app's path within the workspace tree.
CMD ["node", "apps/admin/server.js"]
