# M1 polish: solid chests, the backpedal's cost, run transitions and run_back, and whole-pixel effects

Read CLAUDE.md, `docs/design/combat.md`, `docs/design/sprites.md` (§4, §8), `docs/design/readability.md` and `docs/design/art-pipeline.md`. Then read `packages/sim/src/run.ts` (movement, chests), `apps/client/src/render/animState.ts`, `world.ts`, `fx.ts`, `pixels.ts` and `chestSprites.ts`.

Work on the branch `m1-polish`, which already holds this file (`docs/tasks/m1-polish.md`). Merge the latest `main` into it first. Open one PR, "M1 polish: solid chests, backpedal, run transitions, whole-pixel effects", through the REST API (`gh pr create` is blocked).

This runs alongside M2 Task 3a. It doesn't touch the inventory, the server or `InventoryScene`; if you hit a conflict there, stop and tell David.

## Why

David's M1 playtest at B left decisions from GAME DESIGN and ART (2026-10-17). This task carries them out. Parts 1 and 2 change the sim on purpose. Parts 3–5 change only the client and the sprite contract.

## Decisions

### 1. Chests are solid (GAME DESIGN, sim change)

GAME DESIGN's rule (book, Game design → Preparation):
- A chest is a small round pillar of radius `run.chestRadiusPx` (8). It blocks the Kindled and every enemy alike, so it doubles as cover to circle around.
- Projectiles and Haul's hook pass over it.
- A chest opens when the Kindled touches it, within 2 px of its edge. It spills its items and stays standing with its lid open, **still solid**.
- **Room templates keep two tiles clear around every chest**, so a chest never closes a corridor.

What to do:
- **Collision:** resolve the Kindled and every Husk against chests as circles, after the walls, with the same integer push-out the sim uses for bodies. Don't touch the hook's or a projectile's path.
- **Opening:** opening becomes "within `chestRadius + 2 px` of the Kindled's edge". Put the 2 in tuning as `run.chestOpenReachPx` (2), not in code.
- **Templates:** add a test over `rooms.json` that every `C` has two tiles of floor all round. Report any template that fails, without editing `rooms.json`; GAME DESIGN owns the layouts.
- **Goldens:** replay goldens will move. Update them only for this change and say so in the commit: "chests solid, GAME DESIGN 2026-10-17". Check the autopilot still clears its seeds; if a seed now gets stuck on a chest, change the seed, not the rule, and say which.
- Update `combat.md`.

### 2. The backpedal costs speed (GAME DESIGN, sim change)

GAME DESIGN's rule (Game design → Movement and aim, "Backpedal"):
- Moving away from the aim is slower.
- The factor is 1 up to 90°, so strafing is never slowed. It eases down to 0.85 at 135° and stays there to 180°.
- It applies **in encounters only, to free movement only**: the dodge, Haul's pull and any forced movement keep their full distances.
- With a gamepad stick centred, aim follows movement, so that player is never slowed.

What to do:
- **Tuning keys:**
  - `player.backpedalFactor` (0.85, stored as the sim's usual integer form, e.g. permille);
  - `player.backpedalFromDeg` (90);
  - `player.backpedalFullDeg` (135).
- **The ease:** linear between the two angles, in integer math on the sim's 1/4096-turn angles (no floats, no trig). Clamp outside the range. Apply it to the target speed of free movement only.
- **Goldens move.** Commit them together with part 1's, or in their own commit with the reason.
- **Tests:**
  - the factor at 0°, 90°, 112.5°, 135° and 180°;
  - a dodge and a Haul pull at a backwards angle keep their full distance;
  - a replay test, same seed and inputs giving the same hash.
- Update `combat.md`.

### 3. Run transitions and `run_back` (ART, contract and engine)

New Kindled rows in `KINDLED_ANIMS`, all 8 facings, M1, all on `ANIMS_AWAITING_ART` until ART's frames land:

| anim | frames | fps | loop | playback |
|---|---|---|---|---|
| `run_start` | 2 | 20 | no | time, played once (100 ms) when the Kindled starts moving from idle |
| `run_stop` | 2 | 20 | no | time, played once (100 ms) when it stops, then `idle` |
| `run_back` | 4 | n/a | yes | by distance, one cycle per `anim.backCyclePx` (new tuning key, 48 world px) |

**Visual only.** The sim never waits for them:
- if the Kindled turns, attacks, dodges or stops again during a transition, the transition ends at once and the right animation plays;
- `run_start` hands over to `run` (or `run_back`) at the run's current distance phase.

**Backpedalling** (G1.5h's rule, above 112.5° and back below 100°) plays `run_back` when the sheet has it, otherwise the reversed `run` as today (`backpedalFrame` is the swap point). Transitions into a backpedal use `run_start` too.

While a row awaits art, its fallback is:
- `run_start` and `run_stop`: none, so the run and idle switch directly, as now;
- `run_back`: the reversed run.

The pipeline and the sheet test treat the rows as optional while they await art, as `run` was. Document all three in `sprites.md` §4 and §8.

### 4. Whole-pixel effects (ART's answers to #61)

No anti-aliasing and no alpha anywhere in these. Draw each from whole pixels in palette tokens, at B density.

1. **The slash arc** becomes a pixel arc:
   - the blade colour with a 2 px outline;
   - during the recovery's tail ticks (`ARC_TAIL_TICKS`) it shows as a 50% checker of itself;
   - then it's gone.
2. **The fx rings** become 1 px pixel circles, 2 px for the hit ring. As they fade they break into dashes: drop a growing share of their pixels in a fixed pattern, never lower the alpha.
3. **The Nutshell slam fill** becomes dither only: a telegraph-pink checker inside the dark-pink 1 px ring. It fills in as the wind-up runs, from every 4th pixel to every other pixel. No translucent disc.
4. **Particles** are 1 px everywhere, except the perfect dodge's burst and the core flare. Those two use a 5 px plus shape instead of the 2 × 2 square.
5. **Shadows:**
   - The Kindled keeps 20 × 6.
   - A prop's shadow is as wide as the lowest opaque row of its frame plus 4, and 6 high. Compute it once per sheet frame at load. The chest's comes out about 32 × 6.
   - Husks keep their current shadows unless the same rule gives the same size; say what you did.

Write a pure helper for the pixel circle, arc, checker and plus, with unit tests on their pixel sets, and use it everywhere these effects draw. Update `readability.md` where it describes them.

### 5. The Sparkglass pickup as a prop sheet (ART delivers it)

ART will deliver `prop-sparkglass`:
- a 9 × 11 chip with a 2-frame glint;
- an `idle` of 2 frames at the recipe's fps, which the prop kind already allows.

When that sheet is on disk, pickups draw from it at their position, keeping the engine's fly-out motion, with a shadow by the rule above. Until it lands, the current pickup drawing stays, marked as the fallback: the same pattern as the chest before #61. Test both with a fixture.

## Don't

- Don't touch the inventory, the server, `InventoryScene` or `rooms.json`.
- Make no art.
- Make no visual calls beyond these decisions. Anything unclear goes under "Questions for ART" or "Questions for GAME DESIGN".

## Tests

- The tests listed in each part.
- The headless playtest still shows every M1 Kindled animation except `walk`. The new rows are optional while they await art.
- Screenshots via `tools/screenshots-g15.mjs`, linked in the PR by commit SHA:
  - a fight with the new arc, rings, slam fill and particles;
  - the Kindled circling a chest;
  - a backpedal.

## Done when

- `pnpm check`, `pnpm build` and `pnpm art:check` pass.
- `combat.md`, `sprites.md` and `readability.md` are updated.
- The PR says which goldens moved and why, and lists any template that fails the chest-clearance test.

Your last message tells David the PR number.
