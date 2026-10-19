# prop-threshing-floor

Built by `pnpm art:build prop-threshing-floor` from `art/sheets/prop-threshing-floor.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind prop, outline other, cell 112×128, origin (56, 120).

## Summary

- Frames: 8.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 40.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): idle.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Missing against the contract's table: none.

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: idle.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle | 8 | 38 / 38.86 | 107 98 99 93 99 104 109 96 (range 16) **flag** |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| idle_0 | `art/clean/prop-threshing-floor/idle 0` | 0 | 0 | -34 | 0, 0 | 6 | 7 | 0 |
| idle_1 | `art/clean/prop-threshing-floor/idle 1` | 0 | 0 | -34 | 0, 0 | 4 | 7 | 0 |
| idle_2 | `art/clean/prop-threshing-floor/idle 2` | 0 | 0 | -34 | 0, 0 | 4 | 7 | 0 |
| idle_3 | `art/clean/prop-threshing-floor/idle 3` | 0 | 0 | -34 | 0, 0 | 4 | 7 | 0 |
| idle_4 | `art/clean/prop-threshing-floor/idle 4` | 0 | 0 | -34 | 0, 0 | 4 | 7 | 0 |
| idle_5 | `art/clean/prop-threshing-floor/idle 5` | 0 | 0 | -34 | 0, 0 | 6 | 7 | 0 |
| idle_6 | `art/clean/prop-threshing-floor/idle 6` | 0 | 0 | -34 | 0, 0 | 6 | 7 | 0 |
| idle_7 | `art/clean/prop-threshing-floor/idle 7` | 0 | 0 | -34 | 0, 0 | 6 | 7 | 0 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

