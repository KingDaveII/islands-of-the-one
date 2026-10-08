# CLAUDE.md

Browser multiplayer game (idle / co-op / action MMORPG). pnpm monorepo, TypeScript everywhere.

## Layout

| Path              | What                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `apps/client`     | Vite + Phaser 3. Connects to the server with `@colyseus/sdk`.                    |
| `apps/server`     | Fastify (HTTP, `/health`) + Colyseus 0.18 (rooms, WebSocket) sharing one port.   |
| `packages/shared` | Wire protocol: room names, message types, payload types/guards. No runtime deps. |
| `packages/sim`    | Deterministic game simulation. Seeded RNG, replay tests. No I/O, no deps.        |

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

1. **Keep `pnpm check` green.** Never skip, disable or `.only` a test to get there; fix the cause.
2. **Strict TypeScript.** No `any`, no `@ts-ignore`/`@ts-expect-error` without a comment explaining why,
   no non-null `!` on values that can really be missing. Use `import type` for type-only imports.
3. **Protocol lives in `packages/shared`.** Every client↔server message type, payload and room name is
   defined there and used by both sides. Never hard-code message strings in apps. Bump
   `PROTOCOL_VERSION` on any breaking wire change.
4. **The server is authoritative.** Treat every client message as untrusted: validate with a guard from
   `shared` before use, clamp/limit values, ignore malformed input.
5. **`packages/sim` stays deterministic.** No `Math.random`, `Date.now`, `performance.now`, timers, I/O,
   or iteration over unordered/insertion-dependent data where order affects results. All randomness comes
   from the seeded `Rng`; all inputs come through the input log. Any sim change keeps the replay tests
   passing; update golden hashes only for intentional behavior changes, and say so in the commit.
6. **Database changes go through Drizzle migrations.** Edit `apps/server/src/db/schema.ts`, run
   `db:generate`, commit the generated SQL + `meta/`. Never edit an already-merged migration. Tests use
   in-memory PGlite (`createDb()` with no URL); production uses Postgres via `DATABASE_URL`.
7. **Tests with features.** New server behavior gets a Vitest test (rooms can be tested over a real
   WebSocket — see `apps/server/test/room.test.ts`); new sim logic gets determinism/replay coverage.
8. **Dependencies:** add to the package that uses them (`pnpm --filter <pkg> add`), commit the lockfile,
   prefer what's already in the tree. Keep `shared` and `sim` dependency-free.
9. **Small, focused commits and PRs** with a clear message saying what changed and why.

## Environment notes

- Claude Code on the web: `.claude/settings.json` runs `scripts/cloud-setup.sh` on startup/resume. It
  starts local Postgres, ensures role/db `game`, and runs `pnpm install` only when the lockfile changed.
- Without `DATABASE_URL` the server uses PGlite (`PGLITE_DIR` to persist, else in-memory).
- The server applies pending migrations on start unless `SKIP_MIGRATIONS` is set.
- Colyseus 0.18 is embedded in Fastify manually (see `apps/server/src/app.ts`); don't call
  `gameServer.listen()`, which would install its own catch-all HTTP handler.
