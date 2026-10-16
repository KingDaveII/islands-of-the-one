# The art pipeline (G1.2)

How raw generated frames become a v2 sheet the engine loads ([`sprites.md`](sprites.md) §2, §5). For ART.
The pipeline does everything mechanical and does it the same way every time; anything that takes taste
stays yours and comes in as files (a cleaned frame under `art/clean/`) or as recipe rules (a colour
remap, a pixel recolour, a skin override). It never picks candidates, never trims, never scales a frame up or down
except to undo a whole-number delivery scale you ask for, and never guesses which frames to use.

Code: `packages/art-pipeline` (TypeScript, no app imports it). It reads the contract (cells, origins, the
canvas, the animation table, facings) and `palette.json` from `@iot/shared`, so it moves with them.

## Commands

| Command | What it does |
|---|---|
| `pnpm art:build <sheet>` | Builds `art/sheets/<sheet>.json` and writes its outputs. Several names may follow. |
| `pnpm art:build --all` | Builds every recipe in `art/sheets/`. |
| `pnpm art:check` | Rebuilds every recipe in memory and fails if any committed output differs byte for byte, or is missing. |

`pnpm check` runs the same check as a test (`packages/art-pipeline/test/check.test.ts`), so a hand-edited
sheet, review image or report fails CI. Change the recipe or the source files and rebuild instead.

## Outputs

| Recipe | Writes |
|---|---|
| every recipe, draft or not | `art/review/<sheet>/contact.png`, `report.md`, `report.json`, and `tones.png` for a Kindled sheet |
| non-draft only | `packages/shared/assets/sprites/<sheet>.png` and `.json`, and `<sheet>.skin.png` for a Kindled sheet |

- **`contact.png`**: one row per animation and facing, in sheet order, frames left to right at 2×, on the
  floor #D9D2E9 (left panel) and on the wall face #5B5478 (right panel). Every tile shows the same part of
  the cell (the ink of all frames plus 2 px), so frames line up; the amber tick left of each tile marks
  the soles row. The report lists the rows top to bottom.
- **`tones.png`** (Kindled): the same rows in the four clay tones (grey-ochre as drawn, pale, red,
  river-dark), swapped through the mask exactly as the engine does. Anything that changes with the skin
  but isn't skin (a grip, a belt, rope) shows up here.
- **`report.md` / `report.json`**: the numbers below, per frame and per animation, and the flags. Two
  lists for writing `remap` rules: what each rule took, per animation, and the top 20 off-palette source
  colours the snap moved, with where each went and that colour's ramp (see "Remap").
- **The sheet**: frames packed row-major in the contract's order (animation as in the table, then facing
  `S, SE, E, NE, N, NW, W, SW`, then frame), as many cells per row as fit in 2048 px. The PNG is 8-bit
  RGBA with no metadata, written by the pipeline's own encoder so it is the same bytes on every machine.
  The JSON is §5 v2: `meta.app` `"iot-art-pipeline"`, `version` `"2"`, `pixelScale` 1, and for the
  Kindled `palette.drawn`, `palette.mask` and `palette.swaps` from `palette.json`'s clay tones. Frame
  rates, loops and holds come from the contract's table; the source's timing is ignored.

## Writing a recipe

A recipe is `art/sheets/<sheet>.json`. Every field is checked; an unknown key, a wrong type or a missing
file fails the build with a message naming the field.

```json
{
  "sheet": "kindled-ash",
  "kind": "kindled",
  "outline": "player",
  "draft": false,
  "notes": "optional, free text for people",
  "anims": {
    "walk": {
      "ground": "frame",
      "facings": {
        "S": { "src": "art/raw/g13b-job4/player/walk-skel/south", "frames": [0, 1, 2, 3, 4, 5] }
      }
    },
    "light_1": {
      "ground": { "ref": 0 },
      "despeckle": true,
      "facings": {
        "E": { "src": "art/raw/g13b-job4/player/attack-v3/east", "frames": [1, 3, 5] }
      }
    }
  },
  "fixes": [{ "frame": "walk_S_1", "pixels": [[30, 41, "#7d8794"], [31, 41, null]] }],
  "remap": [
    { "from": ["#bebfc2", "#c0bebd"], "to": "husk-shell" },
    { "near": "#7c7166", "within": 3, "to": "watcher-iron", "exclude": "face" },
    { "from": ["#959ca7"], "to": "watcher-stone", "frames": ["walk_S_2"], "box": [38, 28, 46, 44] }
  ],
  "skin": {
    "add": { "walk_S_2": [[22, 40]] },
    "remove": { "light_1_E_0": [[[40, 38], [43, 41]]] }
  }
}
```

| Field | Meaning |
|---|---|
| `sheet` | The sheet's name, the same as the file name. Its prefix is its kind: `kindled-`, `husk-`, `npc-` or `prop-` (see "Kinds"). |
| `kind` | `kindled`, `husk`, `npc` or `prop`, and the one the name's prefix says. |
| `outline` | `"player"` (dream-night, Kindled sheets only) or `"other"` (hollow-deep). |
| `draft` | `true` builds the review folder only, from any subset of animations, facings and frames. `false` must be complete (every required animation, facing and frame count in the table; see "Kinds") and also writes the sheet. |
| `notes` | Optional text; the pipeline ignores it. |
| `anims.<name>` | An animation, named in the sheet's table (see "Kinds"). Only a Husk with no table yet may use any `lower_snake` name, in a draft. |
| `anims.<name>.facings.<F>` | Kindled and NPCs: one source per facing. Husks and props have no facings: put `src`, `frames` (and `downscale`) on the animation itself. |
| `anims.idle.fps` | Props only: the frame rate of `idle` (default 8). |
| `src` | Repo-relative, under `art/`: a folder of `frame-<n>.png`, one PNG (its only frame is 0), or a GIF. Raw files (`art/raw/…`) or files you cleaned (`art/clean/…`). |
| `frames` | Source frame indices, in play order. Repeats are allowed. In v3 animations frame 0 is the rotation: skip it. Skip smear frames. The light attack keeps 3 of v3's 6. |
| `downscale` | Optional, on a source: a whole number k ≥ 2 for a ×k delivery (Retro Diffusion's ×4). Every k×k block must be one colour. |
| `ground` | How each frame is placed vertically (step 8). Default `"frame"` for `idle`, `walk`, `carry_idle`, `carry_walk`, `{ "ref": 0 }` for everything else. |
| `despeckle` | Optional `true`: run step 9 on this animation. |
| `fixes` | Pixel fixes, per output frame name (`walk_S_1`, or `idle_3` without facings), in that frame's **source** pixels (after any downscale): `[x, y, "#rrggbb"]` sets a whitelist colour (telegraph colours too in a `telegraph*` frame), `[x, y, null]` makes it transparent. |
| `remap` | Colour rules applied before the snap (step 4), in order: generator greys to the right ramp. See "Remap". |
| `skin.add`, `skin.remove` | Kindled only, per output frame name, in source pixels: lists of pixels `[x, y]` or rectangles `[[x0, y0], [x1, y1]]` (corners included). See step 10. |

## Kinds

The sheet's name decides its kind, and the kind its cell, facings and animation table (`spriteSheetSpec` in
`packages/shared/src/sprites.ts`; the tables are in `sprites.md` §4). A finished (non-draft) sheet carries its
table: every animation, every facing it lists, every frame, and nothing else.

**Milestones.** Each row of a table has a `milestone`, the milestone that first uses it, and `REQUIRED_MILESTONE`
in `packages/shared/src/sprites.ts` (`"M1"` today) is the one finished sheets are complete for. A finished sheet
must carry every row at or before it; later rows are optional. An optional animation that is there must still
be complete: every facing in its row and the row's frame count. The Kindled's `carry_idle`, `carry_walk` and
`sit` are M2 (nothing uses them before), so a finished Kindled sheet for M1 may leave all three out; every
other row is M1. The sheet test (`packages/shared/test`) reads the same rule. M2 Task 9, or whichever task
first uses carry or sit, moves `REQUIRED_MILESTONE` to `"M2"`; from then on those rows are required. A
draft's report lists the optional rows under its summary.

| Prefix | Kind | Cell | Facings | Table | Palette and mask |
|---|---|---|---|---|---|
| `kindled-` | `kindled` | 112×80 | per animation (8, 4 or 2) | `KINDLED_ANIMS` | yes |
| `husk-` | `husk` | 64×64 | none | the Husk's own in `HUSK_TABLES` (`peeling`, `nutshell`); a Husk without one builds only as a draft | no |
| `npc-` | `npc` | 64×64 | all 8 | `NPC_ANIMS`: `idle` 2 frames at 2 fps, `walk` 6 at 10, both looping | no |
| `prop-` | `prop` | 64×64 | none | `idle` only, 1–8 frames, at the recipe's `fps` (default 8), looping with more than one frame | no |

Husk `telegraph*` frames may carry the two telegraph colours (they are pre-tinted); every other frame may not.

Frame names are `<anim>_<FACING>_<n>` with facings and `<anim>_<n>` without; `n` counts the recipe's
`frames` list from 0, whatever the source indices are.

A pick that is too tall is trimmed by whole rows by you, into `art/clean/`, before it reaches a recipe;
the pipeline never does it. The same goes for a stubby blade or anything else that needs drawing.

## The steps, per frame, in order

1. **Read.** Loads the frame. Any alpha other than 0 or 255 fails. With `downscale`, every k×k block must
   be one colour, then it is reduced; otherwise nothing is scaled. A GIF is split into frames, and a frame
   whose delay is n times the shortest becomes n frames (an export merges identical frames).
2. **Select.** The recipe's `frames`, in order. Nothing else is guessed.
3. **Fixes.** The recipe's pixel fixes. Nothing else edits the art by the pixel.
4. **Remap.** The recipe's `remap` rules, in order, on the source frame (after any downscale and the
   fixes): each opaque pixel takes the first rule that applies to the frame, takes in the pixel and matches
   its colour, and becomes that rule's token. See "Remap". The report counts each rule's pixels per
   animation.
5. **Reserved colours.** For each opaque pixel, the nearest of the 32 tokens in OKLab. Fails if that is
   #FFFFFF (hit flash) or #FFE7A3 (perfect dodge), or #E0457B / #8E2550 outside a `telegraph*` frame.
6. **Snap.** Every opaque pixel to the nearest of the 28 whitelist colours (plus the two telegraph colours
   in telegraph frames), in OKLab, Euclidean. Distances equal to 1/10 000 ΔE are a tie, and a tie takes the
   token that comes first in `palette.json`. Reported per frame: how many pixels moved, the largest ΔE
   (OKLab distance × 100).
7. **Outline by role.** An edge pixel is opaque and 4-adjacent to transparency or the frame's border. Edge
   pixels in dream-night, hollow-deep or sleeper-night become the role's outline colour; interior pixels
   stay. Reported: edge pixels in any other colour (outline gaps) and, on non-player sheets, interior
   dream-night pixels.
8. **Place in the cell.** Horizontally by the frame's canvas centre: the frame's column
   `floor(width / 2)` goes on the origin's column, whatever the bounding box (a blade on one side never
   shifts the body). Vertically by `ground`:
   - `"frame"`: the frame's lowest opaque row goes on the soles row (cell row 63 for the Kindled, 53 for
     the rest);
   - `{ "ref": i }`: source frame `i`'s lowest opaque row sets one shift for every frame of that
     animation and facing, so a blade or a fall can go below the feet. In v3 output frame 0 is the
     rotation, and it can be the reference without being kept;
   - `"canvas"`: trust the canvas: row 53 goes on the soles row (in a frame taller than 64, the row 53 of
     a 64 px canvas centred in it, `53 + floor((height − 64) / 2)`). For files you have already cleaned.

   The report gives each frame's shift (rows moved against trusting the canvas, positive down; raw
   rotations and frames drift 0–4 rows) and where its (0, 0) landed. Nothing is cropped: an opaque pixel
   outside the cell, or on its outer 1 px ring (which the sheet test reads as clipping), fails.
9. **Despeckle** (only with `"despeckle": true`). A single pixel whose 8 neighbours are all one other
   opaque colour takes that colour. The report counts them.
10. **The skin mask** (Kindled). After the snap and the outline: the 4-connected regions of the drawn
   tone's two skin colours, unwritten-sail #8C7F6E and unwritten-tar #5E5448. `skin.remove` takes pixels
   out first (never masked, never a problem); then a region is skin if `skin.add` marks one of its pixels,
   if it holds at least one #8C7F6E pixel, or if it touches a freckle (#F2B65A). The face, neck and hands
   mix both colours, so they are in. Every other region breaks your rule that the skin colours are for
   skin only (2026-10-15): a finished sheet fails and lists each one (frame, box, pixel count); a draft
   reports the same list. Resolve each with `skin.add` if it is skin, or a `fixes` recolour (to
   watcher-iron, the bronze ramp, sleeper-ochre…) if it isn't. Freckles and eyes are never in the mask.
   The report counts masked pixels per frame.
11. **Pack and write** (above).

## Remap

Generators draw neutral greys that have no exact whitelist match, so the snap sends them by distance to
whichever ramp is nearest: a blade grey to the tan or the lavender, a cloth grey into the skin. The style
sheet says a recipe maps them to the right ramp before the snap, never by luck; `remap` is how. A `fixes`
recolour still works for a single pixel; a `remap` rule covers a colour across every frame.

```json
"remap": [
  { "from": ["#bebfc2", "#c0bebd"], "to": "husk-shell" },
  { "near": "#b5b6b5", "within": 4, "to": "watcher-stone", "anims": ["walk", "light_1"], "facings": ["SE", "E"] },
  { "near": "#7c7166", "within": 3, "to": "watcher-iron", "exclude": "face" },
  { "near": "#6e6357", "within": 3, "to": "watcher-bronze", "frames": ["light_1_E_1"], "exclude": [[30, 36, 34, 40]] },
  { "from": ["#959ca7"], "to": "watcher-stone", "frames": ["walk_SE_2"], "box": [38, 28, 46, 44] }
]
```

| Key | Meaning |
|---|---|
| `from` | A list of exact source colours (`"#rrggbb"`). |
| `near`, `within` | Every opaque source colour within `within` of `near`, inclusive. The distance is ΔE in OKLab × 100, the same units the report prints. A rule has `from` or `near`, never both. |
| `to` | The token the pixels become, by name (`"watcher-stone"`, not a hex): one of the 28 whitelist tokens, or a telegraph token in a rule that applies only to `telegraph*` frames. |
| `anims` | Only these animations (names this recipe builds). |
| `facings` | Only these facings (Kindled and NPC sheets). |
| `frames` | Only these output frames (`walk_S_2`). |
| `box` | Only inside these rectangles: one `[x0, y0, x1, y1]` or a list of them, corners included, in the source frame's pixels after any `downscale` (the coordinates of `fixes` and `skin`). |
| `exclude` | Skip pixels: `"face"`, a rectangle, or a list of both (`["face", [12, 30, 16, 34]]`). |

- **Order.** A pixel takes the first rule that matches it, so put narrow rules (a hand, one frame) before the
  broad ones they carve out of.
- **Scopes.** Without one a rule applies to every frame. `anims`, `facings`, `frames` and `box` narrow it, all
  together. A hand moves between frames, so a `box` usually comes with `frames`.
- **`exclude: "face"`** skips the face in each source frame: the bounding box of the pixels that snap to the
  freckle colour (spark-amber), grown by 3 px. A frame with no freckle pixels (a back view) has no face, so
  nothing is excluded there. This keeps a skin-coloured grey on the face out of a rule meant for the cloth.
- **What it can't do.** A rule never reads the snapped colours or another rule's output: each matches the
  source colour as the fixes left it.
- **Stale rules.** A rule that takes no pixel in any frame it applies to fails a finished build, so stale
  rules don't pile up; in a draft the report lists it instead.

### Writing rules from the report

`report.md` lists, under "Off-palette colours the snap moved", the 20 source colours with the most pixels
that reached the snap off the whitelist (after `remap`): each with its pixel count, the token the snap sent
it to and how far (ΔE), that token's ramp, and the frames it appears in (`walk_S 0–5` is `walk_S_0` to
`walk_S_5`). The ramp is the style sheet's material rows (`art/anchors/style-sheet.md`, "Colour"), kept as a
map in `packages/art-pipeline/src/materials.ts` (a test fails when the two disagree): `skin`, `cloth`,
`steel`, `leather`, `shell` and so on. A grey whose ramp is not its material is the next rule to write. The
"Remap" section shows each rule's pixels per animation, so a rule that takes too much or too little shows.

## Checks that are reported, not fixed

| Check | Applies to | Flag |
|---|---|---|
| Loop seam: pixels changed from the last frame to the first, against the mean change between neighbours in the cycle | looping animations (the table's `loop`) | above 1.5× the mean |
| Body bob: each frame's top opaque row, as rows above the soles | `idle`, `walk` | a range above 2 px (the style sheet allows 2 px at B) |
| Held frames: identical neighbouring frames | every animation | any |
| Colours per frame | every frame | more than 12 |

The report also lists what a draft is missing against the contract's table, the optional (after
`REQUIRED_MILESTONE`) rows of that table, each `remap` rule's pixels per animation, and the top 20
off-palette source colours (see "Remap").

## Failure messages

Every failure names the recipe or the frame, and the pixel where there is one. Several problems in one
recipe are listed together. Coordinates are in the source frame's pixels unless the message says
otherwise.

### Recipes

| Message | What to do |
|---|---|
| `art/sheets/<s>.json does not exist` / `is not valid JSON: …` | Check the name; fix the JSON syntax. |
| `<file>: a recipe is a JSON object` | The file must hold one `{ … }`. |
| `<file>: <path> is not a recipe field` | A misspelt or unsupported key. Remove or rename it (fields above). |
| `sheet must be a lowercase name like "kindled-ash"` / `sheet is "<x>" but the file is <y>.json` | Make `sheet` match the file name. |
| `kind must be one of kindled, husk, npc, prop` | Pick one. |
| `sheet "<s>" has no known kind: a sheet name starts with kindled-, husk-, npc-, prop-` | Rename the sheet (and the file) with its kind's prefix. |
| `kind is <k> but the name "<s>" makes it <k2>` | The name decides how the engine and the sheet test treat a sheet; rename the sheet or fix the kind. |
| `anims.<a>.fps is only for props …` / `must be a whole number, 0 or more` | Other kinds take their rates from the table. |
| `outline must be "player" or "other"` / `outline is "player" but only Kindled sheets use the player outline` | Use `"other"` for everyone but the player. |
| `draft must be true or false` | Say which it is. |
| `anims must be an object with at least one animation` | Add an animation. |
| `anims.<a> is not an animation name …` / `is not in the <kind> animation table (…)` | Use a name from the table (`sprites.md` §4). |
| `anims.<a>.facings must be an object with at least one facing` | Kindled and NPC animations list their sources under `facings`. |
| `anims.<a>.facings.<F> is not a facing of <a> (…)` | `hit`, `death` and `carry_*` have S, E, N, W; `sit` has S, E. |
| `… must be an object with "src" and "frames"` | Give a source both. |
| `….src must be a repo-relative path under art/` | Use a path like `art/raw/…` or `art/clean/…`, no `..`. |
| `….src <path> does not exist` / `<path>/frame-<n>.png does not exist` | Fix the path or the frame index (also the `ground` ref frame). |
| `<path> is a single PNG: its only frame is 0` | Use `"frames": [0]`, or point at a folder of frames. |
| `<path> is not a folder of frame-<n>.png, a .png or a .gif` | Convert the source to one of these. |
| `….frames must be a non-empty list of source frame indices` | Whole numbers from 0. |
| `….downscale must be a whole number, 2 or more` | Leave it out for a 1× delivery. |
| `….ground must be "frame", "canvas" or { "ref": <source frame index> }` | See step 8. |
| `….despeckle must be true or false` | |
| `fixes must be a list` / `fixes[i] must be an object` / `fixes[i].pixels must be a non-empty list` | Shape: `[{ "frame": …, "pixels": [[x, y, colour], …] }]`. |
| `….frame names "<f>", which is not a frame this recipe builds` (also under `skin`) | Use an output frame name (`walk_S_1`): the animation, the facing and the position in `frames`. |
| `fixes[i].pixels[j] must be [x, y, "#rrggbb"] or [x, y, null]` / `must set a "#rrggbb" colour or null` | Fix the entry's shape. |
| `fixes[i].pixels[j] sets <hex>, which is not a whitelist colour` | Pick one of the 28 (`art/anchors/style-sheet.md`); telegraph colours only in telegraph frames. |
| `remap must be a list of rules` / `remap[i] must be an object` / `remap[i].<k> is not a remap field` | Fix the rule's shape (keys in "Remap"). |
| `remap[i] needs "from" (exact colours) or "near" with "within"` / `has both "from" and "near"; a rule matches by one or the other` | Give a rule one way to match. |
| `remap[i].from must be a non-empty list of "#rrggbb" colours` / `remap[i].from[j] is …, not a "#rrggbb" colour` / `remap[i].near is …, not a "#rrggbb" colour` | Use six-digit hex colours, as the report prints them. |
| `remap[i].within is missing: "near" needs a distance (ΔE)` / `must be a number above 0 (ΔE, as the report prints it)` / `goes with "near", not "from"` | `within` belongs to `near`. |
| `remap[i].to must name a whitelist token, like "watcher-stone"` / `is "<x>", which is not a palette token (name a whitelist token, not a hex)` / `is "<x>", which is not a whitelist token` | Name one of the 28 tokens (`palette.json`, the style sheet). |
| `remap[i].to is "<x>", a reserved colour no sheet may use` | spark-glow and signal-hit are never in a sheet. |
| `remap[i].to is "<x>", which only telegraph* frames may use, but the rule also applies to <frame>; narrow it with "anims" or "frames"` | Scope a telegraph rule to the telegraph frames. |
| `remap[i].anims[j] is "<a>", which is not an animation of this recipe` / `remap[i].facings[j] is "<f>", which is not a facing (…)` / `remap[i].frames[j] names "<f>", which is not a frame this recipe builds` / `… must be a non-empty list of …` | Name what the recipe builds. |
| `remap[i].facings is only for kinds with facings (kindled, npc)` | Husks and props have no facings; scope by `anims` or `frames`. |
| `remap[i].box must be [x0, y0, x1, y1] (…) or a non-empty list of them` / `remap[i].exclude must be "face", [x0, y0, x1, y1] (…), or a non-empty list of them` | Corners included, `x0 ≤ x1`, `y0 ≤ y1`. |
| `skin is only for Kindled sheets …` / `skin must be an object with "add" and/or "remove"` / `skin.<add/remove> must map frame names …` / `skin.<w>.<f> must be a non-empty list of [x, y] pixels or [[x0, y0], [x1, y1]] rectangles` | Fix the `skin` block's shape. |

### Building

| Message | What to do |
|---|---|
| `<frame> (<src> frame <n>): pixel (x, y) has alpha <a>; only 0 or 255 are allowed` | A soft or semi-transparent pixel in the source. Clean the file into `art/clean/` (make it opaque or clear it) and point the recipe there. |
| `<frame> (…): <w>×<h> is not a multiple of the downscale <k>` | Wrong `downscale`, or the delivery was cropped. |
| `<frame> (…): the k×k block at (x, y) is not one colour, so it cannot be reduced by k` | The file is not a clean ×k delivery (coordinates are in the large file). Check `k`; otherwise clean the file. |
| `<gif>: GIF frame <i> lasts <d> cs, not a whole multiple of the shortest (<s> cs)` | Re-export the GIF with even timing, or export frames as PNGs. |
| `<frame> (…): the GIF has <n> frames after splitting, so there is no frame <i>` | Fix the index. |
| `<frame>: the fix at (x, y) is outside the <w>×<h> source frame` | Fix coordinates are in source pixels (after any downscale). |
| `art/sheets/<s>.json: remap[i].box [x0, y0, x1, y1] reaches outside the <w>×<h> source frame of <frame>` (also `remap[i].exclude`) | Checked when the frames are read, in drafts too: rectangles are in that frame's source pixels (after any downscale). Fix the rectangle, or scope the rule with `frames` to the frames it fits. |
| `<sheet>: remap[i] (<rule>) matches no pixel in any frame it applies to; remove it, or fix its colours or scope` | A stale rule: the colours are gone (a new source, an earlier rule takes them) or the scope misses. Remove or fix it. In a draft this is reported, not failed. |
| `<frame>: pixel (x, y) is <hex>, nearest to the reserved signal-hit #ffffff` (or `spark-glow #ffe7a3`) | Pure white or the dodge glow can't be in a sheet. Recolour the pixel with `fixes` (or clean the file). |
| `… nearest to the reserved signal-telegraph …, which only telegraph frames may use` | The pink is for `telegraph*` frames only. Recolour it, or use the frames in a telegraph animation. |
| `<frame>: the frame is empty` / `<key>: ground ref frame <i> is empty` | The frame has no opaque pixel; pick another frame or ref. |
| `<frame>: placed at (dx, dy) in the <w>×<h> cell, source pixels (…) would fall outside it or on its outer 1 px ring; nothing is cropped` | Something reaches past the cell. Check `ground` (a `ref` that is far off this frame?), or trim the art into `art/clean/`. If the action genuinely needs more room, ask MAIN for a bigger cell. |
| `<frame>: skin.add marks (x, y), which is not unwritten-sail or unwritten-tar after the snap; only skin colours can be masked` | Point `skin.add` at a skin-coloured pixel of the region. |
| `<frame>: a region of <n> px in the skin colours at [[x0, y0], [x1, y1]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not` | Step 10. Look at the box in the frame (and `tones.png`); `skin.add` with any pixel of it if it is skin, otherwise `fixes` to recolour the region. In a draft this is reported, not failed. |
| `<sheet>: <key> is missing (a finished sheet carries every animation and facing)` / `<sheet>: <key> has <n> frames; the table says <m>` | A non-draft must be complete up to `REQUIRED_MILESTONE`. Add what's missing, or keep `"draft": true`. |
| `<sheet>: <key> is missing (<anim> is optional until <M>, but a finished sheet that has it carries every facing)` | An optional animation is all or nothing: add its other facings, or leave it out entirely. |
| `<sheet>: the sprite contract has no animation table (frame counts and rates) for this husk yet, so only a draft can be built` | A new enemy needs its table in `HUSK_TABLES` first; build a draft and ask MAIN. |
| `<sheet>: a prop's idle has 1 to 8 frames, not <n>` | Pick at most 8 frames. |
| `<sheet>: no masked pixel is <hex>; every swap key needs some skin in it` | The sheet test needs both skin colours under the mask somewhere. Check the skin is still in the clay ramp after the snap. |
| `<sheet>: <n> frames of <w>×<h> need a <W>×<H> sheet; the most is 2048×2048` | Too many frames for one sheet; ask MAIN to split it. |

### Checking

| Message | What to do |
|---|---|
| `<output> is missing: run pnpm art:build <sheet>` | Build and commit the output. |
| `<output> differs from what art/sheets/<sheet>.json builds: run pnpm art:build <sheet> (never edit a built file)` | Rebuild and commit. If you edited a built file by hand, move that change into the recipe or into a cleaned source file. |
| `<sheet>: <any build failure>` | The recipe no longer builds (a source moved, the palette or contract changed). Fix it as above. |

## The first recipes (G1.2)

`kindled-ash` and `npc-tally` are drafts from Job 4's raw files (`art/raw/g13b-job4/`). They prove the
pipeline and are not production art: Job 4's player is the 48 px pick and predates the skin-colour rule,
so its belt, boots and blade grip show up as skin regions to resolve. Their review folders are in
`art/review/`.
