# Art job husks-m1: the Peeling and the Nutshell at B (draft sheets)

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`, especially the Husk rules: hollow shells, the pale shell ramp, one bright core with its 1 px ring, no face, eyes or legs;
- `docs/design/sprites.md` §2–§4: the 64×64 cell, origin (32, 54), and the Peeling and Nutshell tables. The tables live in `HUSK_TABLES` in `packages/shared/src/sprites.ts`;
- `docs/design/readability.md`: Husk cores and telegraphs;
- `docs/design/combat.md` §8: what the two Husks do;
- `docs/design/art-pipeline.md`: recipes, `flipX`, telegraph frames;
- `art/raw/ss01-kindled-ash/manifest.json`, for how SS-01 recorded its calls.

The job generates the two Husks and their moving parts, and builds both as **draft** recipes. ART then draws the rest (spawn stages, telegraph, chipped, drop) and finishes them, as with kindled-ash. It makes no code changes.

## Branch and PR
- Branch `art/husks-m1` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: husks-m1" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/husks-m1 -f base=main -F draft=true -f body=...`). If `gh` is not available, use the GitHub connector.
- Download every PixelLab result at once (links can expire) as raw 1× files, plus `art/raw/husks-m1/manifest.json`. Record the tool, the settings, the character and job ids, the generations per call, any retakes, and the sha256 of every file.
- Pass images by upload reference, never as inline base64.
- Never commit the token, model files or anything from the environment.
- Don't retouch or recolour anything: ART does that through the recipe and `art/clean/`.

## Budget
- About **25 generations**, hard cap **60**. Call `get_balance` before the first call, after each Husk, and at the end.
- If a single call quotes more than 30, or the total would pass 60, stop and ask David.
- At most one retake per animation, and only for a hard failure:
  - the wrong action;
  - the Husk redesigned (a face, eyes or legs appear, or the colours change);
  - the core lost.
- Use `wait_for_jobs` to wait. Run at most 8 jobs at once.

## The two Husks
Both are hollow, translucent shells around one bright core. Shared material and rules:
- Shell: hollow-light #F4EFE6, husk-shell #E8E2D6, hollow-dusk #A99FC4 for the translucent shade.
- Core: husk-core #FFF4C7 inside a 1 px hollow-deep #2A2540 ring.
- Outline: hollow-deep #2A2540.
- No face, eyes, mouth, limbs or text.
- Both rest on row 53 of a 64×64 canvas.
- Both are drawn **facing east**: the engine flips them when they move west.

| Husk | Size on the 64 canvas | Shape |
|---|---|---|
| Peeling (light, fast swarmer, one layer) | about 22 × 18 px | ART's exemplar `art/anchors/husk-peeling-64.png` *is* the Peeling: a curled peel of shell spiralling round its core |
| Nutshell (heavy, slow, two layers) | about 40 px wide × 34 px tall | a big squat nut-shaped shell. The outer layer is thick and ridged, with a crack along the front; through it the inner layer shows, and the core sits inside the inner one. It sits low and heavy, with no visible feet |

## Step 1: the Nutshell's base
`create_image_pro`, 64×64, `no_background: true`, the 28-colour palette (as SS-01 and g13b-job1 passed it), `seed: 1234`.
- Reference images:
  - `art/anchors/husk-peeling-64.png`, usage "enemy style: the same hollow pale shell, translucent lavender shade, core and ring, outline";
  - `art/anchors/kindled-ash-s-64.png`, usage "scale only: this is the player, 45 px tall; the Husk sits beside it".
- Description: "A Nutshell Husk: a big squat hollow nut-shaped double shell, about 40 px wide and 34 px tall, resting heavily on the ground. The thick ridged outer shell is pale and translucent (white to lavender), cracked along the front; through the crack the smoother inner shell shows, and inside it one small bright pale-yellow core with a dark ring. No face, eyes, mouth or legs. Top-down RPG pixel art seen from a low three-quarter view, light from the top left, a 1 px dark violet outline, two or three shades per material, no dithering, transparent background, no text or letters."

Save every candidate. Pick the one closest to 40 × 34 with the core visible through the crack. Pad or trim it onto 64×64 with its lowest pixel on row 53, by moving pixels, never by scaling, and save it as `art/raw/husks-m1/nutshell/base.png`. One retake (seed 1235) is allowed if no candidate is a hollow shell with a visible core.

## Step 2: the characters
For each Husk, call `create_character`:
- mode `v3`;
- `reference_image_url` = the base: the Peeling's is `art/anchors/husk-peeling-64.png`, the Nutshell's is Step 1's pick;
- 4 directions.

Description: Step 1's for the Nutshell. For the Peeling: "A Peeling Husk: a small curled peel of pale translucent shell, about 22 px wide, spiralling round one small bright pale-yellow core with a dark ring; no face, eyes, mouth or legs; it floats low over the ground." Use the same style sentence as Step 1.

Save the east rotation as `<husk>/rotation-east.png`. Only east is used.

## Step 3: the animations (east only)
`animate_character`, v3, `directions: ["east"]`, one call per animation, with `animation_name` as below. Save every frame as `art/raw/husks-m1/<husk>/<animation>/frame-<n>.png`; frame 0 is the rotation, so keep it as the ground reference.

| Husk | Animation | Description | `frame_count` |
|---|---|---|---|
| Peeling | `idle` | "the curled shell breathes: it opens a little and closes again, floating in place" | 4 |
| Peeling | `lunge` | "stretches long and thin toward the right, darts forward to strike, then curls back to its resting shape" | 6 |
| Peeling | `death` | "the curled shell splits open and its pieces fall apart; the bright core flares into a thin ring of light and fades" | 6 |
| Nutshell | `idle` | "the heavy shell settles and lifts very slightly, as if breathing" | 4 |
| Nutshell | `walk` | "the heavy shell rocks forward toward the right on hidden feet, tilting forward and back, in place" | 4 |
| Nutshell | `slam` | "rears up and slams its whole shell down onto the ground in front of it" | 6 |
| Nutshell | `regrow` | "a cracked shell closing back up: pale shell grows back over the inner shell" | 4 |
| Nutshell | `death` | "the shell cracks apart into large pieces that fall away; the bright core flares into a thin ring of light and fades" | 6 |

## Step 4: draft recipes
Write `art/sheets/husk-peeling.json` and `art/sheets/husk-nutshell.json`:
- `"kind": "husk"`, `"outline": "other"`, `"draft": true`;
- a `notes` line naming this job;
- `ground: { "ref": 0 }`.

Pick frames by these rules. Never pick a smear frame (a pale swoosh instead of the shell).

| Husk | Anim | Frames | Pick |
|---|---|---|---|
| Peeling | `idle` | 2 | the most closed and the most open |
| Peeling | `lunge` | 3 | the stretch (longest), the hit (furthest right), the settle (last) |
| Peeling | `hit` | 1 | idle's first pick |
| Peeling | `death` | 4 | spread over the split; the last with the core as a ring |
| Nutshell | `idle` | 2 | the lowest and the highest |
| Nutshell | `walk` | 4 | the cycle in order, tilted forward, level, tilted back, level |
| Nutshell | `slam` | 2 | 0 = the shell highest before it drops, 1 = the impact (lowest, widest) |
| Nutshell | `hit` | 1 | idle's first pick |
| Nutshell | `regrow` | 3 | most cracked, half, closed |
| Nutshell | `death` | 4 | spread over the break; the last with the core as a ring |

Leave out `spawn`, `telegraph`, `chipped` (Peeling), `chipped_outer` and `chipped_inner` (Nutshell), and `drop`: ART draws those.

Then run `pnpm art:build husk-peeling` and `pnpm art:build husk-nutshell`. A draft must build. Off-palette pixels, outline gaps, flags and missing animations are expected; report them, don't fix them. If a build fails, read the message in `art-pipeline.md` and fix the recipe (a path, a frame index, the ground ref), never the art. If a frame reaches outside the 64×64 cell, leave it out and say which and by how much.

## Done when
Run `pnpm check`, commit (raw files, manifest, recipes, `art/review/husk-*/`), push, and open the draft PR. A draft build writes only `art/review/`; M1's v1 Husk sheets stay in `packages/shared/assets/sprites/` until ART's finished build replaces them.

The PR description holds:
- each Husk's `contact.png`;
- the Nutshell base pick and why;
- a picks table: animation, source frames, and why;
- the report summary (off-palette pixels and the largest ΔE, outline gaps, flags);
- measured sizes: width and height of the idle pick against the targets (22 × 18, 40 × 34);
- the character ids, the generations per call, and the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- any animation that failed twice.
