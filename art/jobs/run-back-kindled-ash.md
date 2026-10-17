# Art job run-back-kindled-ash: the player's backpedal, in the sheet, with its stride

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`: the ramps, the skin rule, the eye rule, the W-hand rule;
- `docs/design/sprites.md` §4 (the `run_back` row) and §8 ("Walk and run play by distance", backpedalling);
- `docs/design/art-pipeline.md`, all of it, especially "Remap", the skin mask and the failure messages;
- `art/clean/kindled-ash/README.md` and the scripts in `art/clean/kindled-ash/_scripts/`;
- `art/jobs/run-kindled-ash.md` and its PR #46: this job is the same shape, and its stride method is reused below;
- `art/raw/ss01-kindled-ash/manifest.json`, which describes the character this job animates.

The job generates the backpedal, puts it into the finished `kindled-ash` recipe and measures its stride. It makes no code changes.

## Why
The Kindled backpedals when it moves more than 112.5° away from its aim (G1.5h). Today the engine plays `run` in reverse for that. In David's M1 playtest it read as moonwalking: a full sprint leaning toward the aim, with the cape streaming the way the body travels. M1 polish adds `run_back`:
- 4 frames, loop, 8 facings;
- plays by distance, one cycle per `anim.backCyclePx` (48 world px to start; ART tunes it from this job's stride);
- on `ANIMS_AWAITING_ART` until this sheet has it.

**The look:**
- the Kindled faces its aim and steps backwards, upright, with short careful steps;
- the hood level, no forward sprint lean;
- the cape hanging, or swinging slightly toward the aim (the way it moves away from), never streaming behind in the direction of travel;
- the Hookblade held ready in its facing's hand (style-sheet rule: S and the E-side facings in the right hand, W/SW in the near hand, mostly hidden in N/NW).

## Before you start
Check that M1 polish is merged: `run_back` must be a row of `KINDLED_ANIMS` in `packages/shared/src/sprites.ts` on `main`. If it isn't:
- do Steps 1 and 2 only;
- commit the raw files and the E/W clean frames;
- open the draft PR saying the recipe step waits for M1 polish.

## Branch and PR
- Branch `art/run-back-kindled-ash` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: run-back-kindled-ash" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/run-back-kindled-ash -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files, plus `manifest.json`. Record:
  - the tool and the settings;
  - the character and job ids;
  - the generations per call and any retakes;
  - the sha256 of every file.
- Never commit the token, model files or anything from the environment.
- Don't edit raw files, or ART's existing frames and scripts in `art/clean/`, except where a step below says to run a script.

## Budget
- About **16 generations**, hard cap **30**. David approved this.
- Call `get_balance` before the first call and at the end.
- If a single call quotes more than 16, or the total would pass 30, stop and ask David.
- At most one retake (all directions together), and only for a hard failure:
  - the figure walks forward, not backwards;
  - the figure is redesigned (cloak, hood or colours changed);
  - the wrong facing;
  - the blade is lost in most frames.

  Record the retake and why.
- Use `wait_for_jobs` to wait. Run at most 8 jobs at once.

## Step 1: generate
1. Call `get_character` (free) on SS-01's character `507ec529-642d-4b0e-999b-731be937ba15`. Check that it still exists, and save its template list in the manifest. If the character is missing, stop and ask David.
2. **If the template list has a backwards walk** (a name with "back" and "walk" in it), use it:
   - call `animate_character` with mode skeleton-v3, that template, `animation_name: "run_back"`, and all 8 directions;
   - skeleton-v3 moves our own pixels, so it keeps the design best.
3. **Otherwise**, call `animate_character` with:
   - mode v3, `animation_name: "run_back"`, all 8 directions (always pass `directions`), `frame_count: 6`;
   - description: "steps backwards away from the viewer's facing direction while still facing forward, upright and alert, short careful steps, the hooded cloak hanging and swaying slightly forward, the short hooked blade held ready in the hand, a smooth looping step cycle".

   In v3 output, frame 0 is the rotation: keep it, but don't use it in the cycle.
4. Save every frame as `art/raw/run-back-kindled-ash/run_back/<direction>/frame-<n>.png`, with full direction names (`south-east`).

## Step 2: the E and W blade
Run ART's script, as for the run:

`python3 art/clean/kindled-ash/_scripts/blade_ew.py art/raw/run-back-kindled-ash art/clean/kindled-ash run_back`

This writes `art/clean/kindled-ash/run_back/east/` and `/west/`. Look at every frame before and after, at 4×. List any frame where the redraw looks wrong: a blade at a wrong angle, leftovers of the old one, or a hole in the figure. Don't edit the script.

## Step 3: pick 4 frames and add the recipe
Per facing, pick the 4 frames that make the best loop, in cycle order:
1. a contact with the left foot back;
2. the passing frame;
3. a contact with the right foot back;
4. the passing frame.

Start at a contact, so frame 0 of every facing is a contact. Never pick a smear frame or the v3 rotation frame. If a facing has no clean 4-frame loop, pick the closest and say so.

Add `run_back` to `art/sheets/kindled-ash.json`:
- S, SE, NE, N, NW, SW: `src` `art/raw/run-back-kindled-ash/run_back/<direction>`;
- E and W: `src` `art/clean/kindled-ash/run_back/<east|west>`;
- your 4 frames per facing;
- no `ground` key (`run_back` grounds per frame, like `run`).

Then loop `pnpm art:build kindled-ash` until the finished build (`"draft": false`) passes. Never edit an output by hand. Handle failures as `art/jobs/run-kindled-ash.md` Step 3 says:
- widen remap scopes to take in `run_back`;
- `skin.add` for real skin, `fixes` for belts, boots, grips and hem shade;
- for the eye whites, `eyes.py run_back --apply`, then Prettier, then rebuild;
- `null` fixes for detached specks.

Look at `contact.png` and `tones.png` yourself before you push.

## Step 4: the stride
Measure `run_back_E_*` and `run_back_W_*` from the built sheet (1 sheet px is 1 world px), with the method of `art/jobs/run-kindled-ash.md` Step 4. Two differences: the figure moves backwards, so a planted sole moves **forward** relative to the figure (east in E, west in W), and the cycle has 4 frames.

Report per facing:
- spread;
- planted travel;
- no-slide distance per cycle (say whether it came from 2 × spread or from the planted travel);
- slide factor at `backCyclePx` 48.

Draw `docs/screenshots/run-back-kindled-ash/stride.png` as the run job did.

## Step 5: check and ship
- Run `bash scripts/cloud-setup.sh`, then `pnpm check`. The finished sheet must pass with `run_back` present while it is still on `ANIMS_AWAITING_ART`.
- Commit:
  - the raw files and `manifest.json`;
  - `art/clean/kindled-ash/run_back/`;
  - the recipe;
  - the rebuilt sheet and `art/review/kindled-ash/`;
  - `stride.png`.
- Push and open the draft PR.

The PR description holds:
- `contact.png` (the `run_back` rows) and `stride.png`;
- the stride table;
- per direction:
  - whether it reads as stepping backwards, upright, with the cape not streaming the wrong way;
  - which hand holds the blade;
  - the height in px (sole to hood top, against 45);
  - the bob;
  - the frames picked;
- the remap scope changes, the new `skin.add` and `fixes` counts, and the E/W frames set aside for ART;
- the character id, the template or mode used, the generations per call, and the balance before and after;
- "Requests for MAIN": take `run_back` off `ANIMS_AWAITING_ART`, plus the `backCyclePx` the stride suggests;
- the test plan.

## Done when
The draft PR exists, the finished sheet has `run_back` in all 8 facings (or, before M1 polish, the raw and E/W frames are committed), and `pnpm check` passes.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- whether any direction failed;
- the no-slide distance per cycle and the slide factor at 48;
- anything set aside for ART.
