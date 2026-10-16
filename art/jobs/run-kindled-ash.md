# Art job run-kindled-ash: the player's run cycle, and the stride of walk and run

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`;
- `docs/design/sprites.md` §2–§4 (the Kindled cell and the animation table);
- `art/raw/ss01-kindled-ash/manifest.json` (the character this job animates, and how SS-01 recorded its calls).

This job makes no code changes and writes nothing to `packages/shared/assets` or `art/sheets/`.

## Why
Game design (decision log, 2026-10-16) sets movement after David's playtest:
- outside encounters the Kindled walks at 0.7× `moveSpeed` and breaks into a run after 1.2 s of steady movement;
- walk and run playback follow distance: one walk cycle per 64 world px, one run cycle per 96.

The sheet has no run yet. This job generates it on SS-01's character and measures how far the feet travel in a walk cycle and in a run cycle. ART then decides the picks and integrates `run` into the recipe once MAIN has added it to the animation table.

## Shared header (as in `art/jobs/`)
- Branch `art/run-kindled-ash` from the latest `main`; never push to main. Open a **draft** PR "Asset: run-kindled-ash" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/run-kindled-ash -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files, plus `manifest.json`. Record the tool, the settings, the character and job ids, the generations per call, any retakes, and the sha256 of every file.
- Never commit the token, model files or anything from the environment.
- Don't retouch or recolour anything. ART cleans the frames (the E/W blade, the eyes, the colours) through the recipe and `art/clean/`.

## Budget
- About **24 generations**, hard cap **40**. Call `get_balance` before the first call and at the end.
- If a single call quotes more than 30, or the total would pass 40, stop and ask David.
- At most one retake (all directions together), and only for a hard failure:
  - not a run (a walk, or no feet leaving the ground);
  - the figure redesigned (cloak, hood or colours changed);
  - the wrong facing;
  - the blade lost in most frames.

  Record the retake and why.
- Use `wait_for_jobs` to wait. Run at most 8 jobs at once.

## Step 1: the run
1. Call `get_character` (free) on SS-01's character `507ec529-642d-4b0e-999b-731be937ba15`. Check that it still exists and that `running-8-frames` is in its template list. If either fails, stop and ask David.
2. Call `animate_character` on that character:
   - mode skeleton-v3;
   - `template_animation_id: "running-8-frames"`;
   - `animation_name: "run"`;
   - all 8 directions: S, SE, E, NE, N, NW, W, SW. Always pass `directions`.
3. Save every frame as `art/raw/run-kindled-ash/run/<direction>/frame-<n>.png`, with full direction names (`south-east`) and the frames as numbered by the output. Skeleton-v3 output has no rotation frame: its frame 0 is the cycle's first frame.
4. Make `art/raw/run-kindled-ash/preview.png` with PIL: one row per direction, 8 frames each, at 3×, on `#5B5478`.

## Step 2: the stride
Measure E and W, the side views, for both cycles:
- the walk: `art/raw/ss01-kindled-ash/walk/east` and `/west`, 6 frames;
- the run: this job's `run/east` and `run/west`, 8 frames.

1 sprite px is 1 world px for a v2 sheet (`pixelScale` 1).

For every frame, find the two boots: the opaque clusters in the lowest 6 rows of the figure, split where a column is empty. Record for each boot:
- its sole row (its lowest opaque row);
- its sole's x range;
- whether it is planted: its sole is on the figure's lowest row, within 1 px.

From those, report per cycle and facing:
- **spread**: the largest heel-to-heel distance between the two boots in any frame where both are planted, or where one is planted and the other is about to land. This is one step.
- **planted travel**: for each frame where a boot stays planted from the frame before, how far its sole moved backward (west in E, east in W). Sum it over the whole cycle.
- **no-slide distance per cycle**: the distance the figure must move for the planted feet to stay still on the ground. Take the larger of 2 × spread and the summed planted travel, and say which one you used.
- **slide at Game design's numbers**: 64 world px (walk) or 96 (run) divided by the no-slide distance. 1.0 means no slide.

Draw `art/raw/run-kindled-ash/stride.png`. Show the frames of each measured cycle side by side at 4×, with a 1 px mark on each planted sole (`#E0457B` is fine here: this image is not a sprite and never ships). Under each row, print that row's numbers.

Check for ART: SS-01's walk E should come out at a spread of about 9–10 px, which gives a no-slide distance of about 20 world px per cycle. If you get something very different, say why.

## Step 3: report, no recipe
Don't add `run` to `art/sheets/kindled-ash.json`. The animation isn't in the Kindled table (`sprites.md` §4) or in the pipeline yet, so a recipe with it would not build. ART integrates it after MAIN adds it.

In the PR description, put:
- `preview.png` and `stride.png`;
- the stride table (cycle, facing, spread, planted travel, no-slide distance, slide at 64/96);
- per direction: whether it reads as a run, whether the blade stays in the right hand (the west facings may show it in the near hand), the height in px (sole to hood top, against the 45 px target), and the bob (the highest minus the lowest hood-top row over the cycle; the style sheet allows 2 px for walk and idle, so report it as it is);
- which frame of the 8 is the first contact (a foot lands), so the engine can start the cycle there;
- the character id, the generations per call, and the balance before and after;
- anything surprising;
- **Requests for MAIN:** add `run` to the Kindled table in `sprites.md` §4 and to the pipeline's table: 8 frames, loop, 8 facings, M1 (it is played outside encounters). Also anything the stride numbers suggest for Game design's 64/96.

Run `pnpm check`, commit (the raw files, `manifest.json`, `preview.png` and `stride.png`), push, and open the draft PR.

## Done when
The draft PR exists with the raw run, the preview, the stride image and table, and the requests for MAIN.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- whether any direction failed;
- the no-slide distance per cycle for walk and run, and the slide factor at 64 and 96.
