# Accounts, sessions and the Kindled

Username + password accounts, one Kindled per account, self-hosted (no outside auth service, no
email). The holding talks to the server over the HTTP JSON API below; Colyseus rooms stay for shared
spaces.

## The API

Every route, request and response body, guard and error code lives in
[`packages/shared/src/api.ts`](../../packages/shared/src/api.ts); the rules in
[`accounts.ts`](../../packages/shared/src/accounts.ts) next to it. Apps never spell a route or error
code. Routes are under `/api` (Caddy routes it to the server in staging; Vite proxies it in dev).

| Route                      | Body                                                 | Answer                                                                                                       |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /api/register`       | `{ username, password }`                             | `201` `MeResponse` + cookie · `400` invalid-username/-password · `409` taken                                 |
| `POST /api/login`          | `{ username, password }`                             | `200` `MeResponse` + cookie · `401` wrong-credentials                                                        |
| `POST /api/logout`         | `{}`                                                 | `204`, the session row deleted, the cookie cleared                                                           |
| `GET /api/me`              |                                                      | `200` `{ account, kindled \| null }` · `401` not-signed-in                                                   |
| `POST /api/kindled`        | `{ name, remembrance, clayTone? }` (needs a session) | `201` `{ kindled }` · `400` name-refused/bad-request · `409` kindled-exists                                  |
| `GET /api/inventory`       |                                                      | `200` `{ purse, pack, store, baskets }` · `401` not-signed-in · `404` no-kindled ([inventory](inventory.md)) |
| `POST /api/inventory/move` | `{ itemId, from, to, quantity }` (needs a session)   | `200` the new inventory · `400`/`409` ([inventory](inventory.md))                                            |

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
- **Per-username login throttle** (`apps/server/src/auth/throttle.ts`, in memory): after 10 failed
  logins for one username within 15 minutes, its logins are refused for 15 minutes from any address,
  with the usual "Wrong username or password." (the password isn't even checked while locked, and the
  dummy argon2 verification keeps the timing). The per-IP limit can't stop one account being guessed
  at from many addresses; this can. Unknown usernames count the same way, so the throttle says
  nothing about which exist, and a flood of made-up names can't push a live lock out of memory. A
  success clears the count.

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
- **Kindled names**: NFC, trimmed, every run of whitespace (tabs and line breaks too) collapsed to
  one space; no control, format (bidi overrides and isolates, zero-width space, soft hyphen),
  surrogate or private-use characters; through the safe-letters filter (not strict: a Kindled name
  may contain yod-he); **only characters the game can draw**; 2–24 grapheme clusters; at least one
  letter. Refused names get `NAME_REFUSED`, except undrawable ones (below). Names are not unique.
- **Names the game can draw.** The book asks for names in any language; until the pixel fonts have
  more scripts, that is narrowed to the characters both atlases contain (`DRAWABLE_CHARS` in
  `packages/shared/src/accounts.ts`, read from the atlas contracts, so server and client agree):
  printable ASCII and the Latin-1 Supplement, i.e. A–Z and accented Latin letters (`tools/
bitmap-fonts.py` builds both). Anything else (other scripts, Latin letters outside Latin-1, a mark
  with no precomposed letter, emoji) is refused with "Use letters the game can draw for now: A–Z and
  accented Latin letters." Usernames are ASCII already. The rules that only matter beyond Latin-1
  (at most 4 combining marks per cluster, the zero-width joiner and non-joiner allowed for the scripts
  that need them) stay in the validator for when the atlases grow.
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
and a log-out button (Esc, Circle). `apps/client/src/api.ts` is the typed API client.

The username, password and Kindled name fields are real HTML inputs in a real `<form>` laid over the
canvas (`apps/client/src/ui/formFields.ts`): phones open their on-screen keyboard, password managers
save and fill (`autocomplete` `username`, and `current-password` when logging in or `new-password`
when creating an account; the form's submit event is what they watch), IME works for every
language, and paste works. They are the one exception to "all text is BitmapText": the canvas still
draws each field's panel and focus rim (`render/field.ts`), and the input inside it is transparent,
in Tiny5 at 8 game px (8 × zoom CSS px, whole device pixels like the canvas), coloured from
`palette.ts`. The scenes keep the row model: Tab and Up/Down (D-pad) move between rows and focus or
blur the input, Left/Right (D-pad) change the choices, Enter (Cross) submits through the form.
Characters the fonts can't draw show as `?` on the canvas (`game/drawable.ts`).
