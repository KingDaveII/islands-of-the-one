# npc-kesh

Built by `pnpm art:build npc-kesh` from `art/sheets/npc-kesh.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind npc, outline other, cell 96×128, origin (48, 118).

## Summary

- Frames: 10.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 302.
- Loop seam flags (last → first above 1.5× the mean change): fish.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Points: 4 placed (0 mirrored from their twin); missing: 0.
- Missing against the contract's table: idle (all facings), walk (all facings).
- Optional (after M1, or awaiting art: a finished sheet may leave them out, but carries every facing of any it has): idle (M3), walk (M3).

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: fish, talk, toss.

`points.png` has the rows of the animations that carry points, at 4× on the floor, each point marked by a 1 px cross in telegraph pink round its pixel (listed under "Points").

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| fish | 4 | 287 / 146.67 **flag** |  |  |
| talk | 2 | 629 / 629 |  |  |
| toss | 4 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| fish_0 | `art/clean/npc-kesh/fish 0` | 0 | 0 | -32 | 0, 0 | 31 | 11 | 0 |
| fish_1 | `art/clean/npc-kesh/fish 1` | 0 | 0 | -32 | 0, 0 | 27 | 11 | 0 |
| fish_2 | `art/clean/npc-kesh/fish 2` | 0 | 0 | -32 | 0, 0 | 30 | 10 | 0 |
| fish_3 | `art/clean/npc-kesh/fish 3` | 0 | 0 | -32 | 0, 0 | 31 | 11 | 0 |
| talk_0 | `art/clean/npc-kesh/talk 0` | 0 | 0 | -32 | 0, 0 | 32 | 11 | 0 |
| talk_1 | `art/clean/npc-kesh/talk 1` | 0 | 0 | -32 | 0, 0 | 32 | 11 | 0 |
| toss_0 | `art/clean/npc-kesh/toss 0` | 0 | 0 | -32 | 0, 0 | 31 | 11 | 0 |
| toss_1 | `art/clean/npc-kesh/toss 1` | 0 | 0 | -32 | 0, 0 | 30 | 11 | 0 |
| toss_2 | `art/clean/npc-kesh/toss 2` | 0 | 0 | -32 | 0, 0 | 28 | 11 | 0 |
| toss_3 | `art/clean/npc-kesh/toss 3` | 0 | 0 | -32 | 0, 0 | 30 | 11 | 0 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.


## Points

Each point in the cell (where the sheet stores it) and in the frame's source pixels (where the recipe's `points` gives it). A mirrored facing inherits its twin's points, mirrored, unless the recipe lists its own.

| Frame | Point | Cell | Source | From |
|---|---|---|---|---|
| toss_0 | hand | 25, 89 | 25, 89 | recipe |
| toss_1 | hand | 21, 87 | 21, 87 | recipe |
| toss_2 | hand | 16, 79 | 16, 79 | recipe |
| toss_3 | hand | 51, 83 | 51, 83 | recipe |
