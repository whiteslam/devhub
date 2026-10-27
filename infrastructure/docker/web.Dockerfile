# syntax=docker/dockerfile:1.7
# DevHub dashboard (Next.js standalone). Build from the repository root:
#   docker build -f infrastructure/docker/web.Dockerfile -t devhub-web .
FROM node:24.22.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @devhub/web build

FROM node:24.22.1-alpine AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S devhub && adduser -S devhub -G devhub
COPY --from=build --chown=devhub:devhub /repo/apps/web/.next/standalone ./
COPY --from=build --chown=devhub:devhub /repo/apps/web/.next/static ./apps/web/.next/static
USER devhub
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
