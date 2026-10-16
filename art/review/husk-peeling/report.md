# husk-peeling (draft)

Built by `pnpm art:build husk-peeling` from `art/sheets/husk-peeling.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind husk, outline other, cell 64×64, origin (32, 54). A draft writes this review only, never `packages/shared/assets`.

## Summary

- Frames: 10.
- Off-palette pixels snapped: 301 (largest ΔE 7.32).
- Outline gaps (edge pixels not in an outline colour): 241.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): idle.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: idle_0, hit_0.
- Missing against the contract's table: spawn, telegraph, chipped, drop.

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: idle, lunge, hit, death.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle | 2 | 452 / 452 | 45 41 (range 4) **flag** |  |
| lunge | 3 |  |  |  |
| hit | 1 |  |  |  |
| death | 4 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| idle_0 | `art/raw/husks-m1/peeling/idle 1` | 92 | 7.32 | 0 | 0, -2 | 7 | 14 **flag** | 24 |
| idle_1 | `art/raw/husks-m1/peeling/idle 3` | 69 | 6.94 | 0 | 0, -2 | 9 | 9 | 21 |
| lunge_0 | `art/raw/husks-m1/peeling/lunge 1` | 9 | 5.08 | 0 | 0, -2 | 0 | 7 | 0 |
| lunge_1 | `art/raw/husks-m1/peeling/lunge 2` | 1 | 3.54 | 0 | 0, -2 | 2 | 5 | 0 |
| lunge_2 | `art/raw/husks-m1/peeling/lunge 6` | 7 | 4.79 | 0 | 0, -2 | 0 | 5 | 0 |
| hit_0 | `art/raw/husks-m1/peeling/idle 1` | 92 | 7.32 | 0 | 0, -2 | 7 | 14 **flag** | 24 |
| death_0 | `art/raw/husks-m1/peeling/death 1` | 9 | 7.07 | 0 | 0, -2 | 13 | 5 | 0 |
| death_1 | `art/raw/husks-m1/peeling/death 2` | 3 | 7.07 | 0 | 0, -2 | 82 | 5 | 0 |
| death_2 | `art/raw/husks-m1/peeling/death 3` | 17 | 4.89 | 0 | 0, -2 | 67 | 7 | 0 |
| death_3 | `art/raw/husks-m1/peeling/death 4` | 2 | 7.07 | 0 | 0, -2 | 54 | 4 | 0 |

## Off-palette colours the snap moved

38 source colours reached the snap off the whitelist. The 20 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

| Colour | Pixels | Snapped to | ΔE | Ramp | Frames |
|---|---|---|---|---|---|
| #1b1831 | 150 | dream-night #1c2147 | 4.7 | player outline, paper | idle 0 1; hit 0 |
| #9c94b5 | 12 | hollow-dusk #a99fc4 | 3.92 | shell, stone | idle 0 1; hit 0 |
| #b8b2c6 | 11 | hollow-dusk #a99fc4 | 5.72 | shell, stone | idle 0 1; hit 0 |
| #9a95b3 | 11 | hollow-dusk #a99fc4 | 4.07 | shell, stone | death 0 2 3 |
| #d7d0d8 | 11 | hollow-lavender #d9d2e9 | 2.32 | stone | idle 0 1; hit 0 |
| #c4bcce | 8 | hollow-lavender #d9d2e9 | 6.94 | stone | idle 0 1; hit 0 |
| #bbb2d2 | 8 | hollow-dusk #a99fc4 | 5.85 | shell, stone | idle 0; hit 0 |
| #9d95b7 | 8 | hollow-dusk #a99fc4 | 3.54 | shell, stone | lunge 0–2 |
| #d1cbd0 | 7 | hollow-lavender #d9d2e9 | 3.72 | stone | death 0–2 |
| #dbd5d1 | 6 | hollow-lavender #d9d2e9 | 3.69 | stone | idle 0 1; hit 0 |
| #beb6c8 | 5 | hollow-dusk #a99fc4 | 7.07 | shell, stone | death 0 1 3 |
| #8e89ad | 5 | watcher-stone #7d8794 | 4.66 | cloth, steel | idle 0 1; hit 0 |
| #160e30 | 4 | dream-night #1c2147 | 7.09 | player outline, paper | idle 0; hit 0 |
| #3c3556 | 4 | sleeper-night #24305a | 4.44 | water, hair | idle 0; hit 0 |
| #c9c2aa | 4 | sleeper-soil #e3c29e | 3.9 | red clay | idle 0; hit 0 |
| #655e82 | 4 | hollow-below #5b5478 | 3.54 | stone, hair | idle 0; hit 0 |
| #565063 | 4 | watcher-iron #4a4e57 | 2.89 | cloth, steel | idle 0; hit 0 |
| #d4cec4 | 3 | sleeper-soil #e3c29e | 5.04 | red clay | idle 0 1; hit 0 |
| #cdc5d4 | 3 | hollow-lavender #d9d2e9 | 4.33 | stone | idle 1 |
| #35304a | 3 | sleeper-night #24305a | 3.88 | water, hair | death 0–2 |
