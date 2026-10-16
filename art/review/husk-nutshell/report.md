# husk-nutshell (draft)

Built by `pnpm art:build husk-nutshell` from `art/sheets/husk-nutshell.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind husk, outline other, cell 64×64, origin (32, 54). A draft writes this review only, never `packages/shared/assets`.

## Summary

- Frames: 15.
- Off-palette pixels snapped: 1275 (largest ΔE 7.59).
- Outline gaps (edge pixels not in an outline colour): 471.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): idle.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: idle_0, idle_1, walk_0, walk_1, walk_2, walk_3, slam_0, hit_0, regrow_0.
- Missing against the contract's table: spawn, telegraph, chipped_outer, chipped_inner, death: 3 of 4 frames, drop.

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: idle, walk, slam, hit, regrow, death.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle | 2 | 937 / 937 | 43 39 (range 4) **flag** |  |
| walk | 4 | 903 / 903 | 46 46 46 46 (range 0) |  |
| slam | 2 |  |  |  |
| hit | 1 |  |  |  |
| regrow | 3 |  |  |  |
| death | 3 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| idle_0 | `art/raw/husks-m1/nutshell/idle 2` | 118 | 5.68 | 0 | 0, -4 | 2 | 16 **flag** | 59 |
| idle_1 | `art/raw/husks-m1/nutshell/idle 4` | 318 | 7.3 | 0 | 0, -4 | 1 | 13 **flag** | 42 |
| walk_0 | `art/raw/husks-m1/nutshell/walk 1` | 146 | 7.37 | 0 | -2, -4 | 4 | 15 **flag** | 58 |
| walk_1 | `art/raw/husks-m1/nutshell/walk 0` | 0 | 0 | 0 | -2, -4 | 0 | 15 **flag** | 93 |
| walk_2 | `art/raw/husks-m1/nutshell/walk 1` | 146 | 7.37 | 0 | -2, -4 | 4 | 15 **flag** | 58 |
| walk_3 | `art/raw/husks-m1/nutshell/walk 0` | 0 | 0 | 0 | -2, -4 | 0 | 15 **flag** | 93 |
| slam_0 | `art/raw/husks-m1/nutshell/slam 1` | 110 | 7.59 | 0 | -2, -4 | 1 | 16 **flag** | 100 |
| slam_1 | `art/raw/husks-m1/nutshell/slam 4` | 25 | 7.01 | 0 | -2, -4 | 1 | 10 | 16 |
| hit_0 | `art/raw/husks-m1/nutshell/idle 2` | 118 | 5.68 | 0 | 0, -4 | 2 | 16 **flag** | 59 |
| regrow_0 | `art/raw/husks-m1/nutshell/regrow 1` | 137 | 7.58 | 0 | 0, -4 | 0 | 18 **flag** | 91 |
| regrow_1 | `art/raw/husks-m1/nutshell/regrow 2` | 79 | 7.29 | 0 | 0, -4 | 0 | 12 | 55 |
| regrow_2 | `art/raw/husks-m1/nutshell/regrow 4` | 76 | 7.29 | 0 | 0, -4 | 0 | 11 | 21 |
| death_0 | `art/raw/husks-m1/nutshell/death 4` | 1 | 4.62 | 0 | -2, -4 | 270 | 8 | 0 |
| death_1 | `art/raw/husks-m1/nutshell/death 5` | 0 | 0 | 0 | -2, -4 | 169 | 5 | 0 |
| death_2 | `art/raw/husks-m1/nutshell/death 6` | 1 | 4.85 | 0 | -2, -4 | 17 | 6 | 36 |

## Off-palette colours the snap moved

88 source colours reached the snap off the whitelist. The 20 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

| Colour | Pixels | Snapped to | ΔE | Ramp | Frames |
|---|---|---|---|---|---|
| #998fb9 | 207 | hollow-dusk #a99fc4 | 5.06 | shell, stone | idle 0 1; hit 0 |
| #d8d2cb | 129 | hollow-lavender #d9d2e9 | 4.21 | stone | idle 0 1; hit 0 |
| #9d94ba | 124 | hollow-dusk #a99fc4 | 3.61 | shell, stone | regrow 0–2 |
| #9e94ba | 70 | hollow-dusk #a99fc4 | 3.53 | shell, stone | walk 0 2 |
| #cbc3dd | 46 | hollow-lavender #d9d2e9 | 4.48 | stone | walk 0 2 |
| #8c83b0 | 42 | watcher-stone #7d8794 | 5.36 | cloth, steel | idle 0 1; hit 0 |
| #988fb6 | 41 | hollow-dusk #a99fc4 | 5.22 | shell, stone | slam 0 1 |
| #e6e2f2 | 34 | husk-shell #e8e2d6 | 3.82 | shell, steel | walk 0 2 |
| #cdc6e1 | 34 | hollow-lavender #d9d2e9 | 3.62 | stone | regrow 0–2 |
| #50476a | 30 | watcher-iron #4a4e57 | 4.5 | cloth, steel | regrow 0–2 |
| #b8adcf | 28 | hollow-dusk #a99fc4 | 4.47 | shell, stone | walk 0 2 |
| #151839 | 25 | dream-night #1c2147 | 3.95 | player outline, paper | idle 0 1; hit 0 |
| #dad3c9 | 24 | husk-shell #e8e2d6 | 4.46 | shell, steel | walk 0 2 |
| #151934 | 23 | dream-night #1c2147 | 4.41 | player outline, paper | slam 0 |
| #d0c9d9 | 22 | hollow-lavender #d9d2e9 | 3.14 | stone | walk 0 2 |
| #5f6e83 | 18 | wheel-patina #2f7f7a | 7.3 | water | idle 1 |
| #cbc4e1 | 18 | hollow-lavender #d9d2e9 | 4.22 | stone | slam 0 1 |
| #6b768d | 17 | watcher-stone #7d8794 | 5.68 | cloth, steel | idle 0 1; hit 0 |
| #dad4d2 | 17 | hollow-lavender #d9d2e9 | 3.42 | stone | regrow 0–2 |
| #b8883a | 16 | wheel-brass #c79a3e | 5.46 | brass | idle 0 1; hit 0 |
