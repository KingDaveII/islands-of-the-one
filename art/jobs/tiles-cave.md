# Art job tiles-cave: raw material for the cave tiles and the chest

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`, especially the colour table (the "Stone, floor, wall" ramp) and the drawing rules;
- `docs/design/readability.md` §2, "Room";
- the G1.5e task prompt in the Game Design Book's Engineering tab, which defines the tile pieces and the rule that picks them. If G1.5e is merged, read `packages/shared/src/tiles.ts` and the "Tiles" section of `docs/design/sprites.md` instead;
- `art/raw/g13b-job1/manifest.json`, the `tileset` entry, for how the earlier Wang tileset was called and recorded.

The job **generates raw material only**: a floor texture set, the wall, the north door and the chest. ART cuts and composes the 29 static pieces and 24 door frames from it in `art/clean/tiles-cave/` and builds the `tiles-cave` recipe after G1.5e is merged. So:
- write no recipe;
- run no `art:build`;
- make no code changes;
- don't retouch, recolour or cut anything.

## Branch and PR
- Branch `art/tiles-cave` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: tiles-cave (raw)" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/tiles-cave -f base=main -F draft=true -f body=...`). If `gh` is not available, use the GitHub connector.
- Download every PixelLab result at once (links can expire) as raw 1× files under `art/raw/tiles-cave/`, plus `art/raw/tiles-cave/manifest.json`. The manifest records:
  - the tool and every argument;
  - the job, tileset and image ids;
  - the generations per call, from the balance before and after;
  - any retakes;
  - the sha256 of every file.
- Pass images by upload reference, never as inline base64.
- Never commit the token, model files or anything from the environment.

## Budget
- About **56 generations**, hard cap **90**.
- Call `get_balance` before the first call, after each step, and at the end.
- If a single call quotes more than 20, or the total would pass 90, stop and ask David.
- At most one retake per step, and only for the hard failures named in the step.
- Use `wait_for_jobs` to wait. Run at most 8 jobs at once.
- Steps 1–4 don't depend on each other except where Step 5 needs Step 4's pick, so run them in parallel.

## The look (what ART will build from this)
The Hollow's caves are pale shell-grit floors walled by dark violet stone. Light comes from the top left.

| Part | Colours | Notes |
|---|---|---|
| Floor | hollow-lavender #D9D2E9 base, hollow-light #F4EFE6 flecks, hollow-dusk #A99FC4 grit | Quiet: the pale Husks fight on it, so the texture stays faint, with no outlines, hatching or strong pattern. |
| Wall top | hollow-deep #2A2540 with hollow-below #5B5478 cracks and pits | A dark mass. Its front edge has a lit lip of hollow-dusk. |
| Wall face (the bottom 24 px of a wall cell above floor) | hollow-below #5B5478 with hollow-deep strata and cracks, hollow-dusk catching the light | Rough layered stone. A dark foot where it meets the floor. |
| Door | two heavy shell-stone leaves (hollow-dusk, hollow-lavender) between bronze posts (watcher-bronze #A8743A, wheel-brass-dark #8A6420) with a bronze band | No letters, symbols or text. |
| Chest | bronze-and-wood coffer (watcher-bronze, wheel-brass-dark, wheel-brass #C79A3E bands, a choir-gold #D8B24A clasp), outline hollow-deep | It must not look like a Husk: no pale shell colours, no glowing core. |

Never use #FFFFFF, #FFE7A3, #E0457B or #8E2550. Use husk-core #FFF4C7 only on Husks.

## STYLE (append to every description)
"Top-down RPG pixel art seen from a high three-quarter view, light from the top left, flat shading in two or three steps per material, no anti-aliasing, no soft glow, no text, letters or symbols."

## Step 1: the floor (a Wang tileset as floor texture)
Call `create_topdown_tileset` with:
- `mode: "pro"`;
- `tile_size` 32×32;
- `view: "high top-down"`;
- `shading: "basic shading"`;
- `detail: "low detail"`;
- the smallest `transition_size` the tool accepts, ideally 0.

Use the most outline-free option the tool offers for `outline`, and record which.
- Lower: "a pale lavender cave floor of fine shell grit, smooth and worn, a very quiet texture with only faint grit".
- Upper: "the same pale lavender cave floor with a few small white shell flecks and two or three tiny pebbles".
- Transition: "a light scatter of grit".

Download the 16 tiles, `metadata.json` (corners and bounding boxes) and the example map, as in g13b-job1. Then run `reduce_colors` on all 16 together with `palette_image_url` = an upload of `art/anchors/palette-28.png` and `dithering: "none"`. Keep both raw and reduced tiles.

Retake once (`mode: "standard"`, same descriptions) only if the all-lower or all-upper tile has outlines, a grid or stripes over the whole tile, or a colour that is not pale lavender.

## Step 2: the wall
Call `create_image_pro`, 64×64, with:
- `no_background: false`;
- the 28-colour palette (as husks-m1 passed it);
- `seed: 1234`.

Reference images:
- `art/anchors/tiles-blockout-wall-64.png`, usage "layout to follow exactly: the dark wall top at the top (rows 0–7, with its lit lip on row 7), the stone wall face below it (rows 8–31) with a dark foot, the pale floor below (rows 32–63) with a soft shade under the face. Keep every band at its height; replace the flat colours with stone and grit texture.";
- `art/anchors/prop-clay-jar-64.png`, usage "style only: outline, shading, amount of detail".

Description: "A straight stretch of cave wall seen from above at a three-quarter angle, filling the whole image edge to edge so it can repeat sideways: at the top a thin strip of the dark violet stone wall top with a lit pale edge, below it the front face of the wall, rough layered dark violet stone with horizontal strata, small cracks and a dark foot, and below that the pale lavender shell-grit cave floor with a soft shadow at the foot of the wall." + STYLE.

Save every candidate as `wall/candidates/<n>.png`, a numbered sheet `wall/candidates.png` and your pick as `wall/pick.png`. Pick the candidate that keeps the bands closest to the blockout's rows, with the face reading as stone and no object, plant or light in it. Note in the manifest how many rows each band takes in your pick.

Retake once (seed 1235) only if no candidate keeps the three bands at roughly the blockout's heights.

## Step 3: the north door, closed
Call `create_image_pro` as in Step 2. The references are:
- `art/anchors/tiles-blockout-door-64.png`, with the same layout usage plus "the door fills the face band: bronze posts at both edges, two stone leaves meeting in the middle, a bronze band across them";
- the clay jar, as in Step 2.

Description: "A heavy closed gate set in the front face of a cave wall, seen from above at a three-quarter angle, filling the whole image: at the top a thin strip of the dark violet stone wall top with a lit pale edge; below it two heavy pale lavender shell-stone door leaves meeting in the middle, held by a bronze band, between two bronze posts; below that the pale lavender shell-grit cave floor with a soft shadow at the foot of the gate. No letters or symbols." + STYLE.

Save it as in Step 2, under `door/`. Pick the one with two clear leaves, the seam in the middle, and the posts at the edges. Retake once (seed 1235) only if no candidate shows a two-leaf gate in the face band.

## Step 4: the chest, closed
Call `create_image_pro`, 64×64, with:
- `no_background: true`;
- the palette;
- `max_colors: 10`;
- `seed: 1234`.

References:
- `art/anchors/prop-clay-jar-64.png`, usage "prop style: outline, shading, amount of detail";
- `art/anchors/kindled-ash-s-64.png`, usage "scale only: this is the player, 45 px tall; the chest stands beside it".

Description: "A small closed treasure chest about 24 px wide and 18 px tall, a squat coffer of dark bronze-brown wood bound with brass bands and a gold clasp on the front, seen from above at a three-quarter angle so its lid top and front both show, resting on the ground with a 1 px dark violet outline, transparent background. No letters or symbols." + STYLE.

Save it as in Step 2, under `chest/`. Pick the one closest to 24 × 18 with the lid and front both showing. Pad or trim it onto 64×64 with its lowest pixel on row 53, by moving pixels and never by scaling, and save it as `chest/closed.png`.

Retake once (seed 1235) only if no candidate is a chest in that view.

## Step 5: the chest, open (after Step 4)
Call `create_image_pro` as in Step 4, but with `chest/closed.png` as the first reference, usage "the same chest: keep its size, materials, colours and outline exactly; only the lid changes". Keep the player as the second reference.

Description: "The same small chest with its lid swung fully open and back, its empty dark inside showing, a faint amber glint inside, resting on the ground." + STYLE.

Save it as in Step 2 under `chest-open/`, and the pick placed on 64×64 at the closed chest's position (same lowest row, same left edge of the body) as `chest/open.png`. Pick the one that keeps the closed chest's body. Retake once (seed 1235) only if no candidate keeps it.

## Done when
1. Make `art/raw/tiles-cave/contact.png`:
   - the 16 floor tiles, raw and reduced, at 4×;
   - a 6×4 patch of the all-lower tile and one of the all-upper tile, at 2×, to show how they repeat;
   - the wall, door, chest closed and chest open picks at 4×, each beside its blockout or reference.
2. Run `pnpm check`.
3. Commit the raw files, the manifest and the contact sheet, push, and open the draft PR.

The PR description holds:
- `contact.png`;
- a picks table: step, pick, and why;
- the floor: which outline option you used, how many colours the reduced set uses, and whether the all-lower and all-upper tiles repeat without a visible seam;
- the generations per call, and the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- any step that failed twice.
