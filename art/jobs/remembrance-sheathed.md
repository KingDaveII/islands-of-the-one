# Art job remembrance-sheathed: raw material for a Remembrance's sheathed Kindled sheet

You are running an art job for ART DIRECTION, the art director of Islands of the One. David tells you which Remembrance to run: **clay**, **tide** or **wing** (one per session, in that order). Below, `<rem>` means that word.

Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`: the colour table, the skin rule (the clay skin ramp unwritten-sail #8C7F6E / unwritten-tar #5E5448 is for skin only), the eye rule, the heights;
- `docs/design/sprites.md` §4, "Kindled, sheathed": the five rows this raw material feeds (`idle`, `walk`, `run`, `run_start`, `run_stop`) and why there is no blade;
- `art/jobs/ss01-kindled-ash.md`, `art/jobs/run-kindled-ash.md` and `art/raw/ss01-kindled-ash/manifest.json`: how the Ash Kindled was made (this job animates the same character in another outfit);
- `art/jobs/g13b-job2.md` and `art/raw/g13b-job2/manifest.json`: how `create_character_state` was called for the Tide test.

The job **generates raw material only**: the Kindled in the `<rem>` Remembrance's starting clothes, with no blade in hand, in 8 facings, idling, walking and running. ART cleans it, makes `run_start` and `run_stop` from it, and writes `art/sheets/kindled-<rem>-sheathed.json`. So:
- write no recipe;
- run no `art:build`;
- make no code changes;
- don't retouch, recolour, cut or scale anything.

## Why
At creation the player picks a Remembrance (M2 Task 9), and the holding draws the Kindled from `kindled-<rem>-sheathed`. Only Ash's exists, so today every Remembrance is drawn as Ash, tone-swapped. Each Remembrance needs its own sheathed sheet: the same clay figure, face, freckles and build as Ash, in its own clothes (Lore §14.0), its hands empty.

| `<rem>` | Starting clothing (Lore §14.0) | Outfit colour (`palette.json` `remembranceOutfit`) |
|---|---|---|
| clay | A potter's wrap and a clay-stiffened apron, sleeves rolled | sleeper-ochre #9C5B4A |
| tide | A salt-stiff sailcloth tunic with a rope belt | hollow-dusk #A99FC4 |
| wing | A down-lined mantle over a torn harness | sleeper-soil #E3C29E |

## Branch and PR
- Branch `art/<rem>-sheathed` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: kindled-<rem>-sheathed (raw)" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/<rem>-sheathed -f base=main -F draft=true -f body=...`; `gh pr create` is blocked; if `gh` has no valid token, use the GitHub MCP tool and say so).
- Download every PixelLab result at once (links can expire) as raw 1× files under `art/raw/<rem>-sheathed/`, plus `art/raw/<rem>-sheathed/manifest.json`. Record:
  - the tool and every argument;
  - the character, state and job ids;
  - the generations per call, from the balance before and after;
  - any retake;
  - the sha256 of every file.
- Pass images by upload reference, never as inline base64.
- Never commit the token, model files or anything from the environment.

## Budget
- About **70 generations** for one Remembrance, hard cap **100**. David approved this for each of the three.
- Call `get_balance` before the first call, after each step, and at the end.
- If a single call quotes more than 30, or the total would pass 100, stop and ask David.
- At most one retake per step, only for the hard failures named in the step.
- Use `wait_for_jobs` to wait. Always pass `directions` (v3 defaults to south only).

## Step 1: the Remembrance's state
1. Call `get_character` (free) on SS-01's Ash character `507ec529-642d-4b0e-999b-731be937ba15`. Check that it still exists, and save its states and template list in the manifest. If it is missing, stop and ask David.
2. Call `create_character_state` on it with `state_name` (Clay, Tide or Wing), `seed: 1234` and the `edit_description` for `<rem>`:

| `<rem>` | `edit_description` |
|---|---|
| clay | "Wearing the Clay Remembrance instead of the hooded cloak: a potter's wrap of coarse undyed cloth bound round the body and a stiff apron caked with dried reddish-brown clay over it, the sleeves rolled to the elbow, dark trousers and wrapped feet; no cloak and no hood, short dark hair. The same small clay figure with grey-ochre clay skin, the same face and three amber freckles, the same build. Both hands empty: no blade, no weapon, nothing held." |
| tide | "Wearing the Tide Remembrance instead of the hooded cloak: a pale, salt-stiff sailcloth tunic with a rope belt and a bronze buckle, dark trousers and boots; no cloak and no hood, short dark hair. The same small clay figure with grey-ochre clay skin, the same face and three amber freckles, the same build. Both hands empty: no blade, no weapon, nothing held." |
| wing | "Wearing the Wing Remembrance instead of the hooded cloak: a short wheat-pale mantle lined with soft down that shows at its collar and edges, over a torn leather harness of straps across the chest, dark trousers and boots; no hood, short dark hair. The same small clay figure with grey-ochre clay skin, the same face and three amber freckles, the same build. Both hands empty: no blade, no weapon, nothing held." |

3. Save the 8 rotations as `art/raw/<rem>-sheathed/rotations/<direction>.png`, with full direction names (`south-east`).

Retake once (`seed: 1235`) only if, in most facings:
- a blade or any weapon is still in a hand; or
- the hooded cloak is still there; or
- the figure is redesigned: not the grey-ochre clay skin, no freckles, or a different build or height (more than 3 px off Ash's 45).

## Step 2: idle, walk and run
On the new state, with `animate_character` and these names as `animation_name`, all 8 directions:

| `animation_name` | Mode | Template or description | Expected |
|---|---|---|---|
| `idle` | v3 | "stands at rest, breathing slowly, arms relaxed and empty at the sides; a calm loop", `frame_count: 4` | ~8 |
| `walk` | skeleton-v3 | `template_animation_id: "walking-6-frames"` | ~24 |
| `run` | skeleton-v3 | `template_animation_id: "running-8-frames"` | ~24 |

If a template isn't in the template list, use v3 with a one-line description of the same motion and say so. In v3 output frame 0 is the rotation: keep it, ART doesn't use it in a cycle. Skeleton-v3 output has no rotation frame.

Save every frame as `art/raw/<rem>-sheathed/<animation_name>/<direction>/frame-<n>.png`.

Retake an animation once only if, in most facings:
- the figure is redesigned (outfit, hair or skin changed against Step 1); or
- a weapon appears in a hand; or
- `walk` or `run` doesn't move the legs.

## Done when
1. Make `art/raw/<rem>-sheathed/contact.png`, at 4× on hollow-deep #2A2540:
   - the 8 rotations in a row, with Ash's sheathed `idle_S_0` (cut from `packages/shared/assets/sprites/kindled-ash-sheathed.png`) beside them for the height and design;
   - each animation, one row per facing, labelled.
2. Run `bash scripts/cloud-setup.sh`, then `pnpm check`.
3. Commit the raw files, the manifest and the contact sheet, push, and open the draft PR.

The PR description holds:
- `contact.png`;
- the state: its height in px per facing against 45, whether the hands are empty, the hood gone, the freckles kept;
- per animation and facing: whether it reads, and the frames that loop best (`idle`: the rest frame and the fullest breath; `walk`: six; `run`: eight, starting at a contact);
- the colours used, and whether the clothes landed on the skin ramp (unwritten-sail / unwritten-tar) anywhere: ART remaps them, so just list where;
- any forbidden colour (#FFFFFF, #FFE7A3, #E0457B, #8E2550, husk-core #FFF4C7);
- the generations per call, and the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- any step that failed twice.
