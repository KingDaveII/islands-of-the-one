# islands-of-the-one

Idle/Co-Op/Action/MMORPG Game — browser multiplayer, built with Phaser 3, Colyseus and Fastify.

## Quick start

```sh
pnpm install
pnpm dev          # server :2567 (PGlite unless DATABASE_URL is set), client :5173
pnpm check        # lint + typecheck + tests
pnpm build
```

Open http://localhost:5173 in two tabs and click to move.

## Docker

```sh
docker build -f apps/server/Dockerfile -t iot-server .
docker run -p 2567:2567 -e DATABASE_URL=postgres://... iot-server   # migrates on start

docker build -f apps/client/Dockerfile --build-arg VITE_SERVER_URL=ws://localhost:2567 -t iot-client .
docker run -p 8080:80 iot-client
```

See [CLAUDE.md](CLAUDE.md) for layout and contribution rules, and `.env.example` for configuration.
