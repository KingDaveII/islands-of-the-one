# kindled-ash-sheathed

Built by `pnpm art:build kindled-ash-sheathed` from `art/sheets/kindled-ash-sheathed.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind kindled, outline player, cell 96×80, origin (48, 64).

## Summary

- Frames: 160.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 915.
- Masked skin pixels: 11559.
- Loop seam flags (last → first above 1.5× the mean change): walk_S.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: idle_SE_0, idle_SE_1, idle_SW_0, idle_SW_1, walk_SE_0, walk_SE_1, walk_SE_2, walk_SE_3, walk_SE_4, walk_SE_5, walk_SW_0, walk_SW_1, walk_SW_2, walk_SW_3, walk_SW_4, walk_SW_5, run_SE_0, run_SE_1, run_SE_2, run_SE_3, run_SE_4, run_SE_5, run_SE_6, run_SE_7, run_SW_0, run_SW_1, run_SW_2, run_SW_3, run_SW_4, run_SW_5, run_SW_6, run_SW_7, run_start_SE_0, run_start_SE_1, run_start_SW_0, run_start_SW_1, run_stop_SE_0, run_stop_SE_1, run_stop_SW_0, run_stop_SW_1.
- Skin regions to resolve: 0.
- Missing against the contract's table: carry_idle (all facings), carry_walk (all facings), sit (all facings).
- Optional (after M1, or awaiting art: a finished sheet may leave them out, but carries every facing of any it has): carry_idle (M2), carry_walk (M2), sit (M2).

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row. `tones.png` has the same rows in the four clay tones, through the mask: clay-grey-ochre, clay-pale, clay-red, clay-river-dark.

Rows, top to bottom: idle_S, idle_SE, idle_E, idle_NE, idle_N, idle_NW, idle_W, idle_SW, walk_S, walk_SE, walk_E, walk_NE, walk_N, walk_NW, walk_W, walk_SW, run_S, run_SE, run_E, run_NE, run_N, run_NW, run_W, run_SW, run_start_S, run_start_SE, run_start_E, run_start_NE, run_start_N, run_start_NW, run_start_W, run_start_SW, run_stop_S, run_stop_SE, run_stop_E, run_stop_NE, run_stop_N, run_stop_NW, run_stop_W, run_stop_SW.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle_S | 2 | 225 / 225 | 45 46 (range 1) |  |
| idle_SE | 2 | 359 / 359 | 44 45 (range 1) |  |
| idle_E | 2 | 321 / 321 | 45 45 (range 0) |  |
| idle_NE | 2 | 192 / 192 | 45 45 (range 0) |  |
| idle_N | 2 | 91 / 91 | 45 45 (range 0) |  |
| idle_NW | 2 | 192 / 192 | 45 45 (range 0) |  |
| idle_W | 2 | 321 / 321 | 45 45 (range 0) |  |
| idle_SW | 2 | 359 / 359 | 44 45 (range 1) |  |
| walk_S | 6 | 605 / 356.8 **flag** | 44 45 45 44 45 45 (range 1) |  |
| walk_SE | 6 | 76 / 158.8 | 45 45 45 45 45 45 (range 0) |  |
| walk_E | 6 | 200 / 296.4 | 45 44 45 45 45 45 (range 1) |  |
| walk_NE | 6 | 110 / 227.6 | 45 45 45 45 46 45 (range 1) |  |
| walk_N | 6 | 169 / 244.2 | 45 46 46 45 46 45 (range 1) |  |
| walk_NW | 6 | 110 / 227.6 | 45 45 45 45 46 45 (range 1) |  |
| walk_W | 6 | 200 / 296.4 | 45 44 45 45 45 45 (range 1) |  |
| walk_SW | 6 | 76 / 158.8 | 45 45 45 45 45 45 (range 0) |  |
| run_S | 8 | 398 / 381.29 |  |  |
| run_SE | 8 | 291 / 441.43 |  |  |
| run_E | 8 | 447 / 419.43 |  |  |
| run_NE | 8 | 271 / 301 |  |  |
| run_N | 8 | 353 / 251.57 |  |  |
| run_NW | 8 | 271 / 301 |  |  |
| run_W | 8 | 447 / 419.43 |  |  |
| run_SW | 8 | 291 / 441.43 |  |  |
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
| idle_S_0 | `art/clean/kindled-ash-sheathed/idle/south 0` | 0 | 0 | -2 | 0, 0 | 4 | 11 | 174 |
| idle_S_1 | `art/clean/kindled-ash-sheathed/idle/south 1` | 0 | 0 | -2 | 0, 0 | 5 | 11 | 177 |
| idle_SE_0 | mirrored from `art/clean/kindled-ash-sheathed/idle/south-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 152 |
| idle_SE_1 | mirrored from `art/clean/kindled-ash-sheathed/idle/south-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 145 |
| idle_E_0 | mirrored from `art/clean/kindled-ash-sheathed/idle/west 0` | 0 | 0 | -2 | 0, 0 | 7 | 12 | 69 |
| idle_E_1 | mirrored from `art/clean/kindled-ash-sheathed/idle/west 1` | 0 | 0 | -2 | 0, 0 | 2 | 12 | 69 |
| idle_NE_0 | mirrored from `art/clean/kindled-ash-sheathed/idle/north-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| idle_NE_1 | mirrored from `art/clean/kindled-ash-sheathed/idle/north-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 19 |
| idle_N_0 | `art/clean/kindled-ash-sheathed/idle/north 0` | 0 | 0 | -2 | 0, 0 | 6 | 4 | 0 |
| idle_N_1 | `art/clean/kindled-ash-sheathed/idle/north 1` | 0 | 0 | -2 | 0, 0 | 3 | 4 | 0 |
| idle_NW_0 | `art/clean/kindled-ash-sheathed/idle/north-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| idle_NW_1 | `art/clean/kindled-ash-sheathed/idle/north-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 19 |
| idle_W_0 | `art/clean/kindled-ash-sheathed/idle/west 0` | 0 | 0 | -2 | 0, 0 | 7 | 12 | 69 |
| idle_W_1 | `art/clean/kindled-ash-sheathed/idle/west 1` | 0 | 0 | -2 | 0, 0 | 2 | 12 | 69 |
| idle_SW_0 | `art/clean/kindled-ash-sheathed/idle/south-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 152 |
| idle_SW_1 | `art/clean/kindled-ash-sheathed/idle/south-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 145 |
| walk_S_0 | `art/clean/kindled-ash-sheathed/walk/south 0` | 0 | 0 | -2 | 0, 0 | 2 | 11 | 173 |
| walk_S_1 | `art/clean/kindled-ash-sheathed/walk/south 1` | 0 | 0 | -2 | 0, 0 | 0 | 12 | 171 |
| walk_S_2 | `art/clean/kindled-ash-sheathed/walk/south 2` | 0 | 0 | -2 | 0, 0 | 0 | 11 | 170 |
| walk_S_3 | `art/clean/kindled-ash-sheathed/walk/south 3` | 0 | 0 | -2 | 0, 0 | 1 | 11 | 173 |
| walk_S_4 | `art/clean/kindled-ash-sheathed/walk/south 4` | 0 | 0 | -2 | 0, 0 | 0 | 12 | 175 |
| walk_S_5 | `art/clean/kindled-ash-sheathed/walk/south 5` | 0 | 0 | -2 | 0, 0 | 0 | 11 | 173 |
| walk_SE_0 | mirrored from `art/clean/kindled-ash-sheathed/walk/south-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 15 **flag** | 143 |
| walk_SE_1 | mirrored from `art/clean/kindled-ash-sheathed/walk/south-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 15 **flag** | 138 |
| walk_SE_2 | mirrored from `art/clean/kindled-ash-sheathed/walk/south-west 2` | 0 | 0 | -2 | 0, 0 | 1 | 15 **flag** | 142 |
| walk_SE_3 | mirrored from `art/clean/kindled-ash-sheathed/walk/south-west 3` | 0 | 0 | -2 | 0, 0 | 0 | 15 **flag** | 144 |
| walk_SE_4 | mirrored from `art/clean/kindled-ash-sheathed/walk/south-west 4` | 0 | 0 | -2 | 0, 0 | 1 | 14 **flag** | 130 |
| walk_SE_5 | mirrored from `art/clean/kindled-ash-sheathed/walk/south-west 5` | 0 | 0 | -2 | 0, 0 | 0 | 14 **flag** | 140 |
| walk_E_0 | mirrored from `art/clean/kindled-ash-sheathed/walk/west 0` | 0 | 0 | -2 | 0, 0 | 1 | 11 | 69 |
| walk_E_1 | mirrored from `art/clean/kindled-ash-sheathed/walk/west 1` | 0 | 0 | -2 | 0, 0 | 4 | 12 | 75 |
| walk_E_2 | mirrored from `art/clean/kindled-ash-sheathed/walk/west 2` | 0 | 0 | -2 | 0, 0 | 9 | 12 | 70 |
| walk_E_3 | mirrored from `art/clean/kindled-ash-sheathed/walk/west 3` | 0 | 0 | -2 | 0, 0 | 1 | 12 | 69 |
| walk_E_4 | mirrored from `art/clean/kindled-ash-sheathed/walk/west 4` | 0 | 0 | -2 | 0, 0 | 1 | 11 | 67 |
| walk_E_5 | mirrored from `art/clean/kindled-ash-sheathed/walk/west 5` | 0 | 0 | -2 | 0, 0 | 4 | 12 | 68 |
| walk_NE_0 | mirrored from `art/clean/kindled-ash-sheathed/walk/north-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 15 |
| walk_NE_1 | mirrored from `art/clean/kindled-ash-sheathed/walk/north-west 1` | 0 | 0 | -2 | 0, 0 | 3 | 10 | 11 |
| walk_NE_2 | mirrored from `art/clean/kindled-ash-sheathed/walk/north-west 2` | 0 | 0 | -2 | 0, 0 | 3 | 10 | 13 |
| walk_NE_3 | mirrored from `art/clean/kindled-ash-sheathed/walk/north-west 3` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 19 |
| walk_NE_4 | mirrored from `art/clean/kindled-ash-sheathed/walk/north-west 4` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 15 |
| walk_NE_5 | mirrored from `art/clean/kindled-ash-sheathed/walk/north-west 5` | 0 | 0 | -2 | 0, 0 | 1 | 9 | 15 |
| walk_N_0 | `art/clean/kindled-ash-sheathed/walk/north 0` | 0 | 0 | -2 | 0, 0 | 0 | 4 | 0 |
| walk_N_1 | `art/clean/kindled-ash-sheathed/walk/north 1` | 0 | 0 | -2 | 0, 0 | 0 | 4 | 0 |
| walk_N_2 | `art/clean/kindled-ash-sheathed/walk/north 2` | 0 | 0 | -2 | 0, 0 | 0 | 4 | 0 |
| walk_N_3 | `art/clean/kindled-ash-sheathed/walk/north 3` | 0 | 0 | -2 | 0, 0 | 0 | 4 | 0 |
| walk_N_4 | `art/clean/kindled-ash-sheathed/walk/north 4` | 0 | 0 | -2 | 0, 0 | 3 | 4 | 0 |
| walk_N_5 | `art/clean/kindled-ash-sheathed/walk/north 5` | 0 | 0 | -2 | 0, 0 | 2 | 4 | 0 |
| walk_NW_0 | `art/clean/kindled-ash-sheathed/walk/north-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 15 |
| walk_NW_1 | `art/clean/kindled-ash-sheathed/walk/north-west 1` | 0 | 0 | -2 | 0, 0 | 3 | 10 | 11 |
| walk_NW_2 | `art/clean/kindled-ash-sheathed/walk/north-west 2` | 0 | 0 | -2 | 0, 0 | 3 | 10 | 13 |
| walk_NW_3 | `art/clean/kindled-ash-sheathed/walk/north-west 3` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 19 |
| walk_NW_4 | `art/clean/kindled-ash-sheathed/walk/north-west 4` | 0 | 0 | -2 | 0, 0 | 0 | 10 | 15 |
| walk_NW_5 | `art/clean/kindled-ash-sheathed/walk/north-west 5` | 0 | 0 | -2 | 0, 0 | 1 | 9 | 15 |
| walk_W_0 | `art/clean/kindled-ash-sheathed/walk/west 0` | 0 | 0 | -2 | 0, 0 | 1 | 11 | 69 |
| walk_W_1 | `art/clean/kindled-ash-sheathed/walk/west 1` | 0 | 0 | -2 | 0, 0 | 4 | 12 | 75 |
| walk_W_2 | `art/clean/kindled-ash-sheathed/walk/west 2` | 0 | 0 | -2 | 0, 0 | 9 | 12 | 70 |
| walk_W_3 | `art/clean/kindled-ash-sheathed/walk/west 3` | 0 | 0 | -2 | 0, 0 | 1 | 12 | 69 |
| walk_W_4 | `art/clean/kindled-ash-sheathed/walk/west 4` | 0 | 0 | -2 | 0, 0 | 1 | 11 | 67 |
| walk_W_5 | `art/clean/kindled-ash-sheathed/walk/west 5` | 0 | 0 | -2 | 0, 0 | 4 | 12 | 68 |
| walk_SW_0 | `art/clean/kindled-ash-sheathed/walk/south-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 15 **flag** | 143 |
| walk_SW_1 | `art/clean/kindled-ash-sheathed/walk/south-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 15 **flag** | 138 |
| walk_SW_2 | `art/clean/kindled-ash-sheathed/walk/south-west 2` | 0 | 0 | -2 | 0, 0 | 1 | 15 **flag** | 142 |
| walk_SW_3 | `art/clean/kindled-ash-sheathed/walk/south-west 3` | 0 | 0 | -2 | 0, 0 | 0 | 15 **flag** | 144 |
| walk_SW_4 | `art/clean/kindled-ash-sheathed/walk/south-west 4` | 0 | 0 | -2 | 0, 0 | 1 | 14 **flag** | 130 |
| walk_SW_5 | `art/clean/kindled-ash-sheathed/walk/south-west 5` | 0 | 0 | -2 | 0, 0 | 0 | 14 **flag** | 140 |
| run_S_0 | `art/clean/kindled-ash-sheathed/run/south 0` | 0 | 0 | -2 | 0, 0 | 7 | 11 | 150 |
| run_S_1 | `art/clean/kindled-ash-sheathed/run/south 1` | 0 | 0 | -2 | 0, 0 | 5 | 10 | 154 |
| run_S_2 | `art/clean/kindled-ash-sheathed/run/south 2` | 0 | 0 | -2 | 0, 0 | 6 | 11 | 142 |
| run_S_3 | `art/clean/kindled-ash-sheathed/run/south 3` | 0 | 0 | -2 | 0, 0 | 6 | 12 | 141 |
| run_S_4 | `art/clean/kindled-ash-sheathed/run/south 4` | 0 | 0 | -2 | 0, 0 | 7 | 11 | 156 |
| run_S_5 | `art/clean/kindled-ash-sheathed/run/south 5` | 0 | 0 | -2 | 0, 0 | 5 | 10 | 148 |
| run_S_6 | `art/clean/kindled-ash-sheathed/run/south 6` | 0 | 0 | -2 | 0, 0 | 8 | 11 | 154 |
| run_S_7 | `art/clean/kindled-ash-sheathed/run/south 7` | 0 | 0 | -2 | 0, 0 | 6 | 11 | 136 |
| run_SE_0 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 0` | 0 | 0 | -2 | 0, 0 | 14 | 15 **flag** | 126 |
| run_SE_1 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 1` | 0 | 0 | -2 | 0, 0 | 15 | 15 **flag** | 130 |
| run_SE_2 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 2` | 0 | 0 | -2 | 0, 0 | 8 | 14 **flag** | 118 |
| run_SE_3 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 3` | 0 | 0 | -2 | 0, 0 | 8 | 15 **flag** | 103 |
| run_SE_4 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 4` | 0 | 0 | -2 | 0, 0 | 15 | 14 **flag** | 105 |
| run_SE_5 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 5` | 0 | 0 | -2 | 0, 0 | 11 | 14 **flag** | 99 |
| run_SE_6 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 6` | 0 | 0 | -2 | 0, 0 | 11 | 13 **flag** | 126 |
| run_SE_7 | mirrored from `art/clean/kindled-ash-sheathed/run/south-west 7` | 0 | 0 | -2 | 0, 0 | 23 | 14 **flag** | 143 |
| run_E_0 | mirrored from `art/clean/kindled-ash-sheathed/run/west 0` | 0 | 0 | -1 | 0, 1 | 9 | 12 | 57 |
| run_E_1 | mirrored from `art/clean/kindled-ash-sheathed/run/west 1` | 0 | 0 | -1 | 0, 1 | 3 | 12 | 64 |
| run_E_2 | mirrored from `art/clean/kindled-ash-sheathed/run/west 2` | 0 | 0 | -1 | 0, 1 | 7 | 12 | 63 |
| run_E_3 | mirrored from `art/clean/kindled-ash-sheathed/run/west 3` | 0 | 0 | -1 | 0, 1 | 14 | 12 | 55 |
| run_E_4 | mirrored from `art/clean/kindled-ash-sheathed/run/west 4` | 0 | 0 | -1 | 0, 1 | 4 | 11 | 54 |
| run_E_5 | mirrored from `art/clean/kindled-ash-sheathed/run/west 5` | 0 | 0 | -1 | 0, 1 | 25 | 12 | 51 |
| run_E_6 | mirrored from `art/clean/kindled-ash-sheathed/run/west 6` | 0 | 0 | -1 | 0, 1 | 10 | 12 | 52 |
| run_E_7 | mirrored from `art/clean/kindled-ash-sheathed/run/west 7` | 0 | 0 | -1 | 0, 1 | 18 | 12 | 56 |
| run_NE_0 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 0` | 0 | 0 | -1 | 0, 1 | 5 | 11 | 14 |
| run_NE_1 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 1` | 0 | 0 | -1 | 0, 1 | 13 | 10 | 4 |
| run_NE_2 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 2` | 0 | 0 | -1 | 0, 1 | 5 | 10 | 7 |
| run_NE_3 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 3` | 0 | 0 | -1 | 0, 1 | 8 | 11 | 14 |
| run_NE_4 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 4` | 0 | 0 | -1 | 0, 1 | 7 | 10 | 11 |
| run_NE_5 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 5` | 0 | 0 | -1 | 0, 1 | 17 | 10 | 11 |
| run_NE_6 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 6` | 0 | 0 | -1 | 0, 1 | 7 | 10 | 4 |
| run_NE_7 | mirrored from `art/clean/kindled-ash-sheathed/run/north-west 7` | 0 | 0 | -1 | 0, 1 | 5 | 10 | 10 |
| run_N_0 | `art/clean/kindled-ash-sheathed/run/north 0` | 0 | 0 | -1 | 0, 1 | 6 | 4 | 0 |
| run_N_1 | `art/clean/kindled-ash-sheathed/run/north 1` | 0 | 0 | -1 | 0, 1 | 1 | 4 | 0 |
| run_N_2 | `art/clean/kindled-ash-sheathed/run/north 2` | 0 | 0 | -1 | 0, 1 | 1 | 4 | 0 |
| run_N_3 | `art/clean/kindled-ash-sheathed/run/north 3` | 0 | 0 | -1 | 0, 1 | 1 | 4 | 0 |
| run_N_4 | `art/clean/kindled-ash-sheathed/run/north 4` | 0 | 0 | -1 | 0, 1 | 9 | 4 | 0 |
| run_N_5 | `art/clean/kindled-ash-sheathed/run/north 5` | 0 | 0 | -1 | 0, 1 | 2 | 4 | 0 |
| run_N_6 | `art/clean/kindled-ash-sheathed/run/north 6` | 0 | 0 | -1 | 0, 1 | 2 | 4 | 0 |
| run_N_7 | `art/clean/kindled-ash-sheathed/run/north 7` | 0 | 0 | -1 | 0, 1 | 3 | 4 | 0 |
| run_NW_0 | `art/clean/kindled-ash-sheathed/run/north-west 0` | 0 | 0 | -1 | 0, 1 | 5 | 11 | 14 |
| run_NW_1 | `art/clean/kindled-ash-sheathed/run/north-west 1` | 0 | 0 | -1 | 0, 1 | 13 | 10 | 4 |
| run_NW_2 | `art/clean/kindled-ash-sheathed/run/north-west 2` | 0 | 0 | -1 | 0, 1 | 5 | 10 | 7 |
| run_NW_3 | `art/clean/kindled-ash-sheathed/run/north-west 3` | 0 | 0 | -1 | 0, 1 | 8 | 11 | 14 |
| run_NW_4 | `art/clean/kindled-ash-sheathed/run/north-west 4` | 0 | 0 | -1 | 0, 1 | 7 | 10 | 11 |
| run_NW_5 | `art/clean/kindled-ash-sheathed/run/north-west 5` | 0 | 0 | -1 | 0, 1 | 17 | 10 | 11 |
| run_NW_6 | `art/clean/kindled-ash-sheathed/run/north-west 6` | 0 | 0 | -1 | 0, 1 | 7 | 10 | 4 |
| run_NW_7 | `art/clean/kindled-ash-sheathed/run/north-west 7` | 0 | 0 | -1 | 0, 1 | 5 | 10 | 10 |
| run_W_0 | `art/clean/kindled-ash-sheathed/run/west 0` | 0 | 0 | -1 | 0, 1 | 9 | 12 | 57 |
| run_W_1 | `art/clean/kindled-ash-sheathed/run/west 1` | 0 | 0 | -1 | 0, 1 | 3 | 12 | 64 |
| run_W_2 | `art/clean/kindled-ash-sheathed/run/west 2` | 0 | 0 | -1 | 0, 1 | 7 | 12 | 63 |
| run_W_3 | `art/clean/kindled-ash-sheathed/run/west 3` | 0 | 0 | -1 | 0, 1 | 14 | 12 | 55 |
| run_W_4 | `art/clean/kindled-ash-sheathed/run/west 4` | 0 | 0 | -1 | 0, 1 | 4 | 11 | 54 |
| run_W_5 | `art/clean/kindled-ash-sheathed/run/west 5` | 0 | 0 | -1 | 0, 1 | 25 | 12 | 51 |
| run_W_6 | `art/clean/kindled-ash-sheathed/run/west 6` | 0 | 0 | -1 | 0, 1 | 10 | 12 | 52 |
| run_W_7 | `art/clean/kindled-ash-sheathed/run/west 7` | 0 | 0 | -1 | 0, 1 | 18 | 12 | 56 |
| run_SW_0 | `art/clean/kindled-ash-sheathed/run/south-west 0` | 0 | 0 | -2 | 0, 0 | 14 | 15 **flag** | 126 |
| run_SW_1 | `art/clean/kindled-ash-sheathed/run/south-west 1` | 0 | 0 | -2 | 0, 0 | 15 | 15 **flag** | 130 |
| run_SW_2 | `art/clean/kindled-ash-sheathed/run/south-west 2` | 0 | 0 | -2 | 0, 0 | 8 | 14 **flag** | 118 |
| run_SW_3 | `art/clean/kindled-ash-sheathed/run/south-west 3` | 0 | 0 | -2 | 0, 0 | 8 | 15 **flag** | 103 |
| run_SW_4 | `art/clean/kindled-ash-sheathed/run/south-west 4` | 0 | 0 | -2 | 0, 0 | 15 | 14 **flag** | 105 |
| run_SW_5 | `art/clean/kindled-ash-sheathed/run/south-west 5` | 0 | 0 | -2 | 0, 0 | 11 | 14 **flag** | 99 |
| run_SW_6 | `art/clean/kindled-ash-sheathed/run/south-west 6` | 0 | 0 | -2 | 0, 0 | 11 | 13 **flag** | 126 |
| run_SW_7 | `art/clean/kindled-ash-sheathed/run/south-west 7` | 0 | 0 | -2 | 0, 0 | 23 | 14 **flag** | 143 |
| run_start_S_0 | `art/clean/kindled-ash-sheathed/run_start/south 0` | 0 | 0 | -2 | 0, 0 | 4 | 11 | 171 |
| run_start_S_1 | `art/clean/kindled-ash-sheathed/run_start/south 1` | 0 | 0 | -2 | 0, 0 | 6 | 11 | 136 |
| run_start_SE_0 | mirrored from `art/clean/kindled-ash-sheathed/run_start/south-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 150 |
| run_start_SE_1 | mirrored from `art/clean/kindled-ash-sheathed/run_start/south-west 1` | 0 | 0 | -2 | 0, 0 | 23 | 14 **flag** | 143 |
| run_start_E_0 | mirrored from `art/clean/kindled-ash-sheathed/run_start/west 0` | 0 | 0 | -2 | 0, 0 | 6 | 12 | 68 |
| run_start_E_1 | mirrored from `art/clean/kindled-ash-sheathed/run_start/west 1` | 0 | 0 | -2 | 0, 0 | 18 | 12 | 56 |
| run_start_NE_0 | mirrored from `art/clean/kindled-ash-sheathed/run_start/north-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| run_start_NE_1 | mirrored from `art/clean/kindled-ash-sheathed/run_start/north-west 1` | 0 | 0 | -2 | 0, 0 | 5 | 10 | 10 |
| run_start_N_0 | `art/clean/kindled-ash-sheathed/run_start/north 0` | 0 | 0 | -2 | 0, 0 | 6 | 4 | 0 |
| run_start_N_1 | `art/clean/kindled-ash-sheathed/run_start/north 1` | 0 | 0 | -2 | 0, 0 | 3 | 4 | 0 |
| run_start_NW_0 | `art/clean/kindled-ash-sheathed/run_start/north-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| run_start_NW_1 | `art/clean/kindled-ash-sheathed/run_start/north-west 1` | 0 | 0 | -2 | 0, 0 | 5 | 10 | 10 |
| run_start_W_0 | `art/clean/kindled-ash-sheathed/run_start/west 0` | 0 | 0 | -2 | 0, 0 | 6 | 12 | 68 |
| run_start_W_1 | `art/clean/kindled-ash-sheathed/run_start/west 1` | 0 | 0 | -2 | 0, 0 | 18 | 12 | 56 |
| run_start_SW_0 | `art/clean/kindled-ash-sheathed/run_start/south-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 150 |
| run_start_SW_1 | `art/clean/kindled-ash-sheathed/run_start/south-west 1` | 0 | 0 | -2 | 0, 0 | 23 | 14 **flag** | 143 |
| run_stop_S_0 | `art/clean/kindled-ash-sheathed/run_stop/south 0` | 0 | 0 | -2 | 0, 0 | 7 | 11 | 150 |
| run_stop_S_1 | `art/clean/kindled-ash-sheathed/run_stop/south 1` | 0 | 0 | -2 | 0, 0 | 4 | 11 | 171 |
| run_stop_SE_0 | mirrored from `art/clean/kindled-ash-sheathed/run_stop/south-west 0` | 0 | 0 | -2 | 0, 0 | 14 | 15 **flag** | 126 |
| run_stop_SE_1 | mirrored from `art/clean/kindled-ash-sheathed/run_stop/south-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 150 |
| run_stop_E_0 | mirrored from `art/clean/kindled-ash-sheathed/run_stop/west 0` | 0 | 0 | -2 | 0, 0 | 9 | 12 | 57 |
| run_stop_E_1 | mirrored from `art/clean/kindled-ash-sheathed/run_stop/west 1` | 0 | 0 | -2 | 0, 0 | 6 | 12 | 68 |
| run_stop_NE_0 | mirrored from `art/clean/kindled-ash-sheathed/run_stop/north-west 0` | 0 | 0 | -2 | 0, 0 | 5 | 11 | 14 |
| run_stop_NE_1 | mirrored from `art/clean/kindled-ash-sheathed/run_stop/north-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| run_stop_N_0 | `art/clean/kindled-ash-sheathed/run_stop/north 0` | 0 | 0 | -2 | 0, 0 | 6 | 4 | 0 |
| run_stop_N_1 | `art/clean/kindled-ash-sheathed/run_stop/north 1` | 0 | 0 | -2 | 0, 0 | 6 | 4 | 0 |
| run_stop_NW_0 | `art/clean/kindled-ash-sheathed/run_stop/north-west 0` | 0 | 0 | -2 | 0, 0 | 5 | 11 | 14 |
| run_stop_NW_1 | `art/clean/kindled-ash-sheathed/run_stop/north-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| run_stop_W_0 | `art/clean/kindled-ash-sheathed/run_stop/west 0` | 0 | 0 | -2 | 0, 0 | 9 | 12 | 57 |
| run_stop_W_1 | `art/clean/kindled-ash-sheathed/run_stop/west 1` | 0 | 0 | -2 | 0, 0 | 6 | 12 | 68 |
| run_stop_SW_0 | `art/clean/kindled-ash-sheathed/run_stop/south-west 0` | 0 | 0 | -2 | 0, 0 | 14 | 15 **flag** | 126 |
| run_stop_SW_1 | `art/clean/kindled-ash-sheathed/run_stop/south-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 16 **flag** | 150 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

