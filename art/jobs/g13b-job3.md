# Art job g13b-job3: B at true size, three NPCs (G1.3b pilot)

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read CLAUDE.md and `art/anchors/style-sheet.md` first. This job makes no code changes.

## Shared header (Engineering → Art pipeline → "Art jobs in Claude Code")
- Branch `art/g13b-job3` from the latest `main`; never push to main. Open a **draft** PR "Asset: g13b-job3" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/g13b-job3 -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as the raw 1× files under `art/raw/g13b-job3/`, plus `manifest.json`: tool, prompt, references, settings, seed, character or job id, generations spent, retakes.
- Make the contact sheet described below, commit it and show it in the PR description.
- No code changes. Anything the engine needs goes to MAIN as a request in the PR description.
- Never commit the token, model files or anything from the environment. Spend no more than this job's budget; stop and report if a tool costs more than expected.

## What this job is for
David chose option B for the cast's height: Kindled 44–46 px, Scattered folk 48 px, on 64×64 canvases with the soles on row 53. Before the style sheet is final, we need to see B at its real size. In Job 1 the figures came out too big (51–60 px) and in Job 2 too small (28–34 px). A figure fills about 75 % of a canvas of this size, so this job uses a canvas of about the target height ÷ 0.75, and then picks the candidate closest to the target height.

`main` must already contain `art/raw/g13b-job1/` and `art/raw/g13b-job2/` (PRs #25 and #26). If it doesn't, stop and tell David.

## Budget and rules
- Budget: **about 40 generations, hard cap 45**. Call `get_balance` before the first call and at the end, and record what each call cost.
- If a single call quotes more than 15, or the total would pass 45, stop and ask David.
- Retakes: at most one in the whole job, and only for a hard failure: no candidate faces south with the whole figure inside the canvas, or none is within 4 px of the target height. Use `seed: 1235` for it. If you retake, skip the rotations (step 3) to stay inside the cap.
- Pass `seed: 1234` wherever a tool takes one.
- Pass every image by upload reference, never inline base64. Record each file's sha256.
- Use `wait_for_jobs` to wait for jobs.
- Don't fix, snap or retouch the outputs. The only processing is the padding in step 2 and the contact sheet.

## The three NPCs
| id | target height | canvas (w×h) | description change |
|---|---|---|---|
| `npc-kesh` | 45 px (44–46) | 44×60 | "about 40 px tall" becomes "about 45 px tall" |
| `npc-tally` | 45 px (44–46) | 44×60 | "about 40 px tall" becomes "about 45 px tall" |
| `npc-clerk` | 48 px | 44×64 | "about 43 px tall" becomes "about 48 px tall" |

Height means the opaque rows from the top of the head (hair, hood or bald crown) to the lowest sole pixel. Don't count a rod or anything else held above the head.

## Steps
1. **One `create_image_pro` call per NPC.** Use:
   - the canvas from the table, `no_background: true`
   - Job 1's description for that NPC (`art/raw/g13b-job1/manifest.json`), with the height changed as in the table, + STYLE + " Facing the viewer, standing."
   - exactly the `reference_images` (same files, same usage text), `palette`, `palette_name` and `max_colors` that Job 2 used for it (`art/raw/g13b-job2/manifest.json`)
   - `seed: 1234`

   Save every candidate, and make a numbered candidates sheet with each candidate's measured height under it. **Pick** the candidate that faces south, has the whole figure inside the canvas, and is closest to the target height, within 2 px if any is. Among equally close candidates, take the one that best matches the description. Record the index, the measured height and why.
2. **Pad without scaling.** Put each pick on a transparent 64×64 canvas, centred horizontally, with its lowest opaque row on **row 53**. Save it as `pick-64.png`. If it doesn't fit (taller than 54 px or wider than 64), record that and keep `pick.png` only.
3. **Rotations:** `create_character` with mode v3 and `reference_image_url` = the uploaded `pick-64.png`, with the same description, for 8 directions. These cost 1 generation each. Skip this step if a retake was used.

## Files
- `art/raw/g13b-job3/<id>/`: `candidates/`, `candidates.png`, `pick.png`, `pick-64.png`, and the 8 rotations as `<direction>.png`.
- At the top: `manifest.json`, `balance.json`, `contact-sizes.png`.

## The contact sheet: `contact-sizes.png`
It shows the three sizes side by side against the player.
- **One block per NPC**, each holding, on one shared ground line (everything with its soles on row 53 of its 64×64 cell):
  1. ART's player anchor `art/anchors/kindled-ash-s-64.png`;
  2. Job 1's pick, `art/raw/g13b-job1/c/<id>/south.png`, moved down or up so its lowest opaque row is on row 53;
  3. Job 2's pick, `art/raw/g13b-job2/a/<id>/south.png`;
  4. this job's `pick-64.png`.
- Label each cell with its source and measured height in px, using a small plain font **outside** the cells.
- Draw each block twice:
  - at **2×** (game zoom), on the floor #D9D2E9;
  - at **4×**, on the wall face #5B5478.
- Below the blocks, one row of the three new NPCs' 8 rotations at 2× on the floor, in the order S, SE, E, NE, N, NW, W, SW.
- The player anchor is 40 px tall, which is option A's height. ART redraws it at B after this job, so Kesh and Tally standing a little taller than it is expected. Don't flag it.

## Done when
Run `pnpm check`, commit, push, and open the draft PR. In the PR description:
- the contact sheet
- a table per NPC: canvas, the candidates' heights (min to max), pick index, pick height, colours and off-palette colours of the pick, generations, retakes
- the balance before and after
- anything surprising
- "Requests for MAIN: none" unless something came up

Your last message tells David the PR number, the generations spent, the balance left, each pick's height against its target, and anything that failed.
