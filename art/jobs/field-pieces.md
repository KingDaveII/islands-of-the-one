# Art job field-pieces: raw material for the field's three upgrade pieces

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`: the colour table, the drawing rules, the prop sizes;
- `docs/design/holding.md` (plots, stations, build mode) and `docs/design/sprites.md` (the prop cells);
- `art/jobs/holding.md` and `art/raw/holding/manifest.json`: this job is the same shape, so follow how that job called the tools and recorded them;
- `art/clean/prop-holding-store/idle/frame-0.png` and `art/clean/prop-writ-post/idle/frame-0.png`: the holding's props as they look now.

The job **generates raw material only**: the Seed jars in two facings, the Threshing floor and the Clay channel. ART cleans them, draws what is better drawn by hand (the channel's second facing, the chaff spiral), and writes the three `prop-*` recipes once MAIN's build-mode contract for them is on `main`. So:
- write no recipe;
- run no `art:build`;
- make no code changes;
- don't retouch, recolour, cut or scale anything.

## The pieces (Lore §16.8, LORE 2026-10-18)
Three upgrade pieces a Field takes in build mode (M2 Task 6). Footprints are GAME DESIGN's starting values; each piece turns in 90° steps.

| Piece | Sheet | Footprint | Look (LORE) | Card line (LORE) |
|---|---|---|---|---|
| Clay channel | `prop-clay-channel` | 1 × 4 tiles | Shallow ochre troughs in lines between the rows, dark and damp inside | Fired clay troughs laid between the furrows, the way the Kingdom waters its fields. Dew gathers in them overnight, from nowhere you can find. |
| Seed jars | `prop-seed-jars` | 2 × 1 tiles | Three or four lidded jars on a low plank, a thumbprint in each wax seal | Squat grey jars, waxed shut and pressed with your thumb. Seed kept dry keeps its name. |
| Threshing floor | `prop-threshing-floor` | 3 × 3 tiles | A round floor of flat stones, chaff lifting off it in a slow spiral | A ring of flat stones beaten smooth, where grain is trodden out of the straw. |

A tile is 32 px on the sheets.

## Branch and PR
- Branch `art/field-pieces` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: field-pieces (raw)" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/field-pieces -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files under `art/raw/field-pieces/`, plus `art/raw/field-pieces/manifest.json`. Record:
  - the tool and every argument;
  - the job and image ids;
  - the generations per call, from the balance before and after;
  - any retakes;
  - the sha256 of every file.
- Pass images by upload reference, never as inline base64.
- Never commit the token, model files or anything from the environment.

## Budget
- About **40 generations**, hard cap **60**. David approves it before the job runs.
- Call `get_balance` before the first call, after each step, and at the end.
- If a single call quotes more than 20, or the total would pass 60, stop and ask David.
- At most one retake per step, only for the hard failures named in the step.
- Use `wait_for_jobs` to wait. Steps 1–4 don't depend on each other.

## The look
The pieces stand on the holding's warm pale earth (sleeper-soil) and on a sown field's dark furrows, beside the twisted trees and the holding store. Light comes from the top left. Use only the 28 whitelist colours (`art/anchors/palette-28.png`).

Never use any of these:
- #FFFFFF, #FFE7A3, #E0457B or #8E2550;
- husk-core #FFF4C7 (the Husks' colour);
- green: the palette has none on purpose.

| Piece | Colours |
|---|---|
| Clay channel | fired-clay walls in sleeper-ochre #9C5B4A lit with sleeper-flesh #C98F78 on the rims; the damp inside dark: hollow-below #5B5478 and watcher-rain #3E5C7A, with one or two pale glints of dew (hollow-dusk #A99FC4) |
| Seed jars | squat grey jars (watcher-stone #7D8794, watcher-iron #4A4E57 shade, hollow-dusk light); lids the same grey; wax seals in choir-flame-deep #B5402E with a one-pixel darker thumbprint; the plank in watcher-bronze #A8743A and wheel-brass-dark #8A6420 |
| Threshing floor | flat irregular stones beaten smooth (watcher-stone, hollow-dusk light, watcher-iron joints), a darker ring of stones at its edge, a little straw (sleeper-soil #E3C29E, wheel-brass #C79A3E) caught in the joints |

## STYLE (append to every description)
"Top-down RPG pixel art seen from a high three-quarter view, light from the top left, a 1 px dark violet outline, flat shading in two or three steps per material, no dithering on the object, no anti-aliasing, no soft glow, transparent background, no text, letters or symbols."

## Steps
Call `create_image_pro` once per step with:
- `no_background: true`;
- the 28-colour palette (as the holding job passed it);
- `seed: 1234`;
- reference images:
  - `art/anchors/prop-clay-jar-64.png`, usage "prop style: outline, shading, amount of detail";
  - `art/clean/prop-holding-store/idle/frame-0.png`, usage "the same world and palette: a prop that already stands on this holding";
  - `art/anchors/kindled-ash-s-64.png`, usage "scale only: this is the player, 45 px tall; the piece stands beside it".

| Step | Raw folder | Canvas | Target size | Description (+ STYLE) |
|---|---|---|---|---|
| 1 | `seed-jars/across` | 64×64 | about 58 wide × 36 tall | "Four squat lidded grey clay jars standing in a row on a low wooden plank that runs left to right, each lid sealed with a blob of dark red wax pressed with a thumbprint. Seen from the front and above." |
| 2 | `seed-jars/along` | 64×96 | about 30 wide × 64 tall | "Three squat lidded grey clay jars standing one behind another on a low wooden plank that runs away from the viewer, each lid sealed with a blob of dark red wax pressed with a thumbprint. Seen from above, the plank running up the picture." |
| 3 | `threshing-floor` | 128×128 | about 94 wide × 94 tall | "A round flat threshing floor of irregular flat grey stones fitted together and beaten smooth, a ring of darker edge stones around it, a few wisps of pale straw caught between the stones. It lies flat on the ground, seen from above." |
| 4 | `clay-channel` | 64×128 | about 26 wide × 124 tall | "A long straight shallow trough of fired reddish clay lying in the ground, running up the picture, its inside dark and damp with a glint of water. Flat on the ground, seen from above." |

For each step:
1. Save every candidate as `<raw folder>/candidates/<n>.png`, a numbered sheet `<raw folder>/candidates.png`, and your pick as `<raw folder>/pick.png`.
2. Pick the candidate closest to its target size that matches its description and uses no forbidden colour.
3. Don't place, pad or trim the pick: ART places it in its cell.

Retake once (`seed: 1235`) only if no candidate is the right object:
- step 1: no jars on a plank, or the plank not left to right;
- step 2: the plank not running up the picture (jars side by side instead of one behind another);
- step 3: not round, or not flat (a raised platform or a well);
- step 4: not a trough, or not running up the picture.

## Done when
1. Make `art/raw/field-pieces/contact.png`:
   - every pick at 4× on the holding's ground (`art/clean/tiles-holding/floor_0.png`, tiled), beside the player reference, each over its footprint drawn as a 1 px tile grid (1×4, 2×1, 1×2, 3×3);
   - each step's candidates sheet at 2×.
2. Run `bash scripts/cloud-setup.sh`, then `pnpm check`.
3. Commit the raw files, the manifest and the contact sheet, push, and open the draft PR.

The PR description holds:
- `contact.png`;
- a picks table: step, pick, its size against the target, and why;
- the colours each pick uses, and any forbidden colour;
- the generations per call, and the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- any step that failed twice.
