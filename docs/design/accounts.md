# Accounts, sessions and the Kindled

Username + password accounts, one Kindled per account, self-hosted (no outside auth service, no
email). The holding talks to the server over the HTTP JSON API below; Colyseus rooms stay for shared
spaces.

## The API

Every route, request and response body, guard and error code lives in
[`packages/shared/src/api.ts`](../../packages/shared/src/api.ts); the rules in
[`accounts.ts`](../../packages/shared/src/accounts.ts) next to it. Apps never spell a route or error
code. Routes are under `/api` (Caddy routes it to the server in staging; Vite proxies it in dev).

| Route                | Body                                                 | Answer                                                                       |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /api/register` | `{ username, password }`                             | `201` `MeResponse` + cookie · `400` invalid-username/-password · `409` taken |
| `POST /api/login`    | `{ username, password }`                             | `200` `MeResponse` + cookie · `401` wrong-credentials                        |
| `POST /api/logout`   | `{}`                                                 | `204`, the session row deleted, the cookie cleared                           |
| `GET /api/me`        |                                                      | `200` `{ account, kindled \| null }` · `401` not-signed-in                   |
| `POST /api/kindled`  | `{ name, remembrance, clayTone? }` (needs a session) | `201` `{ kindled }` · `400` name-refused/bad-request · `409` kindled-exists  |

Errors are `{ error, message }`: `error` a code from `ApiErrorCode`, `message` the player-facing
line. Every body goes through a shared guard (unknown fields refused), then the validators; malformed
JSON, other content types and bodies over 4 KiB are refused. Answers carry `Cache-Control:
no-store`.

- **Same origin only.** Mutating routes (everything but `GET`) need `Content-Type:
application/json` (`415` otherwise) and an `Origin` whose host is the request's `Host` (`403`
  otherwise). A cross-site form or fetch can't log anyone in or out or create anything. Staging serves
  client and API from one origin; the Vite dev proxy keeps the page's `Host` (`changeOrigin: false`).
- **Rate limits** (`@fastify/rate-limit`, per client IP, in memory): login 10 a minute, register 10
  an hour; `429` rate-limited. Behind Caddy the IP comes from `X-Forwarded-For` (see `trustProxy` in
  `apps/server/src/config.ts`).

## The session cookie

- `iot_session` (`SESSION_COOKIE`): 32 random bytes, base64url. `HttpOnly`, `SameSite=Lax`,
  `Path=/`, `Max-Age` 30 days, `Secure` when `NODE_ENV=production`.
- The database keeps only its SHA-256 (`sessions.token_hash`), never the token.
- Expiry slides: each use more than a minute after the last pushes `expires_at` (and the cookie's
  `Max-Age`) 30 days out. An expired row is deleted when it is next presented; logging in drops the
  account's expired rows. Logout deletes the row.
- `accountFromCookieHeader(db, header)` (`apps/server/src/auth/sessions.ts`) resolves a raw `Cookie`
  header, for Colyseus `onAuth` (`context.headers.get('cookie')`) when shared spaces need an account.

## Rules

- **Usernames**: 3–20 of `[a-z0-9_-]`, typed in any case, stored lowercase, unique in any case (a
  unique index on `lower(username)`), through the safe-letters filter.
- **Passwords**: 8–128 characters (code points) after NFC normalization; anything else goes.
  Hashed with argon2id (`@node-rs/argon2`, prebuilt binaries; OWASP's baseline: 19 MiB, 2 passes, 1
  lane), the parameters stored in the PHC string so they can be raised without a migration.
- **Logging in** says only "Wrong username or password." whichever part was wrong, and always runs
  one argon2 verification (a dummy hash for an unknown username), so the answer and its timing are
  the same. argon2's comparison is constant-time; sessions are looked up by the token's hash.
- **Kindled names**: free text in any language and script. NFC, trimmed, every run of whitespace
  (tabs and line breaks too) collapsed to one space; 2–24 grapheme clusters; at least one letter; at
  most 4 combining marks per cluster (counted decomposed); no control, format (bidi overrides and
  isolates, zero-width space), surrogate or private-use characters, except the zero-width joiner and
  non-joiner some scripts need; through the safe-letters filter (not strict: a Kindled name may
  contain yod-he). Refused names get `NAME_REFUSED`. Names are not unique.
- **Remembrance** (`clay | ash | tide | wing`) and **clay tone** (palette.json's `clay.tones`,
  default grey-ochre) come from
  [`packages/shared/data/creation.json`](../../packages/shared/data/creation.json), with their
  display names and each Remembrance's outfit. One Kindled per account, created once (`409` after);
  hair and build are not chosen yet.

## Tables

`accounts` (id, username, password_hash, created_at, last_login_at), `sessions` (token_hash,
account_id, created_at, expires_at, last_seen_at), `kindled` (id, account_id unique, name,
remembrance, clay_tone, created_at). Accounts cascade to their sessions and Kindled.

The old `players` table is retired expand-safely: nothing reads or writes it any more, but it stays
in `schema.ts` (marked retired) so `db:generate` doesn't emit a `DROP`, since staging can roll code
back but not migrations. Once no deployable release references it, a contract migration removes it
from `schema.ts` and drops it.

## The client

On load the gate scene asks `GET /api/me`: no session → the account scene (log in / create account),
a session without a Kindled → the creation scene, otherwise the start screen, which shows the Kindled
and a log-out button (Esc, Circle). Text fields are keyboard-driven (`game/textInput.ts`); the choices
are navigable by pad. The pixel fonts are ASCII only for now: characters they lack show as `?` on
screen (the name is stored as typed). `apps/client/src/api.ts` is the typed API client.
