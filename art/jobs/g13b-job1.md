# Art job g13b-job1: the same set twice, (b) text only and (c) anchored (G1.3b pilot)

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read CLAUDE.md and `art/anchors/style-sheet.md` first. This job makes no code changes.

## Shared header (Engineering → Art pipeline → "Art jobs in Claude Code")
- Branch `art/g13b-job1` from the latest `main`; never push to main. Open a **draft** PR "Asset: g13b-job1" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/g13b-job1 -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as the raw 1× files under `art/raw/g13b-job1/`, plus `manifest.json`: tool, prompt, references, settings, seed, character or job id, generations spent, retakes.
- Make contact sheets (4×, on the pale floor #D9D2E9 and the dark Hollow #2A2540, frames in order), commit them and show them in the PR description.
- No code changes. Anything the engine needs goes to MAIN as a request in the PR description.
- Never commit the token, model files or anything from the environment. Spend no more than this job's budget; stop and report if a tool costs more than expected.

## What this job is for
G1.3b decides whether PixelLab becomes our art route at 32×48 bodies on 64×64 canvases. This job makes the same 15 assets twice:
- **(b) text only**: the description and a style sentence, no images, no palette.
- **(c) anchored**: the same text, plus ART's anchors from `art/anchors/` as labelled references and our 28-colour palette.

ART then judges both blind against our own art. Don't fix, snap or retouch anything except where a step says so: the raw output is what's being judged.

## Budget and rules
- Budget: **600 generations** for the whole job (the account has about 1,999). Call `get_balance` before the first call and after each asset, and record the generations each call cost in the manifest.
- If a single call quotes more than 25 generations, or the running total would pass 600, stop and ask David.
- Retakes: at most **one** per asset per option, and only for a hard failure: wrong subject, cut off by the canvas edge, wrong canvas size, a background where it should be transparent, or not facing south where south is asked. Never retake for taste; record every retake and why.
- Seeds: pass `seed: 1234` wherever a tool takes one.
- Async: queue, then use `wait_for_jobs` (free) instead of polling in a loop.
- Downloads: `backblaze.pixellab.ai` should be on the allowlist by now. If a link is blocked anyway, use the API's zip or inline image where the tool offers one; if neither works, stop and tell David the host.
- If a call fails or a parameter is unclear, `search_help` is free; read the tool's description in `art/raw/g13b-job0/tools.json` before guessing.

## Shared text
STYLE (append to every description, both options): "Top-down RPG pixel art seen from a low three-quarter view, light from the top left, a 1 px dark navy-violet outline, two or three shades per material, no dithering, transparent background, no text or letters."

PALETTE (the 28 hex colours, for every (c) call that takes `palette`; also in `art/anchors/palette-28.png`):
["#F4EFE6","#D9D2E9","#A99FC4","#5B5478","#2A2540","#F2B65A","#C9733A","#4A4E57","#7D8794","#3E5C7A","#A8743A","#C79A3E","#8A6420","#E9E4D4","#2F7F7A","#C98F78","#9C5B4A","#E3C29E","#24305A","#E8E2D6","#FFF4C7","#8C7F6E","#5E5448","#FBF8F0","#D8B24A","#F07A3A","#B5402E","#1C2147"]
with `palette_name: "Islands of the One"`.

## The assets

### NPCs: 3 characters, 8 directions, 64×64 canvas
| id | Description (+ STYLE) |
|---|---|
| `npc-kesh` | Old Kesh, a Kindled hermit and fisherman: a small figure made of river-dark brown-black clay, about 40 px tall, with a few widely spaced amber freckles like small lights, long white hair and a white beard, a patched grey-ochre sailcloth tunic with a wet grey patch, dark trousers and wrapped dark feet. He holds a long wooden casting rod upright at his side. |
| `npc-tally` | Tally, a young Kindled woman: a small figure of red terracotta clay, about 40 px tall, three amber freckles, dark violet hair tied up in a knot, a pale salt-stiff sailcloth tunic with a rope belt and a bronze buckle, dark trousers and boots, empty hands. |
| `npc-clerk` | A Concord weigh-house clerk: a Scattered man about 43 px tall with warm tan skin and a shaved head, an iron-grey fringed wrap robe in an ancient Mesopotamian style with ochre trim. He holds a small bronze balance in one hand and a blank clay tablet in the other. |

- **(b)**: `create_character` with `mode: "v3"`, no reference image, `size: 64`, `view: "low top-down"`, `outline: "single color outline"`, `detail: "medium detail"`, `n_directions: 8`, description = text + STYLE. Download the 8 directions (the character zip from api.pixellab.ai works, as in Job 0).
- **(c)**: two steps.
  1. `create_image_pro`: `width: 64`, `height: 64`, `no_background: true`, description = text + STYLE + " Facing the viewer, standing.", `reference_images: [{"base64": <art/anchors/kindled-ash-s-64.png>, "usage": "character base: copy the proportions, the size on the 64x64 canvas, the clay-figure build, the outline and the shading style; NOT the outfit, colours or weapon"}]`, `palette` and `palette_name` as above, `max_colors: 12`, `seed: 1234`. It returns a set of candidates: save every one, and a candidates sheet. Pick ONE: it faces the viewer (south), the whole figure is inside the canvas, the soles are near row 53, the height is near the target, and it matches the description best. Record the index and why.
  2. `create_character` with `mode: "v3"` and `reference_image_base64` = the picked image, same description: download the 8 directions.

### Enemies: 2 of a new family (Dream-Spawn), 1 view facing south, 64×64 canvas
The Dream-Spawn are the dreams of sleeping giants, taken shape in caves: wrong-scale things in warm flesh tones and night blue.

| id | Description (+ STYLE) |
|---|---|
| `enemy-hungerling` | A Hungerling, a Dream-Spawn creature: a giant's hunger given legs. A squat, wrong-scaled thing about 26 px wide and 24 px tall: a huge round belly with a wide toothy mouth, short stubby giant's legs and oversized hands, warm flesh-pink skin with night-blue shadows, no eyes. |
| `enemy-gardener` | A Felled Gardener, a Dream-Spawn creature: a tall stooped gardener about 40 px tall, made of dream-stuff, with a man's shape like a burnt sapling, a broken pruning hook in one hand, warm flesh tones fading into night blue, faint echo outlines trailing from its back. |

- **(b)**: `create_image_pixen`, `width: 64`, `height: 64`, `no_background: true`, `view: "low top-down"`, `direction: "south"`, `outline: "single color outline"`, `detail: "medium detail"`, `seed: 1234`, description = text + STYLE.
- **(c)**: `create_image_pro`, 64×64, `no_background: true`, description = text + STYLE, `reference_images: [{"base64": <husk-peeling-64.png>, "usage": "enemy style: outline, shading, amount of detail"}, {"base64": <kindled-ash-s-64.png>, "usage": "scale only: this is the player; the creature stands beside it"}]`, palette as above, `max_colors: 10`, `seed: 1234`. Save all candidates and pick one as for the NPCs.

### Props: 5, 1 view, 64×64 canvas, resting on row 53
| id | Description (+ STYLE) |
|---|---|
| `prop-basket` | An upturned reed basket, used as a seat, about 20 px wide. |
| `prop-balance` | A small bronze weighing balance on a short wooden stand, two pans, about 24 px tall. |
| `prop-lamp` | A clay oil lamp on a low clay stand, lit with a small orange flame, about 18 px tall. |
| `prop-sailcloth` | A bundle of folded pale sailcloth tied with rope, about 22 px wide. |
| `prop-bricks` | A small stack of sun-dried mud bricks, about 28 px wide. |

- **(b)**: `create_image_pixen`, 64×64, `no_background: true`, `view: "low top-down"`, `outline: "single color outline"`, `detail: "medium detail"`, `seed: 1234`.
- **(c)**: `create_image_pro`, 64×64, `no_background: true`, `reference_images: [{"base64": <prop-clay-jar-64.png>, "usage": "prop style: outline, shading, amount of detail"}, {"base64": <kindled-ash-s-64.png>, "usage": "scale only: this is the player"}]`, palette as above, `max_colors: 8`, `seed: 1234`. Save all candidates and pick one.

### Tileset: 1 top-down Wang set, 32 px tiles
Lower terrain: "still deep water of the Hollow, dark violet-navy with faint ripples". Upper terrain: "pale shell-grit ground, lavender-white with small shell flecks". Transition: "a thin wet shore lip".
- **(b)**: `create_topdown_tileset`, `mode: "standard"`, `tile_size: 32`, `transition_size: 0.25`, `view: "high top-down"`, `outline: "single color outline"`, `shading: "basic shading"`, `detail: "medium detail"`.
- **(c)**: the same with `mode: "pro"` (no `shape_style`). The tool takes no style images or palette, so afterwards run `reduce_colors` on all the tiles together with `palette_image_base64` = `art/anchors/palette-28.png`. Keep both the raw and the reduced tiles.
- For both: download every tile, the tileset metadata (corner layout) and the example map image.

### Icons: 4, made at 32×32, reduced to 16×16
| id | Description (+ STYLE) |
|---|---|
| `icon-ration` | A ration: a small round loaf of hard brown bread wrapped in pale sailcloth and tied with a cord. A game item icon. |
| `icon-sparkglass` | A chip of Sparkglass: a small faceted amber crystal shard with a warm light inside. A game item icon. |
| `icon-tonic` | A tonic: a small clay flask with a cork stopper, half full of amber liquid. A game item icon. |
| `icon-bomb` | A bomb: a round dark clay pot with a short burning fuse. A game item icon. |

- **(b)**: `create_image_pixen`, `width: 32`, `height: 32`, `no_background: true`, `outline: "single color outline"`, `seed: 1234`.
- **(c)**: `create_image_pro`, 32×32, `no_background: true`, `reference_images: [{"base64": <icon-ref-hookblade-32.png>, "usage": "icon style: a 16 px icon shown at 2x; copy the 2x2 pixel blocks, the dark navy outline and the flat shading"}, {"base64": <icon-ref-lock-32.png>, "usage": "icon style, same as the first"}]`, palette as above, `max_colors: 6`, `seed: 1234`. Save all candidates and pick one.
- Then reduce each picked 32×32 to 16×16 with a short Python script kept in `art/raw/g13b-job1/reduce_icons.py` (not app code). For each 2×2 block, take the most frequent opaque colour (transparent if fewer than 2 of the 4 pixels are opaque; ties go to the darker colour). Then snap every colour to the nearest of the 28 in OKLab. Save `<id>-16.png` next to the 32 px original.

## Files
`art/raw/g13b-job1/b/<id>/` and `art/raw/g13b-job1/c/<id>/`:
- every downloaded image at 1× as delivered
- for (c), `candidates/` with all candidates, `candidates.png` (a numbered sheet) and `pick.png`
- for characters, the 8 directions as `<direction>.png`

Plus at the top:
- `manifest.json`: per asset and option, the tool, every argument except the base64, generations, retakes, pick index and job ids
- `balance.json`: before and after each asset
- `contact-npcs.png`, `contact-enemies-props.png`, `contact-tiles.png`, `contact-icons.png`

Lay the contact sheets out with one row per asset, (b) on the left and (c) on the right, at 4×, on both floors. NPC rows show all 8 directions in order (S, SE, E, NE, N, NW, W, SW). The icon sheet shows the 32 px originals and the 16 px results at 1× and 4×.

## Done when
Run `pnpm check` (CLAUDE.md), commit, push, and open the draft PR. In the PR description:
- the contact sheets
- a table per asset and option: tool, generations, retakes, pick index
- the balance before and after, and the total spent
- anything surprising
- "Requests for MAIN: none" unless something came up

Your last message tells David the PR number, the generations spent, the balance left, and any asset that failed twice.
