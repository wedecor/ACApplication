# syntax=docker/dockerfile:1.7
# Production image for the AC Platform API.
#   docker build -f apps/api/Dockerfile -t ac-api .        (from the repo root)
#   docker run --env-file .env -p 4000:4000 ac-api
# Run migrations as a separate release step before rolling out:
#   docker run --env-file .env ac-api pnpm --filter @ac/database migrate:deploy

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl \
  && corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# 1. Keep only the API and the workspace packages it depends on.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.1.3 prune @ac/api --docker

# 2. Install with the pruned lockfile, then build.
FROM base AS builder
ENV HUSKY=0
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm --filter @ac/database exec prisma generate \
  && pnpm exec turbo run build --filter=@ac/api...

# 3. Runtime: non-root, production env, liveness healthcheck.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /repo /repo
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health/liveness || exit 1
CMD ["node", "apps/api/dist/main.js"]
