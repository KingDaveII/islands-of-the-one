# M2 Task 3a follow-up: ART's fixes to the inventory screen

Follow-up to #68, which is merged. Work on the branch `m2-3a-inventory-fixes`, which already holds this file (`docs/tasks/m2-3a-fixes.md`). Merge the latest `main` into it first. Open one PR, "M2 Task 3a follow-up: inventory screen fixes", through the REST API (`gh pr create` is blocked).

## ART's answers to #68 (2026-10-17)

1. **Focus:**
   - Only the focused pane takes `ui-focus` on its frame. In #68's shots both the pack and the store have amber frames, so you can't tell which one the keys or pad act on.
   - The other pane keeps the plain panel frame.
   - The focused cell inside the pane keeps its own focus frame, as now.
2. **"Pack full.":**
   - It sits right-aligned in the PACK header row, next to the slot count: `PACK 20/20 … Pack full.`
   - It blinks twice, holds for 2 s, then disappears in one frame. There's no fade; use `blinkOut()`'s rules.
   - Other refusal lines from a move, such as `stack-limit`, use the same place and timing in the header of the pane the move went to.
3. **The store's page counter** sits right-aligned in the STORE header row, with the page glyphs on either side.
4. **The Q/F key glyphs** go under their slots, centred, the same way the HUD shows its key hints.
5. **`key_i` and `ps_touchpad`** stay as placeholders; ART redraws both with the M2 item icons. No change.

The rest of #68's placeholder layout stays as it is: ART confirmed the 24 px cells on a 26 px pitch, the amber counts and the tooltip (muted body, divider, count line).

## Don't

- Don't touch the server, the inventory module or the API.
- Don't touch `packages/sim`.
- Don't change art.

## Tests and done when

- Unit tests for the layout logic:
  - which pane holds focus;
  - the refusal line's placement and blink timing.
- Re-take #68's screenshots into `docs/screenshots/m2-3a/` and link them in the PR by commit SHA. Include one with the pack focused and one with the store focused.
- `pnpm check`, `pnpm build` and `pnpm art:check` pass.

Your last message tells David the PR number.
