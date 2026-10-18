# Art job kesh: raw material for Old Kesh fishing on his rock

You are running an art job for ART DIRECTION, the art director of Islands of the One. Read these first:
- CLAUDE.md;
- `art/anchors/style-sheet.md`: the colour table, the drawing rules, the heights;
- `docs/design/holding.md`, the `kesh` entry (his rock off the south-east shore and the Talk spot);
- `docs/design/sprites.md`, the NPC section;
- `art/jobs/g13b-job3.md` and `art/raw/g13b-job3/npc-kesh/`: Kesh at B, standing, in 8 rotations (character `8fbb8b65-0614-45c7-8751-c1475b7f41d2`);
- `art/jobs/g13b-job2.md` and `art/raw/g13b-job2/manifest.json`: how `create_character_state` and `animate_character` (mode v3) were called;
- `art/clean/prop-kesh-rock/idle/frame-0.png`: the rock he sits on.

The job **generates raw material only**: a seated, fishing state of Kesh and three short animations of it. ART cleans the frames, cuts the seat into the rock's tip, composes Kesh onto it in the 96×128 cell and writes the `npc-kesh` recipe once Task 4b's contract is on `main`. So:
- write no recipe;
- run no `art:build`;
- make no code changes;
- don't retouch, recolour, cut or scale anything.

## Why
In Task 4b the player talks to Old Kesh across the water. He sits on top of his needle of rock in the Hollow, fishing into the void, and throws something across to the player. His sheet `npc-kesh` gets three seated rows. Each has one facing: Kesh faces **south-east**, away from the island and out over the Hollow.

| Row | Frames | What it shows |
|---|---|---|
| `fish` | 4, looping at 4 fps | sitting still, the rod held out over the void; the rod tip dips and the line sways |
| `talk` | 2, looping at 3 fps | head and shoulders turned back over his right shoulder toward the shore behind him (screen left, west), speaking; the rod still held |
| `toss` | 4, once at 10 fps | a short underarm flick of his free hand, throwing a small object back over his shoulder toward the shore (screen left), then the hand comes back to the rod |

## Branch and PR
- Branch `art/kesh` from the latest `main`; never push to main.
- Open a **draft** PR "Asset: kesh (raw)" through the REST API (`gh api repos/KingDaveII/islands-of-the-one/pulls -f title=... -f head=art/kesh -f base=main -F draft=true -f body=...`; `gh pr create` is blocked).
- Download every PixelLab result at once (links can expire) as raw 1× files under `art/raw/kesh/`, plus `art/raw/kesh/manifest.json`. Record:
  - the tool and every argument;
  - the character, state and job ids;
  - the generations per call, from the balance before and after;
  - any retakes;
  - the sha256 of every file.
- Pass images by upload reference, never as inline base64.
- Never commit the token, model files or anything from the environment.

## Budget
- About **30 generations**, hard cap **50**. David approved this.
- Call `get_balance` before the first call, after each step and at the end.
- If a single call quotes more than 25, or the total would pass 50, stop and ask David.
- At most one retake per step, only for the hard failures named in the step. Record the retake and why.
- Use `wait_for_jobs` to wait.

## Step 1: the seated state
1. Call `get_character` (free) on `8fbb8b65-0614-45c7-8751-c1475b7f41d2`. Check that it still exists and save its states in the manifest. If it is missing, stop and ask David.
2. Call `create_character_state` on it, with `state_name: "Fishing"`, `seed: 1234` and this `edit_description`:

   "sitting on the flat top of a rock with his legs hanging over its edge, knees bent and feet dangling, his back a little hunched; both hands hold a long thin wooden fishing rod angled forward and up, held out in front of him, a thin fishing line hanging from its tip; the same Old Kesh: river-dark brown-black clay, a few widely spaced amber freckles, long white hair and a white beard, the patched grey-ochre sailcloth tunic with its wet grey patch, dark trousers, wrapped dark feet. No rock or ground drawn under him."

3. Save the 8 rotations as `art/raw/kesh/fishing/rotations/<direction>.png`, with full direction names (`south-east`).

Retake once (`seed: 1235`) only if, in the south-east rotation:
- Kesh is standing, not sitting; or
- he holds no rod; or
- he is redesigned: no white hair or beard, skin not dark clay, or the tunic gone.

## Step 2: the animations
Call `animate_character` with mode v3 on the Fishing state, `directions: ["south-east"]` (always pass `directions`), three times:

| `animation_name` | `frame_count` | `action_description` |
|---|---|---|
| `fish` | 6 | "sits still and fishes: the rod tip dips gently and comes back up, the line sways, he breathes; a calm seamless loop, the body hardly moves" |
| `talk` | 4 | "turns his head and shoulders back over his right shoulder toward the left of the picture and talks, the rod still held out in front of him with one hand" |
| `toss` | 6 | "lets go of the rod with one hand and gives a short underarm flick, throwing a small object back over his shoulder toward the left of the picture, then takes hold of the rod again" |

In v3 output, frame 0 is the rotation: keep it, but ART won't use it in a cycle.

Save every frame as `art/raw/kesh/fishing/<animation_name>/south-east/frame-<n>.png`.

Retake an animation once only if:
- Kesh stands up or leaves his seat; or
- the rod disappears in most frames; or
- the figure is redesigned; or
- for `toss`, no throw can be seen.

If `south-east` fails twice for one animation, try that animation once in `east` instead and say so.

## Done when
1. Make `art/raw/kesh/contact.png`, at 4× on hollow-deep #2A2540 (the Hollow):
   - the 8 Fishing rotations in a row, with the standing south-east rotation from Job 3 beside them;
   - each animation's frames in a row, labelled;
   - the south-east Fishing rotation set on top of `art/clean/prop-kesh-rock/idle/frame-0.png` (rock bottom-centred on a 64×64 canvas, Kesh's seat placed by eye on its tip), only for scale.
2. Run `bash scripts/cloud-setup.sh`, then `pnpm check`.
3. Commit the raw files, the manifest and the contact sheet, push, and open the draft PR.

The PR description holds:
- `contact.png`;
- for the Fishing state: Kesh's height in px, from the top of his hair to the lowest pixel of his seat and to the lowest pixel of his feet, and the rod's reach in px beyond his body;
- per animation: the frames that read best as a loop (`fish`, `talk`) or as the throw (`toss`), and the frame where the object leaves his hand;
- the colours used by each set, and any forbidden colour (#FFFFFF, #FFE7A3, #E0457B, #8E2550, husk-core #FFF4C7);
- the generations per call, and the balance before and after;
- anything surprising;
- "Requests for MAIN: none" unless something came up.

Your last message tells David:
- the PR number;
- the generations spent and the balance left;
- any step that failed twice.
