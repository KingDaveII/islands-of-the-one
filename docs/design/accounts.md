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
| `GET /api/holding` and `POST /api/holding/*` | ([holding](holding.md) §5)         | the holding, settled (the inventory routes settle it first too, §13)                                        |
| `POST /api/writ/name`      | `{ name }` (needs a session)                         | `200` the holding · `400` name-refused · `409` already-named ([holding](holding.md) §9)                     |
| `POST /api/writ/feed`      | `{ itemId, count }` or `{ fill: true }`              | `200` the holding · `400` not-sparkglass · `409` unnamed / insufficient / full / too-much ([holding](holding.md) §9) |
| `POST /api/kesh/sliver`    | `{}` (needs a session)                               | `200` the holding · `409` not-due / pack-full ([holding](holding.md) §10)                                   |
| `POST /api/kesh/word`      | `{}` (needs a session)                               | `200` the holding · `409` not-due ([holding](holding.md) §11)                                               |
| `POST /api/kesh/seeds`     | `{}` (needs a session)                               | `200` the holding · `409` not-due / pack-full ([holding](holding.md) §11)                                   |
| `POST /api/plots/name`     | `{ plotId, ground, virtue }` (needs a session)       | `200` the holding · `400` unknown-plot / unknown-word / wrong-slot / no-ground / sentence-refused · `409` unnamed / faded / unchanged / insufficient ([holding](holding.md) §11) |
| `POST /api/plots/sow`      | `{ plotId }` (needs a session)                       | `200` the holding · `400` unknown-plot · `409` unnamed-plot / faded / already-sown / insufficient ([holding](holding.md) §11) |
| `POST /api/plots/build`    | `{ plotId, pieceId, col, row, rotation }` (needs a session) | `200` the holding · `400` unknown-plot / unknown-piece / blocked · `409` unnamed-plot / faded / already-built / needs-line / needs-skill / limit / insufficient ([holding](holding.md) §12) |
| `POST /api/plots/move`     | `{ plotId, pieceId, col, row, rotation }` (needs a session) | `200` the holding · `400` unknown-plot / blocked · `409` unnamed-plot / faded / not-built ([holding](holding.md) §12) |
| `POST /api/plots/take-down` | `{ plotId, pieceId }` (needs a session)             | `200` the holding · `400` unknown-plot · `409` unnamed-plot / faded / not-built / store-full ([holding](holding.md) §12) |
| `POST /api/holding/away/seen` | `{ to }` (ISO 8601; needs a session)             | `204`, the away card dismissed while its `to` still matches ([holding](holding.md) §13)                                |
| `POST /api/holding/rack/choose` | `{ weaponId }` (needs a session)               | `200` the holding · `409` not-owned / not-ready ([holding](holding.md) §14)                                            |

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
- **Typed names** (`validateTypedName`; a Kindled's name, `validateKindledName`, and the island's
  Name, [holding.md](holding.md) §9): NFC, trimmed, every run of whitespace (tabs and line breaks too) collapsed to
  one space; no control, format (bidi overrides and isolates, zero-width space, soft hyphen),
  surrogate or private-use characters; through the safe-letters filter (not strict: a typed name
  may contain yod-he; the island's letters are checked strict); **only characters the game can draw**; 2–24 grapheme clusters; at least one
  letter. A refused Kindled name gets LORE's line, "That name won't hold. Try another." (`KINDLED_NAME_REFUSED`, from
  `creation.json`'s `refused`; there is no Writ in creation yet), and the island's Name keeps the Writ's
  `NAME_REFUSED`, "The Writ won't take that name. Try another."; undrawable ones get their own line (below), and
  `POST /api/kindled` answers `name-refused` with the same line the client shows. "Both filters" (GAME DESIGN) are
  the safe-letters filter and its offensive-word list, both in `isSafe` (the list is empty for now). Names are not
  unique.
- **Names the game can draw.** The book asks for names in any language; until the pixel fonts have
  more scripts, that is narrowed to the characters both atlases contain (`DRAWABLE_CHARS` in
  `packages/shared/src/fonts.ts`, read from the atlas contracts, so server and client agree):
  printable ASCII and the Latin-1 Supplement, i.e. A–Z and accented Latin letters (`tools/
bitmap-fonts.py` builds both). Anything else (other scripts, Latin letters outside Latin-1, a mark
  with no precomposed letter, emoji) is refused with "Use letters the game can draw for now: A–Z and
  accented Latin letters." Usernames are ASCII already. The rules that only matter beyond Latin-1
  (at most 4 combining marks per cluster, the zero-width joiner and non-joiner allowed for the scripts
  that need them) stay in the validator for when the atlases grow.
- **Remembrance** (`clay | ash | tide | wing`) and **clay tone** (palette.json's `clay.tones`,
  default grey-ochre) come from
  [`packages/shared/data/creation.json`](../../packages/shared/data/creation.json), with their
  display names and each Remembrance's image line and starting clothing (LORE's, Lore §14.0). One Kindled per
  account, created once (`409` after); hair and build are not chosen yet (they wait for their sprites).

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

### Creation (M2 Task 9)

LORE's scene (Lore §14.0), every line word for word in `creation.json` (`CREATION_TEXT` in
`packages/shared/src/creation.ts`, checked on load: each line present and drawable; a test holds them to LORE's
text and the banned names). The logic is `apps/client/src/game/creationView.ts`, drawn by `CreationScene`.

1. **The opening** on black: the Narrator's opening line for `openingMs` (3 s), or until any key, click, tap or
   pad button.
2. **Remembrance**: the step's line at the top, four cards (the name, the image line muted, the starting
   clothing), and one figure under them for the chosen card.
3. **Appearance**: the four clay-tone swatches with their names and the tooltip line under them; the figure,
   twice the size, turning through the 8 facings (`idle` S, SE, E, NE, N, NW, W, SW, each held `turnMs`, 600 ms).
   The step has two focus rows, the tones and the figure: on the figure row Left/Right (the D-pad) turn it one
   facing, and a drag across it (mouse or touch) turns it one facing per 24 UI px; either pauses the turning
   until the player leaves the step. Left/Right on the tones row choose the tone.
4. **Name**: the step's line, the DOM name field and the figure standing south. CONFIRM checks the name here
   (the same validator the server runs) and then `POST /api/kindled`; a refusal shows under the field in the
   error token until the next CONFIRM, and the step stays.
5. **The closing** on black: the closing line for `closingMs` (2 s), then the start screen.

Each step has BACK and NEXT (the Name step's NEXT reads CONFIRM); BACK is greyed on the first step and takes no
focus. The choices (the Remembrance, the tone, the typed name) are kept across BACK and NEXT. The figure wears the
Remembrance's sheathed sheet once it is on disk, else Ash's (`sheathedSheetFor`, [sprites](sprites.md) §4), in the
chosen tone. Keyboard: Left/Right step through the choices (or turn the figure, or move between BACK and NEXT),
Up/Down and Tab/Shift+Tab move the focus between the rows and the buttons, Enter is NEXT (BACK when BACK has the
focus), Esc is BACK, typing goes to the name field on the Name step. Pad (`MENU_BUTTONS`): the D-pad the same,
Cross NEXT, Circle BACK; the name still needs the keyboard. Mouse and touch: a click or tap on a card or swatch
chooses it, the buttons move. The Narrator's line ([readability](readability.md) §4) is the moment's: the opening
and closing lines on black, the Remembrance line while a card is hovered or the cards have the focus, the clay
line while a swatch is hovered or the tones have the focus, the empty-field line while the name is empty,
nothing otherwise.

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
