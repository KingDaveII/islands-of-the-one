# Art job g13b-job2: size control, and the player at 32×48 (G1.3b pilot)

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read CLAUDE.md and `art/anchors/style-sheet.md` first. This job makes no code changes.

## Shared header (Engineering → Art pipeline → "Art jobs in Claude Code")
- Branch `art/g13b-job2` from the latest `main`; never push to main. Open a **draft** PR "Asset: g13b-job2" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/g13b-job2 -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as the raw 1× files under `art/raw/g13b-job2/`, plus `manifest.json`: tool, prompt, references, settings, seed, character or job id, generations spent, retakes.
- Make contact sheets (4×, on the pale floor #D9D2E9 and on the wall face #5B5478, frames in order), commit them and show them in the PR description.
- No code changes. Anything the engine needs goes to MAIN as a request in the PR description.
- Never commit the token, model files or anything from the environment. Spend no more than this job's budget; stop and report if a tool costs more than expected.

## Budget and rules (as in Job 1)
- Budget: **320 generations**. Call `get_balance` before the first call and after each part, and record what each call cost.
- If a single call quotes more than 25, or the total would pass 320, stop and ask David.
- At most one retake per item, for hard failures only (wrong subject, cut off, wrong size, background, wrong facing). Record retakes.
- Pass `seed: 1234` wherever a tool takes one.
- Pass every image by URL or upload reference, never inline base64: inline base64 got corrupted in Jobs 0 and 1. Record each file's sha256.
- Use `wait_for_jobs` to wait for jobs. The account runs at most 8 jobs at once; queue in batches of 8.
- Don't fix, snap or retouch the outputs except where a step says so.

## Part A: size control, option (c) only
In Job 1 every asset came out 25–100 % too big, because the tools fill the canvas they're given. This part regenerates Job 1's (c) set on a canvas the size of the target, then pads it onto 64×64.

For each item, call `create_image_pro` with:
- the canvas below
- `no_background: true`
- the description from Job 1 (`art/raw/g13b-job1/manifest.json`), with STYLE appended
- the same labelled references, `palette`, `palette_name` and `max_colors` as Job 1 (c)
- `seed: 1234`

Save all candidates and a numbered candidates sheet. Pick one by the same criteria as Job 1, and record the index. If no candidate fits its canvas with the whole subject inside, that is a hard failure: retake once with `seed: 1235`. Then pad the pick onto a transparent 64×64 canvas, centred horizontally, with its lowest opaque row on **row 53**. Never scale it. Save the result as `pick-64.png`.

| id | canvas (w×h) | after padding |
|---|---|---|
| `npc-kesh` | 32×44 | `create_character` mode v3 with the padded pick as `reference_image_url`, same description: 8 directions |
| `npc-tally` | 32×44 | the same |
| `npc-clerk` | 32×48 | the same |
| `enemy-hungerling` | 32×28 | — |
| `enemy-gardener` | 32×44 | — |
| `prop-basket` | 24×24 | — |
| `prop-balance` | 24×28 | — |
| `prop-lamp` | 20×20 | — |
| `prop-sailcloth` | 24×24 | — |
| `prop-bricks` | 32×32 | — |

If a canvas size is rejected, use the nearest size the tool accepts (check `get_pro_flash_capabilities` or the error text), and record it.

## Part B: the player at 32×48
Use the Kindled from Job 0: character id `8d666a0b-3521-4d4e-a81a-902347b65d1d` (our S plus 7 rotations). First call `get_character` (free) and save the list of template animations it offers in the manifest.

1. **Walk, two ways**, in the directions S, SE, E, NE and N:
   - `animate_character` with `mode: "template"` and the plain walking template: the 6-frame one if there is one, otherwise the nearest.
   - The same template with `mode: "skeleton-v3"`. This moves our pixels instead of redrawing them.
   - Give the animations `animation_name` "walk-template" and "walk-skel".
2. **One attack: the light Hookblade swing**, facing E, then S. For each direction, try three engines:
   - **Text:** `mode: "pixminimax"`, `action_description` "a quick horizontal slash with the short hooked blade held in the right hand, then back to guard", `frame_count: 8`.
   - **Text (v3):** `mode: "v3"`, the same action, `frame_count: 6`.
   - **Template:** `mode: "skeleton-v3"` with an attack template from the list (a sword slash or one-handed swing). If there is none, `mode: "template"` with the nearest attack template. Record which.
   - Names: "attack-pixminimax", "attack-v3", "attack-skel".
3. **Outfit transfer** (Ash → Tide):
   1. `create_character_state` on the same character, with `edit_description` "wearing the Tide Remembrance instead of the hooded cloak: a pale salt-stiff sailcloth tunic with a rope belt and a bronze buckle, dark trousers and boots, no hood, short dark hair; the same clay face with three amber freckles and the same short hooked blade in the right hand", and `state_name` "Tide". Download its 8 rotations.
   2. `transfer_outfit` with `frame_urls` = the S frames of "walk-skel" (or "walk-template" if skel failed) and `reference_image_url` = the Tide state's south rotation. Pass `additional_instructions` "keep the hooked blade in the right hand" and `seed: 1234`.
4. **Dialog close-up portrait**: `create_portrait_character` with `image_url` = an upload of `art/anchors/kindled-ash-s-64.png` (sha256 8e0a1c01…f02a), `direction: "character_to_portrait"`, `view: "low top-down"`. Run it twice, with `result_size: 64` and `result_size: 128`.

## Files
- **Part A:** `art/raw/g13b-job2/a/<id>/`, holding `candidates/`, `candidates.png`, `pick.png`, `pick-64.png`, and the 8 rotations for NPCs.
- **Part B:** `art/raw/g13b-job2/b/<animation-name>/<direction>/frame-<n>.png`; `b/tide/<direction>.png`; `b/tide-walk/frame-<n>.png`; `b/portrait-64.png`; `b/portrait-128.png`.
- **At the top:** `manifest.json`, `balance.json`, and four contact sheets.

Contact sheets, each on both floors:
- `contact-size.png`: every Part A item on one ground line beside ART's three anchors, at 4×. The NPCs show all 8 directions.
- `contact-walks.png`: one row per animation and direction, frames in order, at 4×.
- `contact-attacks.png`: the same layout for the attacks.
- `contact-tide-portrait.png`: the Tide rotations, the transferred walk and both portraits, at 4× (the 128 one at 2×).

## Done when
Run `pnpm check`, commit, push, and open the draft PR. In the PR description:
- the contact sheets
- a table per item: tool, mode, frames, generations, retakes, pick index
- the template list from `get_character`
- the balance before and after
- anything surprising
- "Requests for MAIN: none" unless something came up

Your last message tells David the PR number, the generations spent, the balance left, and any item that failed twice.
