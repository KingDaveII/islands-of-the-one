# Items and the inventory ledger

What a Kindled holds, and the one path by which it changes. The server is the only authority: the
client sees items, never changes them.

## Items

[`packages/shared/data/items.json`](../../packages/shared/data/items.json) lists every item, in
display order, and [`packages/shared/src/items.ts`](../../packages/shared/src/items.ts) validates it
on load (`validateItemsData`; a bad file throws, and `packages/shared/test/items.test.ts` fails).

| Field         | Rule                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `id`          | kebab-case, unique, glossary terms only; stored in the ledger, so never renamed    |
| `name`        | display name, only characters the game can draw                                    |
| `kind`        | `currency`, `sparkglass` or `material` (`ITEM_KINDS`; later kinds are added there) |
| `stackLimit`  | the most one Kindled may hold (a positive integer), or `"unlimited"`               |
| `description` | card text, left empty for LORE to write                                            |

No id or name may use a word the glossary retires (`RETIRED_WORDS`: void, island, tether, crystal,
fishing, shard) or a banned name (`packages/shared/test/banned.ts`, the same matcher as
`names.test.ts`).

The M2 items: **sealed gin** (`sealed-gin`, the currency unit); Sparkglass as **wild sliver**
(`wild-sliver`), **glass chip** (`glass-chip`) and **deep glass** (`deep-glass`); the materials
**twisted log**, **black stone**, **streaked stone**, **grey seeds** and **pale grain**. Currency and
Sparkglass are unlimited; materials stop at 9,999. Plot-sentence word tiles are not items.

Quantities are whole numbers stored as `bigint` and read as JS numbers, so no balance or delta goes
past `MAX_QUANTITY` (2^53 − 1), which is also the limit of an "unlimited" item.

## The Telling

Every ledger row is stamped with the Telling it happened in:
[`packages/shared/data/telling.json`](../../packages/shared/data/telling.json) names the current one
(`telling-1`). Items reset between Tellings; the stamp is what keeps one Telling's history apart
from the next. Change it only when a new Telling begins.

## The one path: `inventory.apply`

Every item or currency change goes through `inventory.apply(changes, reason, ref?)`
([`apps/server/src/inventory`](../../apps/server/src/inventory/inventory.ts)). Nothing else touches
the item tables.

- **changes**: `{ kindledId, itemId, delta }[]`, positive gives, negative takes. A change set may
  span several Kindleds (a trade); each Kindled and item appears at most once in it (merge the
  deltas).
- **reason**: one of `InventoryReason` in shared code: `grant`, `gather`, `harvest`, `feed-writ`,
  `craft`, `trade`, `admin`.
- **ref** (optional, at most 200 characters): an idempotency key, e.g. `trade:<id>` or
  `harvest:<station>:<cycle>`. A change set with a ref already in the ledger is not applied again:
  `apply` answers `duplicate: true` with the ledger rows of the first time, even when the two calls
  run at once. A refused set leaves its ref free. A ref names one change set; reusing it for a
  different one is a bug in the caller (the second is reported as a duplicate, not applied).

One transaction:

1. Rows the set touches but that don't exist yet are created at 0 (`INSERT … ON CONFLICT DO
NOTHING`), so every affected row can be locked.
2. `SELECT … FOR UPDATE` locks every affected row **in one fixed order: Kindled id, then item id**
   (both sides of a trade alike). Two change sets over the same rows, such as a trade and its
   reverse, queue up instead of deadlocking.
3. If any balance would go **below zero** (`insufficient`) or **past its stack limit**
   (`stack-limit`), the whole set is refused and nothing changes. An unknown Kindled is
   `unknown-kindled`.
4. The balances are written and **one `item_ledger` row per change**: Kindled, item, delta, the
   balance after it, reason, ref, the Telling, the time.

`apply` returns `{ ok: true, duplicate, entries }` or `{ ok: false, error, message, change }`. A
malformed call (unknown item or reason, a zero or fractional delta, an empty set, a repeated
Kindled + item) throws `InventoryInputError`: that is a bug in server code, not something a player
can cause.

The inventory module also reads: `holdings(kindledId)` (items held, quantity > 0, in items.json
order) and `ledger(kindledId)` (the rows, oldest first).

## Enforcing "nothing else touches item tables"

- The table objects live in `apps/server/src/inventory/tables.ts`, not `db/schema.ts`
  (`drizzle.config.ts` reads both). ESLint's `no-restricted-imports` refuses importing them from
  anywhere in `apps/server` outside `src/inventory/`, tests included.
- `apps/server/test/inventory-boundary.test.ts` also fails on raw SQL naming `items` or
  `item_ledger` outside the module.
- The database itself refuses a negative balance, a zero delta or a negative balance-after (`CHECK`
  constraints), and a second row for the same Kindled and item (a unique index).

## Tables

`items` (id, kindled_id, item_id, quantity ≥ 0, updated_at; unique on kindled_id + item_id) and
`item_ledger` (id, kindled_id, item_id, delta ≠ 0, balance_after ≥ 0, reason, ref, telling_id,
created_at; unique on ref + kindled_id + item_id where ref is set). Both cascade with the Kindled.
Rows that reach 0 stay (the view leaves them out). Tier, rarity and Virtue columns come later as new
nullable columns (expand-only); `items` rows have their own id so a wider unique key can be added
beside the current one.

## The API

`GET /api/inventory` (in [`packages/shared/src/api.ts`](../../packages/shared/src/api.ts), like the
routes in [`accounts.md`](accounts.md)): the Kindled comes from the session cookie only, never the
request. `200` `{ items: [{ item, quantity }] }` (quantity > 0, items.json order), `401`
not-signed-in, `404` no-kindled. There is no route that changes items.

## Granting items for playtests

No player can grant items. OPERATIONS can, on the host, with the CLI; it goes through
`inventory.apply` with reason `admin` like any other change, so it is in the ledger:

```sh
# Dev (uses DATABASE_URL, or PGLITE_DIR; not an in-memory PGlite the server holds):
pnpm --filter @iot/server inv:grant <username> <item> <qty>
pnpm --filter @iot/server inv:grant mira sealed-gin 120
pnpm --filter @iot/server inv:grant mira black-stone -30   # a negative qty takes away

# Staging (the server container; see DEPLOY.md for c()):
cd /opt/islands
c exec server node dist/inventory/grant-cli.js mira sealed-gin 120
```

It prints the new balance and ledger row, or why it was refused (unknown username or item, no
Kindled yet, not enough to take, past the stack limit), with a non-zero exit code.

## The client

The start screen's **INVENTORY** button (Square on the pad) opens the inventory view
(`apps/client/src/scenes/InventoryScene.ts`): the Kindled's items as `GET /api/inventory` answers
them, one row per item with its kind and count, text only until ART draws the 16×16 icons. It is
only there to see the ledger work; Esc or Enter (Circle) goes back. A grant shows after a reload or
on reopening the view.

## Testing

`apps/server/test/inventory.test.ts` runs on in-memory PGlite: changes and ledger rows, a refused
set changing nothing, stack limits, refs, a trade, the API and the CLI. PGlite is one connection and
runs transactions one after another, so it can't show the row locks at work.
`apps/server/test/inventory.postgres.test.ts` runs the races on a real Postgres: credits racing on a
row that doesn't exist yet, debits racing past zero, trades racing their reverses (no deadlock,
totals kept, every balance chain unbroken) and one ref sent many times at once. It needs
`TEST_DATABASE_URL`, a throwaway database whose name contains `test` (it is wiped): CI's `check`
job has a Postgres service for it and fails without it; `scripts/cloud-setup.sh` creates `game_test`
for Claude Code on the web; elsewhere the suite only runs when the variable is set.
