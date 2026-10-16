# Sprite sheets

The contract for every animated character sheet the client loads (ART DIRECTION → MAIN, 2026-10-12). Terms: [`glossary.md`](glossary.md); drawing rules and signal colours: [`readability.md`](readability.md); the Old Letters sheet, the first asset delivered this way: [`letters.md`](letters.md). Related engine sheets already in `packages/shared/assets/`: `controller-glyphs-12px.png` + `.json` (44 cells, prompts and the controls screen) and `hookblade-fx.png` + `.json` (chain link, hook, charge spark).

How every animated character reaches the engine: a 1× PNG plus a JSON contract, like the Old Letters sheet (PR #8). This spec covers the tool, the frame grid, facings, the animation lists for M1 (Kindled, Peeling, Nutshell), frame rates, the JSON shape for Phaser, and the test MAIN commits with each sheet.

## 1. Tool (decided)

- **Hand-drawn sheets: Aseprite** (`.aseprite` source files in `packages/shared/assets/src/`, exported with `aseprite -b` to PNG + JSON). Reasons: indexed-colour mode holds the 32-colour budget, tags map one-to-one onto our animation names, the CLI export is scriptable in CI, and Phaser 3 has a native loader for its JSON. LibreSprite (free fork) exports the same format if David prefers not to buy it.
- **Generated sheets (what ART DIRECTION makes today): Python/PIL scripts** in the design workspace (ART DIRECTION's own scripts, outside the repo) that write the *same* PNG + JSON contract directly. Placeholder and concept sheets come this way; a hand-drawn Aseprite file can replace any of them without the engine noticing.
- Either way the engine only ever loads `<name>.png` + `<name>.json` from `packages/shared/assets/`. The Aseprite export is converted by a small repo script (`tools/aseprite-to-atlas`) into the contract below (Aseprite's `frameTags` become `anims`, its slice named `origin` becomes the origin). MAIN owns that script.

## 2. Frame grid

Two versions of the contract (G1.5). **v2** is option B's art (PixelLab, G1.3b): every sprite on a
64×64 canvas with the soles on row 53, drawn at 1 world px per sheet px in the 2× world. **v1** is
M1's art (the table further down), drawn at 2 world px per sheet px until its v2 version replaces
it through the G1.2 pipeline ([`art-pipeline.md`](art-pipeline.md): recipes, `pnpm art:build`, `pnpm art:check`). Heights, proportions and drawing rules belong to ART:
[`art/anchors/style-sheet.md`](../../art/anchors/style-sheet.md) (not repeated here).

### v2 cells

The engine, the §6 test and the G1.2 pipeline read these numbers from `packages/shared/src/sprites.ts`
(`SPRITE_CELLS`, `SPRITE_CANVAS`):

| Kind | Cell | Origin (the line under the soles) | The 64×64 canvas sits at |
|---|---|---|---|
| Kindled player sheets (`kindled-<rem>`) | 96×80 | (48, 64) | (16, 10), so canvas row 53 is cell row 63 |
| Every other sheet (Husks and other enemies, NPCs) | 64×64 | (32, 54) | (0, 0) |

- The Kindled's extra room is for actions: the heavy thrust, the Haul throw and the death fall. SS-01 measured
  the reach at most 34 px from the feet in any action (v3 draws actions on a 68×68 canvas, so ±34 is its
  limit), so 96 px (48 either side of the origin) holds it with room for the outer 1 px ring.
- A future kind that needs more room declares a bigger cell (`spriteCellSpec(w, h, originY)`), with
  the canvas centred horizontally and the soles on the row above the origin.
- Where a sprite stands does not come from the cell: the feet are 5 sim px below the body centre for
  the Kindled and a Husk's radius below for a Husk, ×2 in world px (`apps/client/src/render/feet.ts`).

### v1 cells (M1)

| Sheet | Cell (w×h) | Origin (x, y from the cell's top left) | Why |
|---|---|---|---|
| Kindled (`kindled-<rem>`), one per Remembrance: clay, ash, tide, wing | 48×40 | (24, 36) — the point between the feet | the body is 16×24; the Hookblade heavy reaches 22 px past the hand and Haul's throw frame holds the first chain link, so the cell is wider than the body |
| Peeling (`husk-peeling`) | 24×24 | (12, 18) | 12×9 body with room for the lunge stretch |
| Nutshell (`husk-nutshell`) | 40×40 | (20, 34) | 24×24 shell plus the roll squash |
| Later: Rind-Eel 48×32 (24, 26), Mourning Husk 40×48 (20, 44) | | | |

- Cells are a regular grid: `frame.x = col * cellW`, `frame.y = row * cellH`. No trimming, no rotation, no padding; the empty pixels are the cost of a grid the test can check by arithmetic.
- The shadow is **not** in the sheet; the engine draws it (readability.md: a navy dithered ellipse under the origin).
- Colours: v1, the 32-colour palette (design system `tokens.json`, `color`); v2, the 28-colour whitelist (§5). The Kindled sheets are drawn in the **grey-ochre** clay tone; the other three tones are palette swaps (`palette` block below), so one sheet per Remembrance, not twelve.

## 3. Facings

- Kindled: **8 facings**, in this order and spelling: `S, SE, E, NE, N, NW, W, SW`. All eight are stored (the west facings are drawn, not flipped: the Hookblade stays in the right hand, which is the far hand when facing west). A recipe may still build a facing from another facing's frames mirrored, where ART decides the action allows it (`flipX` in [`art-pipeline.md`](art-pipeline.md)); the sheet stores the result as that facing's own frames, so the engine never flips a Kindled. Idle and walk have all eight; attacks, dodge and Haul have all eight; hit, death and carry have four (`S, E, N, W`) and the engine maps diagonals to the nearest.
- Husks: **no facings**. Peelings and Nutshells are radial; the engine rotates nothing, it flips horizontally when the lunge or roll direction has a west component (`"flipX": true` is allowed for Husks only).
- NPCs (`npc-<name>`): **8 facings** in the Kindled order, for every animation; the sheet carries `meta.facings`.
- Props (`prop-<name>`): **no facings**.
- Facing names are part of the frame name: `walk_SE_3`.

## 4. Animations

**The tables live in code** (`packages/shared/src/sprites.ts`, G1.2b): `KINDLED_ANIMS`, `HUSK_TABLES` (one per Husk),
`NPC_ANIMS` and `PROP_IDLE`, each row a frame count, fps, loop, hold, facings and milestone. The tables below describe them;
if the two ever disagree, the code is the contract the sheet test and the art pipeline hold sheets to.

**Milestones (G1.2c).** Each row's `milestone` is the milestone that first uses it, and `REQUIRED_MILESTONE`
(`"M1"`) is the one a finished sheet is complete for: it carries every row at or before it, and later rows are
optional. An optional animation that is there is still complete (every facing, the right frame count). Only the
Kindled's `carry_idle`, `carry_walk` and `sit` are M2 (the Milestone column below); every other row of every
table is M1. M2 Task 9, or whichever task first uses carry or sit, moves `REQUIRED_MILESTONE` to `"M2"`.

**Awaiting art (G1.5c).** A row can be in the contract before ART has drawn it. `ANIMS_AWAITING_ART`
(`packages/shared/src/sprites.ts`, `['run']` today) lists those rows. While a row is on it, the sheet test and
the art pipeline treat it as optional, whatever its milestone, but complete when present (every facing, the
right frame count), and the engine plays its stand-in: `run` falls back to `walk` (§8). When ART's sheet lands
with the row, MAIN removes it from the list in a one-line change, and from then on the row is required like
any other at or before `REQUIRED_MILESTONE`.

**Which kind a sheet is comes from its name's prefix:** `kindled-`, `husk-`, `npc-`, `prop-`. One function,
`spriteSheetSpec(name)`, maps a name to its kind, its cell (§2) and its table; an unknown prefix fails. A later enemy
adds its own table to `HUSK_TABLES` the same way; until then only a draft of it can be built.

Frame rates are per animation; `hold` means the last frame stays until the state ends. Durations in the design tables stay the authority for timing (the engine stretches or cuts frames to fit the combat windows; the art gives the count).

### Kindled (per Remembrance sheet)

| Name | Frames | fps | Loop | Facings | Milestone | Notes |
|---|---|---|---|---|---|---|
| `idle` | 2 | 2 | yes | 8 | M1 | a breath: one pixel of chest and hood |
| `walk` | 6 | 10 | yes | 8 | M1 | the blade bobs with the hand; on a v2 sheet it plays by distance, one cycle per `anim.walkCyclePx` (64 world px, §8). In encounters the engine plays it only as `run`'s stand-in; walking for its own sake is M2's holding |
| `run` | 6 | 10 | yes | 8 | M1 | the Kindled's movement in encounters, Combat and Calm alike (GAME DESIGN 2026-10-16); plays by distance, one cycle per `anim.runCyclePx` (96 world px, §8). On `ANIMS_AWAITING_ART`: optional in a finished sheet until ART draws it, and the engine plays `walk` (at the run's cycle) in its place |
| `dodge` | 4 | 16 | no | 8 | M1 | 1 = crouch, 2–3 = the roll (body a 12×12 ball), 4 = recover; frame 2–3 are the perfect-dodge window art |
| `light_1`, `light_2`, `light_3` | 3 each | 15 | no | 8 | M1 | wind-up, swing (the arc), recover; `light_3` ends lower |
| `heavy_charge` | 3 | 12 | hold last | 8 | M1 | the drawn-back stance; the spark comes from `hookblade-fx` at the tip, not from the sheet |
| `heavy_thrust` | 2 | 20 | no | 8 | M1 | the line: hand forward, blade full length |
| `heavy_hold` | 1 | — | hold | 8 | M1 | the pin: 150 ms, the enemy on the hook |
| `heavy_recover` | 2 | 12 | no | 8 | M1 | |
| `haul_throw` | 2 | 15 | hold last | 8 | M1 | arm out; chain and hook from `hookblade-fx`; the last frame holds while the hook flies |
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

| Name | Frames | fps | Loop | Facings |
|---|---|---|---|---|
| `idle` | 1–8, from the recipe | from the recipe, default 8 | yes with more than one frame; one frame holds | none |

For flames and the like. No palette block and no mask.

## 5. The JSON contract

Phaser 3 **JSON Hash atlas** (`this.load.atlas(key, png, json)`) with two extra top-level blocks the engine reads itself: `anims` and `palette`. Frame names: `<anim>_<FACING>_<n>` for the Kindled and NPCs, `<anim>_<n>` for Husks and props; `n` counts from 0.

```json
{
  "frames": {
    "walk_S_0": { "frame": { "x": 0, "y": 40, "w": 48, "h": 40 }, "rotated": false, "trimmed": false,
                  "spriteSourceSize": { "x": 0, "y": 0, "w": 48, "h": 40 }, "sourceSize": { "w": 48, "h": 40 },
                  "anchor": { "x": 0.5, "y": 0.9 } }
  },
  "meta": { "image": "kindled-ash.png", "size": { "w": 768, "h": 1480 }, "scale": "1", "format": "RGBA8888",
            "app": "islands-of-the-one/art", "version": "1", "cell": { "w": 48, "h": 40 }, "origin": { "x": 24, "y": 36 },
            "facings": ["S", "SE", "E", "NE", "N", "NW", "W", "SW"] },
  "anims": {
    "walk_S": { "frames": ["walk_S_0", "walk_S_1", "walk_S_2", "walk_S_3", "walk_S_4", "walk_S_5"], "frameRate": 10, "repeat": -1 },
    "heavy_charge_E": { "frames": ["heavy_charge_E_0", "heavy_charge_E_1", "heavy_charge_E_2"], "frameRate": 12, "repeat": 0, "hold": true }
  },
  "palette": {
    "drawn": "clay-grey-ochre",
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

What changes from v1; the facings, the animation table, frame names, frame rates, `anims` and the shadow staying out of the sheet do not.

- **Meta.** `meta.version: "2"` and `meta.pixelScale: 1` (world px per sheet px). v1 sheets keep `"1"`, have no `pixelScale`, and draw at 2.
- **Cells.** The §2 v2 table, by kind.
- **Colours.** Only the 28-colour whitelist: `palette.json`'s tokens minus spark-glow and the three signal colours (`SPRITE_WHITELIST`, derived in code; `palette.json` changes only through art PRs). The two telegraph colours are allowed only in `telegraph*` frames. `#FFFFFF` and `#FFE7A3` never appear.
- **Skin mask.** The grey-ochre skin ramp (unwritten-sail, unwritten-tar) is shared with wood, rope, belts, boots and the singe's shade; in the 45 px exemplar the belt and both boots are unwritten-tar, so a plain colour swap would recolour them with the skin. A v2 Kindled sheet ships `<name>.skin.png`, the same size as the sheet, an opaque pixel marking skin, and names it in `palette.mask`. The engine swaps `palette.swaps` only under the mask. v1 sheets keep the whole-sheet swap.

```json
"meta": { "image": "kindled-ash.png", "version": "2", "pixelScale": 1, "cell": { "w": 96, "h": 80 }, "origin": { "x": 48, "y": 64 }, "...": "..." },
"palette": { "drawn": "clay-grey-ochre", "mask": "kindled-ash.skin.png", "swaps": { "clay-pale": { "#8c7f6e": "#e8e2d6", "#5e5448": "#8c7f6e" }, "...": {} } }
```

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
   frame count, rate, loop and hold; a later (optional) animation is either absent or complete the same way; a prop's
   `idle` has 1–8 frames. Husk `telegraph` frames are pre-tinted. Only Kindled sheets have a palette
   block. `anchor` matches `meta.origin / cell`.
5. Every opaque pixel's colour is in the 32-colour palette (tokens.json), the telegraph colours only in `telegraph_*` frames, #FFFFFF nowhere.
6. Every `palette.swaps` key is one of the four clay tones and every swapped hex occurs in the PNG.
7. A v1 sheet is version "1" with no `pixelScale` and no mask, has its M1 cell (§2) and `meta.app` `"placeholder"`.
   A v2 sheet has `meta.app` `"iot-art-pipeline"` (so `kindled-ash` turning v2 needs no test change) and (`packages/shared/test/sheetChecks.ts`):
   - the cell and origin match its kind (§2), and `meta.pixelScale` is 1;
   - no opaque pixel lies on a cell's outer 1 px ring, so nothing was clipped;
   - colours follow §5: the whitelist, the telegraph colours only in `telegraph*` frames, #FFFFFF and #FFE7A3 nowhere;
   - a sheet with a palette block (every Kindled sheet) has its mask: it exists, has the sheet's size, is opaque only on pixels whose colour is a swap key, and every swap key has at least one masked pixel.

The v2 checks run on a small fixture sheet with a mask (`packages/shared/test/fixtures/kindled-fixture.*`, made by the `.py` beside it; it doesn't ship), and on broken copies of it, so they are tested before the first v2 sheet arrives. The client tests its masked swap on the same fixture.

Until a sheet exists, Claude Code draws the placeholder from this table (a 16×24 rectangle in the Remembrance's outfit colour with the frame name under it) so the animation state machine can be built and tested now.

## 7. Delivery order

1. `kindled-ash` (the first-hour default) with idle, walk, dodge, light_1–3, heavy_*, haul_*, hit, death — this unblocks M1 task 3.
2. `husk-peeling`, `husk-nutshell`.
3. `kindled-clay`, `-tide`, `-wing` (same frames, outfit redrawn), then carry and sit.

## 8. Engine (how the sheets load and animate)

What `apps/client` does with a sheet (MAIN, M1 task 5). Nothing here is in the sheets: a hand-drawn sheet that follows §2–§5 replaces a placeholder with no engine change.

- **Loading.** `apps/client/src/render/spriteSheets.ts`: every sheet in `packages/shared/assets/sprites` (listed in `packages/shared/src/sprites.ts`) loads as a Phaser JSON Hash atlas (`load.atlas(name, png, json)`), keyed by its file name (`kindled-ash`, `husk-peeling`, `husk-nutshell`), with its skin mask when it names one. The frames' `anchor` becomes the sprite origin, so a sprite is placed at the point between its feet (the sim's position is the body centre; the engine adds the feet offset, 5 sim px for the Kindled, the radius for a Husk, where the grounding shadow sits).
- **Scale.** The world renders at 2× (`WORLD_PX_PER_UNIT`): sprite positions are the sim's ×2 in world px, each snapped to its own art grid. A sprite draws at its sheet's `pixelScale` (`sheetPixelScale`): 1 for a v2 sheet, 2 for a v1 sheet, so M1's sheets look as they did. Only M1's assets draw at 2: the three v1 sheets, hookblade-fx and the procedural room. The engine's own drawings (the slash arc, the thrust line, particles, the perfect-dodge trail's rim, the grounding shadow, poise bars, the pad reticle, the Haul guide) are at the new density, 1 world px per pixel (`apps/client/src/render/scale.ts`); the hit flash is a fill tint of the sprite, so it is the sprite's own pixels.
- **Animations.** One Phaser animation per entry of the JSON `anims` block, named `<key>/<anim>` (`kindled-ash/walk_S`, `husk-peeling/telegraph`), with its `frameRate` and `repeat`. They exist for tooling; in play the frame is chosen directly (below), so hitstop, slow-mo and the sim's windows stay exact.
- **Palette swaps.** For a Kindled sheet the engine builds a tone's texture the first time that tone is used (`toneTextureKey`): the drawn sheet's pixels are copied with each `from → to` hex replaced (`toneSwap.ts`; under the skin mask for a v2 sheet, everywhere for a v1 sheet) and registered as the same atlas under `<key>@<tone>` (`kindled-ash@clay-red`) with its own `<key>@<tone>/<anim>` animations, cached game-wide; tones never used are never built. `window.__iot.setClayTone(tone)` switches the Kindled in a run.
- **The state machine** (`apps/client/src/render/animState.ts`, pure and tested in node) maps sim state to a frame every render frame; the client never decides gameplay. The Kindled:
  - `idle` / `walk` from the body's velocity, facing the nearest of the 8 facings to the aim;
  - `dodge` over the dodge window (crouch in the startup, the two roll frames over the active ticks, recover over the recovery);
  - `light_1..3` by combo step: wind-up / swing / recover over the strike's startup / active / recovery;
  - `heavy_charge` while charging, at the sheet's rate, holding the last frame → `heavy_thrust` over startup + active → `heavy_hold` from the tick the thrust pins a Husk until the pin ends (through the hitstop) → `heavy_recover` over the rest of the recovery;
  - `haul_throw` (the arm out over the startup, the last frame only while the hook flies), `haul_pull` while the chain pulls a Husk, `haul_slide` while it pulls the player, then `haul_recover` over the recovery (its first frame while the active ticks run out after a miss);
  - `hit` through the hurt stun (180 ms): frame 0, the flinch, for the first 100 ms, frame 1, the stagger, held to the end of the stun; frame 0 alone for 100 ms after an armored hit that does not stun; `death` at the sheet's rate once the sim has stopped (a client clock, the only one besides the armored hit frame and the Nutshell regrow);
  - an animation with fewer facings than 8 takes the nearest it has: diagonals go to the nearest of the 4 (ties clockwise: SE→S, NE→E, NW→N, SW→W), `sit` to S or E. Attacks, the dodge and the Haul face the direction the sim locked at their start; idle, charge and the hit face the aim.
  - `carry_*` and `sit` have no sim state yet (hour two, M2), so the engine never asks for them and a finished M1 sheet may leave them out (§4, milestones; `animState.test.ts` plays a run on a sheet without them).
- **Timing.** The sim's move windows are the authority: an animation with a window is stretched or cut to its ticks. Its frames are split between the phases by fixed shares (lights 1:1:1, dodge 1:2:1, thrust 1:1 over startup and active) and spread evenly inside each phase, so a sheet may change a frame count without touching the engine. Loops and one-shots count sim ticks at the sheet's `frameRate`, so they freeze in hitstop and slow with slow-mo.
- **Husks.** `spawn` stretched over the spawn-in (`spawnMs`), the engine's ring under it, the Husk not awake until it ends; `idle`; the Nutshell's `walk` by velocity while it chases whole (a chipped Nutshell keeps its chipped frame); `telegraph` through the wind-up, blinking with the resting frame while the attack still tracks the player and solid once it has locked (the sheet's pre-tinted frames are the telegraph colour); `lunge` stretch and hit over the Peeling's active ticks, settle through its recovery; the Nutshell's `slam`, frame 0 over the first half of its active ticks and frame 1 over the second, held through the recovery; `hit` for 100 ms after a hit; `chipped` / `chipped_outer` / `chipped_inner` once shell layers are gone; `regrow` as a one-shot on the regrow event; `death` then `drop` (250 ms) on a transient kept after the sim removes the Husk, where the engine's Sparkglass pickups fly out. `flipX` when a Husk moves or lunges west.
- **Effects stay in the engine:** the grounding shadow (20×6 world px under a Kindled, a Husk's scaled by its radius against the player's), the white hit flash (a fill tint for `juice.hitFlashFrames`), chips and the core flare as particles, the slash arc and thrust line (hitbox flashes; M1's straight blade stroke in a light's wind-up only over a v1 sheet, since a v2 sheet draws its own blade), poise bars, the perfect-dodge trail (the sprite's frame as spark-glow afterimages over a 1 px hollow-deep rim) and the Hookblade FX at the hook tip (chain, hook, charge spark).
- **F3** draws the old placeholder hitbox shapes over the sprites (with the stats overlay); `window.__iot.setDebugShapes(on)` does the same from the console.
- **Palette.** `packages/shared/data/palette.json` holds the design system's 32 raw colours (`tokens`, copied from its `tokens.json`; role tokens like `ui-ink` are aliases and stay out) and the four clay tones. It changes only through an art/ PR; the sheet test and the client's `palette.ts` read it.
- **Placeholders** come from `tools/placeholder-sheets.py` (Python/PIL, reads `packages/shared/data/palette.json`): run it after editing the script or the palette. `packages/shared/test/sprites.test.ts` is the test of §6; `tools/screenshots.mjs` takes the reference shots in `docs/screenshots/m1-task5/` and `tools/screenshots-task7.mjs` those in `docs/screenshots/m1-task7/` (spawn, Haul throw → recover, the Nutshell's walk and slam, the hit flinch → stagger) through the `window.__iot` playtest hooks (`setInputSource`, `setSpeed`, `pose`). Those scripts, like the other M1 and M2 ones (`tools/screenshots-task*.mjs`, `tools/screenshots-m2-*.mjs`), assume M1's 480 × 270 canvas at a CSS zoom and no longer run as-is since G1.5; `tools/screenshots-g15.mjs` takes the current shots (`docs/screenshots/g15/`).

## 9. Answers to the PR #12 questions (ART, 2026-10-13)

Done: §4 carries the answers (Husk `spawn`, `haul_recover`, the 2-frame `hit`, the Nutshell's `walk` and `slam` in place of `roll`, `heavy_hold` through the hitstop as the engine already did), §8 describes the engine that plays them, and the lists in `packages/shared/src/sprites.ts`, `animState.ts` and `tools/placeholder-sheets.py` match (M1 task 7). The hand-drawn `kindled-ash`, `husk-peeling` and `husk-nutshell` sheets follow this contract.
