# M1 polish, part 2: GAME DESIGN's answers on the backpedal and the chests, ART's on rates and shadows

Follow-up to #69, which is merged. Work on the branch `m1-polish-2`, which already holds this file (`docs/tasks/m1-polish-2.md`). Merge the latest `main` into it first. Open one PR, "M1 polish 2: backpedal in Combat only, chests moved, prop shadows", through the REST API (`gh pr create` is blocked).

## GAME DESIGN's answers to #69 (2026-10-17): sim changes, goldens move

### 1. The backpedal applies only in Combat

- **Calm:** never in a cleared room, which is Calm, and never on the holding.
- **The heavy's charge walk** keeps its own 0.45 × with no backpedal factor on top.
- **Unchanged:** the dodge, Haul's pull and forced movement keep their full distances, as #69 already does.
- **Tests:**
  - the factor in Combat;
  - none in Calm;
  - none on the charge walk at 180°;
  - a replay test.
- Update `combat.md`.

### 2. Chests move, and the clearance rule grows

- **The rule:** two tiles of plain floor all round every chest (the 5 × 5 square around it), **and no player start (`P`) or spawn point (`S`) within those two tiles**. Extend the shared rule and its test.
- **New chest positions** (col, row) in `packages/shared/data/rooms.json`. Each old `C` becomes `.` and the `C` goes to its new cell:

  | Template | Old | New |
  |---|---|---|
  | Shell Gallery | (5, 15) | (4, 15) |
  | Crossing | (6, 13) | (11, 11) |
  | Narrow Hollow | (36, 1) | (36, 3) |
  | Core Ring | (6, 15) | (6, 13) |
  | Spill | (23, 12) | (23, 7) |

  MAIN checked all five new cells against the rule: each has plain floor in its 5 × 5 square and no `P` or `S`.
- **The pinned list** of failing templates in `rooms.test.ts` becomes empty. The test now fails on any template that breaks the rule.
- **Goldens move again** (chest positions, and the backpedal in Calm). Commit them with the reason, "chests moved, backpedal Combat-only, GAME DESIGN 2026-10-17". Check that the autopilot still clears its seeds; change a seed only if needed, and say which.

## ART's answers to #69 (2026-10-17): client and contract

### 3. `run_back`'s rate

`run_back` gets a nominal **12 fps** in `KINDLED_ANIMS`, used only where nothing drives it by distance: tools, previews, a pose without a stride. In play it stays by distance.

### 4. The prop shadow rule

- **Width:** the widest of the frame's **lowest 3 opaque rows**, plus 4.
- **Height:** 6, or **3 when the shadow is narrower than 16 px**.
- **Results:** the chest 32 × 6, the Sparkglass chip 9 × 3.
- **Husks** keep their radius-scaled shadows (17 × 5 and 33 × 10); the rule is for props only.
- Update the helper and its tests (a pointed base, a flat base, the 16 px edge) and `readability.md`.

## Don't

- Don't touch the inventory, the server, `InventoryScene` or art.
- Make no other change to `rooms.json` than the five chest moves.

## Done when

- `pnpm check`, `pnpm build` and `pnpm art:check` pass.
- `combat.md` and `readability.md` are updated.
- The PR says which goldens moved and why, with a screenshot of each moved chest, linked by commit SHA.

Your last message tells David the PR number.
