# Art job weapon-rack: raw material for the holding's weapon rack

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`: the colour table, the drawing rules, the prop sizes;
- `docs/design/holding.md` (the `weapon-rack` spot: 2 × 1 tiles east of the Writ post) and `docs/design/sprites.md` (the prop cells);
- `art/jobs/holding.md` and `art/raw/holding/manifest.json`: this job is the same shape, so follow how that job called the tools and recorded them;
- `art/clean/prop-twisted-tree/idle/frame-0.png`, `art/clean/prop-holding-store/idle/frame-0.png` and `art/clean/prop-writ-post/idle/frame-0.png`: the props it stands beside.

The job **generates raw material only**: the weapon rack. ART cleans the pick, places it in its 64 × 72 cell (origin (32, 64)), adds its peg points and writes `art/sheets/prop-weapon-rack.json`. So:
- write no recipe;
- run no `art:build`;
- make no code changes;
- don't retouch, recolour, cut or scale anything.

## The piece
"A rack of twisted logs lashed up by the post" (Lore §14.15). It stands on a 2 × 1 tile spot (64 × 32 px) east of the Writ post, beside the holding store, and holds the Kindled's weapons. In M2 it stands empty: the one weapon is carried. Later, unequipped weapons hang from its pegs.

The look:
- a simple upright frame: two short posts of twisted, gnarled log, a crossbar lashed between them near the top, and a lower crossbar;
- three or four short wooden pegs sticking out of the top crossbar, toward the viewer;
- lashed with rope at every joint;
- standing on the ground, empty, about as tall as the player (40–44 px) and two tiles wide (56–60 px);
- dry, old and warm, made from the same twisted wood as the trees beside it.

Colours: the trees' wood, watcher-bronze #A8743A lit with wheel-brass #C79A3E and shaded wheel-brass-dark #8A6420; the rope in sleeper-ochre #9C5B4A lit sleeper-flesh #C98F78. Light from the top left. Use only the 28 whitelist colours (`art/anchors/palette-28.png`).

Never use any of these:
- #FFFFFF, #FFE7A3, #E0457B or #8E2550;
- husk-core #FFF4C7 (the Husks' colour);
- green: the palette has none on purpose.

## Branch and PR
- Branch `art/weapon-rack` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: weapon-rack (raw)" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/weapon-rack -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files under `art/raw/weapon-rack/`, plus `art/raw/weapon-rack/manifest.json`. Record:
  - the tool and every argument;
  - the job and image ids;
  - the generations per call, from the balance before and after;
  - any retake;
  - the sha256 of every file.
- Pass images by upload reference, never as inline base64.
- Never commit the token, model files or anything from the environment.

## Budget
- About **10 generations**, hard cap **20**. David approved this.
- Call `get_balance` before the first call and at the end.
- If the call quotes more than 10, or the total would pass 20, stop and ask David.
- At most one retake, only for the hard failures named below.
- Use `wait_for_jobs` to wait.

## STYLE (append to the description)
"Top-down RPG pixel art seen from a high three-quarter view, light from the top left, a 1 px dark violet outline, flat shading in two or three steps per material, no dithering on the object, no anti-aliasing, no soft glow, transparent background, no text, letters or symbols."

## Step 1: the rack
Call `create_image_pro` once with:
- `no_background: true`;
- the 28-colour palette (as the holding job passed it);
- `seed: 1234`;
- canvas 64×64;
- reference images:
  - `art/clean/prop-twisted-tree/idle/frame-0.png`, usage "the same twisted bronze wood, its shading and outline";
  - `art/clean/prop-holding-store/idle/frame-0.png`, usage "the same world and palette: a prop that already stands on this holding, its rope lashing";
  - `art/anchors/kindled-ash-s-64.png`, usage "scale only: this is the player, 45 px tall; the rack stands beside it";
- description (+ STYLE): "An empty weapon rack made of twisted, gnarled bronze-brown logs lashed together with rope: two short upright posts, a crossbar near the top with three short wooden pegs sticking out toward the viewer, and a lower crossbar. It stands on the ground, seen from the front and above, about as tall as a person and twice as wide as it is deep. No weapons on it."

Save every candidate as `candidates/<n>.png`, a numbered sheet `candidates.png`, and your pick as `pick.png`. Pick the candidate closest to 56–60 wide × 40–44 tall that is an empty upright rack with visible pegs and uses no forbidden colour. Don't place, pad or trim it.

Retake once (`seed: 1235`) only if no candidate is an empty upright rack: for example a fence, a table, a rack lying flat, or one already holding weapons.

## Done when
1. Make `art/raw/weapon-rack/contact.png`: the pick at 4× on the holding's ground (`art/clean/tiles-holding/floor_0.png`, tiled), beside the player reference and the Writ post, over its 2 × 1 footprint drawn as a 1 px tile grid; and the candidates sheet at 2×.
2. Run `bash scripts/cloud-setup.sh`, then `pnpm check`.
3. Commit the raw files, the manifest and the contact sheet, push, and open the draft PR.

The PR description holds:
- `contact.png`;
- the pick, its size against the target, and why;
- the colours it uses, and any forbidden colour;
- the generations spent, and the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- whether the step needed its retake.
