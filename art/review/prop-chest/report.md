# prop-chest

Built by `pnpm art:build prop-chest` from `art/sheets/prop-chest.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind prop, outline other, cell 64×64, origin (32, 54).

## Summary

- Frames: 7.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 0.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Missing against the contract's table: none.

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: closed, opening, open.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| closed | 2 | 5 / 5 |  |  |
| opening | 4 |  |  |  |
| open | 1 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| closed_0 | `art/clean/prop-chest/closed 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| closed_1 | `art/clean/prop-chest/closed 1` | 0 | 0 | 0 | 0, 0 | 0 | 7 | 0 |
| opening_0 | `art/clean/prop-chest/opening 0` | 0 | 0 | 0 | 0, 0 | 0 | 5 | 0 |
| opening_1 | `art/clean/prop-chest/opening 1` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| opening_2 | `art/clean/prop-chest/opening 2` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| opening_3 | `art/clean/prop-chest/opening 3` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |
| open_0 | `art/clean/prop-chest/open 0` | 0 | 0 | 0 | 0, 0 | 0 | 6 | 0 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

