# Art job run-kindled-ash: the player's run cycle, in the sheet, with its stride

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`: the ramps, the skin rule, the eye rule, the W-hand rule;
- `docs/design/sprites.md` §2–§4 (the `run` row) and §8 ("Walk and run play by distance");
- `docs/design/art-pipeline.md`, all of it, especially "Remap", the skin mask and the failure messages;
- `art/clean/kindled-ash/README.md` and the scripts in `art/clean/kindled-ash/_scripts/`;
- `art/raw/ss01-kindled-ash/manifest.json`, which describes the character this job animates and how SS-01 recorded its calls.

The job generates the run, puts it into the finished `kindled-ash` recipe and measures its stride. It makes no code changes.

## Why
In encounters the Kindled always runs (Game design, 2026-10-16). G1.5c (#43) put `run` in the animation table: 6 frames, loop, 8 facings, M1. It plays by distance, one cycle per `anim.runCyclePx` (96 world px). The row is on `ANIMS_AWAITING_ART`, and until this sheet has it the engine plays `walk` in its place. MAIN takes `run` off that list in the next engine task. MAIN needs the measured stride per cycle to confirm the 96.

## Branch and PR
- Branch `art/run-kindled-ash` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: run-kindled-ash" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/run-kindled-ash -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files, plus `manifest.json`. Record the tool, the settings, the character and job ids, the generations per call, any retakes, and the sha256 of every file.
- Never commit the token, model files or anything from the environment.
- Don't edit raw files in `art/raw/`, or ART's frames and scripts in `art/clean/`, except where a step below says to run a script.

## Budget
- About **24 generations**, hard cap **40**. Call `get_balance` before the first call and at the end.
- If a single call quotes more than 30, or the total would pass 40, stop and ask David.
- At most one retake (all directions together), and only for a hard failure:
  - not a run (a walk, or no foot ever off the ground);
  - the figure redesigned (cloak, hood or colours changed);
  - the wrong facing;
  - the blade lost in most frames.

  Record the retake and why.
- Use `wait_for_jobs` to wait. Run at most 8 jobs at once.

## Step 1: generate
1. Call `get_character` (free) on SS-01's character `507ec529-642d-4b0e-999b-731be937ba15`. Check that it still exists and that `running-6-frames` is in its template list. If either fails, stop and ask David.
2. Call `animate_character` on it:
   - mode skeleton-v3;
   - `template_animation_id: "running-6-frames"`;
   - `animation_name: "run"`;
   - all 8 directions: S, SE, E, NE, N, NW, W, SW. Always pass `directions`.
3. Save every frame as `art/raw/run-kindled-ash/run/<direction>/frame-<n>.png`, with full direction names (`south-east`) and the frames as the output numbers them. Skeleton-v3 output has no rotation frame: frame 0 is the cycle's first frame.

## Step 2: the E and W blade
The side views will bring back the generator's crescent blade, which reads as a sickle. ART's script redraws it as the Hookblade:

`python3 art/clean/kindled-ash/_scripts/blade_ew.py art/raw/run-kindled-ash art/clean/kindled-ash run`

This writes `art/clean/kindled-ash/run/east/` and `/west/`. Look at every frame before and after (4× is enough). List any frame where the redraw looks wrong for ART: a blade at a wrong angle, leftovers of the old one, a hole in the figure. Don't edit the script.

## Step 3: the recipe
Add `run` to `art/sheets/kindled-ash.json`:
- S, SE, NE, N, NW, SW: `src` `art/raw/run-kindled-ash/run/<direction>`;
- E and W: `src` `art/clean/kindled-ash/run/<east|west>`;
- `frames: [0, 1, 2, 3, 4, 5]` in each facing, in cycle order;
- no `ground` key (`run` grounds per frame, like `walk`).

If a facing's cycle starts mid-stride, keep the order the generator gave. Report which frame is the first contact (a foot lands), so MAIN can line the engine up with it.

Then loop `pnpm art:build kindled-ash` until the finished build (`"draft": false`) passes. Never edit an output by hand. On a failure, read its message in `art-pipeline.md`:
- **Reserved colours or off-palette greys the existing rules don't reach:** widen a rule's scope (`anims` or `facings`) to take in `run`. Add a new rule only for a colour no existing rule maps. A rule must never take real skin: check `tones.png`.
- **Skin regions:** `skin.add` (one pixel) if it is skin (a hand, the neck, the face's shade under the hood). Otherwise use a `fixes` recolour: watcher-iron for belts and boots, wheel-brass-dark for grips, sleeper-ochre for hem shade.
- **Eye whites (S, SE, SW):** after a clean build, run `python3 art/clean/kindled-ash/_scripts/eyes.py run --apply`, run Prettier on the recipe (`node_modules/.bin/prettier --write art/sheets/kindled-ash.json`) and rebuild. Look at the faces the script lists under "look by hand", and add one husk-shell pixel per eye as `fixes` where a face is open.
- **Detached specks** (a sparkle off the figure): remove them with `fixes` (`null`).

Look at `contact.png` and `tones.png` yourself before you push.

## Step 4: the stride
Measure E and W, the side views, from the built sheet (`packages/shared/assets/sprites/kindled-ash.png` + `.json`), for both cycles:
- `walk_E_*` and `walk_W_*`, 6 frames;
- `run_E_*` and `run_W_*`, 6 frames.

1 sheet px is 1 world px (a v2 sheet draws at `pixelScale` 1).

For every frame, find the two boots: the opaque clusters in the lowest 6 rows of the figure, split where a column is empty. Record each boot's sole row (its lowest opaque row), its sole's x range, and whether it is planted: its sole on the figure's lowest row, within 1 px. Then report per cycle and facing:
- **spread:** the largest heel-to-heel distance between the two boots in any frame where both are on or near the ground. This is one step.
- **planted travel:** for each frame where a boot stays planted from the frame before, how far its sole moved backward (west in E, east in W), summed over the cycle.
- **no-slide distance per cycle:** the distance the figure must move per cycle for planted feet to stay still. Take the larger of 2 × spread and the summed planted travel, and say which one you used.
- **slide factor:** `walkCyclePx` 64 (walk) or `runCyclePx` 96 (run) divided by the no-slide distance. 1.0 means no slide.

Draw `docs/screenshots/run-kindled-ash/stride.png`: the frames of each measured cycle side by side at 4×, with a 1 px mark on each planted sole, and that row's numbers printed under it.

Check against ART's own reading of the walk E: a spread of about 9–10 px, which gives a no-slide distance of about 20 world px per cycle. If you get something very different, say why.

## Step 5: check and ship
- Run `pnpm check`. It runs `art:check` and the sheet tests. The finished sheet must pass with `run` present, while `run` is still on `ANIMS_AWAITING_ART`.
- Commit the raw files and `manifest.json`, `art/clean/kindled-ash/run/`, the recipe, the rebuilt sheet and `art/review/kindled-ash/`, and `stride.png`.
- Push and open the draft PR.

The PR description holds:
- `contact.png` (the run rows) and `stride.png`;
- the stride table: cycle, facing, spread, planted travel, no-slide distance, slide factor at 64 and 96;
- per direction:
  - whether it reads as a run;
  - which hand holds the blade (right hand; the W facings may show it in the near hand, as walk W does);
  - the height in px (sole to hood top, against 45);
  - the bob (highest minus lowest hood-top row over the cycle);
  - the first-contact frame;
- the remap scope changes, the new `skin.add` and `fixes` counts, and the E/W frames set aside for ART;
- the character id, the generations per call, and the balance before and after;
- "Requests for MAIN": take `run` off `ANIMS_AWAITING_ART`, plus anything the stride numbers suggest for `runCyclePx`;
- the test plan (`pnpm art:build kindled-ash`, `pnpm art:check`, `pnpm check`).

## Done when
The draft PR exists, the finished sheet has `run` in all 8 facings, and `pnpm check` passes.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- whether any direction failed;
- the no-slide distance per cycle for walk and run, and the slide factor at 64 and 96;
- anything set aside for ART.
