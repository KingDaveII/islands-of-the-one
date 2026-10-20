# The holding

The Kindled's home Shard (M2 Task 3b): where a player lands after logging in, walks around, works
the twisted trees or the stone outcrop, takes a station's basket into the store and moves things
between the store and the pack, names the island and feeds its Writ (M2 Task 4a, §9), names and builds up
its plots (§11, §12), sleeps by the post and reads the While you were away card (§13), and takes the run's weapon from the
weapon rack (§14). Numbers live in
[`packages/shared/data/holding.json`](../../packages/shared/data/holding.json),
[`stations.json`](../../packages/shared/data/stations.json), [`skills.json`](../../packages/shared/data/skills.json),
[`writ.json`](../../packages/shared/data/writ.json), [`pieces.json`](../../packages/shared/data/pieces.json) and the `roam`
and `plots` blocks of [`tuning.json`](../../packages/shared/data/tuning.json), never in code. Terms:
[`glossary.md`](glossary.md); items and the baskets: [`inventory.md`](inventory.md); how it is
drawn: [`readability.md`](readability.md); the sheets: [`sprites.md`](sprites.md); the Old Letters and
how a Name is heard: [`letters.md`](letters.md).

## 1. The layout: data, the starting holding

`holding.json` holds one layout, `first-holding`: GAME DESIGN's starting holding (2026-10-18, M2 Task 3c; keep it
pure data). A tile template in the rooms' style, 30 × 24 cells with the island inside it, about 28 × 22 of
ground with an irregular edge that blurs into the haze; the template grew from MAIN's 28 × 20 placeholder so the
ring of plots, the trees within reach of the post and the free ground north all fit:

| Legend | Meaning                                                                                   |
| ------ | ----------------------------------------------------------------------------------------- |
| `.`    | ground                                                                                    |
| `#`    | the edge of the Shard, void and solid; everything outside the template is void too        |
| `W`    | the Writ post                                                                             |
| `S`    | the holding store                                                                         |
| `K`    | the weapon rack (M2 Task 8)                                                               |
| `T`    | a twisted tree                                                                            |
| `R`    | the stone outcrop                                                                         |
| `P`    | the start, by the post                                                                    |

- **Stations:** a list, each with its `id` (stations.json), `kind` and `parts`: one or more places it stands, each
  a tile `rect` (`col`, `row`, `cols`, `rows`) and its `interact` point, the ground tile beside it the prompt and the
  panel stand on. Any part's interact point works the station. The Writ post (1 × 1 at (14, 13)) stands at the
  centre; the holding store (`holding-store`, kind `store`, 2 × 1 at (10, 14)) and the weapon rack (`weapon-rack`,
  kind `rack`, 2 × 1 at (17, 13)) within 3 tiles of it; the six twisted trees, one 2 × 2 part each on the west side
  within 10 tiles of the post, all the one `twisted-trees` station with one basket; the stone outcrop (2 × 2 at
  (23, 13)) on the east side within 10. The start is at (14, 15).
- **`reserved`:** a spot kept for a later task: its tiles are plain ground, it draws no prop and offers no Use, and
  stations.json gives it no action. The weapon rack was one until Task 8 (§14); no spot of the shipped layout is
  reserved today, and the rule stays for the next.
- **Plots:** four 6 × 6 rectangles (`PLOT_SIZE`) in a loose ring around the post with paths between them. Each
  has a permanent `id` (`plot-1` … `plot-4`, in order; the basket is `basket:<id>` in the ledger, so ids are
  never renamed) and a `station`: a 1 × 1 `rect` at the plot's centre ((col + 2, row + 2), the signpost, a
  pillar in the roam template once the plot is named) and its `interact` point just south of it. They never
  touch each other, the post or the store. The plots in order belong to Writ line 1, `linePlots` per line (§11).
- **`landing`:** where the boat ties up later, a ground tile on the south shore ((14, 22)); no prop or action yet.
- **`kesh`:** Kesh's needle of rock, `rock`, a 2 × 2 of void a stone's throw off the south-east shore ((26, 20)),
  drawn as the solid prop `prop-kesh-rock` (unwalkable: its tiles are void), and `talk`, the ground tile Talk across
  the water stands on in Task 4 ((23, 19)). No NPC yet.
- **Free ground on the north side** for later Writ lines' plots.
- **The rule** (`holdingLayoutProblems`, `packages/shared/src/holding.ts`, run on load and by
  `packages/shared/test/holding.test.ts`): the template is rectangular, only legend characters, its border all edge
  (so the shore's drops fit inside it) and free of the one-cell notch the shore pieces can't draw
  (`shoreProblems`); every station's parts are its kind's letter (solid for the sim; a reserved spot's are ground)
  and each interact point is ground beside its part and reachable from the start; every station letter belongs
  to a station; there is one Writ post, within `CENTRE_SLACK` (2) of the island's centre; the store and the rack
  within `NEAR_POST` (3) tiles of it, every tree (west of it) and the outcrop (east of it) within `FAR_POST` (10),
  measured between nearest cells (`rectGap`); the plots are 6 × 6 on ground, overlap no station and touch neither
  each other, the post nor the store (`rectsTouch`, diagonals included), their ids unique and kebab-case, each
  station rect and interact point inside its plot, the interact point ground and reachable from the start; the landing is ground with void south of
  it, south of the post and reachable; the rock is void with at least one cell of void between it and the island
  and within 6 of it, south and east of the post, its Talk spot reachable ground within 4 of it; a plot's worth of
  plain ground lies north of the post, clear of every plot and station; there is exactly one start, on ground.
  The numbers are `HOLDING_DISTANCES`.
- `offlineCapHours` (48) and `heartbeatMs` (30 000) live beside the layouts.

**Drawn as an island.** `holdingTemplate` is the layout as the tile rule reads it, and `tiles-holding` is a
**shore set without doors** (`sprites.md` "Tiles", the shore rule; ART 2026-10-18): every cell that isn't the edge
is ground (the station letters too, so the floor draws under the props), drawn as a floor with lips where the void
is beside it; the void cell under a ground cell draws the drop, the cliff hanging below the island into the Hollow,
and every other void cell draws nothing, so the hollow background shows through. The props are sprites: one per
station part from `prop-writ-post`, `prop-twisted-tree` (on the tall 96 × 128 prop cell, the canopy overhanging
upwards: the Kindled standing north of a tree draws behind its crown by the ground-line sort), `prop-stone-outcrop`
and `prop-holding-store` (`STATION_SHEETS`; a reserved spot has none; a part may name its own sheet instead,
`sheet` in `holding.json`, from `STATION_PART_SHEETS`: every other tree is `prop-twisted-tree-2`, ART's forked
crown on the same tall cell, drawn once it is on disk and `prop-twisted-tree` until then), and Kesh's rock from `prop-kesh-rock`
(`KESH_ROCK_SHEET`), each playing its `idle` (one frame, but the Writ post's two at 2 fps: its tablet's marks pulse), standing on the bottom centre of its tile rectangle with a grounding
shadow by the prop rule (none for a prop standing in the void, Kesh's rock: `standsOnGround`), y-sorted with the Kindled by the line it stands on. `holdingRoomTiles(layout, solidPlots)` is the layout as
the sim walks it: every station tile a pillar (`o`), a reserved spot ground, the rock's tiles already void, and a
named plot's signpost tile a pillar too (the scene passes the named plots' ids). All
six sheets are ART's (the holding at B, #84), built through the recipes in `art/sheets/` from `art/clean/`;
they replaced MAIN's placeholders without an engine change, and the placeholder script is retired. The pipeline's `rooms.png`
for a shore set draws the holding's layout alone (the cave sets draw the rooms of rooms.json).

## 2. Roaming: walking outside encounters

`packages/sim/src/roam.ts` (GAME DESIGN 2026-10-16) is deterministic integer movement for everywhere
outside encounters; the holding is its first user and it is not part of the combat run. The same
acceleration, friction and `collideWalls` as the run's free movement, on the run's packed input (its
aim and buttons ignored), with the `roam` block of tuning.json compiled to integers
(`compileRoam`):

- The Kindled **walks** at `roam.walkFactor` (0.7) × `player.moveSpeed`.
- It **breaks into a run on its own** after `roam.runAfterMs` (1200) of moving at a full push
  without stopping or turning more than `roam.resetTurnDeg` (90), and ramps up to full speed over
  `roam.rampMs` (400). Stopping or a sharp turn drops it back to a walk and restarts the clock.
- A stick pushed less than `roam.walkStickMax` (0.6 of its travel: magnitudes 1–4 of 7) always
  walks and never starts the clock; the keyboard counts as a full push. There is no run button.
- **The run clock tolerates a wobbling thumb** (GAME DESIGN 2026-10-18): a dip under 60 % shorter than
  `roam.dipGraceMs` (250) doesn't reset it (the clock keeps counting through the dip), and a longer one does,
  on the tick past the grace; the next full push starts the clock over. A stop (no push) is still a stop. In
  integer ticks (`dipGrace`, 15; `dipTicks` in the state, so the replay hash changed with it).
- **No combat, no backpedal.** The facing follows the movement direction; standing still keeps the
  last facing.
- A record (the template, the start, the tuning, the inputs) replays to the same hash
  (`packages/sim/test/roam.test.ts`: determinism, the walk-to-run timing, the reset on a stop and a
  sharp turn, the stick threshold, the collision).

**Positions on the holding are the client's.** M2 holdings are private and nothing of value depends
on where you stand: the server checks that a station exists in the layout, not where the player is
(`inRange` in `apps/server/src/holding/holding.ts` returns true today; visits make it real).

**Animation** (`roamPose` in `apps/client/src/render/animState.ts`): `walk` by distance at
`anim.walkCyclePx`, `run` at `anim.runCyclePx` once the roam's gait is `run`, `idle` standing;
`run_start` when the run begins and `run_stop` when it ends (`RoamGaitClock`) where a sheet has them
(kindled-ash has both since #72). Outside combat the Kindled carries no blade (David's playtest, 2026-10-18):
the holding draws it from its Remembrance's sheathed sheet (`sheathedSheetFor`, M2 Task 9: `kindled-<rem>-sheathed`
once ART's lands, `kindled-ash-sheathed` until then, `PLAYER_SHEATHED_SHEET`, sprites.md §4, ART #87), with the same
tone swap; encounters keep the combat sheet.

## 3. Stations and the active action

[`stations.json`](../../packages/shared/data/stations.json), validated on load:

| station         | kind    | action          | yields            | cycle | skill       | XP per cycle | basket cycle (the trickle) |
| --------------- | ------- | --------------- | ----------------- | ----- | ----------- | ------------ | -------------------------- |
| `writ-post`     | post    | none: Use opens the Writ panel (the Name screen first, unnamed; §9) | n/a   | n/a   | n/a         | n/a          | none |
| `holding-store` | store   | none: Use opens the inventory with the store pane | n/a | n/a | n/a | n/a | none |
| `weapon-rack`   | rack    | none: Use opens the rack panel (§14) | n/a | n/a | n/a | n/a | none |
| `twisted-trees` | trees   | a dead branch   | 1 `twisted-log`   | 4 s   | Woodcutting | 4            | 1 `twisted-log` every 20 min (six trees at 2 h each, one shared basket filling one log at a time) |
| `stone-outcrop` | outcrop | surface stone   | 1 `black-stone`   | 6 s   | Mining      | 6            | none: stone never comes by itself (GAME DESIGN) |

And the **plot kinds** (`plotKinds`), what a Ground word builds on a plot (§11); a named plot is a station of
its kind whose id is the plot's (`plot-1` …, basket `basket:plot-1`):

| plot kind | action  | yields          | cycle | skill   | XP per cycle | basket cycle                | sown with       |
| --------- | ------- | --------------- | ----- | ------- | ------------ | --------------------------- | --------------- |
| `field`   | farming | 1 `pale-grain`  | 20 s  | Farming | 20           | 1 `pale-grain` every 15 min | 1 `grey-seeds`  |

A living branch ("mixed dead and living branches"), regrowth and the quarry's layers come later, with their
items. The six trees are one station: any tree's interact point works it, and they share one basket. A `cycle`
is optional on any station or plot kind (`itemId`, `quantity`, `cycleMs`), validated like the action; a basket
fills one item at a time, so a cycle's quantity is above 1 only where one action really yields more (GAME DESIGN
2026-10-18).

**One active action per Kindled**, in the `holding_activity` table (the Kindled as primary key, the
station, `started_at`, `credited_cycles`, `last_seen_at`; migration 0004, expand-only). Starting work
at a station replaces any other action: settle first, then switch. Stopping settles, then clears.

**Settling** is how progress is computed. Nothing ticks in the background: the server computes on
every holding request, in one transaction with the Kindled's row locked (`FOR NO KEY UPDATE`, the
same lock `inventory.apply` takes, so every holding change and every item change on one Kindled
queue in one line) and the activity row locked `FOR UPDATE`:

1. **The end:** `end = min(now, last_seen_at + 48 h)`; the cap is `offlineCapHours` in data.
2. **Count:** completed cycles = `floor((end − started_at) / cycle) − credited_cycles`.
3. **Credit them:** the yield into `basket:<station>` through `inventory.apply` (reason `gather`, in
   the same transaction through its `tx` option, ref `act:<kindled>:<started_at ms>:<credited>-<new total>`,
   so a stretch's credit applies once), and the XP into `skill_xp`.
4. **Lost time:** when `end < now` the time between them was beyond the cap. The cycle clock restarts
   at `now` (a fresh `started_at`, `credited_cycles` 0), so lost time is never paid later.
5. **Last seen:** `last_seen_at = now`.

Online play keeps `last_seen_at` fresh (the heartbeat), so the cap only bites away from the game.
**The Writ sets the horizon** (`offlineHorizonMs(writ, lastSeenAt, now)`, M2 Task 4a; §9): the full
cap while the Writ is lit or flickering at `now`; otherwise the stretch earns unattended only until
the moment the Writ went dark, `min(cap, emptyAt − lastSeenAt)`, and never less than
`ONLINE_GRACE_MS`, twice the heartbeat, so online play still never loses a partial cycle and hands
keep working at full rate and XP while dark (GAME DESIGN: "Dark means idling stops, not that the
player is locked out"). The Writ row is locked in the settle's transaction with the rest.

**Baskets** have no limit: what the 48 h rule produced waits there.

**The trickle: basket cycles** (M2 Task 5; GAME DESIGN's "one mechanism", "while the Writ is lit", "basket cycles
earn no XP"). Besides the active action, every station or plot with a `cycle` pays its yield into its basket on
its own while the Writ is lit, whether or not the Kindled is working anywhere. The state is the `basket_cycles`
table (the Kindled and the station as primary key, cascade; `cycled_until`, `carry_permille`; migration 0007,
expand-only): a row is created with `cycled_until` = now for a field when it is sown, and for the trees on the
Kindled's first settle after this shipped (nothing is paid for the time before). The holding-wide **last seen**
is `writs.last_seen_at` (the activity's `last_seen_at` goes with a stop; this one doesn't), refreshed by every
holding request. Settling, in the same transaction and locks as the active action, for every station with a
cycle (`apps/server/src/holding/cycles.ts`):

1. `end = min(now, lastSeen + offlineCapHours, writ.emptyAt)`: no cycle runs while the Writ is dark, and none
   past the cap. A faded plot's end is clamped at its line's `fadesAt` too, so a relight never pays dark time.
2. `n = floor((end − cycled_until) / cycleMs)`, never negative; `cycleMs` is the station's real length,
   `cycleLengthMs(cycle, pieces)`: its `cycleMs` over the speed its standing pieces give (§12; the field's 15 min is
   12 with one piece, 10 with two). A settle pays at the speed the pieces had; a build after it leaves
   `cycled_until` where it stands, so the partial cycle carries on at the new speed.
3. Credit the n cycles' yield into `basket:<station>` through `inventory.apply`, reason `harvest`, ref
   `cycle:<kindled>:<station>:<from ms>-<to ms>`, so a stretch pays once. There is no XP. ישן's bonus (§11)
   multiplies the quantity in permille with a carry kept in `carry_permille`, all integers.
4. `cycled_until += n × cycleMs`; when `end < now` (the Writ went dark, or the cap bit), `cycled_until = now`:
   the lost time and the partial cycle are never paid later, like the active action's lost time.

"192 for a field" is what 48 h of the field's cycle makes under the cap, not a stored number. The away hook
(§5) moves every `cycled_until` and the last seen back too.

**Take all** (Use on a station → Take all) moves the basket into the store **moving only what fits**
(GAME DESIGN 2026-10-17): when a store stack is full the rest stays in the basket and the toast says
"Store: twisted logs full." (§13; Task 7). 3a's move refuses an over-limit set, so
take-all computes what fits under the Kindled's lock (`fitsInStore`: the item's stack limit and
`storeLimit(kind)` less what the store holds) and moves that, as one `move` set per item, so the ledger
shows both sides. What moved shows as "+3" floating over the station, the same float the cycles use, and
no message line; an empty basket shows nothing beyond its panel's "Basket: empty" (GAME DESIGN 2026-10-18).

## 4. Skill XP

GAME DESIGN's curve, in [`packages/shared/src/skills.ts`](../../packages/shared/src/skills.ts):

- Skills have no level cap. The XP to go from level L to L + 1 is
  `round(40 + 12,300 × (1.08^L − 1.08))`; level 2 is at 40 XP.
- XP per action is the action's base time in seconds (4 at the trees, 6 at the outcrop, 20 at a field).
  Basket cycles (§3's trickle) earn none.
- The table is generated, not computed at runtime: `tools/skills-table.mjs` writes `skills.json`, the
  cumulative XP of each level from 1 to 200 (level 10 at 46,689, level 20 at 298,935, level 200 at
  743,985,697,074). `skillProgress(xp)` reads it and runs the same formula past it (`xpToNext`).
  `packages/shared/test/skills.test.ts` recomputes every entry from the formula, integer-exact, pins
  those values and checks the level at the edges, 200 and 250 included.
- `skill_xp` (Kindled, skill, XP as bigint) is written only in the settle transaction. XP is not an
  item, so it is not in the item ledger. The skills of M2: Woodcutting, Mining, Farming (the fields, §11).

## 5. The API

In [`packages/shared/src/api.ts`](../../packages/shared/src/api.ts), beside the account and inventory
routes ([`accounts.md`](accounts.md)): the Kindled comes from the session cookie only.

| Route                     | Body            | Answer                                                                                   |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/holding`        |                 | `200` `HoldingResponse` · `401` not-signed-in · `404` no-kindled                         |
| `POST /api/holding/work`  | `{ stationId }` | `200` the same · `400` bad-request / unknown-station / no-action (the post) · `401` · `404` |
| `POST /api/holding/stop`  | `{}`            | `200` the same · `400` bad-request · `401` · `404`                                       |
| `POST /api/holding/take`  | `{ stationId }` | `200` the same, with `take` · `400` bad-request / unknown-station · `401` · `404`       |
| `POST /api/writ/name`     | `{ name }`      | `200` the same · `400` bad-request / name-refused · `409` already-named · `401` · `404` |
| `POST /api/writ/feed`     | `{ itemId, count }` or `{ fill: true }` | `200` the same · `400` bad-request / not-sparkglass · `409` unnamed / insufficient / full / too-much · `401` · `404` |
| `POST /api/kesh/sliver`   | `{}`            | `200` the same · `400` bad-request · `409` not-due / pack-full · `401` · `404` (§10)     |
| `POST /api/kesh/word`     | `{}`            | `200` the same · `400` bad-request · `409` not-due · `401` · `404` (§11)                 |
| `POST /api/kesh/seeds`    | `{}`            | `200` the same · `400` bad-request · `409` not-due / pack-full · `401` · `404` (§11)     |
| `POST /api/plots/name`    | `{ plotId, ground, virtue }` | `200` the same · `400` bad-request / unknown-plot / unknown-word / wrong-slot / no-ground / sentence-refused · `409` unnamed / faded / unchanged / insufficient · `401` · `404` (§11) |
| `POST /api/plots/sow`     | `{ plotId }`    | `200` the same · `400` bad-request / unknown-plot · `409` unnamed-plot / faded / already-sown / insufficient · `401` · `404` (§11) |
| `POST /api/plots/build`   | `{ plotId, pieceId, col, row, rotation }` | `200` the same · `400` bad-request / unknown-plot / unknown-piece / blocked · `409` unnamed-plot / faded / already-built / needs-line / needs-skill / limit / insufficient · `401` · `404` (§12) |
| `POST /api/plots/move`    | `{ plotId, pieceId, col, row, rotation }` | `200` the same · `400` bad-request / unknown-plot / blocked · `409` unnamed-plot / faded / not-built · `401` · `404` (§12) |
| `POST /api/plots/take-down` | `{ plotId, pieceId }` | `200` the same · `400` bad-request / unknown-plot · `409` unnamed-plot / faded / not-built / store-full · `401` · `404` (§12) |
| `POST /api/holding/away/seen` | `{ to }` (ISO)  | `204`, the away card dismissed while its `to` still matches · `400` bad-request · `401` · `404` (§13) |
| `POST /api/holding/rack/choose` | `{ weaponId }` | `200` the same · `400` bad-request · `409` not-owned / not-ready · `401` · `404` (§14) |

`POST /api/holding/work` and `/take` take a named plot's id as a station id too: an unnamed plot is
`unnamed-plot` (409), an unsown field `not-sown` (409), a faded plot `faded` (409).

`HoldingResponse`: the layout id; `baskets` by station id (every station of the layout listed, the plots'
too) as lists of `{ itemId, quantity }`; the `activity` (`stationId`, `startedAt`, `cycleMs`) or null; the
server's `now`; `skills`, each with its XP, level, XP into the level and XP to the next; the
`writ` (`WritView`, §9) and `kesh` (`KeshView`, §10, with `wordDue` and `seedsDue`); `words`, the known word
ids; `plots`, one `PlotView` per layout plot (`id`, `ground`, `virtue`, `namedAt`, `virtueSetAt`, `sownAt`,
`kind` (null while unnamed), `pieces` (the pieces standing in it, `{ pieceId, col, row, rotation }`, §12),
`level` (1 plus the distinct pieces), `state` `lit` | `dark` | `faded` from the plot's Writ
line); and `cycles`, by station id for every station with a running cycle, `{ cycleMs, cycledUntil,
bonusPermille }` (`cycleMs` the real length, §12), so the client draws "Next in 12 min" between heartbeats (§11). A take answer adds `take`: the station, what `moved` into the store and what
was `left` in the basket. Every route settles first, refuses unknown fields and stations, and answers
the same shape as GET; `away` is the While you were away card waiting to be seen, or null (§13); `rack` is the weapon
rack, the weapons owned and the one a run takes (§14). The Writ's
routes are in §9; the shape change made `PROTOCOL_VERSION` 3, `kesh` with the Writ's `fedAt` (4b) made it 4,
the plots (Task 5) 5, the pieces (Task 6) 6, the away card (Task 7) 7, and the rack (Task 8) 8.

**The heartbeat:** while the holding scene is open the client calls `GET /api/holding` every
`heartbeatMs` (30 s) and after each interaction (work, stop, take, opening a station panel, coming
back from the inventory), so `last_seen_at` stays fresh and the counts stay true. The start screen fetches it once,
when it opens, for the run's weapon (§14). The inventory routes
(`GET /api/inventory`, `POST /api/inventory/move`) settle first too (`Holding.settle`), so every route sees the
same absence (§13).

**The away hook** (playtests only): `pnpm --filter @iot/server holding:away <username> <hours>` moves
the active action's `started_at` and `last_seen_at`, the holding-wide last seen and every basket cycle's
`cycled_until` back that far, as if the Kindled had been away; the next request settles the stretch as
offline time, up to the cap. It prints the `away_cards` row too, if one exists (§13); it never writes one.

## 6. The client

**The start screen's main action is HOLDING** (Enter, Cross); the M1 run stays as a secondary entry
(START RUN, Shift+Enter, Start on the pad), the combat test bed, until boats reach encounters. Since Task 8 it has
no weapon picker: the run takes the weapon chosen at the rack (§14).

**The holding scene** (`apps/client/src/scenes/HoldingScene.ts`) runs on the world and UI cameras as
runs do. In the world: the island (`HoldingWorld`, `render/holdingWorld.ts`, the shore set over the hollow
background), a prop per station part with shadows by the prop rule and Kesh's rock without one, the Kindled walking by
`roam` (`RoamSession`, `game/roamSession.ts`, 60 Hz from the controls' input, interpolated for drawing), and
the interact prompt (the interact glyph and USE) over the nearest station part whose interact point is
within `juice.promptRangePx` (`nearestStationPart`; a reserved spot is never prompted; the plots count once
the island has a Name), and the plots (`PlotsLayer`, `render/plots.ts`; §11). The camera follows
the Kindled and stops at the layout's edges.

**The HUD** (`render/holdingHud.ts`, placeholder panels until ART's kit):

- **Bottom centre, the active-action chip:** the station's placeholder icon (its initials), the skill
  name and level, a progress ring for the current cycle drawn from `startedAt`, the cycle and the
  server's clock offset (`clockOffset`, `cycleProgress` in `game/holdingView.ts`), a thin XP bar to the
  next level; empty while idle. The bar, the level and the station panel's "XP to next" are live (`liveSkill`):
  the answer's XP plus the action's XP for each cycle completed since the answer's `now`, predicted like the
  "+1" floats, so they move with every cycle instead of every heartbeat; the next answer brings the settled numbers. Clicking or tapping it stops the action. **There is no stop binding**
  (GAME DESIGN 2026-10-18): stopping is on the chip and in each station's panel ("Stop working"), and
  walking to another station and working it switches; `stopAction` left `controls.json` and its glyph
  cell `key_x` the glyph sheet.
- **Bottom right, the pack button** with its fill (`PACK 12/20`): opens the inventory over the holding
  (launched, the holding paused; Esc, Circle or I come back and refresh), with the store pane, since we
  are on the holding.
- **Top right, the gin purse.**
- **Top left, the island's Name and the Writ chip** (§9): the Name as typed (BitmapText) over its
  letters (the letter sheet, lit), and the chip: the charge in words, ember under a day, מת from the
  sheet when dark or fading, the exact time ("41 h 12 min") as its tooltip on hover. Before the island
  is named the chip shows alone.
- **Over the station, a "+1"** as each cycle completes, predicted from the ring (`cyclesDone`), render
  only; the counts come from the server. A take-all floats what moved the same way ("+3"), over the
  station's part nearest the Kindled. A basket cycle landing while watching floats its yield the same way
  (`cyclesLanded`, from `cycles`): "+1" over a field's signpost or the tree nearest the Kindled.
- **The camera margin** (4b): the camera follows the Kindled and may scroll `cameraMarginTiles` (6, `holding.json`)
  into the void past every edge of the layout (`clampScroll`'s `near` and `far` on both axes), so the HUD's corner
  panels never cover the shore or Kesh's rock: the PACK chip covered the rock in a 1440 × 810 window before it, the
  rock standing two tiles from the template's edge (ART). The four panels' rectangles are one pure function,
  `hudRects` (`game/holdingView.ts`), that the HUD draws by and `render/keshFraming.test.ts` checks against the
  rock's and Kesh's drawn rects at 1280 × 720, 1440 × 810 and 960 × 540.

**Interacting** (interact is E, Cross or a tap; I or the Touchpad opens the inventory; Esc or Circle
backs out, all from `controls.json`): Use on the Writ post opens the Writ panel, or the Name screen first
while the island has no Name (§9); Use on the holding store opens the inventory with the store pane; Use on the
weapon rack opens the rack panel (§14);
Use on a tree or the outcrop opens a small station panel
(`stationLines`): the name; two labelled rate lines (GAME DESIGN 2026-10-18), "By itself: 1 twisted log every
20 min" (the cycle; the outcrop has none) and "By hand: 1 twisted log every 4 s", which becomes the highlighted
"You: 1 twisted log every 4 s" while working here, so there are never three (the item's full name on each);
"Next in 19 min" (or "Resting while your Writ is dark."), the basket count, the skill's level and XP to the next, and the
buttons WORK HERE (STOP WORKING while working here) and TAKE ALL. Use on a plot: the plot sentence panel
while unnamed, its field's panel once named (§11). After Take all what moved floats over the
station ("+3", `takeFloat`); "Store: twisted logs full." is a toast (§13, `storeFullToast`), no longer the
panel's line; a refusal (work, take, sow) is still the panel's one line, with the inventory's blink-and-hold
timing. The toast strip's rectangle is the fifth of `hudRects` (bottom left, sized for two lines at the widest
M2 toast; above the chip's band where the frame is too narrow for both, `toastStripBottom`), counted in
`panelsBehind` like the others; `render/keshFraming.test.ts` checks it meets neither the chip nor the pack
panel at the three window sizes.

## 7. Seams for later tasks

- **Task 4b, Kesh and the tide:** done (§10), and his word tile and seeds (§11). What stays for later: the
  codex entries come with the codex, odd catches with voyages; the once-per-tide sliver and "One a tide."
  go away in M3 (`m2Scaffold`).
- **The Wet House (M4):** `graceHoursUncertified` in writ.json (48 today) drops to 24; `certified` is
  written there; a rim-band's fitting, scribing a line and renaming (the panel shows line 2's needs
  greyed).
- **Task 5, plots and their baskets' cycles:** done (§11).
- **Task 6, build mode:** done (§12). What stays for later: the pieces of the lumber camp, the quarry and the forge
  wait for their Ground words (their names and cards are in `pieces.json` already, unavailable); a piece's real
  effect replaces GAME DESIGN's placeholder when they are worked out. Build mode's footer refusals stay the footer's
  line: GAME DESIGN's list of M2 toast kinds doesn't include them, and they are panel lines in its screen list
  (Task 7 told GAME DESIGN so).
- **Task 8, the weapon rack:** done (§14). What stays for later: ART's `prop-weapon-rack` sheet replaces the placeholder
  box when it lands (the contract is written); the hung sprites at the pegs, the Sling's and the Keelmaul's combat,
  and M3's wreck, which takes the kit's place (`m2Scaffold`); the Forge's rusted-weapon state (`NEEDS_SMITH`).
- **Boats:** the `landing` on the south shore.
- **Task 7, sleep, the away card and toasts:** done (§13). What stays for later: ART's `sit` row on the sheathed
  Kindled sheet (sleep holds `idle` until then); visitors, the Board and Hearth-warm join the card in later
  milestones, and LORE's fold line waits for them; the UI kit restyles the card and the strip.
- **Visits and voyages:** `inRange(kindled, station)` and `canReachStore(kindled)`.

## 8. Tests and shots

`packages/shared/test/holding.test.ts` (the layout rule and GAME DESIGN's placement checks, the stations
table, a golden snapshot of every cell's pieces under the shore rule in `test/golden/first-holding.tiles.txt`
so a layout edit shows as a readable diff, the API guards), `skills.test.ts`, `writ.test.ts` and
`hear-name.test.ts` (§9); `packages/sim/test/roam.test.ts`
(the dip grace among the rest); `apps/server/test/holding.test.ts` on PGlite (the
settle math: a partial cycle, many cycles, exactly 48 h, 60 h away with the lost time never paid, a
switch settling the old station, a stop; XP and level-ups; take-all moving only what fits; the API's
guards and error codes; migrations 0004 and 0005; the away hook; the Writ: the pressing, the horizon
across the dark moment, naming, feeding, Fill, the relight, `writ:set`) and `holding.postgres.test.ts` on a real
Postgres (settles racing for one Kindled credit each cycle once; a take-all racing a settle keeps the
basket's totals; feeds racing on one Writ never overfill it); `apps/client/src/game/holdingView.test.ts` (the ring and XP bar values, the chip
states, the station panel's lines), `writView.test.ts` (§9) and `render/roamPose.test.ts`. `tools/screenshots-m2-3b.mjs` is the
end-to-end run: it logs in and lands on the holding, walks (a walk and a run), works the trees for a
few cycles, takes all, opens the inventory and moves the logs to the pack, reloads and sees the counts
kept, moves the action 60 h back with the away hook and checks the basket holds the cap's worth, fills
the store for "Store: twisted logs full.", then walks the shore (3c): the south shore dropping into the
Hollow at the landing, the north edge's lip, and the Kindled behind the tall tree's canopy (it checks the
depths). Shots: `docs/screenshots/m2-3b/`.
`tools/screenshots-m2-4a.mjs` is the Writ's run (§9); shots: `docs/screenshots/m2-4a/`.
`tools/screenshots-m2-4b.mjs` is Kesh's (§10); shots: `docs/screenshots/m2-4b/`.
`tools/screenshots-m2-5.mjs` is the plots' (§11); shots: `docs/screenshots/m2-5/`.
`tools/screenshots-m2-6.mjs` is build mode's (§12); shots: `docs/screenshots/m2-6/`.
`tools/screenshots-m2-7.mjs` is sleep's, the card's and the toasts' (§13); shots: `docs/screenshots/m2-7/`.
`tools/screenshots-m2-8.mjs` is the weapon rack's (§14); shots: `docs/screenshots/m2-8/`.

## 9. The Writ

The island's tablet (M2 Task 4a; GAME DESIGN's "The Writ and erosion", "M2 numbers" and "M2 screens", LORE
§4.2, §4.5 and §14.3; GAME DESIGN's answers of 2026-10-18). Numbers in
[`packages/shared/data/writ.json`](../../packages/shared/data/writ.json), validated on load
(`validateWritData`):

| Key                     | Value                                                             | Meaning                                                                  |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `sliverHours`           | 48                                                                | One wild sliver's charge                                                 |
| `capacityHours`         | 144                                                               | A full Writ (three slivers, "a full Writ holds six" days)                |
| `feeds`                 | `wild-sliver` 1, `sealed-gin` 1, `glass-chip` 3, `deep-glass` 9   | Slivers' worth per item; only these can be fed                           |
| `lowHours`              | 24                                                                | Under this the Writ flickers and the chip turns ember                    |
| `pressChargeHours`      | 48                                                                | The charge a Writ is pressed with ("keeps its name two days")            |
| `graceHoursCertified`   | 48                                                                | Dark, but the island still remembers itself                              |
| `graceHoursUncertified` | 48                                                                | The same, uncertified; 48 until the Wet House opens (M4), whose task sets it to 24 |
| `lineFadeHours`         | 24                                                                | After the grace, one line fades each such stretch, outermost first       |
| `lineLetters`           | 12                                                                | Letters a Writ line holds (the lean hand, letters.md "Hearing a Name")   |
| `linePlots`             | 4                                                                 | Plots each line tethers (the layout's plots in order; §11)              |

**The stored state** (the `writs` table, one row per Kindled, cascade; migration 0005, expand-only; only the
holding module touches it): the island's `name` as typed and its `letters` (null until named), `certified`
(false; nobody can be in M2), `empty_at` (when the charge runs out) and `lines` (1). **The pressing:** the row
is created on the Kindled's first holding request with `pressChargeHours` of charge from then, so existing
Kindled get one too; it drains normally from the pressing, and a Writ never fed goes dark after two days.
There is no unfed state.

**Everything else is derived** by one pure function, `writView(writ, now, data)` in
[`packages/shared/src/writ.ts`](../../packages/shared/src/writ.ts), on the server at its `now` and on the
client between heartbeats at its estimate of the server's clock (`writFromView` reads the stored state back
from the answer):

- **charge:** `max(0, emptyAt − now)`, in ms and in hours;
- **state:** `lit` (charge at or above `lowHours`), `flickering` (above 0 and under it), `dark` (0, within the
  grace; the Writ reads מת), `fading` (past the grace);
- **darkSince:** `emptyAt`, once it is past; **graceEndsAt:** `emptyAt` plus the grace by certification;
- **lines:** each with its plots and its state (`lit` while the Writ has charge, `dark` in the grace, `faded`
  after). Line k fades at `graceEndsAt + (lineCount − k) × lineFadeHours`: the outermost line first, the
  Name's line (1) last; with one line, the moment the grace ends (the start of the third day for a 48 h grace);
- **words:** under `lowHours` "less than a day" (the ember chip's threshold); otherwise hours / 24 rounded to
  the nearest whole day, spelled out: "about a day" (24–35 h), "about two days" (36–59 h), up to "about six
  days". The exact time ("41 h 12 min", `exactTime`) is for tooltips.

**Feeding** is one pure preview the client and the server share, `feedPreview(writ, itemId, count, now)`
(and `fillPreview` for Fill): only items in `feeds`; a dark or fading Writ starts from now (`emptyAt = now +
hours`), a lit or flickering one adds to `emptyAt`; **nothing is wasted:** a piece fits when charge + its
hours ≤ `capacityHours`, no feed is ever partial, so a humming glass fits only an empty (dark or fading)
Writ, where it relights it in one go, and deep glass never fits (it is for the Weighing and gear). The
refusals, GAME DESIGN's lines, in this order: "Too much for one Writ" for deep glass; else "Full." for every
other kind when the Writ is full (not even a sliver fits any more, `isFull`: the only meaning of full); else
"Too much for your Writ now" for a piece that doesn't fit now (humming glass with any charge). While full the
charge line reads "Charge: about five days, full" and the greyed buttons' tooltip "A sliver fits in about 4 h"
(`sliverFitsInMs`, rounded up); GAME DESIGN's "clear gold" letters while full wait for ART's kit (the sheet has
no gold state), so they stay lit. A kind that can't be fed says "The Writ only takes Sparkglass."; too few
held, "You don't have that many.".
**Fill feeds wild slivers only**, one at a time while the next one fits, of what the Kindled holds; gin is
money, burned only when the player picks it and a count. Any feed relights a dark or fading Writ at once: on
the server the lines are lit the moment the feed lands; the client animates them back.

**On the server** (`apps/server/src/holding/`): every holding request locks the Kindled's row, then the Writ
row (`lockWrit`, pressing it when there is none), settles with the Writ's horizon (§3), then acts.
`POST /api/writ/name` `{ name }` names the island **once** in M2 (`already-named` after; renaming comes at
the Wet House): the typed Name by the Kindled-name rules (`validateTypedName`: NFC, trimmed, drawable
characters only for now, 2–24 grapheme clusters, a letter, the non-strict filter), then its letters by
`hearName` (letters.md "Hearing a Name"), computed on the server and never taken from the client, checked
by the strict filter; a refusal of either kind answers `name-refused` with `NAME_REFUSED`, except a Name the
fonts can't draw, which keeps `NAME_NOT_DRAWABLE`. `POST /api/writ/feed` `{ itemId, count }` or
`{ fill: true }` runs in the same transaction: the preview decides, the items go through `inventory.apply`
(reason `feed-writ`) **from the store first, then the pack** (the pack is what goes abroad; currency from the
purse), then `empty_at` is written; a refusal changes nothing. Its errors: `unnamed` (feeding waits for the
Name), `not-sparkglass`, `insufficient`, `full` ("Full."), `too-much`. The guards refuse unknown fields and
non-positive or non-integer counts; the Kindled comes from the session cookie only.

**The playtest CLI:** `pnpm --filter @iot/server writ:set -- <username> [--charge-hours N] [--dark-hours N]
[--certified on|off]` sets `empty_at` (N hours from now, or N hours ago) and `certified`, so a lit,
flickering, dark or fading Writ can be seen without waiting days. Nothing in the game calls it.

**The holding scene.** The post's Use opens the **Writ panel**; the first time, while the island has no
Name, the **Name screen** (`apps/client/src/ui/nameScreen.ts`, LORE §14.3): "Name your island.", the body
line, one DOM input (`formFields.ts`, so phones, IME and paste work; the keyboard plugin is off while it is
open, so typing never walks or opens the inventory), the tablet drawn live as `hearName` hears the typed
Name (אמת on the top line, the Name below, right to left, each new letter ember; the tooltip: "Cut as it
sounds, not as it's spelled. The Writ only has to hear it."), and CONFIRM. The server's answer decides, a
refusal shows its message in one line, and an accepted Name flares each letter ember and settles lit (whole
frames, no alpha), then the panel opens. Esc or Circle closes the screen unnamed.

**The Writ panel** (`apps/client/src/ui/writPanel.ts`; its logic in `game/writView.ts`): the face, אמת and
the Name from the letter sheet (`plotLetters`), each letter in a state: lit; full (not even a sliver fits),
every letter clear gold and steady (`gold`, choir-gold, ART 2026-10-18; the HUD's Name letters too); flickering, ember with the
outer letters (the first and last of each line) switching between ember and dim on `writ.json`'s `flickerPatternMs` (ART on #91: lit 600 ms, dim 140, lit 260, dim 140, repeating; a guttering lamp, not the steady blink of the combat telegraphs); dark and
fading, the aleph dark so the Writ reads מת and the Name line dim while dark, then dark once line 1 has
faded. A Name wider than the face after the lean hand widens the face, never the letters. Then the rim
("not certified: the Wet House in Malkhut", or "certified"), the charge in words with the exact time as a
tooltip (left out while dark or fading: the charge is 0 and the state line says so), the state line ("Lit", "Flickering", "Dark since 3 h 12 min, grace ends in 44 h 48 min", "Line 1
fading"; relative times in hours and minutes), "Line 1, the Name: tethers 4 plots · lit", "Line 2: certified, Writ
clay, 20 gin" greyed, and the Sparkglass by kind with what the pack and the store hold (the purse for gin),
a kind that doesn't fit now greyed with its line. The player picks a kind, sees the preview ("+1/3 charge,
about two days"; "⅓" isn't in the fonts, so "1/3"), and feeds one (a count for gin: "FEED 3", "× 3" with − and +) or fills (wild
slivers); on a full Writ the preview reads "Full." and the buttons are disabled. The face redraws from the
server's answer, never ahead of it; on a relight from dark or fading the aleph returns first, then each
line one after another (`relightProgress`), whole frames. Inputs: mouse and touch on the rows and buttons;
the arrows (D-pad or left stick) move through the kinds and the buttons, Left/Right change the gin count or
the button, Enter (Cross) presses; Esc, Circle or the post's Use again closes it. Not in 4a: fitting a
rim-band, scribing a line, renaming.

**Tests:** `packages/shared/test/hear-name.test.ts` (LORE's table, the property test over thousands of
generated names, the lean hand, the single letter, typed Old Letters, the validator) and `writ.test.ts`
(the data, `writView` in every state and at its boundaries, the words, `feedPreview`, Fill, the wire);
`apps/server/test/holding.test.ts` (the pressing on first use, the horizon across the dark moment, naming,
feeding from the store then the pack with its ledger rows, every refusal, Fill, the relight, the routes'
guards and codes, `writ:set`) and `holding.postgres.test.ts` (feeds racing on one Writ);
`apps/client/src/game/writView.test.ts` (the tablet, the face's states, the panel's lines and choices, the
chip). `tools/screenshots-m2-4a.mjs` runs it end to end: the Name screen with the live tablet, a refused
Name, the flare, the panel freshly pressed, a sliver fed with humming and deep glass greyed, flickering,
dark and fading with the chip in each state and its tooltip, a relight, and "Full.".

## 10. Kesh

Old Kesh, across the water (M2 Task 4b; GAME DESIGN: M2 starts the player on the holding with no voyages, so
its only Sparkglass is Kesh's; LORE §14.3 and his four topics). He sits on his needle of rock
(`prop-kesh-rock`, §1) off the south-east shore, drawn from `npc-kesh` (`KESH_SHEET`, sprites.md §4 "Old Kesh")
at the rock's world point one depth step above it, with no shadow and no tone swap (his clay is drawn in):
`fish` loops by default, `talk` loops while a talk box shows his line, `toss` plays once at its rate and goes
back to `fish` (then `talk` again while his line is still open). All three are facing-less rows.

**Talking.** Standing on `kesh.talk` (or within `juice.promptRangePx` of it, the reach the stations use;
a station part nearer than the spot keeps its own prompt, `nearKesh`) shows the interact prompt over his
head with the verb **TALK** (`TALK_LABEL`, beside the stations' `USE_LABEL`). Use opens the **talk box**
(`apps/client/src/ui/talkBox.ts`; its flow, pure and tested in node, in `game/keshTalk.ts`): a placeholder
in the existing panel style at the bottom of the screen, clear of the HUD's corner chips, until ART's UI
kit replaces the look. One line at a time: the speaker ("Kesh"; nothing for the Narrator or a hint) and
the line, Kesh's in the UI ink, the Narrator's muted under a divider (readability.md §4), a hint in
`talkHint` (spark-amber, a placeholder for ART's hint style). Confirm (Cross, click, tap, the interact key)
advances; Circle or Esc closes it at any step. The world keeps running behind it; the Kindled doesn't move
while it is open (`session.held`). At the top level the box offers the topics, in this order, then ends:
**The Old Letters**, **Sparkglass**, **Where the crack points**, **The rack** (Task 8, §14), **Goodbye**; a topic
plays its lines and comes back to the menu, Goodbye plays its lines and closes. The arrows, the D-pad or the left stick move
the menu's focus, the pointer hovers and clicks a row.

**The lines** live in [`packages/shared/data/kesh.json`](../../packages/shared/data/kesh.json), validated on
load (`validateKeshData`), LORE's and GAME DESIGN's word for word; every line passes `DRAWABLE_CHARS`, and a
character the fonts lack fails the test by name instead of changing the text. A line is
`{ who: kesh | narrator | hint, text }`, optionally with a `toss` (`sliver`, `word` or `seeds`: the thrown
thing leaves his hand on that line), an `only` (`first-sliver`: shown only while his first sliver hasn't been
given; `tide-taken`: only while the first has been given and the tide's isn't due, "One a tide. I'm a
fisherman, not a Pillar.") and `m2Scaffold` (the two tide lines go with M3's voyages). Stage
directions in parentheses and LORE's speech marks are part of the text and are drawn. The flows:
`afterNaming` plays from `afterNaming()` once the server has accepted the Name, after 4a's flare, ending with
his clay tile's toss (§11), and the Writ panel opens when it closes; `afterFirstPlot` plays after the seal
scene of a plot's first naming while the seeds are due (§11); `afterFirstFeeding` plays from `afterFeeding()` the first time a feed lands
(`writ.fedAt` went from null to set in the feed's answer), over the open Writ panel; the Sparkglass topic
carries the first-sliver step (the flick with its toss, then the hint "Touch Sparkglass to your Writ to feed
it.") while `firstGiven` is false; `tideSliver` is the tide's line. **When a gift is due** (`kesh.wordDue`, `kesh.seedsDue`, `kesh.due`),
Talk first plays the due toss (the tile's line, then the seeds' flow, then the first sliver's two lines or the
tide's one), then the menu.

**The toss.** On a line with a `toss` the scene plays `toss` and sends `POST /api/kesh/sliver` once. When
`toss` reaches `toss_2` (`KESH_TOSS_RELEASE_FRAME`) and the server has given the sliver, the thrown thing
leaves his hand: drawn from `prop-sparkglass`'s `idle`, it flies a whole-pixel arc (`render/keshToss.ts`)
from that frame's `hand` point (mapped like the Hookblade's points: the anchor plus the point less the cell
origin) to the Kindled's feet over `kesh.tossMs` (600) with the arc `kesh.tossArcPx` (32 world px, a lob over the water; ART on #95) high,
both in `tuning.json`, and "+1" floats where it lands, the cycles' float. The flight is cosmetic: the count
comes from the server's answer, never from the animation. A full pack is the "Pack full." toast (§13); any other
refusal is the box's note line under his line, and nothing flies.

**Slivers from Kesh (the server).** `POST /api/kesh/sliver`, `{}` (the guard refuses any field; the Kindled
from the session cookie; a JSON body and a same-origin `Origin` like every mutating route) runs as a holding
request, under the Kindled's lock after the settle (`apps/server/src/holding/kesh.ts`):

1. if his first sliver hasn't been given, it is given and `first_sliver_at` is set;
2. otherwise, if `m2Scaffold` is on and `last_tide` is not the current tide, one is given and `last_tide`
   set to the tide's index;
3. otherwise `not-due` (409).

The sliver is one `wild-sliver` into the **pack** through `inventory.apply` with reason `gift`
([inventory.md](inventory.md)). A full pack refuses with `pack-full` ("Pack full.", 409) and the sliver stays
due. **The first sliver doesn't use up the tide's**: a player who gets the first today can get the tide's
too (GAME DESIGN wants a Writ to go dark two days after the first sliver unless fed, and the tide's sliver
is the M2 way to keep it fed). Every answer is the holding. The `kesh_gifts` table (the Kindled as primary
key, cascade; `first_sliver_at`, `last_tide`; migration 0006, expand-only) is touched only by the holding
module; the row is created under the lock on the first request that needs it. `GET /api/holding` gains
`kesh`: `firstGiven`, `due` (`first`, `tide` or null) and `nextTideAt` (ISO, the next full of the tide);
the client decides which flow to play from it. The Writ row gains `fed_at` (nullable, expand-only, the
same migration), set by the first feed and answered as `writ.fedAt`.

**The tide** is in [`packages/shared/data/tide.json`](../../packages/shared/data/tide.json): `fullOfTide`
"20:00" and `timeZone` "Europe/Berlin" (GAME DESIGN: "The full of the tide is a fixed hour chosen for the
server's players"), validated on load. `tideIndex(date)` numbers the tides: tide n begins at the full of
the tide, and the index is the civil day, in that zone and counted from the epoch, on which the running
tide began. It is computed with `Intl.DateTimeFormat` in the zone, so the full is 20:00 local on both sides
of a daylight-saving change and a tide is 23 h (the March change) or 25 h (the October change) on those two
days. `nextFullOfTide(date)` is for the client and the tests. A skipped tide is not paid later.

**`m2Scaffold`** ([`packages/shared/data/scaffold.json`](../../packages/shared/data/scaffold.json), validated
on load, read by the server and the client) turns the tide's sliver on; it goes away in M3 when caves and
wrecks give glass.

**The playtest CLI:** `pnpm --filter @iot/server kesh:reset <username>` clears all four columns (the sliver's
two and the gifts' `word_given_at` and `seeds_given_at`) through the holding module, so a playtest can see
the first sliver, the tile and the seeds again; the grant CLI keeps working beside it.

**Tests:** `packages/shared/test/kesh.test.ts` (the validator, every line in `DRAWABLE_CHARS` and free of
the banned names, LORE's lines in place; `scaffold.json`), `tide.test.ts` (`tide.json`, `tideIndex` and
`nextFullOfTide` at 19:59 and 20:00 local across both Berlin daylight-saving changes, the 23 h and 25 h
tides, a skipped hour in another zone); `apps/server/test/holding.test.ts` (the first sliver once into the
pack with the ledger reason, the tide's once per tide and again the next, never with the scaffold off, the
first and the tide's on the same day, `not-due`, `pack-full` keeping it due, the route's guard and codes,
`kesh` in the holding answer, `kesh:reset`, `fed_at` set once) and `holding.postgres.test.ts` (two
`POST /api/kesh/sliver` racing give exactly one sliver); `apps/client/src/game/keshTalk.test.ts` (the flows
as a state machine: the menu, each topic's steps, the first-sliver step present or absent, the due toss
before the menu, Close at any step), `render/keshToss.test.ts` (the release frame, the arc's start at the
`hand` point, whole-pixel flight), `render/keshFraming.test.ts` (the camera margin, above) and
`game/holdingView.test.ts` (`nearKesh`, `hudRects`). `tools/screenshots-m2-4b.mjs` runs it end to end;
shots: `docs/screenshots/m2-4b/`.

## 11. Plots

The four plots round the post (§1), named with plot sentences and worked as fields (M2 Task 5; GAME DESIGN's
"Plots and plot sentences", "The trickle"; LORE §4.5 "Plot sentences", "Drawing a sigil", §14.3's tooltips;
LORE's and GAME DESIGN's answers of 2026-10-18). Plots appear only once the island has a Name (LORE §14.3).

**Word tiles** are knowledge, not items: no slot, no ledger. The lexicon is
[`packages/shared/data/words.json`](../../packages/shared/data/words.json), validated on load
(`validateWordsData`): M2's two words only (the rest of LORE's 30 come with the tasks that give them effects).
Each has its `id` (the transliteration in kebab-case, stored in the database, never renamed), `letters` (base
Old Letters as the Writ stores them; `shapeLetters` adds the final forms), `say`, `meaning`, `slot` (`ground` |
`virtue`), `element` (`earth` | `water` | `fire` | `air`), LORE's `card` text, and for a Ground the plot kind it
`builds`, for a Virtue its `effect`:

| id       | letters | say    | meaning       | slot   | element | builds / effect                                                   |
| -------- | ------- | ------ | ------------- | ------ | ------- | ----------------------------------------------------------------- |
| `adamah` | אדמה    | adamah | tilled ground | ground | earth   | builds `field`                                                    |
| `yashan` | ישן     | yashan | old           | virtue | earth   | `yield-per-day`: +10‰ a day the plot keeps its name, up to +200‰ |

Each tile's letters pass the strict filter on their own, checked when the file loads. What a Kindled knows is
the `known_words` table (the Kindled and `word_id` as primary key, `learned_at`; cascade; migration 0007,
expand-only; only the holding module writes it), answered as `words`. **Kesh gives the first word** (`gifts` in
`kesh.json`: `adamah`): `POST /api/kesh/word`, `{}`, once the island has a Name and the Kindled doesn't know it
(`not-due` otherwise), recorded in `kesh_gifts.word_given_at`; `afterNaming` ends with his toss line, and a
Kindled who named the island before this shipped gets the tile on their next Talk. Nothing in M2 gives ישן
(Tabita trades it in M4): the playtest CLIs `pnpm --filter @iot/server words:grant <username> <wordId>` and
`words:forget <username> <wordId>` do.

**A plot sentence** is a Ground tile and, optionally, a Virtue tile, written Ground then Virtue with the
**divider** (·) between them (`plotSentence`, `PLOT_DIVIDER`; letters.md §1): אדמה · ישן. The Ground decides
the building ("without a Ground the plot cannot be built on"); the Virtue asks something of it. **The filter
rule** differs from a Name's (LORE: "A plot sentence is not a Name, and it isn't cut as one"): each tile passes
the strict filter alone (above), and the whole sentence, read across the divider and in both orders (Ground
then Virtue, Virtue then Ground), passes the ordinary filter when it is confirmed, so the banned name and
title can never be put together from tiles; "the divider closes the door", so yod and he may meet across it
and אדמה · ישן is sealed as it stands. One shared function, `plotSentenceSafe(ground, virtue)` in
`packages/shared/src/plots.ts`, says why. Names keep the strict rule unchanged (letters.md §2).

**Naming** (`POST /api/plots/name`, `{ plotId, ground, virtue }`, `virtue` may be null) runs as a holding request
(the Kindled's lock, the Writ's, the plots' rows, then the settle, then the act; `apps/server/src/holding/plots.ts`).
In order it refuses, with LORE's lines (2026-10-18, `PLOT_TEXT`): `unknown-plot` (400, "That ground isn't yours to
name."), `unnamed` (409: the island has no Name), `faded` (409: the plot's line has faded), `unknown-word` (400:
not in words.json, or not known; "You don't know that word yet."), `wrong-slot` (400: "That's a Virtue, not a
Ground." / "That's a Ground, not a Virtue."), `no-ground` (400: "Choose a Ground first. Without one, the plot
doesn't know what it is."), `unchanged` (409: the same sentence; "It already has that name."), `sentence-refused`
(400: the filter above, which no M2 pair trips;
"Those words won't hold together. Try another pair.") and `insufficient` (409: a rename without the gin, "You
don't have that many."). The **first naming is free**; any later change (another Virtue, filling an empty
Virtue, clearing it) costs 1 `sealed-gin` from the purse through `inventory.apply` with reason `name-plot`
("A name is paid for."). The row is the `plots` table (the Kindled and `plot_id` as primary key; `ground`,
`virtue`, `named_at`, `virtue_set_at`, `virtue_paused_ms`, `sown_at`; cascade; migration 0007, expand-only);
an unnamed plot has no row. A named plot is a station of its kind (the field) with the plot's id, its basket
`basket:plot-n` belonging to the plot, not its kind, so a rename never loses what it holds; a rename that
changes the Ground clears the sowing (M2 has one Ground, so this is only the rule).

**Sowing** (GAME DESIGN: "A new field is sown once before it cycles or can be worked"): `POST /api/plots/sow`,
`{ plotId }`, takes the kind's `sow` item (1 `grey-seeds`) through `inventory.apply` from the store first, then
the pack, reason `sow`, sets `sown_at` and starts the plot's cycle clock (`cycled_until` = now). It refuses
`unknown-plot` (400), `unnamed-plot`, `faded`, `already-sown` and `insufficient` (409). Before it the plot has no
cycle and can't be worked (`not-sown`); from then on it reseeds itself for as long as it keeps its Ground,
through fading too. **Kesh's seeds**: `POST /api/kesh/seeds`, `{}`, gives the 4 seeds (`gifts.seeds`, one for
each plot line 1 tethers) into the pack with reason `gift` once a plot has been named and they haven't been
given (`not-due` otherwise; `pack-full` keeps them due), recorded in `kesh_gifts.seeds_given_at`; the client
plays `afterFirstPlot` after the first naming's seal scene while `seedsDue`. GAME DESIGN's note places the
seeds "after the pressing"; the beat and Kesh's line only make sense once a plot has a name, so they sit after
the first naming.

**Working a field** is the active action of §3 at the plot's id: 1 pale grain every 20 s into `basket:plot-n`
with Farming XP; `work` and `take` at an unnamed plot answer `unnamed-plot`, at an unsown field `not-sown`, at a
faded plot `faded`. In the grace (dark, not faded) take and work are allowed: "Dark means idling stops, not that
the player is locked out". A faded plot is frozen with its basket and contents; a stretch of work at a plot that
can no longer be worked ends at the settle.

**ישן's yield** raises only the plot's basket cycle (§3's trickle), never the hands ("the words work on the plot,
the hands are the player's"). Each cycle's bonus is `min(maxPermille, permillePerDay × whole days the name has
been kept by that cycle's end)` (`yieldBonusPermille`, `cycleBonuses`); the credit is
`floor((carry + quantity × (1000 + bonus)) / 1000)` with the remainder kept in `carry_permille` (`creditCycles`),
all integers. **Days kept** count from `virtue_set_at` less `virtue_paused_ms`, the time the plot spent faded:
the count runs on through the grace and pauses while faded; when a feed relights a faded line, each of its
plots' faded span (from the line's `fadesAt` to the relight) is added in that transaction
(`pauseFadedPlots`), and while faded the shown bonus holds still. The count restarts (`virtue_set_at` = now,
`virtue_paused_ms` = 0) on any change to either tile; confirming the same sentence is `unchanged` and costs
nothing.

**Sigils** (`packages/shared/src/sigil.ts`, pure; LORE §4.5 "Drawing a sigil"; the square in
[`sigil.json`](../../packages/shared/data/sigil.json), Saturn's 3 × 3 as Agrippa prints it, `[[4, 9, 2], [3, 5,
7], [8, 1, 6]]`, validated on load). `sigilPath(letters)` reduces each letter to its root 1–9 (aleph 1 … tet 9,
yod 10 → 1 … qof 100 → 1; a final form counts as its base letter, so final nun is 5; the values 500–900 are
never used), finds each root's chamber on the square, and returns the cells in order with the marks as data,
not pixels: `start` (a small circle at the sentence's first letter), `end` (a bar at its last), `loop` (a
repeated letter), `hook` (two different letters in the same chamber). A sentence is one unbroken line through
both words in writing order, Ground then Virtue; the divider has no number and doesn't break it. The line's
style by element (`sigilStyle`: earth heavy and straight, water a long wave, fire jagged, air thin and broken)
is passed through; only earth is drawn in M2.

**The client.** Plots draw on the world camera (`render/plots.ts`, with ART's seal kit, #125, and field ground,
#123; the unnamed plot and the clay tile are still placeholders in palette tokens): nothing before the Name; an unnamed plot
as a faint dotted outline (`plotOutline`) with the USE prompt at its interact point and LORE's tooltip "Ground,
but not yet ground for anything. Give it a word."; a named plot with its ground inside (ART's
field ground, #123: `field-ground-64px.png` + `field-ground.json`, one seamless 64 px cell per state, `unsown` until
the field is sown, `sown`, and `faded` once its line has faded, sown or not (`fieldGroundCell`), drawn untinted and
tiled from the inner corner of the plot's rect less the sheet's `inset` (`fieldGroundRect`; top 26, right 10,
bottom 14, left 10 world px), a headland of pale holding ground that keeps the ring, its letters and the divider
readable; under the props and the Kindled; the seal scene turns it from the top by showing only its top share),
its **seal** (the 2 px ring round the plot in the Ground's element
colour, `elementColor` from palette.json `elements`: earth sleeper-ochre, water watcher-rain, fire
choir-flame-deep, air watcher-stone; a 6 × 6 knot at each corner centred on the band's corner, its middle 2 × 2 open
(the band's corner cleared, so the headland shows through: an eyelet, ART), `ringKnots`, added as the drawing ring
reaches it, lit or faded; the sentence's letters from the letter sheet in dark ink along the top of the ring
with the divider between the words and at the ring's other join) and, at its centre, its **signpost** (ART's
`prop-signpost`, `SIGNPOST_SHEETS`, drawn at `signpostBase` on the sheet's origin (32, 54) with the prop rule's
shadow; a pillar in the roam, `setSolidPlots`), which carries no words: its board carries the
plot's sigil over a faint 3 × 3 grid (LORE 2026-10-18; `signpostBoard`, `sigilOrigin`, the sheet's board face
exactly there), its line stroked in the element's style (`sigilStroke`, one counter along the whole line: earth
2 px straight, water a 1 px wave `[0,0,1,1,0,0,-1,-1]`, fire a 1 px jag `[0,1,-1]`, air 1 px dashes of 2 with gaps
of 1, pushed across the segment), and loses the line
segment by segment while the plot's Writ line is dark, from the moment the Writ went dark to the line's fade,
the circle staying last (`sigilSegmentsLeft`); a faded plot in hollow-dusk (`plotFaded`: ring, knots, letters
and divider), on `prop-signpost-faded` with its board blank. Hovering a named
plot shows LORE's seal tooltip (§14.3; its two-word line once the plot has a Virtue), and hovering its signpost
the signpost's, "The plot's two words, drawn as one line." (`onSignpost`). **The seal scene** plays from a naming's
answer, never ahead of it (`startSeal`; `sealPhase` in `game/plotView.ts`, timed by `tuning.json` `plots`:
`sealRingMs` 300, `sealLetterMs` 70 a letter, `sealSigilMs` 400, `sealGroundMs` 200): the ring draws itself
round the plot, the letters appear one by one, the sigil traces from its circle to its bar, then the ground
turns; whole frames, about a second, the prompt hidden meanwhile. **The plot sentence panel**
(`ui/plotPanel.ts`, its logic in `game/plotView.ts`) opens on Use at an unnamed plot and on RENAME in a field's
panel: "Name this plot" / "Rename this plot"; the ring with two slots right to left (Ground on the right,
Virtue on the left, labelled); the known tiles that fit the selected slot with their letters, `say`, meaning
and effect ("You don't know any Ground words yet." / "… Virtue words yet." when none; "None" leaves the Virtue
empty); the preview with the sigil drawn live, "Builds: Field", the Virtue's effect "+1% yield for each day it
keeps its name, up to +20%", and LORE's Field tooltip (§14.3; its two-word line once a Virtue is picked); the cost line "First naming: free" / "Renaming: 1
sealed gin" (tooltip "A name is paid for."); the level ("Level 2", 1 plus the pieces standing, §12) and the pieces
by name ("Pieces: Clay channel, Seed jars", or LORE's "Pieces: none yet"); CONFIRM, greyed while the
sentence is unchanged or has no Ground; a refusal in one line. Inputs as the Writ panel's. **The field's
station panel** (`stationLines`): until sown, only "Not sown yet." and SOW (without a seed, "You don't have
that many."); once sown, "FIELD" with the sentence's letters, "Level 2" (the real level), "By itself: 1 pale grain
every 12 min" (the cycle at its real length, §12; with ישן, "+3% for keeping its name" under it, the bonus so far),
"By hand: 1 pale grain every 20 s" (the action, which the pieces never speed; the highlighted "You: 1 pale grain
every 20 s" in its place while working here), the basket count, "Next in 12 min" (`nextInLine`, rounded up to the
minute; "Resting while your Writ is dark." while dark), Farming's level and XP to the next, and WORK HERE / STOP
WORKING, TAKE ALL, BUILD HERE (§12), RENAME; faded, "Faded into the haze with your Writ's first line. Feed your
Writ and it will remember." and no buttons. **Kesh's tosses** (§10): the `word` toss flies a placeholder clay
tile (`clayTile`, a small rectangle drawn as a sprite texture) and lands showing the word's letters from the
letter sheet for a float's time; the `seeds` toss flies the `grey-seeds` item icon and floats "+4". **The
Words tab** of the inventory ([inventory.md](inventory.md)) lists every known tile.

**Tests:** `packages/shared/test/words.test.ts` (the validator, every tile through the strict filter, the
lines in `DRAWABLE_CHARS`), `sigil.test.ts` (the square, roots and final forms, אדמה's cells and its hook, a
loop, אדמה then ישן as one line), `plots.test.ts` (`plotSentenceSafe` on every pair and on constructed pairs
from position fixtures, the strict refusal of the same letters as a Name, ישן's bonus at 0, 1, 19, 20 and 30
days with a faded span paused out, the carry adding up exactly over 192 cycles, the panel's lines),
`holding.test.ts` (the plot kinds and cycles, the layout's plot stations with a failing case for each rule),
`kesh.test.ts` and `letters.test.ts` (the divider); `apps/server/test/plots.test.ts` on PGlite (the word and
the seeds, every naming refusal, the free first naming and the paid rename with its ledger reason, sowing
from the store then the pack, work and take at a field, the trickle: 15 min gives 1, 48 h gives 192 and no
more, dark mid-stretch, the relight's fresh clock, three days online, no XP, the ref paying once, the trees'
one log every 20 min and nothing for the outcrop, ישן's bonus with the faded span at a relight, `holding:away`,
the CLIs, migration 0007) and `holding.postgres.test.ts` (settles racing credit each cycle once; two names
racing on one plot charge at most once); `apps/client/src/game/plotView.test.ts`, `holdingView.test.ts` (the
field's lines lit, dark and faded; "Next in …"), `keshTalk.test.ts` (the flows with `wordDue` and `seedsDue`)
and `inventoryView.test.ts` (the Words tab). `tools/screenshots-m2-5.mjs` runs it end to end; shots:
`docs/screenshots/m2-5/`.

## 12. Build mode

Upgrade pieces (M2 Task 6; GAME DESIGN's "Building upgrades", David 2026-10-15, Valheim's workbench the model: "A
station is upgraded by building pieces around it, as physical objects in the world, not by pressing a button";
LORE §16.8 named them; both answered MAIN's questions on 2026-10-18). A named plot is its 6 × 6 square with the
signpost at the centre; pieces stand inside it, and the station's level is 1 plus the distinct pieces standing
(each kind counts once). Pieces speed only the station's own cycle, never the hands.

**The data** is [`packages/shared/data/pieces.json`](../../packages/shared/data/pieces.json), validated on load
(`validatePiecesData`, `packages/shared/src/pieces.ts`): `piecesPerLine` (2: GAME DESIGN's "two pieces per station
per Writ line") and the pieces, each with its permanent kebab-case `id` (stored in `plot_pieces`), `stationKind`
(a plot kind of stations.json), LORE's `name` and `card` word for word ("A card says what a piece is, never what it
does"), `cost` (items and counts, taken from the store), `footprint` (`{ cols, rows }` in tiles before rotation;
90 and 270 swap them), `skill` (`{ skill, level }` or null), `writLine` (the line needed) and `effect` (GAME DESIGN's
placeholder, `cycle-speed` +250 permille, additive). The field's three:

| id                | name            | cost                             | footprint | skill | Writ line |
| ----------------- | --------------- | -------------------------------- | --------- | ----- | --------- |
| `clay-channel`    | Clay channel    | 300 `twisted-log`, 150 `black-stone` | 1 × 4 | none  | 1         |
| `seed-jars`       | Seed jars       | 200 `twisted-log`, 40 `pale-grain`   | 2 × 1 | none  | 1         |
| `threshing-floor` | Threshing floor | 400 `black-stone`, 150 `twisted-log` | 3 × 3 | none  | 2         |

The threshing floor needs Writ line 2, which nobody has in M2, so it always shows locked with what it needs. The
lumber camp's, the quarry's and the forge's pieces (chopping block, drying rack, saw-horse; hoist, sorting sieve,
stone sledge; anvil, quench trough, pot bellows) are in the file with LORE's cards and `"available": false`: no
cost, no footprint, and the build route refuses them as `unknown-piece`, until their Ground words come. Every name,
card and line of build mode passes `DRAWABLE_CHARS` and the banned-names test (`packages/shared/test/pieces.test.ts`).

**The rules** are shared and pure (`packages/shared/src/pieces.ts`), so the server and the ghost agree:
`plotLevel(pieces)` is 1 + the distinct kinds; `cycleSpeedPermille(pieces)` 1000 + the standing pieces' effects,
each kind once; `cycleLengthMs(cycle, pieces)` = `round(cycleMs × 1000 / speed)` (the field: 15, 12, 10 min);
`pieceLimit(writLines)` = `piecesPerLine` × the Kindled's Writ lines (2 in M2); each kind stands **once per plot**
(GAME DESIGN: "a second clay channel would add nothing to the level"). `placementProblems(layout, plot, pieces,
candidate)` lists why a footprint (its top-left tile and a rotation of 0, 90, 180 or 270) can't stand there, in
the order the refusal names them: `outside` (not wholly inside the plot's square), `on-signpost` (over the
signpost's tile or its interact tile), `overlaps` (over another piece of the plot; the candidate's own kind, if one
stands, is the piece being moved and doesn't block itself), `blocks-signpost` (GAME DESIGN's rule, 2026-10-18:
"there must always be a walkable way from the plot's edge to the signpost": a flood fill inside the plot with the
signpost, every standing piece and the candidate solid, from every free edge tile that has walkable ground
outside it, must reach the signpost's interact tile). An empty list means it fits; the ghost is green exactly then.

**The server** (`apps/server/src/holding/pieces.ts`). The pieces are the `plot_pieces` table (the Kindled, `plot_id`
and `piece_id` as primary key; `col`, `row`, `rotation`, `built_at`; cascade; migration 0008, expand-only), locked
with the plots' rows on every holding request and touched only by the holding module. Three routes, each a holding
request (the locks, the settle, then the act; every answer the holding):

- `POST /api/plots/build` `{ plotId, pieceId, col, row, rotation }` refuses, in order: `unknown-plot` (400),
  `unnamed-plot`, `faded` (409); `unknown-piece` (400: not in pieces.json, not available, or not this plot's kind;
  "This station doesn't take that piece."); `already-built` (409, "One of those already stands in this plot.");
  `needs-line` (409, "Needs Writ line 2."); `needs-skill` (409, "Needs Farming 5."); `limit`
  (409, "This plot can take no more pieces until your Writ has another line."); `blocked` (400: LORE's "That doesn't
  fit there.", then the first reason in LORE's words: "It has to stand inside the plot's ring." / "It's on top of the
  signpost." / "It's on top of another piece." / "It would block the way to the signpost."); `insufficient` (409, "Not enough in the store.":
  the pack doesn't count, GAME DESIGN's "the materials leave the store"). The cost leaves the store through
  `inventory.apply` with reason `build` ([inventory.md](inventory.md)).
- `POST /api/plots/move` `{ plotId, pieceId, col, row, rotation }` is free: `unknown-plot`, `unnamed-plot`, `faded`,
  `not-built` (409, "That piece isn't standing here."), `blocked`.
- `POST /api/plots/take-down` `{ plotId, pieceId }` puts every material back into the store (reason `build`, positive
  deltas), or refuses whole as `store-full` (409) with the take-all's line ("Store: twisted logs full.") when a stack
  doesn't fit, the piece staying up: nothing is ever destroyed. Also `unknown-plot`, `unnamed-plot`, `faded`, `not-built`.

A change to a plot's pieces is an act after the settle: the settle pays the cycles up to now at the old speed and
leaves `cycled_until` where it stands, so the partial cycle carries on at the new speed (§3). A faded plot keeps
its pieces, frozen with it, and refuses all three as `faded`. A rename that changes the Ground (only the rule in
M2) takes every piece down with its refund in the rename's transaction, which may overfill the store
(`overfillStore`). The playtest CLI `pnpm --filter @iot/server plots:pieces <username> <plotId> [--clear]` lists a
plot's pieces; `--clear` takes them all down with their refunds (overfilling if it must), as a holding request.
`plots[]` in the holding answer carries `pieces` and the real `level`; `cycles[...]`'s `cycleMs` is the real length;
`PROTOCOL_VERSION` is 6. The race (two builds for the last free slot stand one and pay one cost) runs on Postgres.

**The client.** BUILD HERE in a sown, unfaded field's panel opens **build mode** (`apps/client/src/ui/buildMode.ts`;
its logic, pure and tested, in `game/buildView.ts`; the pieces, the ghost and the building moment in
`render/pieces.ts`): the camera stays on the plot and its ring is drawn on the ground; the side list on the right
heads "Field, level 2" (LORE: a comma, keeping the dot for the plot sentence's divider) and "Pieces 1/2", then a
row per piece the station can take, each with a placeholder picture (its footprint as tiles, with its initials),
its name, its materials by display name against the store ("Twisted log 340/300", a short one in the warning
token), what it needs ("Needs Writ line 2", "Needs Farming 5") and its effect line apart from the card ("+25% work
speed"); LORE's card is the row's tooltip. A piece already standing in the plot shows "Standing" in place of its
cost, and picking its row selects it, outlined in the world in the focus token (GAME DESIGN 2026-10-19). Picking a row makes a **ghost** of the footprint follow the pointer (on
a pad, a tile cursor moved by the D-pad or the left stick; on touch, a tap places it and the footer says "Tap again
to build"), snapped to the tile grid and
centred on it: ART's tints (#102), `wheel-patina` where `placementProblems` is empty and `choir-flame-deep` where
it isn't (and over the Kindled's own tile, which only the client knows), drawn as a 50 % checkerboard over the
piece's pixels and a 1 px outline round its tiles, never an alpha fade and never a signal colour. **Rotate**: R on
the keyboard (the `rotate` action of `controls.json`); on the pad build mode has its own buttons like a menu, the
same on every preset (GAME DESIGN 2026-10-19): R1 turns the ghost clockwise and L1 back, Cross places, Circle leaves,
nothing attacks or dodges ([controls.md](controls.md)); on touch a TURN button beside the ghost. **Confirm** (LMB, Enter, Cross;
a second tap on the same tile) sends the route; **cancel** (RMB, Esc, Circle) drops the ghost, a second cancel leaves
build mode. When the answer lands, **the building moment** plays on the new piece, whole frames timed by
`tuning.json` `plots.buildMs` (400): a few dust pixels round its base for the first quarter, then the piece's art
rising from its base a tile (32 world px) at a time (`riseCrop` in `render/pieceArt.ts`); nothing draws before the
answer. **Standing pieces** draw from ART's sheets (#107, [sprites.md](sprites.md) §4 "The upgrade pieces"): a
sprite on the bottom centre of the footprint as it lies, `idle_turned` at 90° and 270°, the threshing floor's chaff
looping at 6 fps, the prop rule's grounding shadow under the seed jars only; y-sorted with the bodies by their base.
On a faded plot a piece is frozen on its first frame under a 50 % checkerboard of `plotFaded`. Selected, a 2 px
`uiFocus` outline follows its silhouette (the union of its row's frames, so the floor's outline holds still; ART on
#106). The ghost is the piece's own pixels as the tint's checkerboard. A piece whose sheet isn't on disk keeps the
placeholder box (`pieceFace`, a shaded front, a 1 px outline, its initials as a word over the world). Their tiles
are pillars in the roam
(`setSolidPlots(plotIds, pieceTiles)`). In build mode a standing piece selected (a click on it; the cursor on it
and Cross) offers **MOVE** (it becomes the ghost; confirming sends `move`) and **TAKE DOWN** (sends `take-down`;
one float per item rises over the signpost with its count and items.json's `plural`, lowercase, "+300 twisted logs"
then "+150 black stone", "+1 twisted log" at one, never a bare total (LORE §16.8; `BUILD_TEXT.REFUND`, `itemCount`). A refusal is one line in the list's footer,
with the inventory's blink-and-hold timing (not a toast: §7, §13). The field's panel shows the real level and
the real cycle ("By itself: 1 pale grain every 12 min"); the plot sentence panel lists the pieces by name (§11).

**Tests:** `packages/shared/test/pieces.test.ts` (the validator, LORE's cards, the level and the speed at 0, 1 and 2
pieces, the limit, every placement reason at each rotation, a moved piece not blocking itself, two pieces walling
the signpost off, the wire), `controls.test.ts` (rotate); `apps/server/test/pieces.test.ts` on PGlite (every
refusal in order, the cost and the refund with their ledger rows, the pack not counting, `limit` at 2,
`needs-line` for the floor, move free and blocked, `store-full` refusing whole, `faded` on all three, the trickle
either side of a build, the level and the pieces in the answer, a Ground-changing rename's refund, the CLI, the
routes' guards and codes), `holding.test.ts` (migration 0008) and `holding.postgres.test.ts` (the race);
`apps/client/src/game/buildView.test.ts` (the list's lines and locked states, the header, the ghost's colour and
rotation, the cursor, the building moment's phases, the roam's pillars), `holdingView.test.ts` (the panel's level,
lines and BUILD HERE), `plotView.test.ts` (the pieces line), `render/glyphCells.test.ts` (the R key cap),
`render/pieceArt.test.ts` (the ghost's checkerboard, the silhouette outline and the rise, on ART's sheets).
`tools/screenshots-m2-6.mjs` runs it end to end; shots: `docs/screenshots/m2-6/`.

## 13. Sleep, the away card and toasts

M2 Task 7 (GAME DESIGN, "Holding & village", "Spaces and interaction", the M2 screen list and the toasts, 2026-10-19;
LORE's lines, Lore §14.22, 2026-10-19; ART's "→" glyph and toast glyph sheet, #109; the no-fade rule of the decision
log, 2026-10-15; MAIN's decisions of 2026-10-19). Numbers in `holding.json`, validated with the rest: `awayCardMinMs`
(1 800 000, 30 min), `toastMs` (3000), `toastMax` (2), `sleepSitMs` (600), `sleepMs` (1500). A tide is 24 h of
server time (`TIDE_MS` in [`packages/shared/src/away.ts`](../../packages/shared/src/away.ts), which holds every line
of text the card, the sleep screen and the toasts show, `AWAY_TEXT`, `SLEEP_TEXT`, `TOAST_TEXT`, LORE's and GAME
DESIGN's word for word, read by the tests). The UI kit isn't in yet: the card and the strip are the existing panel
style, laid out as GAME DESIGN describes and with ART's glyph placement, for the kit to restyle.

**Sleep** (GAME DESIGN: "Lying down by the Writ post is the in-world log-out; the hint says so plainly. It is the
SLEEP button at the foot of the Writ panel, with no spot or prompt of its own"). A **SLEEP** button at the foot of
the Writ panel (Use on the post), the last item in the panel's focus order (the D-pad or the arrows reach it after
FEED and FILL; Left/Right step FEED, FILL, SLEEP round), with LORE's hint under it, muted: "Lie down to sleep and leave
the game. Your holding keeps working while you sleep, until the Writ runs low." The Name screen, which opens instead
of the panel while the island is unnamed, has the same button and hint at its foot, so sleep is there whether or not
the island is named. Pressing it closes the panel; the Kindled sits down with its back to the post (the sheathed sheet's
`sit` row, 1 frame held, 2 facings S or E by the angle to the post, when the sheet has it; no sheet has it yet, so the
stand-in holds `idle_S`, facing the player and never the post, so nothing turns round when the row lands; ART
2026-10-19; `sitPose` in `render/holdingWorld.ts`) for `sleepSitMs`; then the scene cuts, with no fade, to the
sleep scene (`scenes/SleepScene.ts`): the Hollow's background and LORE's line in the body font, "You lie down by the
Writ. Its hum is the last thing you hear.", or while the Writ is dark "You lie down by the Writ. It doesn't hum
tonight.". The holding scene is gone, so its heartbeat has stopped; after `sleepMs` the client sends `POST
/api/logout` and lands on the start screen logged out, the way the start screen's LOG OUT does; a failed log-out lands
there too. Sleep changes nothing on the server: the active action keeps running offline up to the cap, exactly as when
the tab is simply closed, which is never punished either.

**The absence (server).** In `settleAll`, before the heartbeat refreshes it, `absence = now − writs.last_seen_at`
(the holding-wide heartbeat, so the holding routes and the inventory routes, which settle through `settle`, see the
same one; a Kindled never seen has none). At `awayCardMinMs` or more the settle records what the stretch made
(`apps/server/src/holding/away-card.ts`): per station or plot, the item and the count credited into its basket (the
active action's `due × quantity` from `settleIn` plus the cycles from `settleCycles`, summed per place); per skill,
the level before the settle and after it (`levelFromXp` on the XP read before and after; only skills whose level
changed). The card shows after any absence of 30 minutes or more, whether the player slept or simply closed the tab,
and a hidden tab that stops the heartbeat for 30 minutes counts as an absence too: GAME DESIGN's rule read literally.
A heartbeat under 30 min is no absence: what it settled is in the basket, not the card.

| `away_cards` (migration 0009, expand-only; one row per Kindled, cascade) | |
| --- | --- |
| `from_at` | the last heartbeat before the absence |
| `to_at` | the settle's `now` |
| `made` | jsonb, place id → `{ itemId, quantity }` |
| `levels` | jsonb, skill → `{ from, to }` |

Only `settleAll` writes it; it moves no items, so `inventory.apply` is not involved. **Merging:** a row still there
when another absence is recorded (the card was never dismissed) merges: the earlier `from_at`, the later `to_at`,
`made` summed per place, `levels` keeping the earliest `from` and the latest `to` (`mergeAway`). **The answer:**
`HoldingResponse.away` is the `AwayCard` (`from`, `to`, `made`, `levels`) or null; the card's Writ line reads the
answer's own `writ`, so it says the Writ now; shared type and guard in `api.ts`; `PROTOCOL_VERSION` 7. **Clearing:**
`POST /api/holding/away/seen` `{ to }` (ISO) deletes the row only if its `to_at` still equals `to`, so an absence
merged in after the card was drawn survives the dismissal; `204` either way, guarded like every mutating route (a JSON
body, a same-origin `Origin`, the session cookie; `400` bad-request, `401`, `404`). The away hook prints the row.

**The card's lines** (`awayLines(card, layout, plots, writ, serverMs)` in `away.ts`, pure), in GAME DESIGN's order,
each only when it has something to say:

1. **Time away** (LORE): "Away " + `duration(ms)` + ".". The duration gives whole tides first, then hours, with minutes
   only under an hour, in tens, rounded down: "1 tide and 3 hours", "2 tides", "5 hours", "40 minutes" (30 to 39
   minutes read "30 minutes"); a whole number of tides drops the hours, and tides and minutes never meet.
2. **One line per station kind, summed** (GAME DESIGN), in the order fields, trees, outcrop: "Field: 14 pale grain,
   in the basket" when one field made something, "Fields: 56 pale grain, in the baskets" when several did; "Trees: 18
   twisted logs, in the basket" (the trees share one basket); "Outcrop: 40 black stone, in the basket". The count is
   the active action's output with the cycle's; the item's name is singular at 1 and items.json's `plural` otherwise
   (`pluralItemName`: a count noun takes its s, a mass noun stays, "40 black stone"); the line ends with where the things wait, "basket" for one station and "baskets" for several
   (the baskets the line sums). The short kind labels are `AWAY_TEXT.KIND`.
3. **Skill levels, one line** (GAME DESIGN): "Woodcutting 7 → 9 · Farming 3 → 4", the skills in `skills.json` order
   joined by " · ", with ART's "→" (in both atlases since #109, drawable).
4. **The Writ now:** lit or flickering, GAME DESIGN's "Writ: " + the HUD chip's charge words + " left" ("Writ: about
   four days left", "Writ: less than a day left"); dark in the grace, LORE's "Writ: dark for 5 hours. It still
   remembers everything."; faded, LORE's "Writ: dark for 2 tides and 4 hours; its outer line has faded." ("its outer 2
   lines have faded" with more lines, in later milestones); the dark durations use the same `duration`; no line while
   the island is unnamed (its Writ has nothing to say yet).

Six lines at most, which M2 never passes (the time away, three kinds, the skills, the Writ). LORE's fold line, "More
is waiting at the stations.", sits in `AWAY_TEXT` for the milestones that bring visitors, the Board and Hearth-warm,
and is not drawn. Every line passes `isDrawable` and the banned-names test (`packages/shared/test/away.test.ts`).

**Plot labels** (LORE, the same decision): "A station is called by its Virtue's epithet and its kind, so a field named
אדמה · ישן is the Old field. A plot with no Virtue is just Field. Only when two still share a label does the plot's
number follow it (Field 2), by Writ line order. The same label is used anywhere the Latin UI names a plot."
`plotLabel(plot, plots)` in `away.ts`, pure, capitalised at the start of a line ("Old field", "Field", "Field 2"); every
Virtue in `words.json` carries LORE's `epithet` (ישן → "Old"; the validator requires one on every Virtue and none on a
Ground; LORE's whole list is in Lore §14.22 for the words to come). The field's station panel title and build mode's
header ("Old field, level 2", `BUILD_TEXT.HEADER`) use it; the away card groups by kind, so it doesn't.

**The card (client)** (`ui/awayCard.ts`): on a holding answer whose `away` is not null, once nothing else is open (the
Name screen first while the island is unnamed; a panel or the talk box keeps the card for the next answer), it opens
over the holding, centred on the UI grid: a panel with the title "While you were away", the lines in the body font,
and under a divider, muted, LORE's last line, "Press anything to wake." (the one "press X" line allowed, since the
card closes on any input). While it is open the Kindled stands still (`session.held`), the world keeps drawing, the
heartbeat keeps running, the prompt hides and the toasts wait. **Dismissing:** the first key, mouse button, pad
button, stick push past the menu threshold or touch closes it and does nothing else (every handler yields to the open
card; the close lands at the start of the next frame). Closing sends `away/seen` with the card's `to`; a card whose
dismissal failed comes back with the next answer, one that was dismissed is not reopened by an answer already in
flight (`awayDismissedTo`). When the card shows a Writ line, that drain is marked told for the Writ toasts.

**Toasts** (`game/toastView.ts`, pure; the strip `ui/toasts.ts`): "A toast is one line, bottom left, above the
consumable slots, in the body font with a small glyph for its kind … at most two stack, and it never takes input.
Toasts are the only system voice besides hints." The strip is a scene of its own, registered last, so it draws above
everything on the UI camera, the inventory and the panels included, with nothing interactive in it (clicks pass
through); the holding scene launches and stops it, and the scenes post into `toastStore`. It sits at `hudRects`'
toasts rectangle (`HUD_INSET` from the bottom left, the newest toast at the bottom; above the chip's band in a frame
too narrow for both, `toastStripBottom`), counts in `panelsBehind` like the other panels (dithered while a body is
behind it), and holds each toast `toastMs` (3 s), then it disappears in one frame: no blink pattern and no alpha
(GAME DESIGN's "blinks out in one frame"). A new toast pushes the older one up a line; a third drops the oldest at
once; a toast with the same text as one showing restarts that one's 3 s instead of stacking (MAIN). "Item gains are
not toasts": they stay the "+12" floats. **The glyphs** are ART's toast glyph sheet (`packages/shared/assets/
toast-glyphs.json` + `toast-glyphs-12px.png`, #109; loaded like the item icon sheet, `meta.tinted` false, drawn
untinted): "a glyph at 1 UI px per px, vertically centred on its line, one HUD gap before the text", a line as tall as
the 12 px glyph, the lines at a pitch of 14 (a 2 px gap between two), and 4 UI px of padding on every side of the
panel, so the text's right margin matches the glyph's left margin (ART 2026-10-19; `TOAST_GLYPH`, `TOAST_ROW`,
`TOAST_PITCH`, `TOAST_GAP`, `toastStripHeight` in `game/holdingView.ts`; the strip for two lines is 34 UI px tall).
The kind picks the cell: a skill
level the skill's own (`skill-woodcutting`, `skill-mining`, `skill-farming`), store full the store's bin (`store-full`,
never the item's icon), `writ-low`, `writ-dark`, `pack-full` (`toastGlyphName`). The kinds and their triggers:

| Kind | When | Text (GAME DESIGN, final) | Glyph (ART, #109) |
| --- | --- | --- | --- |
| skill level | a skill's level in a holding answer is above the last this account saw (`iot.toast.levels.<username>`, written on every answer); never on an answer carrying the card, which says it, and never with nothing stored (a new browser) | `Woodcutting 2.` | `skill-<skill>` |
| Writ low | the derived charge falls under a day while on the holding, or is already under a day on landing with no card showing; once per drain | `Your Writ has about a day left.` | `writ-low` |
| Writ dark | the Writ goes dark, once per drain (מת from the letter sheet, as on the chip) | `Your Writ reads מת.` | `writ-dark` |
| store full | a take-all leaves some of a stack in the basket (`take.left`) | `Store: twisted logs full.` | `store-full` |
| pack full | anything refused as `pack-full`: the inventory's moves over the holding, Kesh's tosses | `Pack full.` | `pack-full` |

**Toasts after a short absence** (GAME DESIGN 2026-10-19): an absence under 30 minutes still shows no card, but its
toasts show on return ("close for 20 min across a level-up, reopen, and the level toast shows with no card"). The
client remembers the last levels it saw, per account, in `localStorage` (`iot.toast.levels.<username>`, `LevelMemory`
in `game/toastView.ts`), written on every holding answer. Every answer is read against them: a skill whose level is
above the stored one is a toast; an answer carrying the card toasts no level (the card says it) and just stores the
new levels; with nothing stored (a new browser) nothing toasts. This replaces the earlier rule that a session's first
answer never toasts. The Writ toasts already toast on landing with no card, once per drain, and stay as they are:
remembered per Kindled in `localStorage` (`iot.toast.writLow.<username>`, `iot.toast.writDark.<username>`; the
account's one Kindled is named by its username, since the client never sees a Kindled id) as the Writ's `emptyAt`
they were shown for: a feed that changes `emptyAt` re-arms them. Every read and write of the memories is wrapped, so
without storage a Writ toast may repeat and a level toast may be missed, which is fine. The inventory's refusal line and the talk
box's note no longer say "Pack full." over the holding; the start screen's inventory, which has no toast strip, keeps
the line. Build mode's footer refusals and the Writ panel's refusals stay where they are (§7; GAME DESIGN logged it
on 2026-10-19).

**Tests:** `packages/shared/test/away.test.ts` (the duration, the lines, one field and several, one skill and two, each
Writ state, never more than six, the plot labels, every line drawable and clear of the banned names, the guards) and
`words.test.ts` (the epithet); `apps/server/test/away.test.ts` on PGlite (under and at 30 min, the credits per place,
a level-up, the merge, `away/seen`, the inventory route's settle, the route's guards and codes, migration 0009);
`apps/client/src/game/toastView.test.ts` (the queue, each trigger, GAME DESIGN's 20-minute case with and without a
card and with nothing stored, the memories with and without storage),
`holdingView.test.ts` and `render/keshFraming.test.ts` (the strip's rectangle at the three sizes).
`tools/screenshots-m2-7.mjs` runs it end to end (shots: `docs/screenshots/m2-7/`): the panel with SLEEP, the
Kindled's moment at the post, the sleep screen, the start screen logged out, the card after `holding:away … 7` with an
Old field sown (the Field and Trees lines, the skills line, the Writ), the holding after any key closed it, a level-up
toast, the level toast on landing after `holding:away … 0.33` across a level-up (no card), "Store: twisted logs full."
under a second toast, "Pack full." over the open inventory, the Writ-low toast on
landing after `writ:set --charge-hours 23` (and not again on a second reload), and the card's faded Writ line after
`writ:set --dark-hours 49`.

## 14. The weapon rack

M2 Task 8 (GAME DESIGN, Encounters & dungeons: "The first weapon comes from the rack in the first wreck: all three hang
there, the player takes one, and the other two are carried home to the weapon rack at the holding, where every weapon
owned hangs. One weapon goes on a run, chosen at the rack before leaving; there is no swapping mid-run"; LORE §14.15 and
§16.5, 2026-10-19; ART's contract; MAIN's decisions). M2 has no wreck (voyages come in M3) and only the Hookblade fights
in the sim, so the rack in M2 is a stand-in for the wreck's gift: it holds what you own, and choosing at it decides the
weapon a run uses. Every player-facing line is `RACK_TEXT` in
[`packages/shared/src/rack.ts`](../../packages/shared/src/rack.ts), LORE's word for word, or data.

**Weapons are items** ([inventory.md](inventory.md)): kind `weapon` in `items.json` (`hookblade`, `sling`, `keelmaul`,
LORE's names and cards, stack limit 1, no skill, a `kit`: the moves in input order as the rack shows them), each an id
of `tuning.json`'s `weaponRoster` or `weapons` (`WEAPON_IDS`; the roster's `locked-2` and `locked-3` became `sling` and
`keelmaul`, still locked). They hang in the fixed place `rack`, which holds weapons and nothing else, one of each;
`inventory.apply` refuses a weapon anywhere else and anything else there (`wrong-place`) and a second of one weapon
(`stack-limit`). They take no pack slot and never show in the inventory's panes: the rack is where they are seen.

**The kit** (GAME DESIGN: "In M2 the rack holds the Hookblade alone, given once on arrival behind m2Scaffold, and chosen;
in M3 the wreck takes over, and a Kindled who already has the Hookblade finds the other two there"): the weapons of
`scaffold.json`'s `kit` (the Hookblade) are given onto the rack, reason `kit`, by the first holding request of a Kindled
who owns no weapon, after the settle and under the Kindled's lock (`giveKit` in `apps/server/src/holding/rack.ts`), each
under the ref `kit:<kindledId>:<weaponId>`, so racing first requests and repeats give it once. The Sling and the Keelmaul
aren't owned in M2; the not-ready state below is built and tested, but no M2 player sees it.

**The choice.** `kindled.run_weapon` (migration 0010, nullable, expand-only) is the weapon a run takes; null means the
first weapon in roster order the Kindled owns that can fight (the sim's `isWeaponAvailable` over the shipped tuning;
`weaponCanFight` in `packages/shared/src/weapons.ts` is its static mirror for shared code, and a server test holds them
equal). `POST /api/holding/rack/choose { weaponId }` sets it: a holding request like the rest (the session cookie, a JSON
body, a same-origin `Origin`, the guard refusing anything but `{ weaponId }`), answering the holding or refusing with
`not-owned` (not on the Kindled's rack; an unknown id too) or `not-ready` (owned, but the sim can't run it), both 409,
their lines `RACK_TEXT.NOT_OWNED` (LORE's "That one isn't hanging on your rack.", Lore §14.15) and `RACK_TEXT.NOT_READY`.
`HoldingResponse.rack` is `{ weapons: { itemId, ready }[], chosen }`: the weapons owned in roster order, and the weapon
a run takes, resolved (`resolveChosen`: the stored choice while it is owned and ready, else the first ready; GAME DESIGN:
"One weapon is always chosen", so `chosen` is null only while the Kindled owns no weapon that can fight, which M2's kit
never allows; the guard `isRackView` holds it to that). `PROTOCOL_VERSION` 8.

**The spot and the prop.** The `weapon-rack` station (kind `rack`, 2 × 1 at (17, 13) beside the post, its interact
point (16, 13)) is no longer reserved: its tiles carry `K`, solid for the sim like the post's, and it is actionless like
the post and the store (Use opens the panel). Its prop is `prop-weapon-rack` ([sprites.md](sprites.md) §4 "The weapon
rack": optional, a 64×72 cell with the origin (32, 64) on the bottom centre of its rect, `idle` alone with the prop rule's
shadow, the three optional peg points reserved for the hung sprites to come); until ART's sheet lands the holding draws a
placeholder box of its rect in the piece tokens, the pieces' fallback.

**The panel** (Use on the rack; `ui/rackPanel.ts`, its logic pure in `game/rackView.ts`; GAME DESIGN's row with LORE's
words): the title `Weapon rack`, then LORE's tooltip line, muted: `Every weapon you own hangs here. Take one out with you;
the others wait.` One row per weapon owned, in roster order: the weapon's name; its card, muted and wrapped; its kit in
input order joined by ` · ` (`Arc · Hook-thrust · Haul`); and on the right its state: the weapon going out next run,
LORE's `Taken` (highlighted); an owned weapon that can fight, LORE's **TAKE** button; an owned weapon that can't fight
yet, greyed, with LORE's `Your hands aren't ready for this one yet.` under its kit; a weapon not owned has no row. In M2
the panel shows one row, the Hookblade, Taken. TAKE is `POST /api/holding/rack/choose`; the rows redraw from the answer,
never ahead of it; a refusal is one line in the panel's footer with the inventory's blink-and-hold timing (panel refusals
stay panel lines). Pad: Up and Down move the focus through the rows, Cross chooses the focused row's weapon, Circle
closes; keys the same with the arrows, Enter and Esc; the mouse clicks a row or its button, touch taps them. GAME
DESIGN's row reuses the book's Found-weapons line, `It needs a smith who knows it`, for the not-ready state; in the book
that line is for a *rusted* weapon of a kind the game can't play yet, so the rack shows LORE's line and GAME DESIGN's is
kept in `RACK_TEXT` as `NEEDS_SMITH` for the rusted state that comes with the Forge (MAIN; both asked to confirm on the
Task 8 PR). GAME DESIGN's row still says CHOOSE and Chosen; LORE's TAKE and Taken are the words.

**Kesh** (LORE): a new topic in `kesh.json`, `rack`, titled `The rack`, before Goodbye, always open, three lines of his:
"Pick one before you go. One blade, one trip. Nobody fights with a rack on their back."; "Hook for close. Sling for far.
The maul for anything that won't get out of the way."; "Get yourself killed out there and you'll wake by your post, and
it'll be hanging right here. What's yours finds its way home. Glass doesn't, not all of it."

**The start screen.** The rack decides: CHOOSE YOUR WEAPON is gone. START RUN reads `rack.chosen` from a holding answer
fetched when the screen opens, and the run starts with that weapon; where the picker was, the weapon's name shows with
LORE's line under it, `Taken from your weapon rack.` If the answer can't be had (the server is down), START RUN uses the
roster's first weapon that can fight, as before, and the line says nothing (`startWeapon` in `game/rackView.ts`).
START RUN stays on the start screen until boats (M3) give the holding its landing (GAME DESIGN); nothing on the holding
starts a run.

**Tests:** `packages/shared/test/items.test.ts` (the weapons' cards word for word, the kit in the validator, every weapon
item named by the roster or the tuning's weapons, the roster renamed), `rack.test.ts` (`RACK_TEXT`'s lines drawable and
clear of the banned names, the kit ref, the rows and the resolved choice, the guards for `rack` in the answer and the
choose body), `places.test.ts` (the `rack` place), `kesh.test.ts` (the topic and `scaffold.json`'s kit), `sprites.test.ts`
(the sheet contract: `PROP_CELLS`, the optional sheet, the pegs allowed on this prop alone); `apps/server/test/rack.test.ts`
on PGlite (the kit given once and never with the scaffold off, `inventory.apply` refusing a weapon off the rack, a
material on it and a second Hookblade, choose: ok, `not-owned`, `not-ready`, `bad-request` and the guards, `chosen`
resolved when null or stale, migration 0010, the inventory view without weapons) and `holding.postgres.test.ts` (first
requests racing give the kit once); `apps/client/src/game/rackView.test.ts` (the rows and their states, the focus, the
start screen's weapon from an answer and its fallback), `keshTalk.test.ts` (the topic in the menu).
`tools/screenshots-m2-8.mjs` runs it end to end (shots: `docs/screenshots/m2-8/`): the rack beside the post with the Use
prompt, the panel with the Hookblade Taken and its kit line, a refusal in the footer (`keelmaul` chosen: `not-owned`), the
start screen with the chosen weapon and "Taken from your weapon rack.", Kesh's "The rack" topic, and a run started from it
with that weapon.
