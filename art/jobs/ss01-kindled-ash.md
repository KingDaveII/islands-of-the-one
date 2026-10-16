# Art job ss01-kindled-ash: the player's M1 sheet at B (SS-01)

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`;
- `docs/design/art-pipeline.md` (recipes and `pnpm art:build`);
- `docs/design/sprites.md` §2–§4 (the 112×80 Kindled cell and the animation table).

This job makes no code changes.

## Shared header (as in `art/jobs/`)
- Branch `art/ss01-kindled-ash` from the latest `main`; never push to main. Open a **draft** PR "Asset: ss01-kindled-ash" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/ss01-kindled-ash -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files, plus `manifest.json`: tool, prompt, settings, character and job ids, generations per call, retakes, the sha256 of every file.
- No code changes, and nothing written to `packages/shared/assets`: the recipe stays a draft. Anything the engine needs goes to MAIN as a request in the PR description.
- Never commit the token, model files or anything from the environment. Pass images by upload reference, never inline base64.

## What this job is for
The first production sheet at option B: `kindled-ash`, the player in the Ash Remembrance, with every **M1** animation of the Kindled table. The M2 ones (`carry_idle`, `carry_walk`, `sit`) come later. Everything starts from ART's 45 px exemplar, `art/anchors/kindled-ash-s-64.png`, and goes through the G1.2 pipeline as a **draft** recipe. ART then reviews it, adds the fixes, remaps and skin overrides, and turns it into the finished sheet.

## Budget and rules
- Budget: **about 155 generations, hard cap 220**. Call `get_balance` before the first call, after each animation, and at the end.
- If a single call quotes more than 30, or the total would pass 220, stop and ask David.
- Retakes: at most one per animation (all directions together), and only for a hard failure:
  - the blade lost in most frames;
  - the wrong action;
  - the figure redesigned (cloak, hood or colours changed);
  - the wrong facing.

  Record every retake and why.
- `wait_for_jobs` to wait. At most 8 jobs at once; queue in batches.
- Don't retouch or recolour anything. ART does that through the recipe.

## Step 1: the character
1. Upload `art/anchors/kindled-ash-s-64.png` and check its sha256 against the file in the repo.
2. Call `create_character` with mode `v3`, `reference_image_url` = that upload, and 8 directions.

   Description: "Ash, a small Kindled clay figure about 45 px tall with grey-ochre clay skin and three amber freckles, in a soot-grey hooded cloak with an ember-singed hem over a grey tunic with a gold collar trim, an iron-grey belt and boots, dark trousers; a short hooked steel blade with a brown leather grip in the right hand. Top-down RPG pixel art seen from a low three-quarter view, light from the top left, a 1 px dark navy outline, no dithering, transparent background."
3. Save the 8 rotations as `art/raw/ss01-kindled-ash/rotation/<direction>.png`.
4. Record the character id and the template list from `get_character` (free).
5. Check the hand: the blade must stay in the right hand in every facing. In W, NW and SW the right hand is the far hand, so the blade is partly behind the body. If the rotation mirrors it into the left hand in the west facings, say so; that is not a retake.

## Step 2: the animations
On the new character, with `animate_character`, using the names below as `animation_name`. Always pass `directions` (v3 defaults to south only).
- The 8 facings are S, SE, E, NE, N, NW, W, SW.
- The 4 facings are S, E, N, W.

| Animation(s) | Engine | Setting | Facings | Expected gens |
|---|---|---|---|---|
| `idle` | skeleton-v3 | `template_animation_id: "breathing-idle"` | 8 | ~24 |
| `walk` | skeleton-v3 | `template_animation_id: "walking-6-frames"` | 8 | ~24 |
| `dodge` | v3 | "a quick forward roll: crouches low, tucks into a tight ball and rolls forward, then springs back up to stand", `frame_count: 8` | 8 | ~8 |
| `light_1` | v3 | "a quick horizontal slash with the short hooked blade in the right hand, from the right side across to the left, then back to guard", `frame_count: 6` | 8 | ~8 |
| `light_2` | v3 | "a quick backhand slash with the short hooked blade in the right hand, from the left side back across to the right, then back to guard", `frame_count: 6` | 8 | ~8 |
| `light_3` | v3 | "a heavy downward chop with the short hooked blade in the right hand, from above the shoulder down to the ground, ending crouched low", `frame_count: 6` | 8 | ~8 |
| `heavy` (charge, thrust, hold, recover) | v3 | "draws the short hooked blade back low behind the hip and holds it, crouched, then thrusts it straight forward at full arm's length, holds the thrust, then pulls back to guard", `frame_count: 10` | 8 | ~8–16 |
| `haul` (throw, recover) | v3 | "throws the right arm straight forward as if casting a chain, holds the arm out, then pulls the arm back to the chest", `frame_count: 6` | 8 | ~8 |
| `haul_pull` | v3 | "plants both feet, leans back and pulls hard with both hands on a rope in front, two strong pulls", `frame_count: 4` | 8 | ~8 |
| `haul_slide` | v3 | "dragged forward on planted feet, leaning back against the pull, cloak streaming back", `frame_count: 4` | 8 | ~8 |
| `hit` | skeleton-v3 | `template_animation_id: "taking-punch"` | 4 | ~12 |
| `death` | skeleton-v3 | `template_animation_id: "falling-back-death"` | 4 | ~12 |

- **If a template isn't in `get_character`'s list:** use v3 with a one-line description of the same motion, and record it.
- **Saving:** save every frame as `art/raw/ss01-kindled-ash/<animation>/<direction>/frame-<n>.png`, with the full direction name (`south-east`). In v3 output frame 0 is the rotation; keep it, because the recipe uses it as the ground reference.

## Step 3: picks and the draft recipe
Replace `art/sheets/kindled-ash.json` (MAIN's Job 4 test draft) with a draft from these files:
- `"kind": "kindled"`, `"outline": "player"`, `"draft": true`;
- a `notes` line naming this job.

Each animation and facing gets its `src` and the frames picked by the rules below. **Never pick frame 0 of a v3 output, or a smear frame**, which draws a big pale swoosh instead of the blade.

| Animation | Frames | Pick | `ground` |
|---|---|---|---|
| `idle` | 2 | the rest frame, then the fullest breath (the highest top row) | default (`"frame"`) |
| `walk` | 6 | all six, in order | default |
| `dodge` | 4 | the crouch; the two most ball-like roll frames; the rise | `{ "ref": 0 }` |
| `light_1/2/3` | 3 each | wind-up (blade furthest back), swing (the widest arc, blade across the body), recover (the last frame) | `{ "ref": 0 }` |
| `heavy_charge` | 3 | from the heavy output: three frames drawing the blade back, the last the most drawn back | `{ "ref": 0 }` |
| `heavy_thrust` | 2 | the arm going forward, then full extension | `{ "ref": 0 }` |
| `heavy_hold` | 1 | full extension (it may repeat the last thrust frame) | `{ "ref": 0 }` |
| `heavy_recover` | 2 | two frames coming back to guard | `{ "ref": 0 }` |
| `haul_throw` | 2 | from the haul output: the arm going out, then fully out | `{ "ref": 0 }` |
| `haul_recover` | 2 | the arm coming back, then at rest | `{ "ref": 0 }` |
| `haul_pull`, `haul_slide` | 2 each | the two most different frames, so they loop | `{ "ref": 0 }` |
| `hit` | 2 | the flinch (the first frame that moves), then the deepest stagger | `{ "ref": 0 }` |
| `death` | 6 | spread evenly over the fall; the last frame lying still | `{ "ref": 0 }` |

Skeleton-v3 output has no rotation frame: its own frame 0 is the reference.

Then run `pnpm art:build kindled-ash` and commit:
- the raw files and `manifest.json`;
- the recipe;
- `art/review/kindled-ash/` (contact, tones, report).

The build must not fail. If it does, read the message in `docs/design/art-pipeline.md` and fix the recipe (a path, a frame index, a `ground` ref), never the art. One exception: if a frame reaches outside the 112×80 cell, leave that frame out, keep the draft building, and report which action and how far it reaches from the feet.

Skin regions, off-palette pixels, outline gaps and flags are expected in a draft. Report them, don't fix them.

## Done when
Run `pnpm check`, commit, push, and open the draft PR. In the PR description:
- `contact.png` and `tones.png`;
- a picks table: animation, facing, source frames picked and why, retakes;
- the report summary, as in PR #33:
  - off-palette pixels and the largest ΔE;
  - shifts;
  - outline gaps;
  - the number of skin regions;
  - the flags;
- **the reach:** for the heavy thrust and the light swings in E and W, the furthest opaque pixel from the feet, against the cell's ±56 px;
- the west-facing blade check from step 1;
- the character id, the generations per animation, the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- any animation that failed twice;
- whether the heavy thrust fits the cell.
