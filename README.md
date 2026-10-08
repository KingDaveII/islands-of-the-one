# islands-of-the-one

Idle/Co-Op/Action/MMORPG Game — browser multiplayer, built with Phaser 3, Colyseus and Fastify.

## Quick start

```sh
pnpm install
pnpm dev          # server :2567 (PGlite unless DATABASE_URL is set), client :5173
pnpm check        # lint + typecheck + tests
pnpm build
```

Open http://localhost:5173 and start a run (M1 solo combat prototype).

Controls: WASD move, mouse aim, LMB/J light combo, hold RMB/K heavy, Space/Shift dodge, Q Lunge.
Gamepad: left stick move, right stick aim, X light, Y/RT heavy, A dodge, B Lunge.
F2 tuning panel (live sliders + Export JSON), F3 debug overlay. `?net` opens the M0 network test.

Combat rules: [docs/design/combat.md](docs/design/combat.md).

## Docker

```sh
docker build -f apps/server/Dockerfile -t iot-server .
docker run -p 2567:2567 -e DATABASE_URL=postgres://... iot-server   # migrates on start

docker build -f apps/client/Dockerfile --build-arg VITE_SERVER_URL=ws://localhost:2567 -t iot-client .
docker run -p 8080:80 iot-client
```

Staging deployment, secrets and rollback: [docs/DEPLOY.md](docs/DEPLOY.md).

See [CLAUDE.md](CLAUDE.md) for layout and contribution rules, and `.env.example` for configuration.
