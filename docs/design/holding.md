# The holding

The Kindled's home Shard (M2 Task 3b): where a player lands after logging in, walks around, works
the twisted trees or the stone outcrop, takes a station's basket into the store and moves things
between the store and the pack, names the island and feeds its Writ (M2 Task 4a, §9). Numbers live in
[`packages/shared/data/holding.json`](../../packages/shared/data/holding.json),
[`stations.json`](../../packages/shared/data/stations.json), [`skills.json`](../../packages/shared/data/skills.json),
[`writ.json`](../../packages/shared/data/writ.json) and the `roam` block of
[`tuning.json`](../../packages/shared/data/tuning.json), never in code. Terms:
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
and `prop-holding-store` (`STATION_SHEETS`; a reserved spot has none; a part may name its own sheet instead,
`sheet` in `holding.json`, from `STATION_PART_SHEETS`: every other tree is `prop-twisted-tree-2`, ART's forked
crown on the same tall cell, drawn once it is on disk and `prop-twisted-tree` until then), and Kesh's rock from `prop-kesh-rock`
(`KESH_ROCK_SHEET`), each playing its `idle` (one frame, but the Writ post's two at 2 fps: its tablet's marks pulse), standing on the bottom centre of its tile rectangle with a grounding
shadow by the prop rule (none for a prop standing in the void, Kesh's rock: `standsOnGround`), y-sorted with the Kindled by the line it stands on. `holdingRoomTiles` is the layout as
the sim walks it: every station tile a pillar (`o`), a reserved spot ground, the rock's tiles already void. All
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
the holding draws it from its sheathed sheet, `kindled-ash-sheathed` (`PLAYER_SHEATHED_SHEET`, sprites.md §4,
ART #87), with the same tone swap; encounters keep the combat sheet.

## 3. Stations and the active action

[`stations.json`](../../packages/shared/data/stations.json), validated on load:

| station         | kind    | action          | yields            | cycle | skill       | XP per cycle |
| --------------- | ------- | --------------- | ----------------- | ----- | ----------- | ------------ |
| `writ-post`     | post    | none: Use opens the Writ panel (the Name screen first, unnamed; §9) | n/a   | n/a   | n/a         | n/a          |
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
**The Writ sets the horizon** (`offlineHorizonMs(writ, lastSeenAt, now)`, M2 Task 4a; §9): the full
cap while the Writ is lit or flickering at `now`; otherwise the stretch earns unattended only until
the moment the Writ went dark, `min(cap, emptyAt − lastSeenAt)`, and never less than
`ONLINE_GRACE_MS`, twice the heartbeat, so online play still never loses a partial cycle and hands
keep working at full rate and XP while dark (GAME DESIGN: "Dark means idling stops, not that the
player is locked out"). The Writ row is locked in the settle's transaction with the rest.

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
| `POST /api/writ/name`     | `{ name }`      | `200` the same · `400` bad-request / name-refused · `409` already-named · `401` · `404` |
| `POST /api/writ/feed`     | `{ itemId, count }` or `{ fill: true }` | `200` the same · `400` bad-request / not-sparkglass · `409` unnamed / insufficient / full / too-much · `401` · `404` |
| `POST /api/kesh/sliver`   | `{}`            | `200` the same · `400` bad-request · `409` not-due / pack-full · `401` · `404` (§10)     |

`HoldingResponse`: the layout id; `baskets` by station id (every station of the layout listed) as
lists of `{ itemId, quantity }`; the `activity` (`stationId`, `startedAt`, `cycleMs`) or null; the
server's `now`; `skills`, each with its XP, level, XP into the level and XP to the next; and the
`writ` (`WritView`, §9) and `kesh` (`KeshView`, §10). A take answer adds `take`: the station, what `moved` into the store and what
was `left` in the basket. Every route settles first, refuses unknown fields and stations, and answers
the same shape as GET. The Writ's routes are in §9; the shape change made `PROTOCOL_VERSION` 3, and
`kesh` with the Writ's `fedAt` (4b) made it 4.

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
- **Top left, the island's Name and the Writ chip** (§9): the Name as typed (BitmapText) over its
  letters (the letter sheet, lit), and the chip: the charge in words, ember under a day, מת from the
  sheet when dark or fading, the exact time ("41 h 12 min") as its tooltip on hover. Before the island
  is named the chip shows alone.
- **Over the station, a "+1"** as each cycle completes, predicted from the ring (`cyclesDone`), render
  only; the counts come from the server. A take-all floats what moved the same way ("+3"), over the
  station's part nearest the Kindled.
- **The camera margin** (4b): the camera follows the Kindled and may scroll `cameraMarginTiles` (6, `holding.json`)
  into the void past every edge of the layout (`clampScroll`'s `near` and `far` on both axes), so the HUD's corner
  panels never cover the shore or Kesh's rock: the PACK chip covered the rock in a 1440 × 810 window before it, the
  rock standing two tiles from the template's edge (ART). The four panels' rectangles are one pure function,
  `hudRects` (`game/holdingView.ts`), that the HUD draws by and `render/keshFraming.test.ts` checks against the
  rock's and Kesh's drawn rects at 1280 × 720, 1440 × 810 and 960 × 540.

**Interacting** (interact is E, Cross or a tap; I or the Touchpad opens the inventory; Esc or Circle
backs out, all from `controls.json`): Use on the Writ post opens the Writ panel, or the Name screen first
while the island has no Name (§9); Use on the holding store opens the inventory with the store pane;
Use on a tree or the outcrop opens a small station panel
(`stationLines`): the name, "1 twisted log every 4 s", the basket count, "You: 1 twisted log every 4 s"
while working here (the item's full name on both lines), the skill's level and XP to the next, and the
buttons WORK HERE (STOP WORKING while working here) and TAKE ALL. After Take all what moved floats over the
station ("+3", `takeFloat`); "Store: twisted logs full." (`takeResultLine`) is the one panel line, shown
with the inventory's blink-and-hold timing when it applies. Toasts proper are Task 7.

## 7. Seams for later tasks

- **Task 4b, Kesh and the tide:** done (§10). What stays for later: Kesh's word tile (אדמה) and the seeds
  are Task 5's, the codex entries come with the codex, odd catches with voyages; the once-per-tide sliver
  goes away in M3 (`m2Scaffold`).
- **The Wet House (M4):** `graceHoursUncertified` in writ.json (48 today) drops to 24; `certified` is
  written there; a rim-band's fitting, scribing a line and renaming (the panel shows line 2's needs
  greyed).
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
| `linePlots`             | 4                                                                 | Plots each line tethers (a count in M2; Task 5 makes the plots)          |

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
**The Old Letters**, **Sparkglass**, **Where the crack points**, **Goodbye**; a topic plays its lines and
comes back to the menu, Goodbye plays its lines and closes. The arrows, the D-pad or the left stick move
the menu's focus, the pointer hovers and clicks a row.

**The lines** live in [`packages/shared/data/kesh.json`](../../packages/shared/data/kesh.json), validated on
load (`validateKeshData`), LORE's and GAME DESIGN's word for word; every line passes `DRAWABLE_CHARS`, and a
character the fonts lack fails the test by name instead of changing the text. A line is
`{ who: kesh | narrator | hint, text }`, optionally with a `toss` (`sliver`: the thrown thing leaves his hand
on that line) and an `only` (`first-sliver`: shown only while his first sliver hasn't been given). Stage
directions in parentheses and LORE's speech marks are part of the text and are drawn. The flows:
`afterNaming` plays from `afterNaming()` once the server has accepted the Name, after 4a's flare, and the
Writ panel opens when it closes; `afterFirstFeeding` plays from `afterFeeding()` the first time a feed lands
(`writ.fedAt` went from null to set in the feed's answer), over the open Writ panel; the Sparkglass topic
carries the first-sliver step (the flick with its toss, then the hint "Touch Sparkglass to your Writ to feed
it.") while `firstGiven` is false; `tideSliver` is the tide's line. **When a sliver is due** (`kesh.due`),
Talk first plays the due toss (the first sliver's two lines, or the tide's one), then the menu.

**The toss.** On a line with a `toss` the scene plays `toss` and sends `POST /api/kesh/sliver` once. When
`toss` reaches `toss_2` (`KESH_TOSS_RELEASE_FRAME`) and the server has given the sliver, the thrown thing
leaves his hand: drawn from `prop-sparkglass`'s `idle`, it flies a whole-pixel arc (`render/keshToss.ts`)
from that frame's `hand` point (mapped like the Hookblade's points: the anchor plus the point less the cell
origin) to the Kindled's feet over `kesh.tossMs` (600) with the arc `kesh.tossArcPx` (20 world px) high,
both in `tuning.json`, and "+1" floats where it lands, the cycles' float. The flight is cosmetic: the count
comes from the server's answer, never from the animation. A refusal ("Pack full.") is the box's note line
under his line, and nothing flies.

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

**The playtest CLI:** `pnpm --filter @iot/server kesh:reset <username>` clears both columns through the
holding module, so a playtest can see the first sliver again; the grant CLI keeps working beside it.

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
