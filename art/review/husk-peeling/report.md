# husk-peeling

Built by `pnpm art:build husk-peeling` from `art/sheets/husk-peeling.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind husk, outline other, cell 64×64, origin (32, 54).

## Summary

- Frames: 18.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 194.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Missing against the contract's table: none.

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: spawn, idle, telegraph, lunge, hit, chipped, death, drop.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| spawn | 4 |  |  |  |
| idle | 2 | 194 / 194 | 17 18 (range 1) |  |
| telegraph | 2 |  |  |  |
| lunge | 3 |  |  |  |
| hit | 1 |  |  |  |
| chipped | 1 |  |  |  |
| death | 4 |  |  |  |
| drop | 1 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| spawn_0 | `art/clean/husk-peeling/spawn 0` | 0 | 0 | 0 | 0, 0 | 0 | 2 | 0 |
| spawn_1 | `art/clean/husk-peeling/spawn 1` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| spawn_2 | `art/clean/husk-peeling/spawn 2` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| spawn_3 | `art/clean/husk-peeling/spawn 3` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| idle_0 | `art/clean/husk-peeling/idle 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| idle_1 | `art/clean/husk-peeling/idle 1` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| telegraph_0 | `art/clean/husk-peeling/telegraph 0` | 0 | 0 | 0 | 0, 0 | 101 | 7 | 0 |
| telegraph_1 | `art/clean/husk-peeling/telegraph 1` | 0 | 0 | 0 | 0, 0 | 93 | 7 | 0 |
| lunge_0 | `art/clean/husk-peeling/lunge 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| lunge_1 | `art/clean/husk-peeling/lunge 1` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| lunge_2 | `art/clean/husk-peeling/lunge 2` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| hit_0 | `art/clean/husk-peeling/hit 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| chipped_0 | `art/clean/husk-peeling/chipped 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| death_0 | `art/clean/husk-peeling/death 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| death_1 | `art/clean/husk-peeling/death 1` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| death_2 | `art/clean/husk-peeling/death 2` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| death_3 | `art/clean/husk-peeling/death 3` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| drop_0 | `art/clean/husk-peeling/drop 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

