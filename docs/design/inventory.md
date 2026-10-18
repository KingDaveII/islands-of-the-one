# Items and the inventory ledger

What a Kindled holds, where it is, and the one path by which it changes. The server is the only
authority: the client sees items and asks for moves, never changes them.

## Items

[`packages/shared/data/items.json`](../../packages/shared/data/items.json) lists every item, in
display order, and [`packages/shared/src/items.ts`](../../packages/shared/src/items.ts) validates it
on load (`validateItemsData`; a bad file throws, and `packages/shared/test/items.test.ts` fails).

| Field         | Rule                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `id`          | kebab-case, unique, glossary terms only; stored in the ledger, so never renamed                           |
| `name`        | display name, only characters the game can draw                                                           |
| `kind`        | `currency`, `sparkglass`, `material`, `consumable` or `lore` (`ITEM_KINDS`)                               |
| `stackLimit`  | the most of the item one place holds (a positive integer), or `"unlimited"`; see "Places" for which apply |
| `description` | LORE's card text, word for word, only characters the game can draw                                        |
| `skill`       | optional: `woodcutting`, `mining` or `farming` (`ITEM_SKILLS`), the tooltip's kind line names it          |

No id or name may use a word the glossary retires (`RETIRED_WORDS`: void, island, tether, crystal,
fishing, shard) or a banned name (`packages/shared/test/banned.ts`, the same matcher as
`names.test.ts`); the card texts are checked the same way, and a character the pixel fonts lack
fails the test by name instead of being changed in the text.

The M2 items: **sealed gin** (`sealed-gin`, the currency unit); Sparkglass as **wild sliver**
(`wild-sliver`), **humming glass** (`glass-chip`, renamed from "glass chip" in M2 Task 3a; the id
stays) and **deep glass** (`deep-glass`); the materials **twisted log** (Woodcutting), **black
stone** and **streaked stone** (Mining), **grey seeds** and **pale grain** (Farming). Currency and
Sparkglass are unlimited; materials stop at 9,999. There are no consumable or lore items yet.
Plot-sentence word tiles are not items.

Quantities are whole numbers stored as `bigint` and read as JS numbers, so no balance or delta goes
past `MAX_QUANTITY` (2^53 − 1), which is also the limit of an "unlimited" item.

## Places

Every item a Kindled holds is in exactly one place
([`packages/shared/src/places.ts`](../../packages/shared/src/places.ts)):

| Place                | Holds                        | Limit                                                                                                                                                  |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `purse`              | currency only (`sealed-gin`) | the item's `stackLimit` (unlimited today). Takes no slot, never lost.                                                                                  |
| `pack`               | everything but currency      | `packSlots` (20) slots in all; an item takes `ceil(quantity / slotSize(kind))` of them. What a Kindled carries abroad; death costs only this.          |
| `store`              | everything but currency      | one stack per item, up to `storeLimit(kind)` (material 9,999) and the item's `stackLimit` (so Sparkglass is unlimited). Reachable only on the holding. |
| `basket:<stationId>` | what that station makes      | none: what the 48 h rule produced waits there ([holding](holding.md)). `stationId` is a station of stations.json, kebab-case.                       |

The numbers live in [`packages/shared/data/inventory.json`](../../packages/shared/data/inventory.json)
(`packSlots`, `slotSize` by kind: material 50, Sparkglass 99, consumable 5, lore 1; `storeLimit` by
kind), validated on load like `items.json` (`validateInventoryData`). They are GAME DESIGN's starting
values. "Store: twisted logs full." reads as one stack per item; if "unlimited slots" meant several
9,999 stacks of one item, that is a data change later.

**Pack slots are derived, not stored.** `packSlots(stacks)` splits each item, in `items.json` order,
into full slots and then the remainder, so there is no manual arrangement to persist and the server
and the client draw the same grid. The place guard is `isPlace`; `canMove(from, to)` says which moves
the API allows (below).

## The Telling

Every ledger row is stamped with the Telling it happened in:
[`packages/shared/data/telling.json`](../../packages/shared/data/telling.json) names the current one
(`telling-1`). Items reset between Tellings; the stamp is what keeps one Telling's history apart
from the next. Change it only when a new Telling begins.

## The one path: `inventory.apply`

Every item or currency change goes through `inventory.apply(changes, reason, { ref?, tx? })`
([`apps/server/src/inventory`](../../apps/server/src/inventory/inventory.ts)). Nothing else touches
the item tables.

- **changes**: `{ kindledId, itemId, place, delta }[]`, positive gives, negative takes. A change set
  may span several Kindleds (a trade); each (Kindled, item, place) appears at most once in it (merge
  the deltas; the same item in two places is two changes).
- **reason**: one of `InventoryReason` in shared code: `grant`, `gather`, `harvest`, `feed-writ`,
  `craft`, `trade`, `admin`, `move`, `gift`. `gather` is a station's yield credited into its basket when the
  holding settles ([holding.md](holding.md) §3): one row per settle, in the settle's transaction, with
  the ref `act:<kindled>:<started_at>:<credited>-<new total>` so a stretch's cycles are paid once.
  `gift` is what an NPC gives: Kesh's first sliver and the tide's, one `wild-sliver` into the pack
  ([holding.md](holding.md) §10), in the holding request's transaction.
- **ref** (optional, at most 200 characters): an idempotency key, e.g. `trade:<id>` or
  `harvest:<station>:<cycle>`. A change set with a ref already in the ledger is not applied again:
  `apply` answers `duplicate: true` with the ledger rows of the first time, even when the two calls
  run at once. A refused set leaves its ref free. A ref names one change set; reusing it for a
  different one is a bug in the caller (the second is reported as a duplicate, not applied).
- **tx** (optional): a caller's transaction. The set then runs inside it as a savepoint, so an
  action and its items settle together (Task 3b): a refusal rolls back only the set's own work and
  the caller's transaction stays usable; the caller rolling back takes the items with it. Without
  `tx` the set runs in a transaction of its own.

One transaction:

1. Every affected Kindled's row is locked, in id order (`FOR NO KEY UPDATE`, so the inserts' foreign-key
   checks never wait on it). The pack's slot count spans rows a set doesn't touch, and rows another
   set is creating, so two sets on one Kindled never judge the pack at once.
2. Rows the set touches but that don't exist yet are created at 0 (`INSERT … ON CONFLICT DO
NOTHING`), so every affected row can be locked.
3. `SELECT … FOR UPDATE` locks every affected stack row **in one fixed order: Kindled id, item id,
   place, all `collate "C"`** (both sides of a trade alike). Two change sets over the same rows, such
   as a trade and its reverse or two moves, queue up instead of deadlocking.
4. The whole set is refused and nothing changes if any change would:
   - put a kind where it can't be: currency outside the purse, anything else in it (`wrong-place`,
     judged before the transaction);
   - take a place below zero (`insufficient`);
   - put a purse balance past the item's `stackLimit`, or a store stack past `storeLimit(kind)` or
     the `stackLimit` (`stack-limit`);
   - take a pack over `packSlots`: the slots are counted over every stack in the pack with the new
     balances, and only a set whose pack gains is refused, so taking things out of a pack that is
     somehow over its slots always goes (`pack-full`).
     An unknown Kindled is `unknown-kindled`.
5. The balances are written and **one `item_ledger` row per change**: Kindled, item, place, delta,
   the balance of that place after it, reason, ref, the Telling, the time.

`apply` returns `{ ok: true, duplicate, entries }` or `{ ok: false, error, message, change }`. A
malformed call (unknown item, place or reason, a zero or fractional delta, an empty set, a repeated
Kindled + item + place) throws `InventoryInputError`: that is a bug in server code, not something a
player can cause.

**A move** (`moveItems` in `move.ts`) is one set with reason `move`: −n from one place and +n to
another, so the ledger shows both sides. The inventory module also reads: `holdings(kindledId)`
(every stack, quantity > 0, in items.json order then purse, pack, store, baskets by station),
`view(kindledId)` (the same by place, the API's shape) and `ledger(kindledId)` (the rows, oldest
first); both take a caller's transaction to read what it sees (the holding's take-all after its settle).

## Enforcing "nothing else touches item tables"

- The table objects live in `apps/server/src/inventory/tables.ts`, not `db/schema.ts`
  (`drizzle.config.ts` reads both). ESLint's `no-restricted-imports` refuses importing them from
  anywhere in `apps/server` outside `src/inventory/`, tests included.
- `apps/server/test/inventory-boundary.test.ts` also fails on raw SQL naming `items`, `item_stacks`
  or `item_ledger` outside the module. Its one exemption is `inventory-migration.test.ts`, which
  seeds the retired `items` table the way Task 2 did to check the migration below.
- The database itself refuses a negative balance, a zero delta or a negative balance-after (`CHECK`
  constraints), and a second row for the same Kindled, item and place (a unique index).

## Tables

`item_stacks` (id, kindled_id, item_id, place, quantity ≥ 0, updated_at; unique on kindled_id +
item_id + place) and `item_ledger` (id, kindled_id, item_id, place, delta ≠ 0, balance_after ≥ 0,
reason, ref, telling_id, created_at; unique on ref + kindled_id + item_id + place where ref is set).
Both cascade with the Kindled. Rows that reach 0 stay (the view leaves them out). Tier, rarity and
Virtue columns come later as new nullable columns (expand-only); `item_stacks` rows have their own id
so a wider unique key can be added beside the current one.

**The migration from Task 2** (`0003_inventory_places`): `items`, Task 2's one balance per Kindled
and item, can't hold one row per place (its unique key is Kindled + item), so `item_stacks` is a new
table and the migration copies `items` into it: currency (`sealed-gin`, the only currency item when it
was written) to the purse, everything else to the store. `item_ledger` gains a nullable `place`: old
rows keep null, meaning the Task 2 single balance; `balance_after` is now the balance of that place.
The ref index became (ref, Kindled, item, place), replacing Task 2's (ref, Kindled, item): the old one
would refuse a valid move (the same item in two places under one ref), so it is dropped rather than
kept. `items` is retired: no code reads or writes it, it stays in `tables.ts` marked retired so
`db:generate` doesn't emit a `DROP` (migrations are expand-only: staging rolls code back but not
migrations), and a later contract migration drops it. A rollback to Task 2's code would read the
stale `items` copy; acceptable on staging, which holds no real players.

## The API

In [`packages/shared/src/api.ts`](../../packages/shared/src/api.ts), like the routes in
[`accounts.md`](accounts.md): the Kindled comes from the session cookie only, never the request.

| Route                      | Body                             | Answer                                                                                                                   |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/inventory`       |                                  | `200` `{ purse, pack, store, baskets }` · `401` not-signed-in · `404` no-kindled                                         |
| `POST /api/inventory/move` | `{ itemId, from, to, quantity }` | `200` the new inventory · `400` bad-request · `409` pack-full / stack-limit / insufficient / wrong-place · `401` · `404` |

`purse`, `pack` and `store` are lists of `{ itemId, quantity }` (quantity > 0, items.json order);
`baskets` is keyed by station id. A move is allowed between `pack` and `store` both ways, and from a
`basket:*` to `store` (the holding's take-all goes through the same change set, server-side, moving
only what fits: [holding.md](holding.md) §3); nothing else moves by this route, and the purse is
never a move target (`wrong-place`). The guard refuses unknown fields and non-positive or non-integer
quantities; nothing is clamped silently. The store is reachable only on the holding:
`canReachStore(kindled)` in `move.ts` returns true today, since M2 has no other place a Kindled can
be (the M1 run is a client-side test); voyages (M3) make it real.

The move changed `GET /api/inventory`'s shape from Task 2's `{ items: [{ item, quantity }] }`, so
`PROTOCOL_VERSION` is 2.

## Granting items for playtests

No player can grant items. OPERATIONS can, on the host, with the CLI; it goes through
`inventory.apply` with reason `admin` like any other change, so it is in the ledger:

```sh
# Dev (uses DATABASE_URL, or PGLITE_DIR; not an in-memory PGlite the server holds):
pnpm --filter @iot/server inv:grant <username> <item> <qty> [place]
pnpm --filter @iot/server inv:grant mira sealed-gin 120           # the purse (currency's default)
pnpm --filter @iot/server inv:grant mira black-stone 30           # the store (everything else's default)
pnpm --filter @iot/server inv:grant mira black-stone -30 pack     # a negative qty takes away, here from the pack
pnpm --filter @iot/server inv:grant mira pale-grain 9 basket:field

# Staging (the server container; see DEPLOY.md for c()):
cd /opt/islands
c exec server node dist/inventory/grant-cli.js mira sealed-gin 120
```

It prints the new balance and ledger row, or why it was refused (unknown username, item or place, no
Kindled yet, not enough to take, the wrong place for the kind, past a limit, the pack full), with a
non-zero exit code.

## The client

The inventory screen (`apps/client/src/scenes/InventoryScene.ts`; its layout logic, tested in node,
in `apps/client/src/game/inventoryView.ts`) opens with I on the keyboard, the Touchpad on a DualSense
(both the `inventory` binding in `controls.json`), the start screen's **INVENTORY** button (Square on
the pad); Esc, Circle or I closes it. Placeholder UI in the existing panel style and BitmapText until
ART's M2 UI kit replaces the look (not the layout logic); each cell draws the item's
16 px icon from ART's `item-icons` sheet (#77), centred in the 24 px cell, and falls back to the item's
initials for an item the sheet lacks.

- **Two panes**: the **pack**, a 5 × 4 grid of its derived slots (`packSlots`, the server's order),
  each cell an icon placeholder and its count, titled with the slots used; the **store**, a scrolling
  grid of the same cells (the store's stacks split a pack slot's worth each, so a cell always fits one
  slot). The mouse wheel scrolls it; the focus scrolls it too.
- **Tabs** filter both panes: all, materials, Sparkglass, consumables, lore objects (empty kinds show
  empty). The Words tab comes with word tiles in Task 5. A tab hides the other kinds' pack slots but
  they still take their room.
- **The header** shows the purse (gin) and the Sparkglass totals across the pack and the store: wild
  slivers, humming glass, deep glass.
- **The two consumable slots** (Q / F, the `item1` and `item2` bindings) sit under the pack, empty,
  and accept nothing until consumables exist.
- **Moving items** goes to the other pane: mouse, click moves the cell's stack, right-click moves one,
  drag to the other pane moves the stack; pad, Cross moves the stack, Square moves one, the D-pad or
  the left stick moves the focus, L1/R1 switch tabs; touch, tap moves the stack, long-press moves one;
  keyboard, the arrows or WASD move the focus, Enter moves the stack, Tab switches tabs. Every move is
  a `POST /api/inventory/move`; the screen redraws from the answer, never optimistically, and takes no
  other move while one is in flight. A refusal shows its reason in one line, right-aligned in the
  header row of the pane the move went to (`PACK 20/20 … Pack full.`; the store's limit in the store's
  header): it blinks twice, holds for 2 s, then disappears in one frame, never a fade
  (`refusalVisible` in `inventoryView.ts`, on `blinkOut()`'s rule).
- **Focus.** Only the pane the keys or the pad act on has the lit (`ui-focus`) rim; the other keeps
  the plain panel frame, and with the mouse alone neither is lit. The focused cell keeps its own frame.
  The store's page counter sits right-aligned in its header row, with the page glyphs (D-pad up and
  down, or W and S) on either side; the Q / F key glyphs sit centred under their slots, as the HUD
  shows its key hints.
- **The tooltip** (hover with the mouse, focus on the pad) takes no input: the name, the kind line
  (`Material · Mining`, or just the kind), the card text muted under a 1 px divider, the count in
  this pane.
- **Nothing can be destroyed**: there is no delete or drop anywhere.

## Testing

`packages/shared/test/places.test.ts`: the `inventory.json` validator, the place guard, derived pack
slots (split stacks, the 20-slot edge), `canMove` and the API guards; `items.test.ts`: the texts
against `DRAWABLE_CHARS` and the banned-name matcher. `apps/server/test/inventory.test.ts` runs on
in-memory PGlite: changes and ledger rows by place, each refusal, moves both ways and from a basket,
the ledger rows of a move, refs with places, `apply` inside a caller's transaction, a trade, the API's
guards and error codes, and the CLI with and without a place; `inventory-migration.test.ts` migrates
to 0002, seeds Task 2's rows and checks 0003 copies them into the right places. PGlite is one
connection and runs transactions one after another, so it can't show the row locks at work.
`apps/server/test/inventory.postgres.test.ts` runs the races on a real Postgres: credits racing on a
row that doesn't exist yet, debits racing past zero, trades racing their reverses, moves racing
between the pack and the store (no deadlock, totals kept, every balance chain unbroken), two moves
racing for the pack's last slots (exactly one wins) and one ref sent many times at once. It needs
`TEST_DATABASE_URL`, a throwaway database whose name contains `test` (it is wiped): CI's `check` job
has a Postgres service for it and fails without it; `scripts/cloud-setup.sh` creates `game_test` for
Claude Code on the web; elsewhere the suite only runs when the variable is set.
`apps/client/src/game/inventoryView.test.ts` covers the screen's layout logic: the pack slots from an
inventory answer, the tab filters, the header, the tooltip lines and the grid navigation.
`tools/screenshots-m2-3a.mjs` is the end-to-end run (`docs/screenshots/m2-3a`).
