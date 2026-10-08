# CLAUDE.md

Browser multiplayer game (idle / co-op / action MMORPG). pnpm monorepo, TypeScript everywhere.

## Layout

| Path                   | What                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| `apps/client`          | Vite + Phaser 3. Renders the sim, reads input, juice/HUD. No gameplay logic.   |
| `apps/server`          | Fastify (HTTP, `/health`) + Colyseus 0.18 (rooms, WebSocket) sharing one port. |
| `packages/shared`      | Wire protocol (types/guards) and game data. No runtime deps.                   |
| `packages/shared/data` | `tuning.json` (every balance/feel number), `rooms.json` (room templates).      |
| `packages/sim`         | Deterministic combat sim: 60 Hz integer ticks, seeded RNG, replayable runs.    |
| `docs/design`          | Design rules (`combat.md`): read before changing combat.                       |

Workspace packages are consumed from source via the custom `source` export condition
(tsconfig `customConditions`, Vite `resolve.conditions`, `tsx --conditions=source`), so
dev/test/typecheck never need a prior build. Production builds compile each package to `dist/`.

## Commands

- `pnpm check` — lint + typecheck + tests. **Must pass before every commit/PR.**
- `pnpm build` — build all packages.
- `pnpm dev` — server on :2567, client on :5173.
- `pnpm --filter @iot/server db:generate` — generate a migration after editing `src/db/schema.ts`.
- `pnpm --filter @iot/server db:migrate` — apply migrations to `DATABASE_URL` (or PGlite).

## Rules

### Authority

- The server decides everything of value: items, xp, currency, loot, positions that matter.
- The client only sends intents ("craft X", "sail to Y", "input log for run Z"). Treat every client
  message as untrusted: validate it with a guard from `packages/shared`, clamp/limit values, and ignore
  malformed input.
- The protocol lives in `packages/shared`. Every client↔server message type, payload and room name is
  defined there and used by both sides; never hard-code message strings in apps. Bump
  `PROTOCOL_VERSION` on any breaking wire change.

### Items and currency

- Every item or currency change goes through one function, `inventory.apply(changes, reason)`.
- It runs in one DB transaction and writes to an `item_ledger` table. No other code touches item tables.
- Trades and purchases lock both sides in the same transaction.

### Determinism (`packages/sim`)

- No `Math.random`, `Date.now`, `performance.now`, timers, I/O or floating-point time. Use the seeded
  `Rng` and a fixed tick. Don't let iteration order of unordered data affect results.
- Any sim change needs a replay test: same seed + inputs => same result. Update golden hashes only for
  intentional behavior changes, and say so in the commit.
- No `Math.sin/cos/atan2/sqrt` either (they differ between browsers): use `trig.ts` / `isqrt` in
  `fixed.ts`. All sim state is integers (sub-pixel units, 1/4096-turn angles, permille). ESLint
  enforces these bans in `packages/sim/src`.
- `packages/sim` stays dependency-free at runtime (its tests use `@iot/shared` data as a dev dep).
- The client never decides gameplay: it sends quantized inputs and renders state/events.

### Idle progress

- Never tick in the background. Store start time + action; compute progress on load or on the next
  action.
- Offline progress is capped (configurable in game data).

### Data and balance

- Game balance numbers live in `packages/shared/data`, never hardcoded in apps or the sim. The sim
  takes the tuning as part of each run's config (live F2 edits are recorded in the run).
- Combat rules: `docs/design/combat.md`. Keep it in sync when the rules change.

### Database

- Schema changes only through Drizzle migrations: edit `apps/server/src/db/schema.ts`, run
  `db:generate`, commit the generated SQL + `meta/`. Never edit an applied migration.
- Tests use in-memory PGlite (`createDb()` with no URL); production uses Postgres via `DATABASE_URL`.

### Code quality

- Strict TypeScript. No `any`, and no `@ts-ignore`/`@ts-expect-error` without a comment saying why. No
  non-null `!` on values that can really be missing. Use `import type` for type-only imports.
- New server behavior gets a Vitest test. Rooms can be tested over a real WebSocket; see
  `apps/server/test/room.test.ts`.
- Add dependencies to the package that uses them (`pnpm --filter <pkg> add`) and commit the lockfile.
  Keep `packages/shared` free of runtime dependencies.

### Workflow

- One feature per branch, end to end (data, server, client, test).
- Run `pnpm check` (lint + typecheck + tests) before declaring a task done. Never skip, disable or
  `.only` a test to get it green; fix the cause.
- Small, focused commits with a message saying what changed and why.

## Environment notes

- Claude Code on the web: `.claude/settings.json` runs `scripts/cloud-setup.sh` on startup/resume. It
  starts local Postgres, ensures role/db `game`, and runs `pnpm install` only when the lockfile changed.
- Without `DATABASE_URL` the server uses PGlite (`PGLITE_DIR` to persist, else in-memory).
- The server applies pending migrations on start unless `SKIP_MIGRATIONS` is set.
- Deployment: `docs/DEPLOY.md`. Staging is a compose stack behind Caddy on one origin; pushes to
  `main` deploy automatically once CI passes. Never commit `.env`/`deploy.env` or put secrets in
  `docker/`. The deployed client connects to its own origin; server CORS is local-dev only.
- Playtesting: `window.__iot` in the client exposes `startRun(seed)`, `setAutopilot({})` (the sim's
  deterministic bot), `record()`, `hash()` and `replayHash(record)` for headless browser runs.
- Colyseus 0.18 is embedded in Fastify manually (see `apps/server/src/app.ts`); don't call
  `gameServer.listen()`, which would install its own catch-all HTTP handler.
