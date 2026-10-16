# Art job kindled-ash-finish: the finished kindled-ash sheet (SS-01, part 2)

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md` (the ramps, the skin-ramp rule, the W-hand rule);
- `docs/design/art-pipeline.md`, all of it, especially "Remap", `flipX` and the failure messages;
- `docs/design/sprites.md` §2–§4;
- `art/clean/kindled-ash/README.md`.

This job writes a recipe and builds it. It makes **no PixelLab generations**: if one turns out to be unavoidable, stop and ask David. It makes no code changes.

## Branch and PR
- Work on the existing branch **`art/kindled-ash-finish`**: `git fetch origin && git checkout art/kindled-ash-finish`. ART has already committed the hand-made frames in `art/clean/kindled-ash/` and this prompt. Rebase it on the latest `main` first.
- Open a **draft** PR "Asset: kindled-ash" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/kindled-ash-finish -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Never commit the token or anything from the environment. Don't edit raw files in `art/raw/` or ART's files in `art/clean/`. Everything you decide goes in `art/sheets/kindled-ash.json`.

## What the PR delivers
`art/sheets/kindled-ash.json` with `"draft": false`. `pnpm art:build kindled-ash` then writes the first v2 sheet into `packages/shared/assets/sprites/` (`kindled-ash.png`, `.json`, `.skin.png`), replacing the v1 placeholder. Commit those, the rebuilt `art/review/kindled-ash/` and the recipe.

A finished build fails on any of the following (MAIN's list; `art-pipeline.md` names each failure):
- a missing animation, facing or frame. Every M1 row must be complete: 8 facings for idle 2, walk 6, dodge 4, light_1/2/3 3 each, heavy_charge 3, heavy_thrust 2, heavy_hold 1, heavy_recover 2, haul_throw 2, haul_recover 2, haul_pull 2 and haul_slide 2; S, E, N and W for hit 2 and death 6. Leave carry and sit out;
- a reserved colour;
- a skin region left unresolved;
- a stale remap rule;
- anything on the cell's ring or outside the 96×80 cell.

## Step 1: start from the SS-01 draft
The SS-01 recipe on main has the picks for everything SS-01 delivered (its table is in PR #37). Keep those picks, and set `"draft": false` only at the end.

**Ground.** It is per animation:
- idle and walk: `"frame"` (the default);
- everything else: `{ "ref": 0 }`.

Every source folder, ART's clean ones included, has its rotation as frame 0, so `ref: 0` works everywhere.

## Step 2: fill the gaps, in this order of preference
1. **ART's clean frames:**
   - `heavy_charge`, `heavy_thrust`, `heavy_hold` and `heavy_recover` N come from `art/clean/kindled-ash/heavy/north`: frames [1, 2, 3], [4, 5], [6] and [7, 8].
   - `dodge` S and N come from `art/clean/kindled-ash/dodge/south` and `.../north`: frames [1, 2, 3, 4].
2. **The dodge's E side, mirrored:** E, SE and NE are W, SW and NW's dodge sources and picks with `"flipX": true`. Those three facings rolled; the east ones didn't.
3. **Remap rescue.** A frame skipped only for reserved colours comes back once Step 3's rescue rules map those colours. Pick by the SS-01 rules:
   - wind-up = blade furthest back;
   - swing = the widest arc;
   - recover = the last frame;
   - never a smear (a pale swoosh where the blade should be).
4. **Mirror the opposite side** when a facing still has no clean frames: use NE for NW, E for W or SE for SW (or the reverse) with `flipX`, the same picks and the same animation. Expected for heavy NW if its white and blue crescent frames don't read as the Hookblade after the remap.
5. **N only:**
   - reuse another light attack's N frames (light_2 N may repeat light_1 N's);
   - use the rotation (frame 0) as the wind-up when the blade is behind the body anyway;
   - a frame may repeat within an animation.

Record in the PR, per gap, which of these filled it.

## Step 3: remap rules (ART's choices)
Write them from the build report's "top 20 off-palette source colours" and from each reserved-colour failure. Exact colours go in `from`; families of colours get `near` with a small `within` (≤ 4). Order matters, because the first rule that matches wins:

| What it is | → token | Scope |
|---|---|---|
| Near-white highlights (fail as signal-hit) on the blade, buckle and eye whites | `husk-shell` | everywhere |
| Glow-yellow (fails as spark-glow) on the blade or as stray sparkles | `husk-shell`; a sparkle detached from the figure is removed with `fixes` (`null`) | everywhere |
| Dark reds (fail as telegraph-dark) and pinks (telegraph) in the hem and singe | `sleeper-ochre` (dark), `choir-flame` (bright) | everywhere |
| Blue or teal blade colours (heavy NW, heavy N take 1) | `watcher-stone` (mid), `husk-shell` (light) | `anims` and `facings` where they occur |
| Neutral light greys on the blade that the snap sends to tan or lavender | `husk-shell` | everywhere, `exclude: "face"` |
| Mid and blue greys on the blade | `watcher-stone` | everywhere, `exclude: "face"` |
| Warm or neutral greys on cloth, belt and boots that the snap sends into #8C7F6E/#5E5448 | `watcher-iron` (mid), `hollow-deep` (dark) | `exclude: "face"`, and a `box` per frame where a hand touches them |
| Brown greys on the grip | `wheel-brass-dark` | `box` per frame |
| The back views' amber hem (#F2B65A in N, NE and NW: no face there, so it isn't freckles) | `choir-flame` | `facings: ["N", "NE", "NW"]` |

- **A rule must never take real skin.** Face, neck and hands keep #8C7F6E/#5E5448: the face is covered by `exclude: "face"`, the hands by `box`. Check `tones.png` after every rule batch: anything that changes colour with the tone but isn't skin is a mistake.
- **Remove a rule rather than leave it stale.** A finished build fails on a rule that matches nothing.

## Step 4: the skin regions
After the remaps, every remaining region in the build's list gets one of these:
- `skin.add` (one pixel of it) if it is skin: a hand, the neck, an ear, or the face's shade under the hood;
- a `fixes` recolour if it is a belt, boot, grip or hem pixel cluster that no rule could reach: watcher-iron for belts and boots, wheel-brass-dark for grips, sleeper-ochre for hem shade.

Both skin colours must keep at least one masked pixel.

## Step 5: iterate to a clean finished build
Loop `pnpm art:build kindled-ash` until `"draft": false` builds. Never edit an output by hand. If a frame can't be rescued by Steps 2–4, use the next fallback in Step 2 and say so. Then:
- run `pnpm check`;
- look at `contact.png` and `tones.png` yourself before you push;
- set aside any frame that looks wrong (a blade in the wrong place, a stray swoosh, a broken outline) for ART's review, listed in the PR rather than fixed by guessing.

## Step 6: in-game shots (MAIN's request)
Run the client (`pnpm dev`). Take:
- the fight shot with `tools/screenshots-g15.mjs` at 1920×912;
- one shot per clay tone, using `window.__iot.setClayTone(tone)` with clay-grey-ochre, clay-pale, clay-red and clay-river-dark.

Save them under `docs/screenshots/kindled-ash/` and show them in the PR. The Husks and the room stay at 2× (M1 art) until their own jobs; that's expected.

## Done when
The draft PR exists with the finished sheet. The PR description holds:
- `contact.png` and `tones.png`;
- a table of every remap rule with its pixel counts per animation, from the report;
- the remaining top-off-palette list;
- outline gaps and the flags;
- the gap-filling table (Step 2), the `skin.add` and `fixes` counts, and the frames set aside for ART;
- the in-game shots;
- "Requests for MAIN", with anything in the engine that looks wrong: feet off the shadow, a facing that doesn't match the aim, an animation at the wrong time;
- the test plan (`pnpm art:build kindled-ash`, `pnpm art:check`, `pnpm check`).

Your last message tells David:
- the PR number;
- the remap rule count;
- the gaps and how each was filled;
- anything set aside for ART.
