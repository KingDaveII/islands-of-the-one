# kindled-tide-sheathed

Built by `pnpm art:build kindled-tide-sheathed` from `art/sheets/kindled-tide-sheathed.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind kindled, outline player, cell 96×80, origin (48, 64).

## Summary

- Frames: 160.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 942.
- Masked skin pixels: 15840.
- Loop seam flags (last → first above 1.5× the mean change): walk_N, run_NE.
- Body bob flags (top row moves more than 2 px): walk_NW.
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
| idle_S | 2 | 45 / 45 | 44 44 (range 0) |  |
| idle_SE | 2 | 298 / 298 | 45 45 (range 0) |  |
| idle_E | 2 | 146 / 146 | 45 45 (range 0) |  |
| idle_NE | 2 | 235 / 235 | 45 45 (range 0) |  |
| idle_N | 2 | 297 / 297 | 45 46 (range 1) |  |
| idle_NW | 2 | 158 / 158 | 45 45 (range 0) |  |
| idle_W | 2 | 199 / 199 | 45 45 (range 0) |  |
| idle_SW | 2 | 197 / 197 | 45 45 (range 0) |  |
| walk_S | 6 | 136 / 389 | 44 45 44 44 45 44 (range 1) |  |
| walk_SE | 6 | 183 / 331 | 45 44 44 45 45 45 (range 1) |  |
| walk_E | 6 | 261 / 358.6 | 45 46 46 45 44 45 (range 2) |  |
| walk_NE | 6 | 164 / 343.6 | 46 47 47 45 46 46 (range 2) |  |
| walk_N | 6 | 362 / 228.2 **flag** | 46 47 46 46 47 47 (range 1) |  |
| walk_NW | 6 | 267 / 413.2 | 45 46 45 46 48 45 (range 3) **flag** |  |
| walk_W | 6 | 292 / 263.6 | 45 45 45 45 46 46 (range 1) |  |
| walk_SW | 6 | 105 / 158.6 | 45 45 45 45 45 45 (range 0) |  |
| run_S | 8 | 187 / 346.57 |  |  |
| run_SE | 8 | 298 / 316.43 |  |  |
| run_E | 8 | 249 / 272.86 |  |  |
| run_NE | 8 | 402 / 259.29 **flag** |  |  |
| run_N | 8 | 271 / 270.43 |  |  |
| run_NW | 8 | 292 / 294.57 |  |  |
| run_W | 8 | 278 / 310.43 |  |  |
| run_SW | 8 | 267 / 288.71 |  |  |
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
| idle_S_0 | `art/clean/kindled-tide-sheathed/idle/south 0` | 0 | 0 | 0 | 14, 8 | 0 | 11 | 174 |
| idle_S_1 | `art/clean/kindled-tide-sheathed/idle/south 1` | 0 | 0 | 0 | 14, 8 | 2 | 11 | 178 |
| idle_SE_0 | `art/clean/kindled-tide-sheathed/idle/south-east 0` | 0 | 0 | -1 | 14, 7 | 0 | 10 | 152 |
| idle_SE_1 | `art/clean/kindled-tide-sheathed/idle/south-east 1` | 0 | 0 | -1 | 14, 7 | 1 | 10 | 139 |
| idle_E_0 | `art/clean/kindled-tide-sheathed/idle/east 0` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 99 |
| idle_E_1 | `art/clean/kindled-tide-sheathed/idle/east 1` | 0 | 0 | -1 | 14, 7 | 1 | 10 | 102 |
| idle_NE_0 | `art/clean/kindled-tide-sheathed/idle/north-east 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 60 |
| idle_NE_1 | `art/clean/kindled-tide-sheathed/idle/north-east 1` | 0 | 0 | -1 | 14, 7 | 1 | 9 | 69 |
| idle_N_0 | `art/clean/kindled-tide-sheathed/idle/north 0` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 45 |
| idle_N_1 | `art/clean/kindled-tide-sheathed/idle/north 1` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 33 |
| idle_NW_0 | `art/clean/kindled-tide-sheathed/idle/north-west 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 66 |
| idle_NW_1 | `art/clean/kindled-tide-sheathed/idle/north-west 1` | 0 | 0 | 0 | 14, 8 | 3 | 9 | 65 |
| idle_W_0 | `art/clean/kindled-tide-sheathed/idle/west 0` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 100 |
| idle_W_1 | `art/clean/kindled-tide-sheathed/idle/west 1` | 0 | 0 | -1 | 14, 7 | 1 | 10 | 87 |
| idle_SW_0 | `art/clean/kindled-tide-sheathed/idle/south-west 0` | 0 | 0 | -1 | 14, 7 | 0 | 10 | 148 |
| idle_SW_1 | `art/clean/kindled-tide-sheathed/idle/south-west 1` | 0 | 0 | -1 | 14, 7 | 0 | 10 | 132 |
| walk_S_0 | `art/clean/kindled-tide-sheathed/walk/south 0` | 0 | 0 | 0 | 8, 2 | 1 | 11 | 181 |
| walk_S_1 | `art/clean/kindled-tide-sheathed/walk/south 1` | 0 | 0 | -1 | 8, 1 | 1 | 11 | 182 |
| walk_S_2 | `art/clean/kindled-tide-sheathed/walk/south 2` | 0 | 0 | 0 | 8, 2 | 3 | 11 | 181 |
| walk_S_3 | `art/clean/kindled-tide-sheathed/walk/south 3` | 0 | 0 | 0 | 8, 2 | 0 | 11 | 174 |
| walk_S_4 | `art/clean/kindled-tide-sheathed/walk/south 4` | 0 | 0 | -1 | 8, 1 | 0 | 11 | 184 |
| walk_S_5 | `art/clean/kindled-tide-sheathed/walk/south 5` | 0 | 0 | 0 | 8, 2 | 2 | 11 | 177 |
| walk_SE_0 | `art/clean/kindled-tide-sheathed/walk/south-east 0` | 0 | 0 | -1 | 8, 1 | 3 | 11 | 147 |
| walk_SE_1 | `art/clean/kindled-tide-sheathed/walk/south-east 1` | 0 | 0 | 0 | 8, 2 | 3 | 10 | 143 |
| walk_SE_2 | `art/clean/kindled-tide-sheathed/walk/south-east 2` | 0 | 0 | 0 | 8, 2 | 4 | 11 | 119 |
| walk_SE_3 | `art/clean/kindled-tide-sheathed/walk/south-east 3` | 0 | 0 | -1 | 8, 1 | 0 | 10 | 151 |
| walk_SE_4 | `art/clean/kindled-tide-sheathed/walk/south-east 4` | 0 | 0 | -1 | 8, 1 | 4 | 10 | 159 |
| walk_SE_5 | `art/clean/kindled-tide-sheathed/walk/south-east 5` | 0 | 0 | -1 | 8, 1 | 10 | 10 | 160 |
| walk_E_0 | `art/clean/kindled-tide-sheathed/walk/east 0` | 0 | 0 | -1 | 8, 1 | 3 | 8 | 96 |
| walk_E_1 | `art/clean/kindled-tide-sheathed/walk/east 1` | 0 | 0 | -2 | 8, 0 | 2 | 8 | 126 |
| walk_E_2 | `art/clean/kindled-tide-sheathed/walk/east 2` | 0 | 0 | -2 | 8, 0 | 2 | 8 | 117 |
| walk_E_3 | `art/clean/kindled-tide-sheathed/walk/east 3` | 0 | 0 | -1 | 8, 1 | 0 | 8 | 99 |
| walk_E_4 | `art/clean/kindled-tide-sheathed/walk/east 4` | 0 | 0 | 0 | 8, 2 | 4 | 10 | 94 |
| walk_E_5 | `art/clean/kindled-tide-sheathed/walk/east 5` | 0 | 0 | -1 | 8, 1 | 5 | 10 | 100 |
| walk_NE_0 | `art/clean/kindled-tide-sheathed/walk/north-east 0` | 0 | 0 | -1 | 8, 1 | 12 | 9 | 62 |
| walk_NE_1 | `art/clean/kindled-tide-sheathed/walk/north-east 1` | 0 | 0 | -3 | 8, -1 | 3 | 10 | 72 |
| walk_NE_2 | `art/clean/kindled-tide-sheathed/walk/north-east 2` | 0 | 0 | -2 | 8, 0 | 5 | 9 | 69 |
| walk_NE_3 | `art/clean/kindled-tide-sheathed/walk/north-east 3` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 62 |
| walk_NE_4 | `art/clean/kindled-tide-sheathed/walk/north-east 4` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 59 |
| walk_NE_5 | `art/clean/kindled-tide-sheathed/walk/north-east 5` | 0 | 0 | -1 | 8, 1 | 10 | 9 | 70 |
| walk_N_0 | `art/clean/kindled-tide-sheathed/walk/north 0` | 0 | 0 | -1 | 8, 1 | 9 | 6 | 33 |
| walk_N_1 | `art/clean/kindled-tide-sheathed/walk/north 1` | 0 | 0 | -2 | 8, 0 | 10 | 8 | 48 |
| walk_N_2 | `art/clean/kindled-tide-sheathed/walk/north 2` | 0 | 0 | -2 | 8, 0 | 3 | 8 | 42 |
| walk_N_3 | `art/clean/kindled-tide-sheathed/walk/north 3` | 0 | 0 | -1 | 8, 1 | 4 | 8 | 48 |
| walk_N_4 | `art/clean/kindled-tide-sheathed/walk/north 4` | 0 | 0 | -2 | 8, 0 | 5 | 8 | 51 |
| walk_N_5 | `art/clean/kindled-tide-sheathed/walk/north 5` | 0 | 0 | -2 | 8, 0 | 6 | 8 | 48 |
| walk_NW_0 | `art/clean/kindled-tide-sheathed/walk/north-west 0` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 62 |
| walk_NW_1 | `art/clean/kindled-tide-sheathed/walk/north-west 1` | 0 | 0 | -1 | 8, 1 | 5 | 9 | 57 |
| walk_NW_2 | `art/clean/kindled-tide-sheathed/walk/north-west 2` | 0 | 0 | -1 | 8, 1 | 8 | 9 | 63 |
| walk_NW_3 | `art/clean/kindled-tide-sheathed/walk/north-west 3` | 0 | 0 | -2 | 8, 0 | 10 | 10 | 69 |
| walk_NW_4 | `art/clean/kindled-tide-sheathed/walk/north-west 4` | 0 | 0 | -4 | 8, -2 | 5 | 10 | 68 |
| walk_NW_5 | `art/clean/kindled-tide-sheathed/walk/north-west 5` | 0 | 0 | -1 | 8, 1 | 6 | 9 | 67 |
| walk_W_0 | `art/clean/kindled-tide-sheathed/walk/west 0` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 86 |
| walk_W_1 | `art/clean/kindled-tide-sheathed/walk/west 1` | 0 | 0 | -1 | 8, 1 | 3 | 10 | 82 |
| walk_W_2 | `art/clean/kindled-tide-sheathed/walk/west 2` | 0 | 0 | -1 | 8, 1 | 2 | 10 | 83 |
| walk_W_3 | `art/clean/kindled-tide-sheathed/walk/west 3` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 86 |
| walk_W_4 | `art/clean/kindled-tide-sheathed/walk/west 4` | 0 | 0 | -2 | 8, 0 | 2 | 10 | 82 |
| walk_W_5 | `art/clean/kindled-tide-sheathed/walk/west 5` | 0 | 0 | -2 | 8, 0 | 6 | 8 | 70 |
| walk_SW_0 | `art/clean/kindled-tide-sheathed/walk/south-west 0` | 0 | 0 | -1 | 8, 1 | 0 | 10 | 146 |
| walk_SW_1 | `art/clean/kindled-tide-sheathed/walk/south-west 1` | 0 | 0 | -1 | 8, 1 | 5 | 10 | 156 |
| walk_SW_2 | `art/clean/kindled-tide-sheathed/walk/south-west 2` | 0 | 0 | -1 | 8, 1 | 7 | 10 | 153 |
| walk_SW_3 | `art/clean/kindled-tide-sheathed/walk/south-west 3` | 0 | 0 | -1 | 8, 1 | 0 | 10 | 147 |
| walk_SW_4 | `art/clean/kindled-tide-sheathed/walk/south-west 4` | 0 | 0 | -1 | 8, 1 | 2 | 10 | 134 |
| walk_SW_5 | `art/clean/kindled-tide-sheathed/walk/south-west 5` | 0 | 0 | -1 | 8, 1 | 9 | 11 | 145 |
| run_S_0 | `art/clean/kindled-tide-sheathed/run/south 0` | 0 | 0 | -1 | 8, 1 | 3 | 11 | 126 |
| run_S_1 | `art/clean/kindled-tide-sheathed/run/south 1` | 0 | 0 | -1 | 8, 1 | 2 | 10 | 157 |
| run_S_2 | `art/clean/kindled-tide-sheathed/run/south 2` | 0 | 0 | -1 | 8, 1 | 7 | 10 | 155 |
| run_S_3 | `art/clean/kindled-tide-sheathed/run/south 3` | 0 | 0 | -1 | 8, 1 | 12 | 11 | 152 |
| run_S_4 | `art/clean/kindled-tide-sheathed/run/south 4` | 0 | 0 | -1 | 8, 1 | 5 | 11 | 140 |
| run_S_5 | `art/clean/kindled-tide-sheathed/run/south 5` | 0 | 0 | -1 | 8, 1 | 10 | 11 | 169 |
| run_S_6 | `art/clean/kindled-tide-sheathed/run/south 6` | 0 | 0 | -1 | 8, 1 | 7 | 10 | 171 |
| run_S_7 | `art/clean/kindled-tide-sheathed/run/south 7` | 0 | 0 | -1 | 8, 1 | 5 | 10 | 152 |
| run_SE_0 | `art/clean/kindled-tide-sheathed/run/south-east 0` | 0 | 0 | -1 | 8, 1 | 20 | 10 | 165 |
| run_SE_1 | `art/clean/kindled-tide-sheathed/run/south-east 1` | 0 | 0 | -1 | 8, 1 | 13 | 10 | 159 |
| run_SE_2 | `art/clean/kindled-tide-sheathed/run/south-east 2` | 0 | 0 | -1 | 8, 1 | 16 | 9 | 153 |
| run_SE_3 | `art/clean/kindled-tide-sheathed/run/south-east 3` | 0 | 0 | -1 | 8, 1 | 7 | 9 | 118 |
| run_SE_4 | `art/clean/kindled-tide-sheathed/run/south-east 4` | 0 | 0 | -1 | 8, 1 | 6 | 9 | 116 |
| run_SE_5 | `art/clean/kindled-tide-sheathed/run/south-east 5` | 0 | 0 | -1 | 8, 1 | 12 | 9 | 118 |
| run_SE_6 | `art/clean/kindled-tide-sheathed/run/south-east 6` | 0 | 0 | -1 | 8, 1 | 11 | 11 | 146 |
| run_SE_7 | `art/clean/kindled-tide-sheathed/run/south-east 7` | 0 | 0 | -1 | 8, 1 | 8 | 10 | 163 |
| run_E_0 | `art/clean/kindled-tide-sheathed/run/east 0` | 0 | 0 | -1 | 8, 1 | 17 | 11 | 117 |
| run_E_1 | `art/clean/kindled-tide-sheathed/run/east 1` | 0 | 0 | -1 | 8, 1 | 5 | 11 | 88 |
| run_E_2 | `art/clean/kindled-tide-sheathed/run/east 2` | 0 | 0 | -1 | 8, 1 | 11 | 8 | 90 |
| run_E_3 | `art/clean/kindled-tide-sheathed/run/east 3` | 0 | 0 | -1 | 8, 1 | 17 | 11 | 97 |
| run_E_4 | `art/clean/kindled-tide-sheathed/run/east 4` | 0 | 0 | -1 | 8, 1 | 10 | 11 | 130 |
| run_E_5 | `art/clean/kindled-tide-sheathed/run/east 5` | 0 | 0 | -1 | 8, 1 | 11 | 11 | 95 |
| run_E_6 | `art/clean/kindled-tide-sheathed/run/east 6` | 0 | 0 | -1 | 8, 1 | 14 | 10 | 70 |
| run_E_7 | `art/clean/kindled-tide-sheathed/run/east 7` | 0 | 0 | -1 | 8, 1 | 9 | 11 | 82 |
| run_NE_0 | `art/clean/kindled-tide-sheathed/run/north-east 0` | 0 | 0 | -3 | 8, -1 | 8 | 10 | 50 |
| run_NE_1 | `art/clean/kindled-tide-sheathed/run/north-east 1` | 0 | 0 | -3 | 8, -1 | 11 | 10 | 47 |
| run_NE_2 | `art/clean/kindled-tide-sheathed/run/north-east 2` | 0 | 0 | -3 | 8, -1 | 7 | 10 | 52 |
| run_NE_3 | `art/clean/kindled-tide-sheathed/run/north-east 3` | 0 | 0 | -3 | 8, -1 | 5 | 10 | 66 |
| run_NE_4 | `art/clean/kindled-tide-sheathed/run/north-east 4` | 0 | 0 | -3 | 8, -1 | 5 | 10 | 62 |
| run_NE_5 | `art/clean/kindled-tide-sheathed/run/north-east 5` | 0 | 0 | -3 | 8, -1 | 15 | 9 | 67 |
| run_NE_6 | `art/clean/kindled-tide-sheathed/run/north-east 6` | 0 | 0 | -3 | 8, -1 | 8 | 7 | 66 |
| run_NE_7 | `art/clean/kindled-tide-sheathed/run/north-east 7` | 0 | 0 | -3 | 8, -1 | 2 | 10 | 71 |
| run_N_0 | `art/clean/kindled-tide-sheathed/run/north 0` | 0 | 0 | -2 | 8, 0 | 7 | 8 | 42 |
| run_N_1 | `art/clean/kindled-tide-sheathed/run/north 1` | 0 | 0 | -2 | 8, 0 | 7 | 8 | 45 |
| run_N_2 | `art/clean/kindled-tide-sheathed/run/north 2` | 0 | 0 | -2 | 8, 0 | 9 | 8 | 54 |
| run_N_3 | `art/clean/kindled-tide-sheathed/run/north 3` | 0 | 0 | -2 | 8, 0 | 5 | 9 | 31 |
| run_N_4 | `art/clean/kindled-tide-sheathed/run/north 4` | 0 | 0 | -2 | 8, 0 | 8 | 8 | 42 |
| run_N_5 | `art/clean/kindled-tide-sheathed/run/north 5` | 0 | 0 | -2 | 8, 0 | 11 | 8 | 44 |
| run_N_6 | `art/clean/kindled-tide-sheathed/run/north 6` | 0 | 0 | -2 | 8, 0 | 9 | 8 | 36 |
| run_N_7 | `art/clean/kindled-tide-sheathed/run/north 7` | 0 | 0 | -2 | 8, 0 | 9 | 8 | 44 |
| run_NW_0 | `art/clean/kindled-tide-sheathed/run/north-west 0` | 0 | 0 | -3 | 8, -1 | 10 | 10 | 54 |
| run_NW_1 | `art/clean/kindled-tide-sheathed/run/north-west 1` | 0 | 0 | -3 | 8, -1 | 13 | 11 | 52 |
| run_NW_2 | `art/clean/kindled-tide-sheathed/run/north-west 2` | 0 | 0 | -3 | 8, -1 | 6 | 9 | 49 |
| run_NW_3 | `art/clean/kindled-tide-sheathed/run/north-west 3` | 0 | 0 | -3 | 8, -1 | 10 | 9 | 54 |
| run_NW_4 | `art/clean/kindled-tide-sheathed/run/north-west 4` | 0 | 0 | -3 | 8, -1 | 6 | 6 | 61 |
| run_NW_5 | `art/clean/kindled-tide-sheathed/run/north-west 5` | 0 | 0 | -3 | 8, -1 | 3 | 6 | 64 |
| run_NW_6 | `art/clean/kindled-tide-sheathed/run/north-west 6` | 0 | 0 | -3 | 8, -1 | 6 | 9 | 55 |
| run_NW_7 | `art/clean/kindled-tide-sheathed/run/north-west 7` | 0 | 0 | -3 | 8, -1 | 5 | 10 | 55 |
| run_W_0 | `art/clean/kindled-tide-sheathed/run/west 0` | 0 | 0 | -1 | 8, 1 | 13 | 11 | 99 |
| run_W_1 | `art/clean/kindled-tide-sheathed/run/west 1` | 0 | 0 | -1 | 8, 1 | 9 | 10 | 89 |
| run_W_2 | `art/clean/kindled-tide-sheathed/run/west 2` | 0 | 0 | -1 | 8, 1 | 17 | 10 | 70 |
| run_W_3 | `art/clean/kindled-tide-sheathed/run/west 3` | 0 | 0 | -1 | 8, 1 | 7 | 8 | 51 |
| run_W_4 | `art/clean/kindled-tide-sheathed/run/west 4` | 0 | 0 | -1 | 8, 1 | 17 | 8 | 59 |
| run_W_5 | `art/clean/kindled-tide-sheathed/run/west 5` | 0 | 0 | -1 | 8, 1 | 10 | 8 | 43 |
| run_W_6 | `art/clean/kindled-tide-sheathed/run/west 6` | 0 | 0 | -1 | 8, 1 | 13 | 7 | 36 |
| run_W_7 | `art/clean/kindled-tide-sheathed/run/west 7` | 0 | 0 | -1 | 8, 1 | 9 | 11 | 80 |
| run_SW_0 | `art/clean/kindled-tide-sheathed/run/south-west 0` | 0 | 0 | -1 | 8, 1 | 13 | 10 | 126 |
| run_SW_1 | `art/clean/kindled-tide-sheathed/run/south-west 1` | 0 | 0 | -1 | 8, 1 | 6 | 10 | 133 |
| run_SW_2 | `art/clean/kindled-tide-sheathed/run/south-west 2` | 0 | 0 | -1 | 8, 1 | 2 | 11 | 124 |
| run_SW_3 | `art/clean/kindled-tide-sheathed/run/south-west 3` | 0 | 0 | -1 | 8, 1 | 4 | 8 | 126 |
| run_SW_4 | `art/clean/kindled-tide-sheathed/run/south-west 4` | 0 | 0 | -1 | 8, 1 | 8 | 10 | 141 |
| run_SW_5 | `art/clean/kindled-tide-sheathed/run/south-west 5` | 0 | 0 | -1 | 8, 1 | 4 | 11 | 103 |
| run_SW_6 | `art/clean/kindled-tide-sheathed/run/south-west 6` | 0 | 0 | -1 | 8, 1 | 4 | 10 | 135 |
| run_SW_7 | `art/clean/kindled-tide-sheathed/run/south-west 7` | 0 | 0 | -1 | 8, 1 | 25 | 10 | 132 |
| run_start_S_0 | `art/clean/kindled-tide-sheathed/run_start/south 0` | 0 | 0 | -1 | 8, 1 | 0 | 11 | 172 |
| run_start_S_1 | `art/clean/kindled-tide-sheathed/run_start/south 1` | 0 | 0 | -1 | 8, 1 | 5 | 10 | 152 |
| run_start_SE_0 | `art/clean/kindled-tide-sheathed/run_start/south-east 0` | 0 | 0 | -1 | 8, 1 | 0 | 10 | 152 |
| run_start_SE_1 | `art/clean/kindled-tide-sheathed/run_start/south-east 1` | 0 | 0 | -1 | 8, 1 | 8 | 10 | 163 |
| run_start_E_0 | `art/clean/kindled-tide-sheathed/run_start/east 0` | 0 | 0 | -1 | 8, 1 | 0 | 8 | 99 |
| run_start_E_1 | `art/clean/kindled-tide-sheathed/run_start/east 1` | 0 | 0 | -1 | 8, 1 | 9 | 11 | 82 |
| run_start_NE_0 | `art/clean/kindled-tide-sheathed/run_start/north-east 0` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 60 |
| run_start_NE_1 | `art/clean/kindled-tide-sheathed/run_start/north-east 1` | 0 | 0 | -3 | 8, -1 | 2 | 10 | 71 |
| run_start_N_0 | `art/clean/kindled-tide-sheathed/run_start/north 0` | 0 | 0 | -2 | 8, 0 | 0 | 8 | 45 |
| run_start_N_1 | `art/clean/kindled-tide-sheathed/run_start/north 1` | 0 | 0 | -2 | 8, 0 | 9 | 8 | 44 |
| run_start_NW_0 | `art/clean/kindled-tide-sheathed/run_start/north-west 0` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 66 |
| run_start_NW_1 | `art/clean/kindled-tide-sheathed/run_start/north-west 1` | 0 | 0 | -3 | 8, -1 | 5 | 10 | 55 |
| run_start_W_0 | `art/clean/kindled-tide-sheathed/run_start/west 0` | 0 | 0 | -1 | 8, 1 | 0 | 8 | 100 |
| run_start_W_1 | `art/clean/kindled-tide-sheathed/run_start/west 1` | 0 | 0 | -1 | 8, 1 | 9 | 11 | 80 |
| run_start_SW_0 | `art/clean/kindled-tide-sheathed/run_start/south-west 0` | 0 | 0 | -1 | 8, 1 | 0 | 10 | 148 |
| run_start_SW_1 | `art/clean/kindled-tide-sheathed/run_start/south-west 1` | 0 | 0 | -1 | 8, 1 | 25 | 10 | 132 |
| run_stop_S_0 | `art/clean/kindled-tide-sheathed/run_stop/south 0` | 0 | 0 | -1 | 8, 1 | 3 | 11 | 126 |
| run_stop_S_1 | `art/clean/kindled-tide-sheathed/run_stop/south 1` | 0 | 0 | -1 | 8, 1 | 0 | 11 | 172 |
| run_stop_SE_0 | `art/clean/kindled-tide-sheathed/run_stop/south-east 0` | 0 | 0 | -1 | 8, 1 | 20 | 10 | 165 |
| run_stop_SE_1 | `art/clean/kindled-tide-sheathed/run_stop/south-east 1` | 0 | 0 | -1 | 8, 1 | 0 | 10 | 152 |
| run_stop_E_0 | `art/clean/kindled-tide-sheathed/run_stop/east 0` | 0 | 0 | -1 | 8, 1 | 17 | 11 | 117 |
| run_stop_E_1 | `art/clean/kindled-tide-sheathed/run_stop/east 1` | 0 | 0 | -1 | 8, 1 | 0 | 8 | 99 |
| run_stop_NE_0 | `art/clean/kindled-tide-sheathed/run_stop/north-east 0` | 0 | 0 | -3 | 8, -1 | 8 | 10 | 50 |
| run_stop_NE_1 | `art/clean/kindled-tide-sheathed/run_stop/north-east 1` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 60 |
| run_stop_N_0 | `art/clean/kindled-tide-sheathed/run_stop/north 0` | 0 | 0 | -2 | 8, 0 | 7 | 8 | 42 |
| run_stop_N_1 | `art/clean/kindled-tide-sheathed/run_stop/north 1` | 0 | 0 | -2 | 8, 0 | 0 | 8 | 45 |
| run_stop_NW_0 | `art/clean/kindled-tide-sheathed/run_stop/north-west 0` | 0 | 0 | -3 | 8, -1 | 10 | 10 | 54 |
| run_stop_NW_1 | `art/clean/kindled-tide-sheathed/run_stop/north-west 1` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 66 |
| run_stop_W_0 | `art/clean/kindled-tide-sheathed/run_stop/west 0` | 0 | 0 | -1 | 8, 1 | 13 | 11 | 99 |
| run_stop_W_1 | `art/clean/kindled-tide-sheathed/run_stop/west 1` | 0 | 0 | -1 | 8, 1 | 0 | 8 | 100 |
| run_stop_SW_0 | `art/clean/kindled-tide-sheathed/run_stop/south-west 0` | 0 | 0 | -1 | 8, 1 | 13 | 10 | 126 |
| run_stop_SW_1 | `art/clean/kindled-tide-sheathed/run_stop/south-west 1` | 0 | 0 | -1 | 8, 1 | 0 | 10 | 148 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

