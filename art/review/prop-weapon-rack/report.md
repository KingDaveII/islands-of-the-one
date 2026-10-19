# prop-weapon-rack

Built by `pnpm art:build prop-weapon-rack` from `art/sheets/prop-weapon-rack.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind prop, outline other, cell 64×72, origin (32, 64).

## Summary

- Frames: 1.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 8.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Points: 3 placed (0 mirrored from their twin); missing: 0.
- Missing against the contract's table: none.

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: idle.

`points.png` has the rows of the animations that carry points, at 4× on the floor, each point marked by a 1 px cross in telegraph pink round its pixel (listed under "Points").

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle | 1 |  | 43 (range 0) |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| idle_0 | `art/clean/prop-weapon-rack/idle 0` | 0 | 0 | -6 | 0, 0 | 8 | 5 | 0 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.


## Points

Each point in the cell (where the sheet stores it) and in the frame's source pixels (where the recipe's `points` gives it). A mirrored facing inherits its twin's points, mirrored, unless the recipe lists its own.

| Frame | Point | Cell | Source | From |
|---|---|---|---|---|
| idle_0 | peg_0 | 27, 24 | 27, 24 | recipe |
| idle_0 | peg_1 | 37, 24 | 37, 24 | recipe |
| idle_0 | peg_2 | 45, 23 | 45, 23 | recipe |
