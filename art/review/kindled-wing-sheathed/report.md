# kindled-wing-sheathed

Built by `pnpm art:build kindled-wing-sheathed` from `art/sheets/kindled-wing-sheathed.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind kindled, outline player, cell 96×80, origin (48, 64).

## Summary

- Frames: 160.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 1779.
- Masked skin pixels: 17064.
- Loop seam flags (last → first above 1.5× the mean change): walk_SE, walk_N.
- Body bob flags (top row moves more than 2 px): walk_NE.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Skin regions to resolve: 0.
- Missing against the contract's table: carry_idle (all facings), carry_walk (all facings), sit (all facings).
- Optional (after M1, or awaiting art: a finished sheet may leave them out, but carries every facing of any it has): carry_idle (M2), carry_walk (M2), sit (M2).

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row. `tones.png` has the same rows in the four clay tones, through the mask: clay-grey-ochre, clay-pale, clay-red, clay-river-dark.

Rows, top to bottom: idle_S, idle_SE, idle_E, idle_NE, idle_N, idle_NW, idle_W, idle_SW, walk_S, walk_SE, walk_E, walk_NE, walk_N, walk_NW, walk_W, walk_SW, run_S, run_SE, run_E, run_NE, run_N, run_NW, run_W, run_SW, run_start_S, run_start_SE, run_start_E, run_start_NE, run_start_N, run_start_NW, run_start_W, run_start_SW, run_stop_S, run_stop_SE, run_stop_E, run_stop_NE, run_stop_N, run_stop_NW, run_stop_W, run_stop_SW.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle_S | 2 | 153 / 153 | 44 44 (range 0) |  |
| idle_SE | 2 | 208 / 208 | 45 45 (range 0) |  |
| idle_E | 2 | 214 / 214 | 45 46 (range 1) |  |
| idle_NE | 2 | 511 / 511 | 45 44 (range 1) |  |
| idle_N | 2 | 411 / 411 | 45 47 (range 2) |  |
| idle_NW | 2 | 542 / 542 | 45 46 (range 1) |  |
| idle_W | 2 | 337 / 337 | 45 45 (range 0) |  |
| idle_SW | 2 | 428 / 428 | 45 46 (range 1) |  |
| walk_S | 6 | 107 / 445.8 | 44 45 44 44 45 44 (range 1) |  |
| walk_SE | 6 | 364 / 235 **flag** | 45 45 45 45 45 45 (range 0) |  |
| walk_E | 6 | 306 / 421.6 | 45 46 46 46 44 45 (range 2) |  |
| walk_NE | 6 | 171 / 434.2 | 45 48 47 45 46 45 (range 3) **flag** |  |
| walk_N | 6 | 416 / 240.8 **flag** | 46 47 47 46 47 47 (range 1) |  |
| walk_NW | 6 | 404 / 313.4 | 45 45 45 45 46 46 (range 1) |  |
| walk_W | 6 | 279 / 357.6 | 45 44 44 45 45 45 (range 1) |  |
| walk_SW | 6 | 61 / 124.6 | 45 45 45 45 45 45 (range 0) |  |
| run_S | 8 | 341 / 301.71 |  |  |
| run_SE | 8 | 292 / 370.29 |  |  |
| run_E | 8 | 304 / 393.86 |  |  |
| run_NE | 8 | 413 / 345.57 |  |  |
| run_N | 8 | 318 / 223.86 |  |  |
| run_NW | 8 | 409 / 323 |  |  |
| run_W | 8 | 405 / 385 |  |  |
| run_SW | 8 | 267 / 343 |  |  |
| run_start_S | 2 |  |  |  |
| run_start_SE | 2 |  |  |  |
| run_start_E | 2 |  |  |  |
| run_start_NE | 2 |  |  |  |
| run_start_N | 2 |  |  |  |
| run_start_NW | 2 |  |  |  |
| run_start_W | 2 |  |  |  |
| run_start_SW | 2 |  |  |  |
| run_stop_S | 2 |  |  |  |
| run_stop_SE | 2 |  |  |  |
| run_stop_E | 2 |  |  |  |
| run_stop_NE | 2 |  |  |  |
| run_stop_N | 2 |  |  |  |
| run_stop_NW | 2 |  |  |  |
| run_stop_W | 2 |  |  |  |
| run_stop_SW | 2 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Masked |
|---|---|---|---|---|---|---|---|---|
| idle_S_0 | `art/clean/kindled-wing-sheathed/idle/south 0` | 0 | 0 | 0 | 14, 8 | 0 | 9 | 211 |
| idle_S_1 | `art/clean/kindled-wing-sheathed/idle/south 1` | 0 | 0 | 0 | 14, 8 | 3 | 9 | 213 |
| idle_SE_0 | `art/clean/kindled-wing-sheathed/idle/south-east 0` | 0 | 0 | -1 | 14, 7 | 1 | 9 | 171 |
| idle_SE_1 | `art/clean/kindled-wing-sheathed/idle/south-east 1` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 185 |
| idle_E_0 | `art/clean/kindled-wing-sheathed/idle/east 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 110 |
| idle_E_1 | `art/clean/kindled-wing-sheathed/idle/east 1` | 0 | 0 | -1 | 14, 7 | 3 | 8 | 110 |
| idle_NE_0 | `art/clean/kindled-wing-sheathed/idle/north-east 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 43 |
| idle_NE_1 | `art/clean/kindled-wing-sheathed/idle/north-east 1` | 0 | 0 | 0 | 14, 8 | 3 | 9 | 37 |
| idle_N_0 | `art/clean/kindled-wing-sheathed/idle/north 0` | 0 | 0 | -1 | 14, 7 | 0 | 6 | 0 |
| idle_N_1 | `art/clean/kindled-wing-sheathed/idle/north 1` | 0 | 0 | -1 | 14, 7 | 2 | 6 | 0 |
| idle_NW_0 | `art/clean/kindled-wing-sheathed/idle/north-west 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 44 |
| idle_NW_1 | `art/clean/kindled-wing-sheathed/idle/north-west 1` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 48 |
| idle_W_0 | `art/clean/kindled-wing-sheathed/idle/west 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 99 |
| idle_W_1 | `art/clean/kindled-wing-sheathed/idle/west 1` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 74 |
| idle_SW_0 | `art/clean/kindled-wing-sheathed/idle/south-west 0` | 0 | 0 | -1 | 14, 7 | 1 | 9 | 169 |
| idle_SW_1 | `art/clean/kindled-wing-sheathed/idle/south-west 1` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 185 |
| walk_S_0 | `art/clean/kindled-wing-sheathed/walk/south 0` | 0 | 0 | 0 | 8, 2 | 6 | 9 | 219 |
| walk_S_1 | `art/clean/kindled-wing-sheathed/walk/south 1` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 215 |
| walk_S_2 | `art/clean/kindled-wing-sheathed/walk/south 2` | 0 | 0 | 0 | 8, 2 | 4 | 9 | 212 |
| walk_S_3 | `art/clean/kindled-wing-sheathed/walk/south 3` | 0 | 0 | 0 | 8, 2 | 0 | 9 | 215 |
| walk_S_4 | `art/clean/kindled-wing-sheathed/walk/south 4` | 0 | 0 | -1 | 8, 1 | 5 | 9 | 210 |
| walk_S_5 | `art/clean/kindled-wing-sheathed/walk/south 5` | 0 | 0 | 0 | 8, 2 | 2 | 9 | 221 |
| walk_SE_0 | `art/clean/kindled-wing-sheathed/walk/south-east 0` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 180 |
| walk_SE_1 | `art/clean/kindled-wing-sheathed/walk/south-east 1` | 0 | 0 | -1 | 8, 1 | 10 | 9 | 175 |
| walk_SE_2 | `art/clean/kindled-wing-sheathed/walk/south-east 2` | 0 | 0 | -1 | 8, 1 | 5 | 9 | 173 |
| walk_SE_3 | `art/clean/kindled-wing-sheathed/walk/south-east 3` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 172 |
| walk_SE_4 | `art/clean/kindled-wing-sheathed/walk/south-east 4` | 0 | 0 | -1 | 8, 1 | 6 | 9 | 190 |
| walk_SE_5 | `art/clean/kindled-wing-sheathed/walk/south-east 5` | 0 | 0 | -1 | 8, 1 | 7 | 9 | 188 |
| walk_E_0 | `art/clean/kindled-wing-sheathed/walk/east 0` | 0 | 0 | -1 | 8, 1 | 12 | 9 | 109 |
| walk_E_1 | `art/clean/kindled-wing-sheathed/walk/east 1` | 0 | 0 | -2 | 8, 0 | 11 | 9 | 117 |
| walk_E_2 | `art/clean/kindled-wing-sheathed/walk/east 2` | 0 | 0 | -2 | 8, 0 | 13 | 9 | 120 |
| walk_E_3 | `art/clean/kindled-wing-sheathed/walk/east 3` | 0 | 0 | -2 | 8, 0 | 12 | 9 | 114 |
| walk_E_4 | `art/clean/kindled-wing-sheathed/walk/east 4` | 0 | 0 | 0 | 8, 2 | 9 | 9 | 114 |
| walk_E_5 | `art/clean/kindled-wing-sheathed/walk/east 5` | 0 | 0 | -1 | 8, 1 | 14 | 9 | 127 |
| walk_NE_0 | `art/clean/kindled-wing-sheathed/walk/north-east 0` | 0 | 0 | -1 | 8, 1 | 14 | 9 | 47 |
| walk_NE_1 | `art/clean/kindled-wing-sheathed/walk/north-east 1` | 0 | 0 | -4 | 8, -2 | 8 | 9 | 48 |
| walk_NE_2 | `art/clean/kindled-wing-sheathed/walk/north-east 2` | 0 | 0 | -3 | 8, -1 | 15 | 9 | 53 |
| walk_NE_3 | `art/clean/kindled-wing-sheathed/walk/north-east 3` | 0 | 0 | -1 | 8, 1 | 7 | 9 | 60 |
| walk_NE_4 | `art/clean/kindled-wing-sheathed/walk/north-east 4` | 0 | 0 | -1 | 8, 1 | 18 | 9 | 65 |
| walk_NE_5 | `art/clean/kindled-wing-sheathed/walk/north-east 5` | 0 | 0 | -1 | 8, 1 | 27 | 9 | 56 |
| walk_N_0 | `art/clean/kindled-wing-sheathed/walk/north 0` | 0 | 0 | -1 | 8, 1 | 8 | 6 | 0 |
| walk_N_1 | `art/clean/kindled-wing-sheathed/walk/north 1` | 0 | 0 | -2 | 8, 0 | 8 | 6 | 0 |
| walk_N_2 | `art/clean/kindled-wing-sheathed/walk/north 2` | 0 | 0 | -2 | 8, 0 | 5 | 6 | 0 |
| walk_N_3 | `art/clean/kindled-wing-sheathed/walk/north 3` | 0 | 0 | -1 | 8, 1 | 10 | 6 | 0 |
| walk_N_4 | `art/clean/kindled-wing-sheathed/walk/north 4` | 0 | 0 | -2 | 8, 0 | 0 | 6 | 0 |
| walk_N_5 | `art/clean/kindled-wing-sheathed/walk/north 5` | 0 | 0 | -2 | 8, 0 | 10 | 6 | 0 |
| walk_NW_0 | `art/clean/kindled-wing-sheathed/walk/north-west 0` | 0 | 0 | -1 | 8, 1 | 10 | 9 | 59 |
| walk_NW_1 | `art/clean/kindled-wing-sheathed/walk/north-west 1` | 0 | 0 | -1 | 8, 1 | 10 | 9 | 65 |
| walk_NW_2 | `art/clean/kindled-wing-sheathed/walk/north-west 2` | 0 | 0 | -1 | 8, 1 | 15 | 9 | 69 |
| walk_NW_3 | `art/clean/kindled-wing-sheathed/walk/north-west 3` | 0 | 0 | -1 | 8, 1 | 4 | 9 | 47 |
| walk_NW_4 | `art/clean/kindled-wing-sheathed/walk/north-west 4` | 0 | 0 | -2 | 8, 0 | 7 | 9 | 63 |
| walk_NW_5 | `art/clean/kindled-wing-sheathed/walk/north-west 5` | 0 | 0 | -2 | 8, 0 | 11 | 9 | 46 |
| walk_W_0 | `art/clean/kindled-wing-sheathed/walk/west 0` | 0 | 0 | -1 | 8, 1 | 5 | 9 | 109 |
| walk_W_1 | `art/clean/kindled-wing-sheathed/walk/west 1` | 0 | 0 | 0 | 8, 2 | 1 | 9 | 116 |
| walk_W_2 | `art/clean/kindled-wing-sheathed/walk/west 2` | 0 | 0 | 0 | 8, 2 | 1 | 9 | 115 |
| walk_W_3 | `art/clean/kindled-wing-sheathed/walk/west 3` | 0 | 0 | -1 | 8, 1 | 5 | 9 | 105 |
| walk_W_4 | `art/clean/kindled-wing-sheathed/walk/west 4` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 108 |
| walk_W_5 | `art/clean/kindled-wing-sheathed/walk/west 5` | 0 | 0 | -1 | 8, 1 | 6 | 9 | 101 |
| walk_SW_0 | `art/clean/kindled-wing-sheathed/walk/south-west 0` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 172 |
| walk_SW_1 | `art/clean/kindled-wing-sheathed/walk/south-west 1` | 0 | 0 | -1 | 8, 1 | 7 | 9 | 175 |
| walk_SW_2 | `art/clean/kindled-wing-sheathed/walk/south-west 2` | 0 | 0 | -1 | 8, 1 | 4 | 9 | 173 |
| walk_SW_3 | `art/clean/kindled-wing-sheathed/walk/south-west 3` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 173 |
| walk_SW_4 | `art/clean/kindled-wing-sheathed/walk/south-west 4` | 0 | 0 | -1 | 8, 1 | 4 | 9 | 169 |
| walk_SW_5 | `art/clean/kindled-wing-sheathed/walk/south-west 5` | 0 | 0 | -1 | 8, 1 | 9 | 9 | 164 |
| run_S_0 | `art/clean/kindled-wing-sheathed/run/south 0` | 0 | 0 | -2 | 8, 0 | 27 | 9 | 149 |
| run_S_1 | `art/clean/kindled-wing-sheathed/run/south 1` | 0 | 0 | -2 | 8, 0 | 27 | 8 | 170 |
| run_S_2 | `art/clean/kindled-wing-sheathed/run/south 2` | 0 | 0 | -2 | 8, 0 | 17 | 8 | 164 |
| run_S_3 | `art/clean/kindled-wing-sheathed/run/south 3` | 0 | 0 | -2 | 8, 0 | 13 | 8 | 150 |
| run_S_4 | `art/clean/kindled-wing-sheathed/run/south 4` | 0 | 0 | -2 | 8, 0 | 18 | 9 | 158 |
| run_S_5 | `art/clean/kindled-wing-sheathed/run/south 5` | 0 | 0 | -2 | 8, 0 | 12 | 9 | 148 |
| run_S_6 | `art/clean/kindled-wing-sheathed/run/south 6` | 0 | 0 | -2 | 8, 0 | 13 | 8 | 161 |
| run_S_7 | `art/clean/kindled-wing-sheathed/run/south 7` | 0 | 0 | -2 | 8, 0 | 15 | 8 | 147 |
| run_SE_0 | `art/clean/kindled-wing-sheathed/run/south-east 0` | 0 | 0 | -2 | 8, 0 | 25 | 9 | 162 |
| run_SE_1 | `art/clean/kindled-wing-sheathed/run/south-east 1` | 0 | 0 | -2 | 8, 0 | 22 | 9 | 163 |
| run_SE_2 | `art/clean/kindled-wing-sheathed/run/south-east 2` | 0 | 0 | -2 | 8, 0 | 19 | 9 | 147 |
| run_SE_3 | `art/clean/kindled-wing-sheathed/run/south-east 3` | 0 | 0 | -2 | 8, 0 | 28 | 9 | 118 |
| run_SE_4 | `art/clean/kindled-wing-sheathed/run/south-east 4` | 0 | 0 | -2 | 8, 0 | 27 | 9 | 123 |
| run_SE_5 | `art/clean/kindled-wing-sheathed/run/south-east 5` | 0 | 0 | -2 | 8, 0 | 17 | 9 | 126 |
| run_SE_6 | `art/clean/kindled-wing-sheathed/run/south-east 6` | 0 | 0 | -2 | 8, 0 | 15 | 9 | 141 |
| run_SE_7 | `art/clean/kindled-wing-sheathed/run/south-east 7` | 0 | 0 | -2 | 8, 0 | 14 | 9 | 150 |
| run_E_0 | `art/clean/kindled-wing-sheathed/run/east 0` | 0 | 0 | -1 | 8, 1 | 33 | 9 | 126 |
| run_E_1 | `art/clean/kindled-wing-sheathed/run/east 1` | 0 | 0 | -1 | 8, 1 | 19 | 9 | 125 |
| run_E_2 | `art/clean/kindled-wing-sheathed/run/east 2` | 0 | 0 | -1 | 8, 1 | 8 | 9 | 105 |
| run_E_3 | `art/clean/kindled-wing-sheathed/run/east 3` | 0 | 0 | -1 | 8, 1 | 16 | 9 | 105 |
| run_E_4 | `art/clean/kindled-wing-sheathed/run/east 4` | 0 | 0 | -1 | 8, 1 | 11 | 9 | 111 |
| run_E_5 | `art/clean/kindled-wing-sheathed/run/east 5` | 0 | 0 | -1 | 8, 1 | 12 | 9 | 103 |
| run_E_6 | `art/clean/kindled-wing-sheathed/run/east 6` | 0 | 0 | -1 | 8, 1 | 8 | 9 | 101 |
| run_E_7 | `art/clean/kindled-wing-sheathed/run/east 7` | 0 | 0 | -1 | 8, 1 | 8 | 9 | 126 |
| run_NE_0 | `art/clean/kindled-wing-sheathed/run/north-east 0` | 0 | 0 | -3 | 8, -1 | 31 | 9 | 75 |
| run_NE_1 | `art/clean/kindled-wing-sheathed/run/north-east 1` | 0 | 0 | -3 | 8, -1 | 24 | 9 | 90 |
| run_NE_2 | `art/clean/kindled-wing-sheathed/run/north-east 2` | 0 | 0 | -3 | 8, -1 | 18 | 9 | 75 |
| run_NE_3 | `art/clean/kindled-wing-sheathed/run/north-east 3` | 0 | 0 | -3 | 8, -1 | 24 | 9 | 72 |
| run_NE_4 | `art/clean/kindled-wing-sheathed/run/north-east 4` | 0 | 0 | -3 | 8, -1 | 18 | 9 | 102 |
| run_NE_5 | `art/clean/kindled-wing-sheathed/run/north-east 5` | 0 | 0 | -3 | 8, -1 | 37 | 9 | 112 |
| run_NE_6 | `art/clean/kindled-wing-sheathed/run/north-east 6` | 0 | 0 | -3 | 8, -1 | 22 | 8 | 81 |
| run_NE_7 | `art/clean/kindled-wing-sheathed/run/north-east 7` | 0 | 0 | -3 | 8, -1 | 17 | 9 | 82 |
| run_N_0 | `art/clean/kindled-wing-sheathed/run/north 0` | 0 | 0 | -2 | 8, 0 | 10 | 6 | 0 |
| run_N_1 | `art/clean/kindled-wing-sheathed/run/north 1` | 0 | 0 | -2 | 8, 0 | 9 | 6 | 0 |
| run_N_2 | `art/clean/kindled-wing-sheathed/run/north 2` | 0 | 0 | -2 | 8, 0 | 9 | 6 | 0 |
| run_N_3 | `art/clean/kindled-wing-sheathed/run/north 3` | 0 | 0 | -2 | 8, 0 | 18 | 6 | 0 |
| run_N_4 | `art/clean/kindled-wing-sheathed/run/north 4` | 0 | 0 | -2 | 8, 0 | 5 | 6 | 0 |
| run_N_5 | `art/clean/kindled-wing-sheathed/run/north 5` | 0 | 0 | -2 | 8, 0 | 10 | 6 | 0 |
| run_N_6 | `art/clean/kindled-wing-sheathed/run/north 6` | 0 | 0 | -2 | 8, 0 | 5 | 6 | 0 |
| run_N_7 | `art/clean/kindled-wing-sheathed/run/north 7` | 0 | 0 | -2 | 8, 0 | 11 | 6 | 0 |
| run_NW_0 | `art/clean/kindled-wing-sheathed/run/north-west 0` | 0 | 0 | -2 | 8, 0 | 7 | 9 | 91 |
| run_NW_1 | `art/clean/kindled-wing-sheathed/run/north-west 1` | 0 | 0 | -2 | 8, 0 | 42 | 8 | 86 |
| run_NW_2 | `art/clean/kindled-wing-sheathed/run/north-west 2` | 0 | 0 | -2 | 8, 0 | 32 | 8 | 85 |
| run_NW_3 | `art/clean/kindled-wing-sheathed/run/north-west 3` | 0 | 0 | -2 | 8, 0 | 16 | 8 | 66 |
| run_NW_4 | `art/clean/kindled-wing-sheathed/run/north-west 4` | 0 | 0 | -2 | 8, 0 | 22 | 9 | 101 |
| run_NW_5 | `art/clean/kindled-wing-sheathed/run/north-west 5` | 0 | 0 | -2 | 8, 0 | 21 | 9 | 80 |
| run_NW_6 | `art/clean/kindled-wing-sheathed/run/north-west 6` | 0 | 0 | -2 | 8, 0 | 23 | 9 | 99 |
| run_NW_7 | `art/clean/kindled-wing-sheathed/run/north-west 7` | 0 | 0 | -2 | 8, 0 | 15 | 9 | 71 |
| run_W_0 | `art/clean/kindled-wing-sheathed/run/west 0` | 0 | 0 | -1 | 8, 1 | 13 | 9 | 114 |
| run_W_1 | `art/clean/kindled-wing-sheathed/run/west 1` | 0 | 0 | -1 | 8, 1 | 9 | 9 | 118 |
| run_W_2 | `art/clean/kindled-wing-sheathed/run/west 2` | 0 | 0 | -1 | 8, 1 | 16 | 9 | 105 |
| run_W_3 | `art/clean/kindled-wing-sheathed/run/west 3` | 0 | 0 | -1 | 8, 1 | 10 | 9 | 110 |
| run_W_4 | `art/clean/kindled-wing-sheathed/run/west 4` | 0 | 0 | -1 | 8, 1 | 33 | 9 | 113 |
| run_W_5 | `art/clean/kindled-wing-sheathed/run/west 5` | 0 | 0 | -1 | 8, 1 | 9 | 9 | 113 |
| run_W_6 | `art/clean/kindled-wing-sheathed/run/west 6` | 0 | 0 | -1 | 8, 1 | 21 | 9 | 102 |
| run_W_7 | `art/clean/kindled-wing-sheathed/run/west 7` | 0 | 0 | -1 | 8, 1 | 26 | 8 | 114 |
| run_SW_0 | `art/clean/kindled-wing-sheathed/run/south-west 0` | 0 | 0 | -2 | 8, 0 | 11 | 9 | 133 |
| run_SW_1 | `art/clean/kindled-wing-sheathed/run/south-west 1` | 0 | 0 | -2 | 8, 0 | 14 | 9 | 139 |
| run_SW_2 | `art/clean/kindled-wing-sheathed/run/south-west 2` | 0 | 0 | -2 | 8, 0 | 10 | 9 | 117 |
| run_SW_3 | `art/clean/kindled-wing-sheathed/run/south-west 3` | 0 | 0 | -2 | 8, 0 | 21 | 9 | 107 |
| run_SW_4 | `art/clean/kindled-wing-sheathed/run/south-west 4` | 0 | 0 | -2 | 8, 0 | 15 | 9 | 109 |
| run_SW_5 | `art/clean/kindled-wing-sheathed/run/south-west 5` | 0 | 0 | -2 | 8, 0 | 21 | 9 | 123 |
| run_SW_6 | `art/clean/kindled-wing-sheathed/run/south-west 6` | 0 | 0 | -2 | 8, 0 | 17 | 9 | 148 |
| run_SW_7 | `art/clean/kindled-wing-sheathed/run/south-west 7` | 0 | 0 | -2 | 8, 0 | 16 | 9 | 149 |
| run_start_S_0 | `art/clean/kindled-wing-sheathed/run_start/south 0` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 209 |
| run_start_S_1 | `art/clean/kindled-wing-sheathed/run_start/south 1` | 0 | 0 | -2 | 8, 0 | 15 | 8 | 147 |
| run_start_SE_0 | `art/clean/kindled-wing-sheathed/run_start/south-east 0` | 0 | 0 | -2 | 8, 0 | 1 | 9 | 169 |
| run_start_SE_1 | `art/clean/kindled-wing-sheathed/run_start/south-east 1` | 0 | 0 | -2 | 8, 0 | 14 | 9 | 150 |
| run_start_E_0 | `art/clean/kindled-wing-sheathed/run_start/east 0` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 110 |
| run_start_E_1 | `art/clean/kindled-wing-sheathed/run_start/east 1` | 0 | 0 | -1 | 8, 1 | 8 | 9 | 126 |
| run_start_NE_0 | `art/clean/kindled-wing-sheathed/run_start/north-east 0` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 43 |
| run_start_NE_1 | `art/clean/kindled-wing-sheathed/run_start/north-east 1` | 0 | 0 | -3 | 8, -1 | 17 | 9 | 82 |
| run_start_N_0 | `art/clean/kindled-wing-sheathed/run_start/north 0` | 0 | 0 | -3 | 8, -1 | 0 | 6 | 0 |
| run_start_N_1 | `art/clean/kindled-wing-sheathed/run_start/north 1` | 0 | 0 | -3 | 8, -1 | 11 | 6 | 0 |
| run_start_NW_0 | `art/clean/kindled-wing-sheathed/run_start/north-west 0` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 44 |
| run_start_NW_1 | `art/clean/kindled-wing-sheathed/run_start/north-west 1` | 0 | 0 | -2 | 8, 0 | 15 | 9 | 71 |
| run_start_W_0 | `art/clean/kindled-wing-sheathed/run_start/west 0` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 99 |
| run_start_W_1 | `art/clean/kindled-wing-sheathed/run_start/west 1` | 0 | 0 | -1 | 8, 1 | 26 | 8 | 114 |
| run_start_SW_0 | `art/clean/kindled-wing-sheathed/run_start/south-west 0` | 0 | 0 | -2 | 8, 0 | 1 | 9 | 169 |
| run_start_SW_1 | `art/clean/kindled-wing-sheathed/run_start/south-west 1` | 0 | 0 | -2 | 8, 0 | 16 | 9 | 149 |
| run_stop_S_0 | `art/clean/kindled-wing-sheathed/run_stop/south 0` | 0 | 0 | -2 | 8, 0 | 27 | 9 | 149 |
| run_stop_S_1 | `art/clean/kindled-wing-sheathed/run_stop/south 1` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 209 |
| run_stop_SE_0 | `art/clean/kindled-wing-sheathed/run_stop/south-east 0` | 0 | 0 | -2 | 8, 0 | 25 | 9 | 162 |
| run_stop_SE_1 | `art/clean/kindled-wing-sheathed/run_stop/south-east 1` | 0 | 0 | -2 | 8, 0 | 1 | 9 | 169 |
| run_stop_E_0 | `art/clean/kindled-wing-sheathed/run_stop/east 0` | 0 | 0 | -1 | 8, 1 | 33 | 9 | 126 |
| run_stop_E_1 | `art/clean/kindled-wing-sheathed/run_stop/east 1` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 110 |
| run_stop_NE_0 | `art/clean/kindled-wing-sheathed/run_stop/north-east 0` | 0 | 0 | -3 | 8, -1 | 31 | 9 | 75 |
| run_stop_NE_1 | `art/clean/kindled-wing-sheathed/run_stop/north-east 1` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 43 |
| run_stop_N_0 | `art/clean/kindled-wing-sheathed/run_stop/north 0` | 0 | 0 | -3 | 8, -1 | 10 | 6 | 0 |
| run_stop_N_1 | `art/clean/kindled-wing-sheathed/run_stop/north 1` | 0 | 0 | -3 | 8, -1 | 0 | 6 | 0 |
| run_stop_NW_0 | `art/clean/kindled-wing-sheathed/run_stop/north-west 0` | 0 | 0 | -2 | 8, 0 | 7 | 9 | 91 |
| run_stop_NW_1 | `art/clean/kindled-wing-sheathed/run_stop/north-west 1` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 44 |
| run_stop_W_0 | `art/clean/kindled-wing-sheathed/run_stop/west 0` | 0 | 0 | -1 | 8, 1 | 13 | 9 | 114 |
| run_stop_W_1 | `art/clean/kindled-wing-sheathed/run_stop/west 1` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 99 |
| run_stop_SW_0 | `art/clean/kindled-wing-sheathed/run_stop/south-west 0` | 0 | 0 | -2 | 8, 0 | 11 | 9 | 133 |
| run_stop_SW_1 | `art/clean/kindled-wing-sheathed/run_stop/south-west 1` | 0 | 0 | -2 | 8, 0 | 1 | 9 | 169 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

