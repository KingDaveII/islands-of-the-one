# Art job holding: raw material for the starting holding

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`: the colour table, the drawing rules, the prop sizes;
- `docs/design/holding.md` (the layout, the stations) and `packages/shared/data/holding.json` (`first-holding`);
- `docs/design/sprites.md`: "Tiles" (the shore rule and its pieces) and the prop cells, including the tall cell for the twisted tree (64×96, origin (32, 86));
- `art/jobs/tiles-cave.md` and `art/raw/tiles-cave/manifest.json`: this job is the same shape, so follow how that job called the tools and recorded them;
- `art/review/tiles-holding/rooms.png` and the placeholder recipes `art/sheets/tiles-holding.json` and `art/sheets/prop-*.json` (MAIN's placeholders, which show where everything sits).

The job **generates raw material only**:
- the holding's ground texture;
- five props: the Writ post, the twisted tree, the stone outcrop, the holding store and Kesh's rock.

ART cuts and composes the shore pieces from it, cleans the props, and rebuilds `tiles-holding` and the five `prop-*` recipes. So:
- write no recipe;
- run no `art:build`;
- make no code changes;
- don't retouch, recolour or cut anything.

## Branch and PR
- Branch `art/holding` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: holding (raw)" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/holding -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files under `art/raw/holding/`, plus `art/raw/holding/manifest.json`. Record:
  - the tool and every argument;
  - the job, tileset and image ids;
  - the generations per call, from the balance before and after;
  - any retakes;
  - the sha256 of every file.
- Pass images by upload reference, never as inline base64.
- Never commit the token, model files or anything from the environment.

## Budget
- About **65 generations**, hard cap **110**. David approves it before the job runs.
- Call `get_balance` before the first call, after each step, and at the end.
- If a single call quotes more than 20, or the total would pass 110, stop and ask David.
- At most one retake per step, only for the hard failures named in the step.
- Use `wait_for_jobs` to wait. Run at most 8 jobs at once; Steps 1–6 don't depend on each other.

## The look
The holding is the player's own Shard, a small island floating in the Hollow. It should feel warm and lived-in next to the cool lavender caves: warm pale earth, dark stone and old bronze wood. Light comes from the top left. Use only the 28 whitelist colours (`art/anchors/palette-28.png`).

Never use any of these:
- #FFFFFF, #FFE7A3, #E0457B or #8E2550;
- husk-core #FFF4C7 (the Husks' colour);
- green: the palette has none on purpose, so the only foliage colour is wheel-patina teal #2F7F7A.

| Part | Colours | Notes |
|---|---|---|
| Ground | sleeper-soil #E3C29E base, sleeper-flesh #C98F78 grit, a few wheel-eye #E9E4D4 pebbles, rare small tufts of wheel-patina #2F7F7A moss | Quiet, like the cave floor: the Kindled and the props must read on it. No outlines, grid or stripes. |
| The island's edge (ART draws it) | the ground's lit lip, then a short rock face of sleeper-ochre #9C5B4A and hollow-below #5B5478, dithered into hollow-deep #2A2540 | Drawn by ART from the ground and the stone ramp, not generated. |
| Writ post | a short squat post of grey stone (watcher-stone #7D8794, watcher-iron #4A4E57) with a palm-sized fired-clay tablet set into its front (sleeper-flesh, sleeper-ochre), a few tiny marks on it lit spark-amber #F2B65A | At this size the inscription is only a few lit pixels, never letters. |
| Twisted tree | a gnarled trunk twisting as it rises (watcher-bronze #A8743A, wheel-brass-dark #8A6420), a sparse canopy of wheel-patina leaves shaded with watcher-rain #3E5C7A and sleeper-night #24305A | Dry, old and warm in the middle. The canopy overhangs; the trunk's base is narrow. |
| Stone outcrop | black stone (watcher-iron, hollow-below, watcher-stone light) with one pale porous vein (wheel-eye, hollow-dusk) | It matches the item icons for black stone and streaked stone. |
| Holding store | a squat wooden storage bin with a pale sailcloth cover tied down with rope (watcher-bronze and wheel-brass-dark wood, wheel-eye and unwritten-sail #8C7F6E cloth, rope in sleeper-ochre) | Clearly a place to put things; no lock, no letters. |
| Kesh's rock | a tall thin needle of dark rock standing alone in the Hollow (hollow-below, hollow-deep, a lit hollow-dusk edge on its left), its foot dissolving into the void | It stands in the void, so it has no ground at its base. |

## STYLE (append to every description)
"Top-down RPG pixel art seen from a high three-quarter view, light from the top left, a 1 px dark violet outline, flat shading in two or three steps per material, no dithering on the object, no anti-aliasing, no soft glow, transparent background, no text, letters or symbols."

For the ground (Step 1), use the same sentence without "a 1 px dark violet outline" and "transparent background".

## Step 1: the ground (a Wang tileset as ground texture)
Call `create_topdown_tileset` as `art/jobs/tiles-cave.md` Step 1 did:
- `mode: "pro"`;
- `tile_size` 32×32;
- `view: "high top-down"`;
- `shading: "basic shading"`;
- `detail: "low detail"`;
- the smallest `transition_size` the tool accepts;
- the most outline-free `outline` option.

Descriptions:
- Lower: "warm pale sandy earth of a small island, packed and dry, a very quiet texture with faint darker grit".
- Upper: "the same warm pale earth with a few small pale pebbles and one or two tiny tufts of dark teal moss".
- Transition: "a light scatter of grit".

Download the 16 tiles, `metadata.json` and the example map. Then run `reduce_colors` on all 16 together, with `palette_image_url` = an upload of `art/anchors/palette-28.png` and `dithering: "none"`. Keep both the raw and the reduced tiles.

Retake once (`mode: "standard"`) only if the all-lower or all-upper tile has outlines, a grid or stripes over the whole tile, or is not a warm pale earth colour after the reduction.

## Steps 2–6: the props
Call `create_image_pro` once per prop with:
- `no_background: true`;
- the 28-colour palette (as husks-m1 and tiles-cave passed it);
- `seed: 1234`;
- reference images:
  - `art/anchors/prop-clay-jar-64.png`, usage "prop style: outline, shading, amount of detail";
  - `art/anchors/kindled-ash-s-64.png`, usage "scale only: this is the player, 45 px tall; the prop stands beside it".

| Step | Prop | Canvas | Target size | Description (+ STYLE) |
|---|---|---|---|---|
| 2 | `writ-post` | 64×64 | about 18 wide × 34 tall | "A short squat post of rough grey stone, about knee to chest height on a person, with a palm-sized tablet of reddish fired clay set into its front. A few tiny glowing amber marks are cut into the tablet. It stands on the ground." |
| 3 | `twisted-tree` | the tallest canvas the tool accepts that is at least 64 wide and 96 tall (96×96, or 128×128) | about 50 wide × 88 tall | "A gnarled old twisted tree, its bronze-brown trunk spiralling as it rises from a narrow base, with a sparse crown of dark teal leaves overhanging. Dry and hard. It stands on the ground." |
| 4 | `stone-outcrop` | 64×64 | about 50 wide × 34 tall | "A low outcrop of dense black stone breaking out of the ground, two or three heavy rounded boulders together, with one pale porous vein running through the largest." |
| 5 | `holding-store` | 64×64 | about 44 wide × 30 tall | "A squat wooden storage bin of old bronze-brown planks, its top covered with a pale sailcloth tied down with rope. A place to keep things. No lock, no letters." |
| 6 | `kesh-rock` | 64×64 | about 22 wide × 56 tall | "A tall thin needle of dark violet rock standing alone, rising from nothing, its left edge catching pale light, its foot fading into darkness. No ground under it." |

For each prop:
1. Save every candidate as `<prop>/candidates/<n>.png`, a numbered sheet `<prop>/candidates.png`, and your pick as `<prop>/pick.png`.
2. Pick the candidate closest to its target size that matches its description and uses no forbidden colour (no green other than the teal, no white, no husk-core).
3. Place the pick, by moving pixels and never by scaling, with its lowest pixel on row 53 of a 64×64 canvas. For the tree, use a 64×96 canvas with the trunk's base on row 85. Save it as `<prop>/placed.png`.
4. If it is too big for its canvas, say by how much and leave it unplaced; ART trims it.

Retake once (seed 1235) only if no candidate is the right object, for example a tree with no visible trunk, a post with no tablet, or a rock lying down instead of standing.

## Done when
1. Make `art/raw/holding/contact.png`:
   - the 16 ground tiles, raw and reduced, at 4×;
   - a 6×4 patch of the all-lower and all-upper reduced tiles, at 2×;
   - every prop pick at 4× on the reduced ground, beside the player reference.
2. Run `bash scripts/cloud-setup.sh`, then `pnpm check`.
3. Commit the raw files, the manifest and the contact sheet, push, and open the draft PR.

The PR description holds:
- `contact.png`;
- a picks table: step, pick, its size against the target, and why;
- the ground: the outline option used, the colours the reduced set uses, and whether the all-lower and all-upper tiles repeat without a visible seam;
- the generations per call, and the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- any step that failed twice.
