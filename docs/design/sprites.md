# Sprite sheets

The contract for every animated character sheet the client loads (ART DIRECTION → MAIN, 2026-10-12). Terms: [`glossary.md`](glossary.md); drawing rules and signal colours: [`readability.md`](readability.md); the Old Letters sheet, the first asset delivered this way: [`letters.md`](letters.md). Related engine sheets already in `packages/shared/assets/`: `controller-glyphs-12px.png` + `.json` (44 cells, prompts and the controls screen) and `hookblade-fx.png` + `.json` (chain link, hook, charge spark); their format is "Engine sheets" in §5.

How every animated character reaches the engine: a 1× PNG plus a JSON contract, like the Old Letters sheet (PR #8). This spec covers the tool, the frame grid, facings, the animation lists for M1 (Kindled, Peeling, Nutshell), frame rates, the JSON shape for Phaser, and the test MAIN commits with each sheet.

## 1. Tool (decided)

- **Hand-drawn sheets: Aseprite** (`.aseprite` source files in `packages/shared/assets/src/`, exported with `aseprite -b` to PNG + JSON). Reasons: indexed-colour mode holds the 32-colour budget, tags map one-to-one onto our animation names, the CLI export is scriptable in CI, and Phaser 3 has a native loader for its JSON. LibreSprite (free fork) exports the same format if David prefers not to buy it.
- **Generated sheets (what ART DIRECTION makes today): Python/PIL scripts** in the design workspace (ART DIRECTION's own scripts, outside the repo) that write the *same* PNG + JSON contract directly. Placeholder and concept sheets come this way; a hand-drawn Aseprite file can replace any of them without the engine noticing.
- Either way the engine only ever loads `<name>.png` + `<name>.json` from `packages/shared/assets/`. The Aseprite export is converted by a small repo script (`tools/aseprite-to-atlas`) into the contract below (Aseprite's `frameTags` become `anims`, its slice named `origin` becomes the origin). MAIN owns that script.

## 2. Frame grid

One contract, **v2** (G1.5): option B's art (PixelLab, G1.3b), every sprite on a 64×64 canvas with
the soles on row 53, drawn at 1 world px per sheet px in the 2× world, built through the pipeline
([`art-pipeline.md`](art-pipeline.md): recipes, `pnpm art:build`, `pnpm art:check`). M1's v1 sheets
(drawn at 2 world px per sheet px) are retired; the §6 test rejects one (history in §8). Heights,
proportions and drawing rules belong to ART:
[`art/anchors/style-sheet.md`](../../art/anchors/style-sheet.md) (not repeated here).

### Cells

The engine, the §6 test and the G1.2 pipeline read these numbers from `packages/shared/src/sprites.ts`
(`SPRITE_CELLS`, `SPRITE_CANVAS`):

| Kind | Cell | Origin (the line under the soles) | The 64×64 canvas sits at |
|---|---|---|---|
| Kindled player sheets (`kindled-<rem>`) | 96×80 | (48, 64) | (16, 10), so canvas row 53 is cell row 63 |
| Every other sheet (Husks and other enemies, NPCs, props) | 64×64 | (32, 54) | (0, 0) |
| Tall props (`PROP_CELLS`, M2 Task 3c; the first is `prop-twisted-tree`) | 64×96 | (32, 86), the line under the trunk | (0, 32), so canvas row 53 is cell row 85; the canopy overhangs upwards |
| Room tiles (`tiles-<set>`, G1.5e) | 32×32 per piece; doors 64×32 (`door_n`) or 32×64 (`door_w`, `door_e`) | none: a piece's top left sits on its cell's | no canvas: a piece is its own size, on one 16 sim px cell ("Tiles", §10) |

- The Kindled's extra room is for actions: the heavy thrust, the Haul throw and the death fall. SS-01 measured
  the reach at most 34 px from the feet in any action (v3 draws actions on a 68×68 canvas, so ±34 is its
  limit), so 96 px (48 either side of the origin) holds it with room for the outer 1 px ring.
- A future kind that needs more room declares a bigger cell (`spriteCellSpec(w, h, originY)`), with
  the canvas centred horizontally and the soles on the row above the origin. A **tall prop** (ART
  2026-10-18) does this per prop, in shared code: `PROP_CELLS` in `packages/shared/src/sprites.ts`, keyed
  by the name after `prop-`, not in the recipe. `spriteSheetSpec` returns the tall cell for those names,
  so the pipeline places the frames on it (the source may be any size up to the cell; its lowest opaque
  row lands on row 85) and the sheet test checks it. The ground-line sort (§8, G1.5h) puts the Kindled
  behind the canopy when its feet are north of the trunk's base; the collision stays the layout's
  footprint, and the shadow rule is unchanged. The Writ post and the stone outcrop keep the 64×64 cell.
- Where a sprite stands does not come from the cell: the feet are 5 sim px below the body centre for
  the Kindled and a Husk's radius below for a Husk, ×2 in world px (`apps/client/src/render/feet.ts`).

- Cells are a regular grid: `frame.x = col * cellW`, `frame.y = row * cellH`. No trimming, no rotation, no padding; the empty pixels are the cost of a grid the test can check by arithmetic.
- The shadow is **not** in the sheet; the engine draws it (readability.md: a navy dithered ellipse under the origin).
- Colours: the 28-colour whitelist (§5). The Kindled sheets are drawn in the **grey-ochre** clay tone; the other three tones are palette swaps (`palette` block below), so one sheet per Remembrance, not twelve.

## 3. Facings

- Kindled: **8 facings**, in this order and spelling: `S, SE, E, NE, N, NW, W, SW`. All eight are stored (the west facings are drawn, not flipped: the Hookblade stays in the right hand, which is the far hand when facing west). A recipe may still build a facing from another facing's frames mirrored, where ART decides the action allows it (`flipX` in [`art-pipeline.md`](art-pipeline.md)); the sheet stores the result as that facing's own frames, so the engine never flips a Kindled. Idle and walk have all eight; attacks, dodge and Haul have all eight; hit, death and carry have four (`S, E, N, W`) and the engine maps diagonals to the nearest.
- Husks: **no facings**. Peelings and Nutshells are radial; the engine rotates nothing, it flips horizontally when the lunge or roll direction has a west component (`"flipX": true` is allowed for Husks only).
- NPCs (`npc-<name>`): **8 facings** in the Kindled order, for every animation; the sheet carries `meta.facings`.
- Props (`prop-<name>`): **no facings**.
- Facing names are part of the frame name: `walk_SE_3`.

## 4. Animations

**The tables live in code** (`packages/shared/src/sprites.ts`, G1.2b): `KINDLED_ANIMS`, `HUSK_TABLES` (one per Husk),
`NPC_ANIMS`, `PROP_TABLES` (one per prop that has one, G1.5f) and `PROP_IDLE`, each row a frame count, fps, loop, hold, facings
and milestone. The tables below describe them; if the two ever disagree, the code is the contract the sheet test and the
art pipeline hold sheets to.

**Milestones (G1.2c).** Each row's `milestone` is the milestone that first uses it, and `REQUIRED_MILESTONE`
(`"M1"`) is the one a finished sheet is complete for: it carries every row at or before it, and later rows are
optional. An optional animation that is there is still complete (every facing, the right frame count). Only the
Kindled's `carry_idle`, `carry_walk` and `sit` are M2 (the Milestone column below); every other row of every
table is M1. M2 Task 9, or whichever task first uses carry or sit, moves `REQUIRED_MILESTONE` to `"M2"`.

**Awaiting art (G1.5c).** A row can be in the contract before ART has drawn it. `ANIMS_AWAITING_ART`
(`packages/shared/src/sprites.ts`) lists those rows: empty from kindled-ash's `run` (#46) to the M1 polish, which put
`run_start`, `run_stop` and `run_back` on it (ART 2026-10-17); the two transitions came off when ART's frames landed (#72) and `run_back` with the backwards-run job (#74), so the list is empty again. While a row is on it, the sheet test and
the art pipeline treat it as optional, whatever its milestone, but complete when present (every facing, the
right frame count), and the engine plays its stand-in: `run` falls back to `walk` (§8), as it still does on a sheet without `run`;
`run_back` to the run in reverse; `run_start` and `run_stop` to nothing, the run and idle switching directly. When ART's sheet lands
with the row, MAIN removes it from the list in a one-line change, and from then on the row is required like
any other at or before `REQUIRED_MILESTONE`.

**Which kind a sheet is comes from its name's prefix:** `kindled-`, `husk-`, `npc-`, `prop-`, `tiles-`. One function,
`spriteSheetSpec(name)`, maps a name to its kind, its cell (§2) and its table; an unknown prefix fails. A `tiles-`
sheet's table is its doors' animations; its pieces are in §10. A later enemy
adds its own table to `HUSK_TABLES` the same way; until then only a draft of it can be built.

Frame rates are per animation; `hold` means the last frame stays until the state ends. Durations in the design tables stay the authority for timing (the engine stretches or cuts frames to fit the combat windows; the art gives the count).

### Kindled (per Remembrance sheet)

| Name | Frames | fps | Loop | Facings | Milestone | Notes |
|---|---|---|---|---|---|---|
| `idle` | 2 | 2 | yes | 8 | M1 | a breath: one pixel of chest and hood |
| `walk` | 6 | 10 | yes | 8 | M1 | the blade bobs with the hand; it plays by distance, one cycle per `anim.walkCyclePx` (64 world px, §8). In encounters the engine plays it only as `run`'s stand-in; walking for its own sake is M2's holding |
| `run` | 8 | 16 | yes | 8 | M1 | the Kindled's movement in encounters, Combat and Calm alike (GAME DESIGN 2026-10-16); plays by distance, one cycle per `anim.runCyclePx` (96 world px, §8), so 12 world px a frame; the fps only matters where nothing drives it by distance. 8 frames because PixelLab's `running-8-frames` template draws 8, and dropping two would break the cycle's even timing. The recipe lists the frames starting at the first contact (a foot lands), so frame 0 is a contact. Required since #46 (off `ANIMS_AWAITING_ART`); while a row awaits art and a sheet lacks it, the engine plays `walk` at the run's cycle in its place |
| `run_start` | 2 | 20 | no | 8 | M1 | the push-off, played once by time (100 ms) when the Kindled starts moving from idle, then `run` (or `run_back`) takes over at the run's current distance phase; visual only, the sim never waits for it (§8). ART's frames landed in #72 and the row is required (off `ANIMS_AWAITING_ART`); a sheet without it (a fixture) switches the run and idle directly |
| `run_stop` | 2 | 20 | no | 8 | M1 | the settle, played once by time (100 ms) when it stops, then `idle`; the same rules as `run_start`. Required since #72, like `run_start` |
| `run_back` | 4 | 12 | yes | 8 | M1 | the backpedal: the run away from the aim, played by distance, one cycle per `anim.backCyclePx` (48 world px, §8), so 12 world px a frame like `run`; the 12 fps is nominal, used only where nothing drives it by distance (tools, previews, a pose without a stride; ART's answer on #69). ART's frames landed in #74 (16–18 px of stride per cycle, so 48 stays) and the row is required; a sheet without it (a fixture) plays `run` in reverse (G1.5h) |
| `dodge` | 4 | 16 | no | 8 | M1 | 1 = crouch, 2–3 = the roll (body a 12×12 ball), 4 = recover; frame 2–3 are the perfect-dodge window art |
| `light_1`, `light_2`, `light_3` | 3 each | 15 | no | 8 | M1 | wind-up, swing (the arc), recover; `light_3` ends lower |
| `heavy_charge` | 3 | 12 | hold last | 8 | M1 | the drawn-back stance; the spark comes from `hookblade-fx`, drawn at each frame's `tip` point (§5), not from the sheet |
| `heavy_thrust` | 2 | 20 | no | 8 | M1 | the line: hand forward, blade full length |
| `heavy_hold` | 1 | — | hold | 8 | M1 | the pin: 150 ms, the enemy on the hook |
| `heavy_recover` | 2 | 12 | no | 8 | M1 | |
| `haul_throw` | 2 | 15 | hold last | 8 | M1 | arm out; chain and hook from `hookblade-fx`, the chain from each frame's `hand` point (§5); the last frame holds while the hook flies |
| `haul_recover` | 2 | 12 | no | 8 | M1 | the arm comes back as the chain reels in, over the Haul's recovery (1:1), so the move ends at rest like the light and heavy |
| `haul_pull` | 2 | 12 | yes | 8 | M1 | the brace: feet planted, both hands on the chain |
| `haul_slide` | 2 | 12 | yes | 8 | M1 | the heavy branch: the player dragged, cloak streaming back |
| `hit` | 2 | — | hold last | 4 | M1 | 0 = the flinch (the first 100 ms of the stun, alone on an armored hit), 1 = the stagger held to the end of the hurt stun; the engine flashes it #FFFFFF (the only pure white) |
| `death` | 6 | 8 | no | 4 | M1 | the fall, then the freckles go out one by one on the last three frames |
| `carry_idle`, `carry_walk` | 2, 6 | 2, 10 | yes | 4 | M2 | both arms round the Glowing Shell (hour two) |
| `sit` | 1 | — | hold | 2 (S, E) | M2 | the ebb, by the post |

M2 adds the station animations (`chop`, `hoe`, `fish`, `knead`: 4 frames, 8 fps, 2 facings) on the same sheet.

### Peeling

| Name | Frames | fps | Loop | Notes |
|---|---|---|---|---|
| `spawn` | 4 | — | no | the curl gathering round its core, stretched over `spawnMs`: 0 = the core alone, 1 = flakes circling it, 2 = the shell half closed, 3 = closed (= `idle` 0); the engine's ring stays under it and the Husk is not awake until it ends |
| `idle` | 2 | 3 | yes | the curl breathes; also its drift while it circles |
| `telegraph` | 2 | 8 | hold last | tinted in the sheet already in #E0457B / #8E2550; no engine tint |
| `lunge` | 3 | 15 | no | stretch, hit, settle |
| `hit` | 1 | — | 100 ms | engine white flash |
| `chipped` | 1 | — | hold | the shell with pixels missing (chips are particles from the engine) |
| `death` | 4 | 10 | no | the shell parts, the core flares as a ring |
| `drop` | 1 | — | hold | the Sparkglass chip on the floor |

### Nutshell

| Name | Frames | fps | Loop | Notes |
|---|---|---|---|---|
| `spawn` | 4 | — | no | the shell closing round its core, stretched over `spawnMs`, the same four stages as the Peeling's |
| `idle` | 2 | 2 | yes | |
| `walk` | 4 | 6 | yes | the chase: the shell rocks forward on its hidden feet, 4 px per cycle; chosen by velocity like the Kindled's walk (the sim's Nutshell walks and slams in place, it never rolls) |
| `telegraph` | 2 | 8 | hold last | tinted in the sheet |
| `slam` | 2 | — | hold last | 0 = the shell dropping over the first half of the active ticks, 1 = the impact over the second half, held through the recovery; the slam's circle on the floor stays an engine decal |
| `hit` | 1 | — | 100 ms | |
| `chipped_outer` | 1 | — | hold | first poise bar broken: outer shell gone |
| `chipped_inner` | 1 | — | hold | second bar broken: core exposed |
| `regrow` | 3 | 6 | no | the shell closing back (poise regrow) |
| `death` | 4 | 10 | no | |
| `drop` | 1 | — | hold | |

### NPCs (`npc-<name>`, G1.2b)

| Name | Frames | fps | Loop | Facings |
|---|---|---|---|---|
| `idle` | 2 | 2 | yes | 8 |
| `walk` | 6 | 10 | yes | 8 |

- No palette block and no mask: each NPC is generated in its own clay tone, so nothing is swapped.
- More NPC animations come later, per NPC, as data.

### Props (`prop-<name>`, G1.2b)

A prop may have a table of its own, like a Husk: `PROP_TABLES`, keyed by the name after `prop-` (G1.5f).
`spriteSheetSpec('prop-<name>')` returns it when there is one; the pipeline and the §6 test read it through
`spriteSheetSpec`, as they do for Husks, so a finished sheet carries every row and a draft may carry any subset.
A prop without an entry keeps the rule below: `idle` only.

| Name | Frames | fps | Loop | Facings |
|---|---|---|---|---|
| `idle` | 1–8, from the recipe | from the recipe, default 8 | yes with more than one frame; one frame holds | none |

For flames and the like. No palette block and no mask. The cell is the 64×64 prop cell, origin (32, 54) (§2),
or the tall prop cell for a prop in `PROP_CELLS` (the twisted tree, 64×96, origin (32, 86)).

A row's frame count and rate can come from the recipe within a range, like `idle` (`fromRecipe` on the row,
`PropRecipeAnim`): the pipeline writes the recipe's count and `fps`, the sheet test takes the sheet's, and
`propTableFor` resolves the table for both. Such a row loops with more than one frame and holds with one.

#### The Sparkglass pickup (`prop-sparkglass`, M1 polish)

ART delivers it (2026-10-17): a prop without a table, so `idle` alone, a 9 × 11 chip with a 2-frame glint at the
recipe's fps, on the prop cell with the chip's base on the sole row. It is optional (`OPTIONAL_SPRITE_SHEETS`,
`SPARKGLASS_SHEET` in `packages/shared/src/sprites.ts`, not in `SPRITE_SHEET_NAMES`): when the sheet is on disk the
client bundles and loads it with the others (`optionalSheet` in `apps/client/src/render/spriteSheets.ts`) and draws
every pickup from it (`apps/client/src/render/pickupSprites.ts`) at its position, keeping the sim's fly-out and
magnet motion, `idle` looping on the client clock, with a grounding shadow by the prop rule
([`readability.md`](readability.md) §2); until it lands the engine's own 7 × 9 chip stays as the fallback
(`drawPickup` in `world.ts`), the same pattern as the chest before #61. `window.__iot.pickups()` says which draws and
reads the frames; the tests use the fixture `packages/shared/test/fixtures/prop-sparkglass.*` (made by the `.py`
beside it; it never ships) for both paths.

#### The chest (`prop-chest`, G1.5f)

The first entry. Every row has no facings and is M1:

| Name | Frames | fps | Loop | Hold | Notes |
|---|---|---|---|---|---|
| `closed` | 1 or 2, from the recipe | from the recipe, default 8 | yes with 2 | with 1 | like `idle`, capped at 2 frames: ART draws the clasp glint as its 2 frames (about 2 fps); a 1-frame `closed` is still, with no glint |
| `opening` | 4 | 12 | no | yes | the lid rising, played once on the client clock when `ChestState.opened` turns true |
| `open` | 1 | 0 | no | yes | held; also what a chest already open when the client first sees it shows |

The engine (`apps/client/src/render/chestSprites.ts`) draws each chest as a sprite at its sim position, through the
same render boundary and origin as the other props (the soles row on its sim position, snapped to the sheet's art
grid), y-sorted with the bodies by that line (§8, draw order), its frame from `opened` on the client clock like the tile doors (§10, the shared
`opening.ts` helper): `closed` loops at the sheet's rate (still with 1 frame); `opened` turning true plays `opening`
once, then `open` holds. The engine draws nothing of its own over the chest (any glint is ART's, in `closed`); the
grounding shadow stays the engine's, under it. The sheet is one of the client's sprite sheets (`SPRITE_SHEET_NAMES`),
loaded with the characters, and the only chest there is (M1's procedural chest went with the v1 path, G1.5g).
`window.__iot.chestFrames()` reads the frames; the client tests use the fixture `packages/shared/test/fixtures/prop-chest.*`
(made by the `.py` beside it; it never ships).

## 5. The JSON contract

Phaser 3 **JSON Hash atlas** (`this.load.atlas(key, png, json)`) with two extra top-level blocks the engine reads itself: `anims` and `palette`. Frame names: `<anim>_<FACING>_<n>` for the Kindled and NPCs, `<anim>_<n>` for Husks and props; `n` counts from 0.

```json
{
  "frames": {
    "walk_S_0": { "frame": { "x": 0, "y": 80, "w": 96, "h": 80 }, "rotated": false, "trimmed": false,
                  "spriteSourceSize": { "x": 0, "y": 0, "w": 96, "h": 80 }, "sourceSize": { "w": 96, "h": 80 },
                  "anchor": { "x": 0.5, "y": 0.8 } }
  },
  "meta": { "image": "kindled-ash.png", "size": { "w": 768, "h": 2960 }, "scale": "1", "format": "RGBA8888",
            "app": "iot-art-pipeline", "version": "2", "pixelScale": 1, "cell": { "w": 96, "h": 80 }, "origin": { "x": 48, "y": 64 },
            "facings": ["S", "SE", "E", "NE", "N", "NW", "W", "SW"] },
  "anims": {
    "walk_S": { "frames": ["walk_S_0", "walk_S_1", "walk_S_2", "walk_S_3", "walk_S_4", "walk_S_5"], "frameRate": 10, "repeat": -1 },
    "heavy_charge_E": { "frames": ["heavy_charge_E_0", "heavy_charge_E_1", "heavy_charge_E_2"], "frameRate": 12, "repeat": 0, "hold": true }
  },
  "palette": {
    "drawn": "clay-grey-ochre",
    "mask": "kindled-ash.skin.png",
    "swaps": { "clay-pale": { "#8c7f6e": "#e8e2d6", "#5e5448": "#8c7f6e" },
               "clay-red": { "#8c7f6e": "#c98f78", "#5e5448": "#9c5b4a" },
               "clay-river-dark": { "#8c7f6e": "#5e5448", "#5e5448": "#2a2540" } }
  }
}
```

- `anims[*].frames` lists frame names in order; `repeat` −1 loops, 0 plays once; `hold: true` keeps the last frame; `frameRate` in fps. The engine builds Phaser animations from this block at load (`this.anims.create` per entry) and names them `<key>/<anim>` so `kindled-ash/walk_S` cannot collide with `husk-peeling/walk`.
- `anchor` is the origin as a fraction of the cell (Phaser's `setOrigin`); `meta.origin` repeats it in pixels for tests.
- `palette.swaps` maps the drawn tone's hex values to each other tone's (skin, skin shade; the freckle colour never swaps). The engine builds a tone's texture the first time the tone is used and caches it.
- Husk sheets carry no `facings` and no `palette`; their telegraph frames are pre-tinted.

### v2 (G1.5)

The contract's version, the only one the engine loads (`SPRITE_SHEET_VERSION`); the §6 test rejects a sheet that is not it.

- **Meta.** `meta.version: "2"` and `meta.pixelScale: 1` (world px per sheet px; the test holds it at 1, and the engine draws every sprite sheet at 1).
- **Cells.** The §2 table, by kind.
- **Colours.** Only the 28-colour whitelist: `palette.json`'s tokens minus spark-glow and the three signal colours (`SPRITE_WHITELIST`, derived in code; `palette.json` changes only through art PRs). The two telegraph colours are allowed only in `telegraph*` frames. `#FFFFFF` and `#FFE7A3` never appear.
- **Skin mask.** The grey-ochre skin ramp (unwritten-sail, unwritten-tar) is shared with wood, rope, belts, boots and the singe's shade; in the 45 px exemplar the belt and both boots are unwritten-tar, so a plain colour swap would recolour them with the skin. A Kindled sheet ships `<name>.skin.png`, the same size as the sheet, an opaque pixel marking skin, and names it in `palette.mask`. The engine swaps `palette.swaps` only under the mask; there is no other swap.

```json
"meta": { "image": "kindled-ash.png", "version": "2", "pixelScale": 1, "cell": { "w": 96, "h": 80 }, "origin": { "x": 48, "y": 64 }, "...": "..." },
"palette": { "drawn": "clay-grey-ochre", "mask": "kindled-ash.skin.png", "swaps": { "clay-pale": { "#8c7f6e": "#e8e2d6", "#5e5448": "#8c7f6e" }, "...": {} } }
```

- **Points (G1.5d).** A frame may carry `points`: named pixel positions in the frame's cell, `[x, y]` from the
  cell's top left, where the engine attaches its effects. ART writes them in the recipe (`points` in
  [`art-pipeline.md`](art-pipeline.md)) and the pipeline places each with its frame, so they move whenever ART
  redraws one; no table of offsets lives in code.

  ```json
  "heavy_charge_S_2": { "frame": { "x": 0, "y": 0, "w": 96, "h": 80 }, "...": "...", "points": { "tip": [31, 42] } }
  ```

  The names and where they go are in `packages/shared/src/sprites.ts` (`KINDLED_POINTS`, `KINDLED_POINT_ANIMS`):

  | Point | What | Required on every frame and facing of |
  |---|---|---|
  | `tip` | the hook's tip: the charge spark | `heavy_charge` |
  | `hand` | the hand the Haul chain leaves from | `haul_throw`, `haul_pull`, `haul_slide`, `haul_recover` |

  - Allowed nowhere else for now, and only on Kindled sheets. A finished Kindled sheet has every required
    point; an unknown name, a point on another frame, or one outside the cell or on its outer 1 px ring fails.
  - So every frame the engine attaches an effect to has its point. The one frame it shows over a charge or a
    Haul that has none, the hit flinch after an armored hit (100 ms), keeps the effect where the action last drew
    it (§8); `hit` frames carry no points.

### Engine sheets

The cell sheets the engine draws its own effects from, next to the sprites in `packages/shared/assets/`:
`controller-glyphs` and `hookblade-fx` (chain link, hook, charge spark). Each is a PNG plus a JSON of named
`cells` (`{ name, x, y, w, h }`), checked by `packages/shared/test/sheets.test.ts`. `hookblade-fx.json` also
carries its anims (`charge_spark`), `chain` (`link`, `taut`, `spacing`) and `hook` (`flight`, `set`, `origin`),
and a `meta` block (`engineSheetMeta` in `packages/shared/src/sheets.ts`):

```json
"meta": { "version": "1", "pixelScale": 2 }
```

| Key | Meaning | Default |
|---|---|---|
| `version` | `"1"` for M1's sheet, `"2"` for a B sheet | `"1"` |
| `pixelScale` | world px per sheet px | `2` |
| `tinted` | `true`: white shapes the engine tints at draw time, with a rim of four offset copies in the player outline. `false`: the frames are drawn in their own colours, no tint and no rim (ART draws the colours and outline in) | `true` |

- A sheet without `meta` reads as `{ "version": "1", "pixelScale": 2, "tinted": true }`, today's drawing.
- Every number in the sheet is in sheet px: the cells, `hook.origin` and `chain.spacing`. The engine multiplies by
  `pixelScale` for world px (a link every `spacing × pixelScale` world px), which at 2 is exactly M1's drawing.
- A tinted sheet is white on transparent only. An untinted one is checked like a v2 sprite: the 28-colour
  whitelist, no telegraph colours, no `#FFFFFF` and no `#FFE7A3`.
- ART's B redraw of hookblade-fx lands as an asset-only PR: a new PNG and JSON with `"version": "2"` and
  `"pixelScale": 1` (and `"tinted": false` if it is drawn in colour), and no engine change. The sheet test runs both
  kinds; `packages/shared/test/fixtures/hookblade-fixture.*` (made by the `.py` beside it) is an untinted B sheet
  that stands in until then.

## 6. Test (the pattern from PR #8)

For every sheet on disk in `packages/shared/assets/sprites/` (the test lists the folder: every `<name>.json`
with its `<name>.png`; a JSON with no PNG, a PNG with no JSON, or a mask no sheet names fails). `SPRITE_SHEET_NAMES`
is the client's load list: every name in it must be on disk, but a sheet on disk need not be in it yet (the M2
tasks register NPC sheets as they use them). Every name must have a known kind (§4).

1. `meta.image` exists; the PNG's size equals `meta.size`; width and height are multiples of the cell.
2. Every `frames[*].frame` lies inside the PNG and on the cell grid; `w`/`h` equal the cell.
3. Every name in every `anims[*].frames` exists in `frames`; every frame belongs to at least one anim.
4. Every sheet carries its kind's table (§4), and nothing else: every animation up to `REQUIRED_MILESTONE`, for every
   facing it lists (Kindled and NPCs, which also carry `meta.facings`; Husks and props have none), with the table's
   frame count, rate, loop and hold; a later (optional) animation is either absent or complete the same way; a row
   the recipe rates (a prop's `idle`, the chest's `closed`) has its frame count within its range (`tableProblems`
   on the table `propTableFor` resolves from the sheet). Husk `telegraph` frames are pre-tinted. Only Kindled sheets have a palette
   block. `anchor` matches `meta.origin / cell`.
5. Every opaque pixel's colour is in the 32-colour palette (tokens.json), the telegraph colours only in `telegraph_*` frames, #FFFFFF nowhere.
6. Every `palette.swaps` key is one of the four clay tones and every swapped hex occurs in the PNG.
7. Every sheet is version "2" and has `meta.app` `"iot-art-pipeline"`. A v1 sheet (version "1", M1's placeholders)
   fails with "v1 sprite sheets are retired; build it through the pipeline", and the test checks no v1 rule any more.
   Besides (`packages/shared/test/sheetChecks.ts`):
   - the cell and origin match its kind (§2), and `meta.pixelScale` is 1;
   - no opaque pixel lies on a cell's outer 1 px ring, so nothing was clipped;
   - colours follow §5: the whitelist, the telegraph colours only in `telegraph*` frames, #FFFFFF and #FFE7A3 nowhere;
   - a sheet with a palette block (every Kindled sheet) has its mask: it exists, has the sheet's size, is opaque only on pixels whose colour is a swap key, and every swap key has at least one masked pixel.
8. Points (§5, `pointProblems` in `sheetChecks.ts`): every point is a known name (`tip`, `hand`), on a frame whose
   animation carries it, two whole pixels inside the cell and off its outer 1 px ring; a finished sheet has every
   required point on every frame of `heavy_charge` and the four `haul_*` animations.

9. A tile sheet (`tiles-<set>`, §10; `tileSheetProblems` in `packages/shared/test/tileChecks.ts`) skips 1–8 and has
   its own checks: meta `version` "2", `pixelScale` 1 and `app` `"iot-art-pipeline"`, the PNG the size of
   `meta.size`; the set read from its `tiles` block (`rule` cave or shore, absent cave; `doors` a boolean, absent
   true); every piece of its rule and, with doors, every door frame of `packages/shared/src/tiles.ts` present at
   its size (32×32, 64×32, 32×64), inside the PNG, on no other frame, and nothing else (a doorless set carries no
   door frame or animation, a set none of the other rule's pieces); each door's `_closed` (1 frame), `_opening`
   (6 frames at 12 fps) and `_open` (1 frame), played once and held; the `tiles` block, `tileSize` 32,
   `floorWeights` four positive integers and, when present, the mid weights of its rule (`faceMidWeights` and
   `topMidWeights` on a cave set, `dropMidWeights` on a shore set) two positive integers each; only the
   whitelist's colours (no telegraph colours, never #FFFFFF or #FFE7A3) and no soft alpha; each piece's opacity:
   `floor_*`, `face_*`, `top_*` and every door frame fully opaque, `drop_mid_*`, `drop_w`, `drop_e` and `drop_we`
   opaque in their top row. They run on every tile sheet on disk (`tiles-cave`, `tiles-holding`), and on
   `packages/shared/test/fixtures/tiles-fixture.*` (made by the `.py` beside it) and broken copies of it, the
   fixture declared a shore or doorless set among them.

The v2 checks also run on a small fixture sheet with a mask (`packages/shared/test/fixtures/kindled-fixture.*`, made by the `.py` beside it; it doesn't ship), and on broken copies of it (a v1 copy among them), so the checks themselves are tested. The client tests its masked swap on the same fixture, and the point checks run on copies of it with `heavy_charge` and `haul_throw` frames. The chest's table runs the same way on `packages/shared/test/fixtures/prop-chest.*` (a 2-frame `closed`) and copies of it (a 1-frame `closed` passes, a 3-frame one fails, a finished chest without `opening` fails).

## 7. Delivery order

1. `kindled-ash` (the first-hour default) with idle, walk, dodge, light_1–3, heavy_*, haul_*, hit, death — this unblocks M1 task 3.
2. `husk-peeling`, `husk-nutshell`.
3. `kindled-clay`, `-tide`, `-wing` (same frames, outfit redrawn), then carry and sit.

## 8. Engine (how the sheets load and animate)

What `apps/client` does with a sheet (MAIN, M1 task 5). Nothing here is in the sheets: a redrawn sheet that follows §2–§5 replaces the old one with no engine change.

- **Loading.** `apps/client/src/render/spriteSheets.ts`: every sheet the client uses (`SPRITE_SHEET_NAMES` in `packages/shared/src/sprites.ts`: `kindled-ash`, `husk-peeling`, `husk-nutshell`, `prop-chest`) is bundled with the code and loads as a Phaser JSON Hash atlas (`load.atlas(name, png, json)`), keyed by its file name, a Kindled sheet with its skin mask. An optional sheet (`OPTIONAL_SPRITE_SHEETS`: `prop-sparkglass`, §4) loads the same way when its JSON and PNG were on disk at build time, and the engine draws its fallback otherwise. The tile sheet (`tiles-cave`, `caveTileSheet`) loads the same way from `roomTiles.ts`. A sheet whose PNG is not there is an error at load; there is no fallback drawing for anything (G1.5g). The frames' `anchor` becomes the sprite origin, so a sprite is placed at the point between its feet (the sim's position is the body centre; the engine adds the feet offset, 5 sim px for the Kindled, the radius for a Husk, where the grounding shadow sits).
- **Scale.** The world renders at 2× (`WORLD_PX_PER_UNIT`): sprite positions are the sim's ×2 in world px, each on a whole world px. Every sheet draws at 1 world px per sheet px: the sprites and the chest (`meta.pixelScale` 1, held there by §6), the tile sheet (§10) and hookblade-fx (at its own `meta.pixelScale`, 1 for ART's B sheet; "Engine sheets" in §5). The engine's own drawings (the slash arc, the thrust line, particles, the perfect-dodge trail's rim, the grounding shadow, poise bars, the pad reticle, the Haul guide) are at the same density, 1 world px per pixel (`apps/client/src/render/scale.ts`); the hit flash is a fill tint of the sprite, so it is the sprite's own pixels. Only the F3 debug overlay, M1's hitbox figures, is drawn in sim px and scaled.
- **Animations.** One Phaser animation per entry of the JSON `anims` block, named `<key>/<anim>` (`kindled-ash/walk_S`, `husk-peeling/telegraph`), with its `frameRate` and `repeat`. They exist for tooling; in play the frame is chosen directly (below), so hitstop, slow-mo and the sim's windows stay exact.
- **Draw order (G1.5h).** Every y-sorted world sprite in the bodies layer sorts by one key, the line it stands on, in sim px (`groundLine` in `apps/client/src/render/feet.ts`, used by `bodyDepth` at every `setDepth` of the layer): the Kindled's feet (`y + PLAYER_FEET`), a Husk's feet (`y + radius`, the same `huskFeet` that places it), a chest's position, which is already its base. Before, bodies sorted by the sim's body centre, 5 px above the Kindled's feet and a radius above a Husk's, while the chest sorted by its base, so the Kindled standing just in front of a chest still drew behind it. The depth is the ground line's whole world px row (the row the sprite is drawn on, `snapToArt`) per `DEPTH.perPixel`; two bodies on the same row are a tie and keep today's order, from under to over: a Husk, the Kindled, a chest (so the Kindled still draws over a Husk on its line, and a chest over a Kindled whose feet are on its base). The tie rank is a fraction of a world px, so it never beats a real difference in the line. Nothing else sorts in the layer: a Husk's corpse keeps the depth of its last living frame, the perfect-dodge afterimages sit under the bodies on `DEPTH.trail`, the chain under them and the hook head, the spark and the bars over them on the overlay depths. It changes only the draw order, never a position (`feet.test.ts`).
- **Palette swaps.** For a Kindled sheet the engine builds a tone's texture the first time that tone is used (`toneTextureKey`): the drawn sheet's pixels are copied with each `from → to` hex replaced under the skin mask (`toneSwap.ts`) and registered as the same atlas under `<key>@<tone>` (`kindled-ash@clay-red`) with its own `<key>@<tone>/<anim>` animations, cached game-wide; tones never used are never built. `window.__iot.setClayTone(tone)` switches the Kindled in a run.
- **The state machine** (`apps/client/src/render/animState.ts`, pure and tested in node) maps sim state to a frame every render frame; the client never decides gameplay. The Kindled:
  - `idle`, or `run` while the body moves faster than a quarter sim px a tick, facing the nearest of the 8 facings to the aim, with `run_start` and `run_stop` between them and `run_back` for a backpedal where the sheet has them (below). In an encounter, Combat and Calm alike, the Kindled always runs (GAME DESIGN 2026-10-16); while `run` is on `ANIMS_AWAITING_ART` (§4) and a sheet lacks it, `walk` plays in its place, at the run's cycle. `walk` at its own cycle (`gaitPose(sheet, 'walk', …)`) is kept for M2's holding, where walking happens;
  - `dodge` over the dodge window (crouch in the startup, the two roll frames over the active ticks, recover over the recovery);
  - `light_1..3` by combo step: wind-up / swing / recover over the strike's startup / active / recovery;
  - `heavy_charge` while charging, at the sheet's rate, holding the last frame → `heavy_thrust` over startup + active → `heavy_hold` from the tick the thrust pins a Husk until the pin ends (through the hitstop) → `heavy_recover` over the rest of the recovery;
  - `haul_throw` (the arm out over the startup, the last frame only while the hook flies), `haul_pull` while the chain pulls a Husk, `haul_slide` while it pulls the player, then `haul_recover` over the recovery (its first frame while the active ticks run out after a miss);
  - `hit` through the hurt stun (180 ms): frame 0, the flinch, for the first 100 ms, frame 1, the stagger, held to the end of the stun; frame 0 alone for 100 ms after an armored hit that does not stun; `death` at the sheet's rate once the sim has stopped (a client clock, the only one besides the armored hit frame and the Nutshell regrow);
  - an animation with fewer facings than 8 takes the nearest it has: diagonals go to the nearest of the 4 (ties clockwise: SE→S, NE→E, NW→N, SW→W), `sit` to S or E. Attacks, the dodge and the Haul face the direction the sim locked at their start; idle, charge and the hit face the aim.
  - `carry_*` and `sit` have no sim state yet (hour two, M2), so the engine never asks for them and a finished M1 sheet may leave them out (§4, milestones; `animState.test.ts` plays a run on a sheet without them).
- **Timing.** The sim's move windows are the authority: an animation with a window is stretched or cut to its ticks. Its frames are split between the phases by fixed shares (lights 1:1:1, dodge 1:2:1, thrust 1:1 over startup and active) and spread evenly inside each phase, so a sheet may change a frame count without touching the engine. Loops and one-shots count sim ticks at the sheet's `frameRate`, so they freeze in hitstop and slow with slow-mo.
- **Walk and run play by distance (G1.5c).** The Kindled's `walk`, `run` and `run_back` pick their frame from how far the body has moved, not from time: `frame = floor(distance / cyclePx × frames) mod frames`, with `cyclePx` from the `anim` block of `tuning.json`, in world px per full cycle: `walkCyclePx` 64, `runCyclePx` 96, `backCyclePx` 48 (GAME DESIGN's and ART's numbers; feel values like `juice`, which ART may ask to adjust to the sheet, and live in F2). The distance is the world px between the interpolated render positions the client already has (`StrideMeter`, `apps/client/src/render/stride.ts`), summed for the whole session: it keeps growing through stops, so a restart carries on the cycle instead of popping to frame 0, and it stands still when the body does (a wall, hitstop). It only picks a frame; the sim moves the body. The `walk` that stands in for `run` plays at `runCyclePx`. At moveSpeed 100 (200 world px/s) a run cycle takes 0.48 s. Every other animation keeps its timing above, and the Nutshell's `walk` stays time-based (by design).
- **The backpedal (G1.5h, `run_back` in the M1 polish).** Aim and movement are separate, so the Kindled often runs away from where it faces (facing E while moving W), and a forward run cycle strides the wrong way. While it runs, the engine compares the movement direction with the facing, the aim: above 112.5° apart it backpedals, so the movement in the three facings opposite the aim; it runs forwards again below 100° (`backpedals`, `BACKPEDAL_ON_DEG` / `BACKPEDAL_OFF_DEG` in `animState.ts`). The gap is hysteresis: a stick held near the boundary does not flicker. Strafing, about 90°, plays forwards. A backpedal plays `run_back` when the sheet has it (ART 2026-10-17): forwards, by distance, one cycle per `anim.backCyclePx` (48 world px, 12 a frame), from the same distance the run uses; on a sheet without it (a fixture) the run cycle plays backwards, frame `n − 1 − f` for the distance-driven frame `f` (`backpedalFrame`). The facing stays the aim's, and the distance cycle carries on through a stop as before. The movement direction comes from the same interpolated render positions the `StrideMeter` sums (`headingDeg`, the last step that moved), not from a sim input. Only the Kindled's `run` gait backpedals (`walk` standing in for it reverses with it); `walk` for its own sake and the Nutshell's walk stay as they are. The backpedal's cost in speed is the sim's (`combat.md` §2, GAME DESIGN 2026-10-17).
- **Run transitions (M1 polish, ART 2026-10-17).** `run_start` plays once (2 frames at 20 fps, 100 ms) when the Kindled starts moving from idle, then `run` (or `run_back`) takes over at the run's current distance phase; `run_stop` plays once (100 ms) when it stops, then `idle`. Both by time, counted in sim ticks from the tick the start or the stop began (`GaitClock` in `animState.ts`, fed every render frame; the ms reach `kindledPose` as `clocks.runStartMs` / `runStopMs`), so they slow with slow-mo and replay the same. Visual only: the sim never waits for them. If the Kindled turns (its 8-way facing changes), attacks, dodges, is hurt or dies during a transition, it ends at once and the right animation plays; stopping during `run_start` plays `run_stop`, starting during `run_stop` plays `run_start`. A move that ends with the body already moving starts no `run_start`. A transition into a backpedal uses `run_start` too. While the rows await art and a sheet lacks them, the run and idle switch directly, as before.
- **Husks.** `spawn` stretched over the spawn-in (`spawnMs`), the engine's ring under it, the Husk not awake until it ends; `idle`; the Nutshell's `walk` by velocity while it chases whole (a chipped Nutshell keeps its chipped frame); `telegraph` through the wind-up, blinking with the resting frame while the attack still tracks the player and solid once it has locked (the sheet's pre-tinted frames are the telegraph colour); `lunge` stretch and hit over the Peeling's active ticks, settle through its recovery; the Nutshell's `slam`, frame 0 over the first half of its active ticks and frame 1 over the second, held through the recovery; `hit` for 100 ms after a hit; `chipped` / `chipped_outer` / `chipped_inner` once shell layers are gone; `regrow` as a one-shot on the regrow event; `death` then `drop` (250 ms) on a transient kept after the sim removes the Husk, where the engine's Sparkglass pickups fly out. `flipX` when a Husk moves or lunges west.
- **Effects stay in the engine:** the grounding shadow (20×6 world px under a Kindled, a Husk's scaled by its radius against the player's), the white hit flash (a fill tint for `juice.hitFlashFrames`), chips and the core flare as particles, the slash arc and thrust line (hitbox flashes; nothing in a light's wind-up, where the sheet draws its own blade), poise bars, the perfect-dodge trail (the sprite's frame as spark-glow afterimages over a 1 px hollow-deep rim) and the Hookblade FX (chain, hook, charge spark).
- **The Hookblade's points.** The charge spark is drawn at the current frame's `tip`, and the Haul chain starts at its `hand` (§5). A point maps to the world like the frame itself: `world = the anchor the sprite is drawn at + (point − cell origin) × pixelScale`, in world px, with the anchor and rounding the sprite uses, so the spark and the chain move with the sprite pixel for pixel. The spark, the chain's links and the hook are placed at whole world px; the hook head stays at the sim's hook position (or the hooked Husk's). Every frame of those animations has its point (§6); the one frame shown over a charge or a Haul without one, the hit flinch for 100 ms after an armored hit, keeps the last point drawn in the same action, as an offset from the sprite's anchor so it moves with the Kindled (`HookbladeAnchors` in `apps/client/src/render/hookbladePoints.ts`; the memory clears when the action changes), and an action with no earlier point puts the effect on the body centre (`bodyCentre`). The player's sheet is named in one place, `PLAYER_SHEET` (`CharacterSprites.playerSheet`, `apps/client/src/render/characters.ts`), which these lookups read.
- **F3** draws the old placeholder hitbox shapes over the sprites (with the stats overlay); `window.__iot.setDebugShapes(on)` does the same from the console.
- **Palette.** `packages/shared/data/palette.json` holds the design system's 32 raw colours (`tokens`, copied from its `tokens.json`; role tokens like `ui-ink` are aliases and stay out) and the four clay tones. It changes only through an art/ PR; the sheet test and the client's `palette.ts` read it.
- **History.** M1's three sheets were v1 placeholders (`meta.version` "1", 48×40 / 24×24 / 40×40 cells drawn at 2 world px per sheet px, made by a Python script in `tools/`); G1.5 replaced them one by one with B sheets through the pipeline, and G1.5g retired the v1 path, the procedural room and chest and the placeholder script, so the §6 test now rejects a v1 sheet.
- **Tests and shots.** `packages/shared/test/sprites.test.ts` is the test of §6; `tools/screenshots.mjs` takes the reference shots in `docs/screenshots/m1-task5/` and `tools/screenshots-task7.mjs` those in `docs/screenshots/m1-task7/` (spawn, Haul throw → recover, the Nutshell's walk and slam, the hit flinch → stagger) through the `window.__iot` playtest hooks (`setInputSource`, `setSpeed`, `pose`). Those scripts, like the other M1 and M2 ones (`tools/screenshots-task*.mjs`, `tools/screenshots-m2-*.mjs`), assume M1's 480 × 270 canvas at a CSS zoom and no longer run as-is since G1.5; `tools/screenshots-g15.mjs` takes the current shots (`docs/screenshots/g15/`, `g15e/`, `g15g/`).

## 9. Answers to the PR #12 questions (ART, 2026-10-13)

Done: §4 carries the answers (Husk `spawn`, `haul_recover`, the 2-frame `hit`, the Nutshell's `walk` and `slam` in place of `roll`, `heavy_hold` through the hitstop as the engine already did), §8 describes the engine that plays them, and the lists in `packages/shared/src/sprites.ts` and `animState.ts` match (M1 task 7). The hand-drawn `kindled-ash`, `husk-peeling` and `husk-nutshell` sheets follow this contract.

## 10. Tiles (G1.5e, M2 Task 3c)

The room is drawn from a tile sheet: named 32×32 world px pieces, one per room cell, chosen by a 4-neighbour rule
(ART's design, B). Not a 16-tile corner set: a corner set can't draw a wall's front face, and on a dual grid its
transitions straddle the sim's collision edges; named pieces sit exactly on the sim's 16 sim px cells. The names,
sizes and the rules are in `packages/shared/src/tiles.ts`; `tileAt(template, col, row, weights)` is a pure
function with no runtime dependencies (`weights` is the sheet's `tiles` block), so the engine and the art
pipeline's review (`rooms.png`) draw a room the same way.

**Two rules** (M2 Task 3c, ART 2026-10-18). A tile set declares its rule in its `tiles` block, `"rule": "cave" |
"shore"`, defaulting to `"cave"`; `tileAt` dispatches on it. The **cave** rule draws walls rising from the floor: a
solid cell with open ground to its south is a wall face. It suits the rooms of `rooms.json` (`tiles-cave`, ART's
first sheet). For an island seen at a low ¾ angle it draws backwards (the north edge would show a cliff rising,
the south edge the Hollow's dark tops), so an island uses the **shore** rule: the ground draws floors with lips
where the void is beside it, and the void cell under a ground cell draws the drop, the cliff hanging below the
island into the Hollow; every other void cell draws nothing, so the Hollow shows through. The holding's
`tiles-holding` is a shore set. The two rules share the floors and the hash; each has its own pieces, and a set
carries only its rule's (`staticTilePieces(rule)`, `tileFramesFor(set)`).

**Doors are optional** per set (`"doors": true | false`, default true). A set with `"doors": false` carries no
door piece: the sheet test and the pipeline require none and refuse any present, and a template with a `D`
drawn with such a set fails, naming the template (`doorlessProblems`, through `roomTiles`). `tiles-cave` keeps
its doors; `tiles-holding` has none.

### The cave rule

**Cells.** From the template legend (`rooms.json`): `#`, `o` and `D` are solid (a door counts as wall for its
neighbours and draws its own piece), and so is every cell outside the room (and past a short row's end). Everything
else is open: `.`, `P`, `S` and `C` draw as plain floor. The chest is a sprite from ART's `prop-chest` (§4, "The
chest").

**The rule.** Everything draws under the sprites. Open sides in a name are always in the order n, w, e.

| Cell | Piece | Overlays, stacked in this order |
|---|---|---|
| open | `floor_0` … `floor_3`, by an integer hash of (template name, col, row) weighted by the sheet's `floorWeights`; no `Math.random`, so a room always looks the same | `shade_n`, `shade_w`, `shade_e` where that neighbour is solid; `shade_nw` where NW is solid and N and W are both open, `shade_ne` the same way. No south shade |
| solid, not a door, S open: a wall face (the bottom 24 px the face, the top 8 px the cap) | `face_` + the open sides among N, W, E: `face_n`, `face_w`, `face_e`, `face_nw`, `face_ne`, `face_we`, `face_nwe`; with none open `face_mid_0` or `face_mid_1` by the hash weighted by the sheet's `faceMidWeights` (the second is ART's repeat variant) | none |
| solid, not a door, S solid: a wall top | `top_` + the open sides the same way (`top_n` … `top_nwe`); with none open `top_mid_0` or `top_mid_1` by the hash weighted by `topMidWeights` (the spare plain top for thick masses) | `corner_nw` where N and W are solid and NW is open, `corner_ne` the same way |
| `D` | its door, below | |

**Doors**, by the wall the door's two cells sit in: `door_n` (64×32) covers a `DD` in the north wall (row 0),
`door_w` and `door_e` (32×64) a vertical `DD` in the west or east wall. Each has three animations: `<door>_closed`
(1 frame), `<door>_opening` (6 frames, played once at 12 fps when the client sees `doorOpen` turn true; ART may ask
to change the rate) and `<door>_open` (1 frame, held). The open frame draws the passage floor itself; a room that
loads with the door already open shows `_open`. No template has a south door: a `D` the rule can't place (a south
door, a single `D` or a longer run, a pair away from the border) fails the test over `rooms.json` with the
template's name (`tileDoors`), so a new template that needs a new piece is caught early.

**The cave set's pieces:** the four floors, the five shades, the nine faces, the nine tops, the two corners
(`CAVE_STATIC_PIECES`, 29) and, with doors, the three doors' 24 frames. `floor_*`, `face_*`, `top_*` and every door
frame are fully opaque; shades and corners may be transparent.

### The shore rule (ART 2026-10-18)

**Ground and void.** Ground is every cell that isn't the island's edge or outside the template; the station letters
of a holding layout (`W`, `T`, `R`, `S`, the start `P`) are ground for drawing, though solid for collision (the sim's
collision doesn't change). Void is the edge (`#`) and everything outside.

| Cell | Piece | Overlays, stacked in this order |
|---|---|---|
| ground | `floor_0` … `floor_3`, by the same hash and `floorWeights`; no shades on a shore set | the **lips**, each the outline and a lit rim with no face: `lip_n` where the void is north (the island's back edge, which simply ends), `lip_w` and `lip_e` where it is west or east, `lip_nw` where NW is void while N and W are ground (an inner corner), `lip_ne` the same way. No south lip: the drop below covers it |
| void with ground directly north: a **drop**, the cliff hanging below the island | `drop_mid_0` or `drop_mid_1` where both the W and E neighbours are drops too, by the hash weighted by `dropMidWeights` (default `[1, 1]`; `tiles-holding` sets `[3, 1]`); `drop_w` where the cliff ends on its west side (the W neighbour isn't a drop), `drop_e` the same way, `drop_we` when both ends do (a one-cell drop) | none |
| void with no ground north, west of a run's west end: an **outer corner** | `drop_corner_w` where NE is ground and the E neighbour is a drop, the cliff turning round the corner west of the run; `drop_corner_e` where NW is ground and the W neighbour is a drop. A void cell beside a straight west or east edge has ground at NE or NW too, but no run to turn round, and draws nothing | none |
| void with ground at both NW and NE but not N | a one-cell notch the pieces can't draw: the layout validator refuses it, naming the cell (`shoreProblems`), so a layout never needs it; `tileAt` draws nothing there | |
| every other void cell | nothing: the Hollow shows through (the room texture is transparent there, over the hollow background) | |

**The shore set's pieces** (`SHORE_STATIC_PIECES`, 16): the four floors; the drops `drop_mid_0`, `drop_mid_1`,
`drop_w`, `drop_e`, `drop_we`, `drop_corner_w`, `drop_corner_e`; the lips `lip_n`, `lip_w`, `lip_e`, `lip_nw`,
`lip_ne`. **Opacity:** the floors are fully opaque; `drop_mid_*`, `drop_w`, `drop_e` and `drop_we` are opaque in
their top row, where they meet the floor above, while the dither into hollow-deep below may end in transparent
rows; the two outer corners have void to their north and may be transparent anywhere; the lips are transparent
overlays. The pipeline and the sheet test check each piece's opacity (`TileOpacity` in `tiles.ts`).

### The sheet

The JSON shape of the other sheets: named frames (`floor_0`, `door_n_opening_3`), each `frame`
its size, `anchor` (0, 0); door animations under `anims` (`door_n_opening`: its frames, `frameRate`, `repeat` 0,
`hold`; none on a doorless set); `meta` with `"version": "2"` and `"pixelScale": 1`; and a `tiles` block:

```json
"tiles": { "tileSize": 32, "floorWeights": [6, 3, 2, 1], "faceMidWeights": [3, 1], "topMidWeights": [3, 1] }
"tiles": { "tileSize": 32, "floorWeights": [6, 3, 2, 1], "rule": "shore", "doors": false, "dropMidWeights": [3, 1] }
```

`floorWeights` lives in the sheet, never in code, and so do `faceMidWeights` and `topMidWeights` (G1.5f, ART's
answer to G1.5e: at 50/50 the spare plain face and top read as a pattern) and the shore's `dropMidWeights`: two
positive integers each, the weights of `*_mid_0` and `*_mid_1`, picked through the same hash and `pickWeighted` as
the floors; absent means `[1, 1]`, the even pick, so a sheet without them draws as before. ART's `tiles-cave` uses
`[3, 1]` for both wall weights. `rule` and `doors` are written only when they are not the defaults (cave, true), so a
cave set's block reads as before. Colours: the 28-colour whitelist only, no telegraph colours, never #FFFFFF or
#FFE7A3. Checked by §6 item 9.

**The engine** (`apps/client/src/render/roomTiles.ts`). The room's static pieces are drawn once per room into a texture on the world layer at `DEPTH.room`, a cell (c, r) at world (c × 32,
r × 32), no piece scaled; the texture is made anew at each room's size and the last room's destroyed (resizing one leaves its GPU target at the first room's size and clips a larger room, G1.5i;
`tools/screenshots-g15.mjs --room-changes` checks the texture after each change); the doors are images over it (`DEPTH.roomDoors`) whose frame comes from the state's
`doorOpen` on the client clock (the client only renders it; a doorless set places none). Depth, camera clamping and the hollow margin around
the room are unchanged; a shore set's void draws nothing, so the hollow background shows through it. The sheets are bundled with the code (`caveTileSheet`, `holdingTileSheet`) and their PNGs load with the sprite
sheets; a missing PNG is the same error as a missing sprite sheet's. There is no other room: M1's procedural room
went with the v1 path (G1.5g). `tools/screenshots-g15.mjs --rooms` shoots the five M1 rooms from the cave set
(`docs/screenshots/g15g/`; `g15e/` has the earlier shots from the test fixture); `tools/screenshots-m2-3b.mjs` shoots
the holding from the shore set (`docs/screenshots/m2-3b/`).
