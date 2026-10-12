# Sprite sheets

The contract for every animated character sheet the client loads (ART DIRECTION → MAIN, 2026-10-12). Terms: [`glossary.md`](glossary.md); drawing rules and signal colours: [`readability.md`](readability.md); the Old Letters sheet, the first asset delivered this way: [`letters.md`](letters.md). Related engine sheets already in `packages/shared/assets/`: `controller-glyphs-12px.png` + `.json` (44 cells, prompts and the controls screen) and `hookblade-fx.png` + `.json` (chain link, hook, charge spark).

How every animated character reaches the engine: a 1× PNG plus a JSON contract, like the Old Letters sheet (PR #8). This spec covers the tool, the frame grid, facings, the animation lists for M1 (Kindled, Peeling, Nutshell), frame rates, the JSON shape for Phaser, and the test MAIN commits with each sheet.

## 1. Tool (decided)

- **Hand-drawn sheets: Aseprite** (`.aseprite` source files in `packages/shared/assets/src/`, exported with `aseprite -b` to PNG + JSON). Reasons: indexed-colour mode holds the 32-colour budget, tags map one-to-one onto our animation names, the CLI export is scriptable in CI, and Phaser 3 has a native loader for its JSON. LibreSprite (free fork) exports the same format if David prefers not to buy it.
- **Generated sheets (what ART DIRECTION makes today): Python/PIL scripts** in the design workspace (ART DIRECTION's own scripts, outside the repo) that write the *same* PNG + JSON contract directly. Placeholder and concept sheets come this way; a hand-drawn Aseprite file can replace any of them without the engine noticing.
- Either way the engine only ever loads `<name>.png` + `<name>.json` from `packages/shared/assets/`. The Aseprite export is converted by a small repo script (`tools/aseprite-to-atlas`) into the contract below (Aseprite's `frameTags` become `anims`, its slice named `origin` becomes the origin). MAIN owns that script.

## 2. Frame grid

| Sheet | Cell (w×h) | Origin (x, y from the cell's top left) | Why |
|---|---|---|---|
| Kindled (`kindled-<rem>`), one per Remembrance: clay, ash, tide, wing | 48×40 | (24, 36) — the point between the feet | the body is 16×24; the Hookblade heavy reaches 22 px past the hand and Haul's throw frame holds the first chain link, so the cell is wider than the body |
| Peeling (`husk-peeling`) | 24×24 | (12, 18) | 12×9 body with room for the lunge stretch |
| Nutshell (`husk-nutshell`) | 40×40 | (20, 34) | 24×24 shell plus the roll squash |
| Later: Rind-Eel 48×32 (24, 26), Mourning Husk 40×48 (20, 44) | | | |

- Cells are a regular grid: `frame.x = col * cellW`, `frame.y = row * cellH`. No trimming, no rotation, no padding; the empty pixels are the cost of a grid the test can check by arithmetic.
- The shadow is **not** in the sheet; the engine draws it (readability.md: a navy dithered ellipse under the origin).
- Colours: the 32-colour palette only (design system `tokens.json`, `color`). The Kindled sheets are drawn in the **grey-ochre** clay tone; the other three tones are palette swaps at load (`palette` block below), so one sheet per Remembrance, not twelve.

## 3. Facings

- Kindled: **8 facings**, in this order and spelling: `S, SE, E, NE, N, NW, W, SW`. All eight are stored (the west facings are drawn, not flipped: the Hookblade stays in the right hand, which is the far hand when facing west). Idle and walk have all eight; attacks, dodge and Haul have all eight; hit, death and carry have four (`S, E, N, W`) and the engine maps diagonals to the nearest.
- Husks: **no facings**. Peelings and Nutshells are radial; the engine rotates nothing, it flips horizontally when the lunge or roll direction has a west component (`"flipX": true` is allowed for Husks only).
- Facing names are part of the frame name: `walk_SE_3`.

## 4. Animations, M1

Frame rates are per animation; `hold` means the last frame stays until the state ends. Durations in the design tables stay the authority for timing (the engine stretches or cuts frames to fit the combat windows; the art gives the count).

### Kindled (per Remembrance sheet)

| Name | Frames | fps | Loop | Facings | Notes |
|---|---|---|---|---|---|
| `idle` | 2 | 2 | yes | 8 | a breath: one pixel of chest and hood |
| `walk` | 6 | 10 | yes | 8 | 8 px per cycle; the blade bobs with the hand |
| `dodge` | 4 | 16 | no | 8 | 1 = crouch, 2–3 = the roll (body a 12×12 ball), 4 = recover; frame 2–3 are the perfect-dodge window art |
| `light_1`, `light_2`, `light_3` | 3 each | 15 | no | 8 | wind-up, swing (the arc), recover; `light_3` ends lower |
| `heavy_charge` | 3 | 12 | hold last | 8 | the drawn-back stance; the spark comes from `hookblade-fx` at the tip, not from the sheet |
| `heavy_thrust` | 2 | 20 | no | 8 | the line: hand forward, blade full length |
| `heavy_hold` | 1 | — | hold | 8 | the pin: 150 ms, the enemy on the hook |
| `heavy_recover` | 2 | 12 | no | 8 | |
| `haul_throw` | 2 | 15 | hold last | 8 | arm out; chain and hook from `hookblade-fx`; the last frame holds while the hook flies |
| `haul_recover` | 2 | 12 | no | 8 | the arm comes back as the chain reels in, over the Haul's recovery (§9) |
| `haul_pull` | 2 | 12 | yes | 8 | the brace: feet planted, both hands on the chain |
| `haul_slide` | 2 | 12 | yes | 8 | the heavy branch: the player dragged, cloak streaming back |
| `hit` | 2 | — | hold last | 4 | 0 = the flinch, 1 = the stagger held to the end of the hurt stun (§9); the engine flashes it #FFFFFF (the only pure white) |
| `death` | 6 | 8 | no | 4 | the fall, then the freckles go out one by one on the last three frames |
| `carry_idle`, `carry_walk` | 2, 6 | 2, 10 | yes | 4 | both arms round the Glowing Shell (hour two) |
| `sit` | 1 | — | hold | 2 (S, E) | the ebb, by the post |

M2 adds the station animations (`chop`, `hoe`, `fish`, `knead`: 4 frames, 8 fps, 2 facings) on the same sheet.

### Peeling

| Name | Frames | fps | Loop | Notes |
|---|---|---|---|---|
| `spawn` | 4 | — | no | the curl gathering round its core, stretched over `spawnMs` (§9) |
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
| `spawn` | 4 | — | no | the shell closing round its core, stretched over `spawnMs` (§9) |
| `idle` | 2 | 2 | yes | |
| `walk` | 4 | 6 | yes | the chase: the shell rocks forward on its hidden feet, 4 px per cycle (§9) |
| `telegraph` | 2 | 8 | hold last | tinted in the sheet |
| `slam` | 2 | — | hold last | 0 = the shell dropping, 1 = the impact, held through the recovery; replaces `roll` (§9) |
| `hit` | 1 | — | 100 ms | |
| `chipped_outer` | 1 | — | hold | first poise bar broken: outer shell gone |
| `chipped_inner` | 1 | — | hold | second bar broken: core exposed |
| `regrow` | 3 | 6 | no | the shell closing back (poise regrow) |
| `death` | 4 | 10 | no | |
| `drop` | 1 | — | hold | |

## 5. The JSON contract

Phaser 3 **JSON Hash atlas** (`this.load.atlas(key, png, json)`) with two extra top-level blocks the engine reads itself: `anims` and `palette`. Frame names: `<anim>_<FACING>_<n>` for the Kindled, `<anim>_<n>` for Husks; `n` counts from 0.

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
- `palette.swaps` maps the drawn tone's hex values to each other tone's (skin, skin shade; the freckle colour never swaps). The engine applies the swap with a per-texture palette pass at load, once, and caches four textures.
- Husk sheets carry no `facings` and no `palette`; their telegraph frames are pre-tinted.

## 6. Test (the pattern from PR #8)

For every sheet in `packages/shared/assets/`:

1. `meta.image` exists; the PNG's size equals `meta.size`; width and height are multiples of the cell.
2. Every `frames[*].frame` lies inside the PNG and on the cell grid; `w`/`h` equal the cell.
3. Every name in every `anims[*].frames` exists in `frames`; every frame belongs to at least one anim.
4. For Kindled sheets: every anim in the table above exists for every facing it lists; `anchor` matches `meta.origin / cell`.
5. Every opaque pixel's colour is in the 32-colour palette (tokens.json), the telegraph colours only in `telegraph_*` frames, #FFFFFF nowhere.
6. Every `palette.swaps` key is one of the four clay tones and every swapped hex occurs in the PNG.

Until a sheet exists, Claude Code draws the placeholder from this table (a 16×24 rectangle in the Remembrance's outfit colour with the frame name under it) so the animation state machine can be built and tested now.

## 7. Delivery order

1. `kindled-ash` (the first-hour default) with idle, walk, dodge, light_1–3, heavy_*, haul_*, hit, death — this unblocks M1 task 3.
2. `husk-peeling`, `husk-nutshell`.
3. `kindled-clay`, `-tide`, `-wing` (same frames, outfit redrawn), then carry and sit.

## 8. Engine (how the sheets load and animate)

What `apps/client` does with a sheet (MAIN, M1 task 5). Nothing here is in the sheets: a hand-drawn sheet that follows §2–§5 replaces a placeholder with no engine change.

- **Loading.** `apps/client/src/render/spriteSheets.ts`: every sheet in `packages/shared/assets/sprites` (listed in `packages/shared/src/sprites.ts`) loads as a Phaser JSON Hash atlas (`load.atlas(name, png, json)`), keyed by its file name (`kindled-ash`, `husk-peeling`, `husk-nutshell`). The frames' `anchor` becomes the sprite origin, so a sprite is placed at the point between its feet (the sim's position is the body centre; the engine adds the feet offset, 5 px for the Kindled, the radius for a Husk, where the grounding shadow sits).
- **Animations.** One Phaser animation per entry of the JSON `anims` block, named `<key>/<anim>` (`kindled-ash/walk_S`, `husk-peeling/telegraph`), with its `frameRate` and `repeat`. They exist for tooling; in play the frame is chosen directly (below), so hitstop, slow-mo and the sim's windows stay exact.
- **Palette swaps.** For a Kindled sheet the engine builds one texture per clay tone from `palette.swaps` at load: the drawn sheet's pixels are copied with each `from → to` hex replaced and registered as the same atlas under `<key>@<tone>` (`kindled-ash@clay-red`) with its own `<key>@<tone>/<anim>` animations; four textures, built once and cached game-wide. `window.__iot.setClayTone(tone)` switches the Kindled in a run.
- **The state machine** (`apps/client/src/render/animState.ts`, pure and tested in node) maps sim state to a frame every render frame; the client never decides gameplay. The Kindled:
  - `idle` / `walk` from the body's velocity, facing the nearest of the 8 facings to the aim;
  - `dodge` over the dodge window (crouch in the startup, the two roll frames over the active ticks, recover over the recovery);
  - `light_1..3` by combo step: wind-up / swing / recover over the strike's startup / active / recovery;
  - `heavy_charge` while charging, at the sheet's rate, holding the last frame → `heavy_thrust` over startup + active → `heavy_hold` from the tick the thrust pins a Husk until the pin ends (through the hitstop) → `heavy_recover` over the rest of the recovery;
  - `haul_throw` (the arm out over the startup, the last frame while the hook flies and through the recovery), `haul_pull` while the chain pulls a Husk, `haul_slide` while it pulls the player;
  - `hit` for as long as the sim says the player is stunned (the hurt stun, 180 ms; a longer `hit` animation plays at its rate and holds its last frame), or for 100 ms after an armored hit that does not stun; `death` at the sheet's rate once the sim has stopped (a client clock, the only one besides the armored hit frame and the Nutshell regrow);
  - an animation with fewer facings than 8 takes the nearest it has: diagonals go to the nearest of the 4 (ties clockwise: SE→S, NE→E, NW→N, SW→W), `sit` to S or E. Attacks, the dodge and the Haul face the direction the sim locked at their start; idle, charge and the hit face the aim.
  - `carry_*` and `sit` have no sim state yet (hour two, M2).
- **Timing.** The sim's move windows are the authority: an animation with a window is stretched or cut to its ticks. Its frames are split between the phases by fixed shares (lights 1:1:1, dodge 1:2:1, thrust 1:1 over startup and active) and spread evenly inside each phase, so a sheet may change a frame count without touching the engine. Loops and one-shots count sim ticks at the sheet's `frameRate`, so they freeze in hitstop and slow with slow-mo.
- **Husks.** `idle`; `telegraph` through the wind-up, blinking with the resting frame while the attack still tracks the player and solid once it has locked (the sheet's pre-tinted frames are the telegraph colour); `lunge` stretch and hit over the Peeling's active ticks, settle through its recovery; `roll` looping through the Nutshell's slam; `hit` for 100 ms after a hit; `chipped` / `chipped_outer` / `chipped_inner` once shell layers are gone; `regrow` as a one-shot on the regrow event; `death` then `drop` (250 ms) on a transient kept after the sim removes the Husk, where the engine's Sparkglass pickups fly out. `flipX` when a Husk moves or lunges west; the spawn-in ring is an engine effect, the sprite appears once the Husk wakes.
- **Effects stay in the engine:** the grounding shadow, the white hit flash (a fill tint for `juice.hitFlashFrames`), chips and the core flare as particles, the slash arc and thrust line (hitbox flashes), poise bars, the perfect-dodge trail (the sprite's frame as spark-glow afterimages over a 1 px hollow-deep rim) and the Hookblade FX at the hook tip (chain, hook, charge spark).
- **F3** draws the old placeholder hitbox shapes over the sprites (with the stats overlay); `window.__iot.setDebugShapes(on)` does the same from the console.
- **Palette.** `packages/shared/data/palette.json` holds the design system's 32 raw colours (`tokens`, copied from its `tokens.json`; role tokens like `ui-ink` are aliases and stay out) and the four clay tones. It changes only through an art/ PR; the sheet test and the client's `palette.ts` read it.
- **Placeholders** come from `tools/placeholder-sheets.py` (Python/PIL, reads `packages/shared/data/palette.json`): run it after editing the script or the palette. `packages/shared/test/sprites.test.ts` is the test of §6; `tools/screenshots.mjs` takes the reference shots in `docs/screenshots/m1-task5/` through the `window.__iot` playtest hooks (`setInputSource`, `setSpeed`, `pose`).

## 9. Answers to the PR #12 questions (ART, 2026-10-13)

§4 above is the contract with these answers in it. Until MAIN brings the code to it (the lists in `packages/shared/src/sprites.ts`, `animState.ts`, `tools/placeholder-sheets.py` and the placeholders it writes), §8 describes the engine as it runs.

1. **Husks get a `spawn` animation.** The spawn ring says *where*; the sprite should say *what*, rather than popping in when the Husk wakes. Peeling and Nutshell each get `spawn`, 4 frames, played once and stretched over the kind's `spawnMs` (600 / 800 ms) like any windowed animation: 0 = the core alone, a 2×2 spark; 1 = flakes circling it; 2 = the shell half closed; 3 = the shell closed, the same as `idle` frame 0. The ring stays under it. A Husk is still not awake until the spawn ends (as now); the sprite is just visible during it.
2. **The Haul gets `haul_recover`**, 2 frames at 12 fps: the arm coming back to the body as the chain reels in. `haul_throw` covers the startup and holds its last frame only while the hook flies; `haul_recover` plays over the recovery (1:1), so the move ends where the light and heavy end, at rest. `haul_pull` and `haul_slide` are unchanged (they loop while the chain pulls).
3. **`hit` covers the whole hurt stun** (already resolved in PR #12 for the engine; now the sheet matches): 2 frames. Frame 0, the flinch, shows for the first 100 ms; frame 1, the stagger, holds to the end of the stun (`hurtStunMs`, 180 ms). An armored hit that does not stun shows frame 0 alone for 100 ms. The white flash stays in the engine.
4. **The Nutshell's `roll` was the wrong animation.** The sim's Nutshell walks slowly and slams in place for 70 ms; it never rolls. So `roll` goes and two take its place: `walk` (4 frames, 6 fps, loop) for the chase, chosen by velocity like the Kindled's walk, and `slam` (2 frames): frame 0 over the first half of the active ticks, frame 1 over the second half and held through the recovery. The slam's circle on the floor stays an engine decal.
5. **`heavy_hold` vs hitstop: keep what the engine does.** The hold frame shows from the tick the thrust pins a Husk, through the hitstop, until the Husk is let go or the player cancels. The pin is the moment the heavy is for; it should be on screen while the world is frozen.

**For MAIN** (one task, no new art needed to start: the placeholders carry the new names):

- `KINDLED_ANIMS`: add `haul_recover` (2 frames, 12 fps, no loop, no hold, 8 facings) after `haul_throw`; `hit` becomes 2 frames with hold (4 facings).
- `HUSK_ANIMS`: `peeling` gains `spawn` first; `nutshell` becomes `spawn, idle, walk, telegraph, slam, hit, chipped_outer, chipped_inner, regrow, death, drop`.
- `animState.ts`: `spawn` over the spawn-in; `haul_throw` → `haul_recover` at the start of the recovery; `hit` frame 0 for 100 ms then frame 1 to the end of the stun; Nutshell `walk` from velocity in the chase and `slam` over active + recovery instead of `roll`.
- `tools/placeholder-sheets.py`: write the new animations, rerun it, and keep `sprites.test.ts` green.

The hand-drawn `kindled-ash`, `husk-peeling` and `husk-nutshell` sheets follow this contract.
