# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/server/Dockerfile -t iot-server .
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
WORKDIR /repo
RUN npm install -g pnpm@10.34.6
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/sim/package.json packages/sim/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @iot/server...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/sim packages/sim
COPY apps/server apps/server
RUN pnpm --filter @iot/server... build \
 && pnpm --filter @iot/server deploy --prod --legacy /out

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production PORT=2567 HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
COPY --from=build --chown=node:node /out/drizzle ./drizzle
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# main.js applies pending Drizzle migrations against DATABASE_URL before listening.
CMD ["node", "dist/main.js"]
