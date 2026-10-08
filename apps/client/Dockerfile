# syntax=docker/dockerfile:1
# Build from the repo root:
#   docker build -f apps/client/Dockerfile --build-arg VITE_SERVER_URL=wss://game.example.com -t iot-client .
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
WORKDIR /repo
RUN npm install -g pnpm@10.34.6
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/client/package.json apps/client/
COPY packages/shared/package.json packages/shared/
COPY packages/sim/package.json packages/sim/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @iot/client... --filter islands-of-the-one
COPY tsconfig.base.json vitest.shared.ts ./
COPY packages/shared packages/shared
COPY packages/sim packages/sim
COPY apps/client apps/client
# Baked in at build time; when empty the client connects to the page's own
# origin (wss://<host>), which is how the Caddy deployment serves it.
ARG VITE_SERVER_URL=""
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
RUN pnpm --filter @iot/client build

FROM nginx:1.27-alpine AS runtime
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/dist /usr/share/nginx/html
EXPOSE 80
