# husk-nutshell

Built by `pnpm art:build husk-nutshell` from `art/sheets/husk-nutshell.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind husk, outline other, cell 64×64, origin (32, 54).

## Summary

- Frames: 25.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 220.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Missing against the contract's table: none.

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: spawn, idle, walk, telegraph, slam, hit, chipped_outer, chipped_inner, regrow, death, drop.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| spawn | 4 |  |  |  |
| idle | 2 | 366 / 366 | 32 31 (range 1) |  |
| walk | 4 | 550 / 574.67 | 32 33 32 32 (range 1) |  |
| telegraph | 2 |  |  |  |
| slam | 2 |  |  |  |
| hit | 1 |  |  |  |
| chipped_outer | 1 |  |  |  |
| chipped_inner | 1 |  |  |  |
| regrow | 3 |  |  |  |
| death | 4 |  |  |  |
| drop | 1 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| spawn_0 | `art/clean/husk-nutshell/spawn 0` | 0 | 0 | 0 | 0, 0 | 0 | 2 | 0 |
| spawn_1 | `art/clean/husk-nutshell/spawn 1` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| spawn_2 | `art/clean/husk-nutshell/spawn 2` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| spawn_3 | `art/clean/husk-nutshell/spawn 3` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| idle_0 | `art/clean/husk-nutshell/idle 0` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| idle_1 | `art/clean/husk-nutshell/idle 1` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| walk_0 | `art/clean/husk-nutshell/walk 0` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| walk_1 | `art/clean/husk-nutshell/walk 1` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| walk_2 | `art/clean/husk-nutshell/walk 2` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| walk_3 | `art/clean/husk-nutshell/walk 3` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| telegraph_0 | `art/clean/husk-nutshell/telegraph 0` | 0 | 0 | 0 | 0, 0 | 109 | 5 | 0 |
| telegraph_1 | `art/clean/husk-nutshell/telegraph 1` | 0 | 0 | 0 | 0, 0 | 111 | 6 | 0 |
| slam_0 | `art/clean/husk-nutshell/slam 0` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| slam_1 | `art/clean/husk-nutshell/slam 1` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| hit_0 | `art/clean/husk-nutshell/hit 0` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| chipped_outer_0 | `art/clean/husk-nutshell/chipped_outer 0` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| chipped_inner_0 | `art/clean/husk-nutshell/chipped_inner 0` | 0 | 0 | 0 | 0, 0 | 0 | 4 | 0 |
| regrow_0 | `art/clean/husk-nutshell/regrow 0` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| regrow_1 | `art/clean/husk-nutshell/regrow 1` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| regrow_2 | `art/clean/husk-nutshell/regrow 2` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| death_0 | `art/clean/husk-nutshell/death 0` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| death_1 | `art/clean/husk-nutshell/death 1` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| death_2 | `art/clean/husk-nutshell/death 2` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| death_3 | `art/clean/husk-nutshell/death 3` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| drop_0 | `art/clean/husk-nutshell/drop 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

