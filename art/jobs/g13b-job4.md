# Art job g13b-job4: the player at B, and Tally at size (G1.3b pilot)

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read CLAUDE.md and `art/anchors/style-sheet.md` first; it now has the B heights and a "Generating at size" section. This job makes no code changes.

## Shared header (Engineering → Art pipeline → "Art jobs in Claude Code")
- Branch `art/g13b-job4` from the latest `main`; never push to main. Open a **draft** PR "Asset: g13b-job4" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/g13b-job4 -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as the raw 1× files under `art/raw/g13b-job4/`, plus `manifest.json`: tool, prompt, references, settings, seed, character or job id, generations spent, retakes.
- Make the contact sheets described below, commit them and show them in the PR description.
- No code changes. Don't touch `art/anchors/`: ART replaces the player exemplar after reviewing this job. Anything the engine needs goes to MAIN as a request in the PR description.
- Never commit the token, model files or anything from the environment. Spend no more than this job's budget; stop and report if a tool costs more than expected.

## What this job is for
B is decided: Kindled 45 px (44–46), Scattered folk 48 px. In Job 3 the NPCs held their detail at B, but our hand-drawn player is still 40 px and plainer than the cast. This job:
- makes the player at 45 px from ART's design, at the cast's level of detail;
- re-runs the skeleton walk and the v3 swing on the new player, the two engines that won in Job 2;
- re-runs Tally at size: in Job 3 all 16 of her candidates came out 50–51 px on a 44×60 canvas.

`main` must already contain `art/raw/g13b-job3/` and the updated style sheet (PRs #27 and #28). If it doesn't, stop and tell David.

## Budget and rules
- Budget: **about 40 generations, hard cap 50**. Call `get_balance` before the first call and at the end, and record what each call cost.
- If a single call quotes more than 15, or the total would pass 50, stop and ask David.
- Retakes: at most one in the whole job, for a hard failure only: no candidate within 3 px of the target height, wrong subject, figure cut off, or not facing south. If the heights are off, change the canvas height by the gap ÷ 0.8 (rounded) rather than the seed, and record it.
- Pass `seed: 1234` wherever a tool takes one.
- Pass every image by upload reference, never inline base64. Record each file's sha256.
- Use `wait_for_jobs` to wait for jobs.
- Don't fix, snap or retouch the outputs. The only processing is the padding and the contact sheets.

Height means the opaque rows from the top of the head, hair or hood to the lowest sole pixel. A blade hanging below the feet or a rod above the head doesn't count.

## Part A: the player at 45 px
1. **`create_image_pro`**, canvas **44×56**, `no_background: true`, `seed: 1234`, palette as in Job 3 (the 28 colours, `palette_name: "Islands of the One"`), `max_colors: 12`.
   - Description: "Small clay figure about 45 px tall with grey-ochre clay skin and three amber freckles, in a soot-grey hooded cloak with an ember-singed hem over a grey tunic, tan collar, dark belt, dark trousers and boots. Holds a short hooked blade in its right hand, hanging down at its side. " + STYLE (from Job 1's manifest) + " Facing the viewer, standing."
   - `reference_images`:
     1. `art/anchors/kindled-ash-s-64.png`, usage: "this is the character: copy its design exactly (the hooded soot-grey cloak with the ember-singed hem, grey tunic, tan collar, grey-ochre clay face with two small eyes and three amber freckles, the short hooked blade hanging from the right hand on the viewer's left) and its 1 px dark navy outline; NOT its size, it is drawn smaller than wanted"
     2. `art/raw/g13b-job3/npc-kesh/pick-64.png`, usage: "detail and shading only: match this amount of detail, the shading and the height on the canvas; NOT its design, colours or outline colour"
2. Save every candidate, plus a numbered candidates sheet with each candidate's measured height under it.
3. **Pick** the candidate closest to 45 px (within 2 px if any is) that keeps the design: the hood, the cloak, the blade in the hand on the viewer's left, and visible freckles. If no candidate keeps the blade on the viewer's left, pick the best anyway and say so. Record the index, the height and why.
4. Pad the pick onto 64×64, centred, soles on row 53, never scaled, as `player/pick-64.png`.
5. **`create_character`** with mode v3 and `reference_image_url` = the uploaded `pick-64.png`. Description: the same text without "Facing the viewer, standing." 8 directions. Record the new character id.
6. **Walk:** `animate_character` on the new character with `mode: "skeleton-v3"`, `template_animation_id: "walking-6-frames"`, directions S, SE, E, NE and N, `animation_name: "walk-skel"`.
7. **Light swing:** `animate_character` with `mode: "v3"`, `action_description` "a quick horizontal slash with the short hooked blade held in the right hand, then back to guard", `frame_count: 6`, directions E and S, `animation_name: "attack-v3"`.

## Part B: Tally at 45 px
`create_image_pro` exactly as in Job 3 (`art/raw/g13b-job3/manifest.json`: description, references, palette, `max_colors`), but on a canvas of **44×54**. Pick the candidate closest to 45 px, then pad it to `npc-tally/pick-64.png`. Then run a v3 `create_character` from it for 8 directions, as in Job 3.

## Files
- `art/raw/g13b-job4/player/`:
  - `candidates/`, `candidates.png`, `pick.png`, `pick-64.png`
  - the 8 rotations as `<direction>.png`
  - `walk-skel/<direction>/frame-<n>.png`, `attack-v3/<direction>/frame-<n>.png`
- `art/raw/g13b-job4/npc-tally/`: `candidates/`, `candidates.png`, `pick.png`, `pick-64.png`, the 8 rotations.
- At the top: `manifest.json`, `balance.json`, `contact-cast-b.png`, `contact-player-b.png`.

## Contact sheets
- **`contact-cast-b.png`: the B cast on one ground line**, each with its soles on row 53 of its 64×64 cell, labelled with its measured height outside the cells:
  1. the old player anchor `art/anchors/kindled-ash-s-64.png` (40 px), labelled "old A";
  2. the new player `pick-64.png`;
  3. Kesh from Job 3;
  4. the new Tally;
  5. the clerk from Job 3;
  6. `art/anchors/husk-peeling-64.png`;
  7. `art/anchors/prop-clay-jar-64.png`.

  Draw it at 2× on the floor #D9D2E9 and at 4× on the wall face #5B5478.
- **`contact-player-b.png`, at 2× on the floor:**
  - one row of the new player's 8 rotations, in the order S, SE, E, NE, N, NW, W, SW;
  - then one row per walk direction (6 frames);
  - then one row per swing direction.

  Draw every frame on a 96×96 cell with the figure's lowest opaque row on the same line, so the frames line up.

## Done when
Run `pnpm check`, commit, push, and open the draft PR. In the PR description:
- both contact sheets
- a table with, for the player pick and the Tally pick: canvas, candidate heights (min to max), pick index, pick height, colours and off-palette colours
- a table for the rotations, the walk and the swing: generations, frames, canvas size, off-palette colours, and the lowest-row range across frames
- the new character id
- the balance before and after
- anything surprising
- "Requests for MAIN: none" unless something came up

Your last message tells David the PR number, the generations spent, the balance left, both picks' heights against 45, whether the player kept the blade on the viewer's left, and anything that failed.
