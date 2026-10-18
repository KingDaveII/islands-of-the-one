# The holding

The Kindled's home Shard (M2 Task 3b): where a player lands after logging in, walks around, works
the twisted trees or the stone outcrop, takes a station's basket into the store and moves things
between the store and the pack. Numbers live in
[`packages/shared/data/holding.json`](../../packages/shared/data/holding.json),
[`stations.json`](../../packages/shared/data/stations.json), [`skills.json`](../../packages/shared/data/skills.json)
and the `roam` block of [`tuning.json`](../../packages/shared/data/tuning.json), never in code. Terms:
[`glossary.md`](glossary.md); items and the baskets: [`inventory.md`](inventory.md); how it is
drawn: [`readability.md`](readability.md); the sheets: [`sprites.md`](sprites.md).

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
- **`reserved`:** a spot kept for a later task. The weapon rack (Task 8) is reserved: its tiles are plain ground,
  it draws no prop and offers no Use, and stations.json gives it no action.
- **Plots:** four 6 × 6 rectangles (`PLOT_SIZE`) in a loose ring around the post with paths between them, data
  only; Task 5 names them. They never touch each other, the post or the store.
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
  each other, the post nor the store (`rectsTouch`, diagonals included); the landing is ground with void south of
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
and `prop-holding-store` (`STATION_SHEETS`; a reserved spot has none), and Kesh's rock from `prop-kesh-rock`
(`KESH_ROCK_SHEET`), each `idle`, one frame, standing on the bottom centre of its tile rectangle with a grounding
shadow by the prop rule (none for a prop standing in the void, Kesh's rock: `standsOnGround`), y-sorted with the Kindled by the line it stands on. `holdingRoomTiles` is the layout as
the sim walks it: every station tile a pillar (`o`), a reserved spot ground, the rock's tiles already void. All
six sheets are MAIN's placeholders through the pipeline (`tools/placeholder-holding.py` writes the source PNGs
into `art/clean/`, the recipes in `art/sheets/` say "placeholder by MAIN; ART replaces" in the holding art job);
ART replaces the pixels through the recipes without an engine change. The drops and lips and the props carry their
name's initials, so a wrong pick shows in a shot; the floors carry only their flecks. The pipeline's `rooms.png`
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
(the rows await art, so kindled-ash shows neither yet).

## 3. Stations and the active action

[`stations.json`](../../packages/shared/data/stations.json), validated on load:

| station         | kind    | action          | yields            | cycle | skill       | XP per cycle |
| --------------- | ------- | --------------- | ----------------- | ----- | ----------- | ------------ |
| `writ-post`     | post    | none: Use opens the inventory with the store pane (its Writ panel is Task 4) | n/a | n/a | n/a | n/a |
| `holding-store` | store   | none: Use opens the inventory with the store pane | n/a | n/a | n/a | n/a |
| `weapon-rack`   | rack    | none: a reserved spot until Task 8 | n/a | n/a | n/a | n/a |
| `twisted-trees` | trees   | a dead branch   | 1 `twisted-log`   | 4 s   | Woodcutting | 4            |
| `stone-outcrop` | outcrop | surface stone   | 1 `black-stone`   | 6 s   | Mining      | 6            |

A living branch ("mixed dead and living branches"), regrowth and the quarry's layers come later, with their
items. The six trees are one station: any tree's interact point works it, and they share one basket.

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
A Writ that is dark (Task 4) stops offline earning: `offlineAllowed(kindled)` returns true today;
when it is false the stretch's horizon is `ONLINE_GRACE_MS`, twice the heartbeat, so online play
still never loses a partial cycle.

**Baskets** have no limit in this task: what the 48 h rule produced waits there.

**Take all** (Use on a station → Take all) moves the basket into the store **moving only what fits**
(GAME DESIGN 2026-10-17): when a store stack is full the rest stays in the basket and the panel's one line
says "Store: twisted logs full." (until toasts arrive in Task 7). 3a's move refuses an over-limit set, so
take-all computes what fits under the Kindled's lock (`fitsInStore`: the item's stack limit and
`storeLimit(kind)` less what the store holds) and moves that, as one `move` set per item, so the ledger
shows both sides. What moved shows as "+3" floating over the station, the same float the cycles use, and
no message line; an empty basket shows nothing beyond its panel's "Basket: empty" (GAME DESIGN 2026-10-18).

## 4. Skill XP

GAME DESIGN's curve, in [`packages/shared/src/skills.ts`](../../packages/shared/src/skills.ts):

- Skills have no level cap. The XP to go from level L to L + 1 is
  `round(40 + 12,300 × (1.08^L − 1.08))`; level 2 is at 40 XP.
- XP per action is the action's base time in seconds (4 at the trees, 6 at the outcrop). Basket cycles
  from plots (Task 5) earn none.
- The table is generated, not computed at runtime: `tools/skills-table.mjs` writes `skills.json`, the
  cumulative XP of each level from 1 to 200 (level 10 at 46,689, level 20 at 298,935, level 200 at
  743,985,697,074). `skillProgress(xp)` reads it and runs the same formula past it (`xpToNext`).
  `packages/shared/test/skills.test.ts` recomputes every entry from the formula, integer-exact, pins
  those values and checks the level at the edges, 200 and 250 included.
- `skill_xp` (Kindled, skill, XP as bigint) is written only in the settle transaction. XP is not an
  item, so it is not in the item ledger. The skills of M2: Woodcutting, Mining, Farming (no station
  until Task 5).

## 5. The API

In [`packages/shared/src/api.ts`](../../packages/shared/src/api.ts), beside the account and inventory
routes ([`accounts.md`](accounts.md)): the Kindled comes from the session cookie only.

| Route                     | Body            | Answer                                                                                   |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/holding`        |                 | `200` `HoldingResponse` · `401` not-signed-in · `404` no-kindled                         |
| `POST /api/holding/work`  | `{ stationId }` | `200` the same · `400` bad-request / unknown-station / no-action (the post) · `401` · `404` |
| `POST /api/holding/stop`  | `{}`            | `200` the same · `400` bad-request · `401` · `404`                                       |
| `POST /api/holding/take`  | `{ stationId }` | `200` the same, with `take` · `400` bad-request / unknown-station · `401` · `404`       |

`HoldingResponse`: the layout id; `baskets` by station id (every station of the layout listed) as
lists of `{ itemId, quantity }`; the `activity` (`stationId`, `startedAt`, `cycleMs`) or null; the
server's `now`; and `skills`, each with its XP, level, XP into the level and XP to the next. A take
answer adds `take`: the station, what `moved` into the store and what was `left` in the basket. Every
route settles first, refuses unknown fields and stations, and answers the same shape as GET.

**The heartbeat:** while the holding scene is open the client calls `GET /api/holding` every
`heartbeatMs` (30 s) and after each interaction (work, stop, take, opening a station panel, coming
back from the inventory), so `last_seen_at` stays fresh and the counts stay true.

**The away hook** (playtests only): `pnpm --filter @iot/server holding:away <username> <hours>` moves
the active action's `started_at` and `last_seen_at` back that far, as if the Kindled had been away;
the next request settles the stretch as offline time, up to the cap.

## 6. The client

**The start screen's main action is HOLDING** (Enter, Cross); the M1 run stays as a secondary entry
(START RUN, Shift+Enter, Start on the pad), the combat test bed, until boats reach encounters.

**The holding scene** (`apps/client/src/scenes/HoldingScene.ts`) runs on the world and UI cameras as
runs do. In the world: the island (`HoldingWorld`, `render/holdingWorld.ts`, the shore set over the hollow
background), a prop per station part with shadows by the prop rule and Kesh's rock without one, the Kindled walking by
`roam` (`RoamSession`, `game/roamSession.ts`, 60 Hz from the controls' input, interpolated for drawing), and
the interact prompt (the interact glyph and USE) over the nearest station part whose interact point is
within `juice.promptRangePx` (`nearestStationPart`; a reserved spot is never prompted). The camera follows
the Kindled and stops at the layout's edges.

**The HUD** (`render/holdingHud.ts`, placeholder panels until ART's kit):

- **Bottom centre, the active-action chip:** the station's placeholder icon (its initials), the skill
  name and level, a progress ring for the current cycle drawn from `startedAt`, the cycle and the
  server's clock offset (`clockOffset`, `cycleProgress` in `game/holdingView.ts`), a thin XP bar to the
  next level; empty while idle. Clicking or tapping it stops the action. **There is no stop binding**
  (GAME DESIGN 2026-10-18): stopping is on the chip and in each station's panel ("Stop working"), and
  walking to another station and working it switches; `stopAction` left `controls.json` and its glyph
  cell `key_x` the glyph sheet.
- **Bottom right, the pack button** with its fill (`PACK 12/20`): opens the inventory over the holding
  (launched, the holding paused; Esc, Circle or I come back and refresh), with the store pane, since we
  are on the holding.
- **Top right, the gin purse.**
- **Over the station, a "+1"** as each cycle completes, predicted from the ring (`cyclesDone`), render
  only; the counts come from the server. A take-all floats what moved the same way ("+3"), over the
  station's part nearest the Kindled.

**Interacting** (interact is E, Cross or a tap; I or the Touchpad opens the inventory; Esc or Circle
backs out, all from `controls.json`): Use on the Writ post or the holding store opens the inventory with
the store pane (the post's Writ panel is Task 4); Use on a tree or the outcrop opens a small station panel
(`stationLines`): the name, "1 twisted log every 4 s", the basket count, "You: 1 twisted log every 4 s"
while working here (the item's full name on both lines), the skill's level and XP to the next, and the
buttons WORK HERE (STOP WORKING while working here) and TAKE ALL. After Take all what moved floats over the
station ("+3", `takeFloat`); "Store: twisted logs full." (`takeResultLine`) is the one panel line, shown
with the inventory's blink-and-hold timing when it applies. Toasts proper are Task 7.

## 7. Seams for later tasks

- **Task 4, the Writ and the Name:** `offlineAllowed(kindled)` (a dark Writ stops offline earning);
  the post's Use, which opens the Writ panel beside the store; Kesh's Talk spot (`kesh.talk`) across the
  water from the rock.
- **Task 5, plots and their baskets' cycles:** the plot rectangles in `holding.json`; `stations.json`
  gains the plot stations; basket cycles earn no XP.
- **Task 6, build mode:** the layout stays pure data.
- **Task 8, the weapon rack:** the reserved `weapon-rack` spot by the post gets its prop and its Use.
- **Boats:** the `landing` on the south shore.
- **Task 7, sleep, the away card and toasts:** the settle already reports what a stretch credited
  (`Settlement`); the take-all result line is where the toast goes.
- **Visits and voyages:** `inRange(kindled, station)` and `canReachStore(kindled)`.

## 8. Tests and shots

`packages/shared/test/holding.test.ts` (the layout rule and GAME DESIGN's placement checks, the stations
table, a golden snapshot of every cell's pieces under the shore rule in `test/golden/first-holding.tiles.txt`
so a layout edit shows as a readable diff, the API guards) and `skills.test.ts`; `packages/sim/test/roam.test.ts`
(the dip grace among the rest); `apps/server/test/holding.test.ts` on PGlite (the
settle math: a partial cycle, many cycles, exactly 48 h, 60 h away with the lost time never paid, a
switch settling the old station, a stop; XP and level-ups; take-all moving only what fits; the API's
guards and error codes; migration 0004; the away hook) and `holding.postgres.test.ts` on a real
Postgres (settles racing for one Kindled credit each cycle once; a take-all racing a settle keeps the
basket's totals); `apps/client/src/game/holdingView.test.ts` (the ring and XP bar values, the chip
states, the station panel's lines) and `render/roamPose.test.ts`. `tools/screenshots-m2-3b.mjs` is the
end-to-end run: it logs in and lands on the holding, walks (a walk and a run), works the trees for a
few cycles, takes all, opens the inventory and moves the logs to the pack, reloads and sees the counts
kept, moves the action 60 h back with the away hook and checks the basket holds the cap's worth, fills
the store for "Store: twisted logs full.", then walks the shore (3c): the south shore dropping into the
Hollow at the landing, the north edge's lip, and the Kindled behind the tall tree's canopy (it checks the
depths). Shots: `docs/screenshots/m2-3b/`.
