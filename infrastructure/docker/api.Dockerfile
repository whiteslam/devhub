# syntax=docker/dockerfile:1.7
# DevHub API. The build bundles all dependencies into dist/server.js, so the
# runtime image contains a single file and no node_modules.
#   docker build -f infrastructure/docker/api.Dockerfile -t devhub-api .
FROM node:24.22.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @devhub/api build

FROM node:24.22.1-alpine AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
RUN addgroup -S devhub && adduser -S devhub -G devhub
COPY --from=build --chown=devhub:devhub /repo/apps/api/dist/server.js ./server.js
USER devhub
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:4000/v1/health || exit 1
CMD ["node", "server.js"]
