# kindled-clay-sheathed

Built by `pnpm art:build kindled-clay-sheathed` from `art/sheets/kindled-clay-sheathed.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind kindled, outline player, cell 96×80, origin (48, 64).

## Summary

- Frames: 160.
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels not in an outline colour): 1153.
- Masked skin pixels: 16681.
- Loop seam flags (last → first above 1.5× the mean change): walk_SW.
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
| idle_S | 2 | 281 / 281 | 44 43 (range 1) |  |
| idle_SE | 2 | 181 / 181 | 45 44 (range 1) |  |
| idle_E | 2 | 91 / 91 | 45 45 (range 0) |  |
| idle_NE | 2 | 262 / 262 | 45 45 (range 0) |  |
| idle_N | 2 | 246 / 246 | 45 46 (range 1) |  |
| idle_NW | 2 | 78 / 78 | 45 45 (range 0) |  |
| idle_W | 2 | 358 / 358 | 45 44 (range 1) |  |
| idle_SW | 2 | 365 / 365 | 45 46 (range 1) |  |
| walk_S | 6 | 225 / 457.8 | 44 44 45 44 45 44 (range 1) |  |
| walk_SE | 6 | 242 / 337.6 | 45 44 44 45 45 45 (range 1) |  |
| walk_E | 6 | 240 / 304.6 | 46 45 46 45 46 46 (range 1) |  |
| walk_NE | 6 | 306 / 424.2 | 45 46 47 45 46 45 (range 2) |  |
| walk_N | 6 | 170 / 323.2 | 45 46 46 45 46 45 (range 1) |  |
| walk_NW | 6 | 473 / 364 | 44 45 45 45 47 46 (range 3) **flag** |  |
| walk_W | 6 | 162 / 317.2 | 45 44 45 45 45 45 (range 1) |  |
| walk_SW | 6 | 424 / 227.2 **flag** | 45 45 45 45 44 44 (range 1) |  |
| run_S | 8 | 203 / 323.71 |  |  |
| run_SE | 8 | 262 / 342.43 |  |  |
| run_E | 8 | 314 / 264.86 |  |  |
| run_NE | 8 | 338 / 299.57 |  |  |
| run_N | 8 | 255 / 197.29 |  |  |
| run_NW | 8 | 397 / 280.43 |  |  |
| run_W | 8 | 324 / 341 |  |  |
| run_SW | 8 | 228 / 350.86 |  |  |
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
| idle_S_0 | `art/clean/kindled-clay-sheathed/idle/south 0` | 0 | 0 | 0 | 14, 8 | 0 | 9 | 192 |
| idle_S_1 | `art/clean/kindled-clay-sheathed/idle/south 1` | 0 | 0 | 0 | 14, 8 | 0 | 9 | 165 |
| idle_SE_0 | `art/clean/kindled-clay-sheathed/idle/south-east 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 158 |
| idle_SE_1 | `art/clean/kindled-clay-sheathed/idle/south-east 1` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 156 |
| idle_E_0 | `art/clean/kindled-clay-sheathed/idle/east 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 104 |
| idle_E_1 | `art/clean/kindled-clay-sheathed/idle/east 1` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 103 |
| idle_NE_0 | `art/clean/kindled-clay-sheathed/idle/north-east 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 55 |
| idle_NE_1 | `art/clean/kindled-clay-sheathed/idle/north-east 1` | 0 | 0 | 0 | 14, 8 | 3 | 8 | 44 |
| idle_N_0 | `art/clean/kindled-clay-sheathed/idle/north 0` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 44 |
| idle_N_1 | `art/clean/kindled-clay-sheathed/idle/north 1` | 0 | 0 | -1 | 14, 7 | 0 | 8 | 33 |
| idle_NW_0 | `art/clean/kindled-clay-sheathed/idle/north-west 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 47 |
| idle_NW_1 | `art/clean/kindled-clay-sheathed/idle/north-west 1` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 51 |
| idle_W_0 | `art/clean/kindled-clay-sheathed/idle/west 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 104 |
| idle_W_1 | `art/clean/kindled-clay-sheathed/idle/west 1` | 0 | 0 | -1 | 14, 7 | 3 | 9 | 110 |
| idle_SW_0 | `art/clean/kindled-clay-sheathed/idle/south-west 0` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 158 |
| idle_SW_1 | `art/clean/kindled-clay-sheathed/idle/south-west 1` | 0 | 0 | -1 | 14, 7 | 0 | 9 | 144 |
| walk_S_0 | `art/clean/kindled-clay-sheathed/walk/south 0` | 0 | 0 | 0 | 8, 2 | 11 | 9 | 202 |
| walk_S_1 | `art/clean/kindled-clay-sheathed/walk/south 1` | 0 | 0 | 0 | 8, 2 | 2 | 9 | 186 |
| walk_S_2 | `art/clean/kindled-clay-sheathed/walk/south 2` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 183 |
| walk_S_3 | `art/clean/kindled-clay-sheathed/walk/south 3` | 0 | 0 | 0 | 8, 2 | 0 | 9 | 191 |
| walk_S_4 | `art/clean/kindled-clay-sheathed/walk/south 4` | 0 | 0 | -1 | 8, 1 | 4 | 9 | 194 |
| walk_S_5 | `art/clean/kindled-clay-sheathed/walk/south 5` | 0 | 0 | 0 | 8, 2 | 6 | 9 | 184 |
| walk_SE_0 | `art/clean/kindled-clay-sheathed/walk/south-east 0` | 0 | 0 | -1 | 8, 1 | 11 | 9 | 151 |
| walk_SE_1 | `art/clean/kindled-clay-sheathed/walk/south-east 1` | 0 | 0 | 0 | 8, 2 | 6 | 9 | 118 |
| walk_SE_2 | `art/clean/kindled-clay-sheathed/walk/south-east 2` | 0 | 0 | 0 | 8, 2 | 4 | 9 | 146 |
| walk_SE_3 | `art/clean/kindled-clay-sheathed/walk/south-east 3` | 0 | 0 | -1 | 8, 1 | 2 | 9 | 159 |
| walk_SE_4 | `art/clean/kindled-clay-sheathed/walk/south-east 4` | 0 | 0 | -1 | 8, 1 | 4 | 9 | 182 |
| walk_SE_5 | `art/clean/kindled-clay-sheathed/walk/south-east 5` | 0 | 0 | -1 | 8, 1 | 11 | 9 | 172 |
| walk_E_0 | `art/clean/kindled-clay-sheathed/walk/east 0` | 0 | 0 | -1 | 8, 1 | 5 | 9 | 84 |
| walk_E_1 | `art/clean/kindled-clay-sheathed/walk/east 1` | 0 | 0 | -1 | 8, 1 | 7 | 8 | 104 |
| walk_E_2 | `art/clean/kindled-clay-sheathed/walk/east 2` | 0 | 0 | -1 | 8, 1 | 3 | 9 | 112 |
| walk_E_3 | `art/clean/kindled-clay-sheathed/walk/east 3` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 104 |
| walk_E_4 | `art/clean/kindled-clay-sheathed/walk/east 4` | 0 | 0 | -1 | 8, 1 | 4 | 9 | 95 |
| walk_E_5 | `art/clean/kindled-clay-sheathed/walk/east 5` | 0 | 0 | -1 | 8, 1 | 13 | 9 | 99 |
| walk_NE_0 | `art/clean/kindled-clay-sheathed/walk/north-east 0` | 0 | 0 | -1 | 8, 1 | 11 | 9 | 43 |
| walk_NE_1 | `art/clean/kindled-clay-sheathed/walk/north-east 1` | 0 | 0 | -2 | 8, 0 | 10 | 9 | 42 |
| walk_NE_2 | `art/clean/kindled-clay-sheathed/walk/north-east 2` | 0 | 0 | -3 | 8, -1 | 9 | 9 | 50 |
| walk_NE_3 | `art/clean/kindled-clay-sheathed/walk/north-east 3` | 0 | 0 | -1 | 8, 1 | 2 | 9 | 47 |
| walk_NE_4 | `art/clean/kindled-clay-sheathed/walk/north-east 4` | 0 | 0 | -1 | 8, 1 | 5 | 8 | 48 |
| walk_NE_5 | `art/clean/kindled-clay-sheathed/walk/north-east 5` | 0 | 0 | 0 | 8, 2 | 22 | 8 | 56 |
| walk_N_0 | `art/clean/kindled-clay-sheathed/walk/north 0` | 0 | 0 | -1 | 8, 1 | 0 | 8 | 40 |
| walk_N_1 | `art/clean/kindled-clay-sheathed/walk/north 1` | 0 | 0 | -2 | 8, 0 | 1 | 8 | 39 |
| walk_N_2 | `art/clean/kindled-clay-sheathed/walk/north 2` | 0 | 0 | -2 | 8, 0 | 2 | 8 | 41 |
| walk_N_3 | `art/clean/kindled-clay-sheathed/walk/north 3` | 0 | 0 | -1 | 8, 1 | 3 | 8 | 39 |
| walk_N_4 | `art/clean/kindled-clay-sheathed/walk/north 4` | 0 | 0 | -2 | 8, 0 | 1 | 8 | 41 |
| walk_N_5 | `art/clean/kindled-clay-sheathed/walk/north 5` | 0 | 0 | -1 | 8, 1 | 6 | 8 | 37 |
| walk_NW_0 | `art/clean/kindled-clay-sheathed/walk/north-west 0` | 0 | 0 | 0 | 8, 2 | 5 | 9 | 41 |
| walk_NW_1 | `art/clean/kindled-clay-sheathed/walk/north-west 1` | 0 | 0 | -1 | 8, 1 | 9 | 9 | 50 |
| walk_NW_2 | `art/clean/kindled-clay-sheathed/walk/north-west 2` | 0 | 0 | -1 | 8, 1 | 6 | 9 | 44 |
| walk_NW_3 | `art/clean/kindled-clay-sheathed/walk/north-west 3` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 47 |
| walk_NW_4 | `art/clean/kindled-clay-sheathed/walk/north-west 4` | 0 | 0 | -3 | 8, -1 | 6 | 9 | 62 |
| walk_NW_5 | `art/clean/kindled-clay-sheathed/walk/north-west 5` | 0 | 0 | -2 | 8, 0 | 15 | 9 | 39 |
| walk_W_0 | `art/clean/kindled-clay-sheathed/walk/west 0` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 104 |
| walk_W_1 | `art/clean/kindled-clay-sheathed/walk/west 1` | 0 | 0 | 0 | 8, 2 | 1 | 9 | 105 |
| walk_W_2 | `art/clean/kindled-clay-sheathed/walk/west 2` | 0 | 0 | -1 | 8, 1 | 9 | 9 | 100 |
| walk_W_3 | `art/clean/kindled-clay-sheathed/walk/west 3` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 104 |
| walk_W_4 | `art/clean/kindled-clay-sheathed/walk/west 4` | 0 | 0 | -1 | 8, 1 | 5 | 9 | 107 |
| walk_W_5 | `art/clean/kindled-clay-sheathed/walk/west 5` | 0 | 0 | -1 | 8, 1 | 13 | 9 | 82 |
| walk_SW_0 | `art/clean/kindled-clay-sheathed/walk/south-west 0` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 158 |
| walk_SW_1 | `art/clean/kindled-clay-sheathed/walk/south-west 1` | 0 | 0 | -1 | 8, 1 | 9 | 9 | 159 |
| walk_SW_2 | `art/clean/kindled-clay-sheathed/walk/south-west 2` | 0 | 0 | -1 | 8, 1 | 3 | 9 | 156 |
| walk_SW_3 | `art/clean/kindled-clay-sheathed/walk/south-west 3` | 0 | 0 | -1 | 8, 1 | 1 | 9 | 162 |
| walk_SW_4 | `art/clean/kindled-clay-sheathed/walk/south-west 4` | 0 | 0 | 0 | 8, 2 | 3 | 9 | 141 |
| walk_SW_5 | `art/clean/kindled-clay-sheathed/walk/south-west 5` | 0 | 0 | 0 | 8, 2 | 16 | 9 | 149 |
| run_S_0 | `art/clean/kindled-clay-sheathed/run/south 0` | 0 | 0 | -2 | 8, 0 | 3 | 9 | 165 |
| run_S_1 | `art/clean/kindled-clay-sheathed/run/south 1` | 0 | 0 | -2 | 8, 0 | 16 | 8 | 164 |
| run_S_2 | `art/clean/kindled-clay-sheathed/run/south 2` | 0 | 0 | -2 | 8, 0 | 7 | 8 | 162 |
| run_S_3 | `art/clean/kindled-clay-sheathed/run/south 3` | 0 | 0 | -2 | 8, 0 | 10 | 8 | 184 |
| run_S_4 | `art/clean/kindled-clay-sheathed/run/south 4` | 0 | 0 | -2 | 8, 0 | 9 | 8 | 179 |
| run_S_5 | `art/clean/kindled-clay-sheathed/run/south 5` | 0 | 0 | -2 | 8, 0 | 4 | 9 | 171 |
| run_S_6 | `art/clean/kindled-clay-sheathed/run/south 6` | 0 | 0 | -2 | 8, 0 | 15 | 8 | 180 |
| run_S_7 | `art/clean/kindled-clay-sheathed/run/south 7` | 0 | 0 | -2 | 8, 0 | 8 | 9 | 166 |
| run_SE_0 | `art/clean/kindled-clay-sheathed/run/south-east 0` | 0 | 0 | -2 | 8, 0 | 13 | 9 | 163 |
| run_SE_1 | `art/clean/kindled-clay-sheathed/run/south-east 1` | 0 | 0 | -2 | 8, 0 | 5 | 9 | 160 |
| run_SE_2 | `art/clean/kindled-clay-sheathed/run/south-east 2` | 0 | 0 | -2 | 8, 0 | 12 | 9 | 140 |
| run_SE_3 | `art/clean/kindled-clay-sheathed/run/south-east 3` | 0 | 0 | -2 | 8, 0 | 5 | 9 | 134 |
| run_SE_4 | `art/clean/kindled-clay-sheathed/run/south-east 4` | 0 | 0 | -2 | 8, 0 | 5 | 9 | 108 |
| run_SE_5 | `art/clean/kindled-clay-sheathed/run/south-east 5` | 0 | 0 | -2 | 8, 0 | 9 | 9 | 173 |
| run_SE_6 | `art/clean/kindled-clay-sheathed/run/south-east 6` | 0 | 0 | -2 | 8, 0 | 8 | 9 | 171 |
| run_SE_7 | `art/clean/kindled-clay-sheathed/run/south-east 7` | 0 | 0 | -2 | 8, 0 | 34 | 9 | 174 |
| run_E_0 | `art/clean/kindled-clay-sheathed/run/east 0` | 0 | 0 | -2 | 8, 0 | 8 | 8 | 120 |
| run_E_1 | `art/clean/kindled-clay-sheathed/run/east 1` | 0 | 0 | -2 | 8, 0 | 7 | 8 | 128 |
| run_E_2 | `art/clean/kindled-clay-sheathed/run/east 2` | 0 | 0 | -2 | 8, 0 | 8 | 8 | 116 |
| run_E_3 | `art/clean/kindled-clay-sheathed/run/east 3` | 0 | 0 | -2 | 8, 0 | 10 | 9 | 113 |
| run_E_4 | `art/clean/kindled-clay-sheathed/run/east 4` | 0 | 0 | -2 | 8, 0 | 4 | 9 | 121 |
| run_E_5 | `art/clean/kindled-clay-sheathed/run/east 5` | 0 | 0 | -2 | 8, 0 | 12 | 9 | 139 |
| run_E_6 | `art/clean/kindled-clay-sheathed/run/east 6` | 0 | 0 | -2 | 8, 0 | 7 | 9 | 118 |
| run_E_7 | `art/clean/kindled-clay-sheathed/run/east 7` | 0 | 0 | -2 | 8, 0 | 9 | 9 | 112 |
| run_NE_0 | `art/clean/kindled-clay-sheathed/run/north-east 0` | 0 | 0 | -3 | 8, -1 | 9 | 9 | 42 |
| run_NE_1 | `art/clean/kindled-clay-sheathed/run/north-east 1` | 0 | 0 | -3 | 8, -1 | 7 | 9 | 52 |
| run_NE_2 | `art/clean/kindled-clay-sheathed/run/north-east 2` | 0 | 0 | -3 | 8, -1 | 13 | 9 | 44 |
| run_NE_3 | `art/clean/kindled-clay-sheathed/run/north-east 3` | 0 | 0 | -3 | 8, -1 | 7 | 9 | 39 |
| run_NE_4 | `art/clean/kindled-clay-sheathed/run/north-east 4` | 0 | 0 | -3 | 8, -1 | 14 | 8 | 61 |
| run_NE_5 | `art/clean/kindled-clay-sheathed/run/north-east 5` | 0 | 0 | -3 | 8, -1 | 25 | 8 | 63 |
| run_NE_6 | `art/clean/kindled-clay-sheathed/run/north-east 6` | 0 | 0 | -3 | 8, -1 | 13 | 9 | 56 |
| run_NE_7 | `art/clean/kindled-clay-sheathed/run/north-east 7` | 0 | 0 | -3 | 8, -1 | 10 | 9 | 31 |
| run_N_0 | `art/clean/kindled-clay-sheathed/run/north 0` | 0 | 0 | -1 | 8, 1 | 8 | 8 | 24 |
| run_N_1 | `art/clean/kindled-clay-sheathed/run/north 1` | 0 | 0 | -1 | 8, 1 | 10 | 8 | 44 |
| run_N_2 | `art/clean/kindled-clay-sheathed/run/north 2` | 0 | 0 | -1 | 8, 1 | 16 | 8 | 52 |
| run_N_3 | `art/clean/kindled-clay-sheathed/run/north 3` | 0 | 0 | -1 | 8, 1 | 9 | 8 | 42 |
| run_N_4 | `art/clean/kindled-clay-sheathed/run/north 4` | 0 | 0 | -1 | 8, 1 | 9 | 8 | 32 |
| run_N_5 | `art/clean/kindled-clay-sheathed/run/north 5` | 0 | 0 | -1 | 8, 1 | 16 | 8 | 46 |
| run_N_6 | `art/clean/kindled-clay-sheathed/run/north 6` | 0 | 0 | -1 | 8, 1 | 9 | 8 | 37 |
| run_N_7 | `art/clean/kindled-clay-sheathed/run/north 7` | 0 | 0 | -1 | 8, 1 | 9 | 8 | 52 |
| run_NW_0 | `art/clean/kindled-clay-sheathed/run/north-west 0` | 0 | 0 | -2 | 8, 0 | 9 | 9 | 50 |
| run_NW_1 | `art/clean/kindled-clay-sheathed/run/north-west 1` | 0 | 0 | -2 | 8, 0 | 30 | 9 | 51 |
| run_NW_2 | `art/clean/kindled-clay-sheathed/run/north-west 2` | 0 | 0 | -2 | 8, 0 | 14 | 9 | 49 |
| run_NW_3 | `art/clean/kindled-clay-sheathed/run/north-west 3` | 0 | 0 | -2 | 8, 0 | 13 | 8 | 27 |
| run_NW_4 | `art/clean/kindled-clay-sheathed/run/north-west 4` | 0 | 0 | -2 | 8, 0 | 16 | 8 | 62 |
| run_NW_5 | `art/clean/kindled-clay-sheathed/run/north-west 5` | 0 | 0 | -2 | 8, 0 | 17 | 8 | 62 |
| run_NW_6 | `art/clean/kindled-clay-sheathed/run/north-west 6` | 0 | 0 | -2 | 8, 0 | 11 | 8 | 31 |
| run_NW_7 | `art/clean/kindled-clay-sheathed/run/north-west 7` | 0 | 0 | -2 | 8, 0 | 7 | 8 | 44 |
| run_W_0 | `art/clean/kindled-clay-sheathed/run/west 0` | 0 | 0 | -1 | 8, 1 | 11 | 8 | 123 |
| run_W_1 | `art/clean/kindled-clay-sheathed/run/west 1` | 0 | 0 | -1 | 8, 1 | 12 | 8 | 132 |
| run_W_2 | `art/clean/kindled-clay-sheathed/run/west 2` | 0 | 0 | -1 | 8, 1 | 12 | 9 | 96 |
| run_W_3 | `art/clean/kindled-clay-sheathed/run/west 3` | 0 | 0 | -1 | 8, 1 | 10 | 8 | 112 |
| run_W_4 | `art/clean/kindled-clay-sheathed/run/west 4` | 0 | 0 | -1 | 8, 1 | 18 | 8 | 117 |
| run_W_5 | `art/clean/kindled-clay-sheathed/run/west 5` | 0 | 0 | -1 | 8, 1 | 9 | 9 | 104 |
| run_W_6 | `art/clean/kindled-clay-sheathed/run/west 6` | 0 | 0 | -1 | 8, 1 | 14 | 9 | 108 |
| run_W_7 | `art/clean/kindled-clay-sheathed/run/west 7` | 0 | 0 | -1 | 8, 1 | 15 | 9 | 117 |
| run_SW_0 | `art/clean/kindled-clay-sheathed/run/south-west 0` | 0 | 0 | -2 | 8, 0 | 11 | 9 | 134 |
| run_SW_1 | `art/clean/kindled-clay-sheathed/run/south-west 1` | 0 | 0 | -2 | 8, 0 | 7 | 9 | 113 |
| run_SW_2 | `art/clean/kindled-clay-sheathed/run/south-west 2` | 0 | 0 | -2 | 8, 0 | 2 | 9 | 131 |
| run_SW_3 | `art/clean/kindled-clay-sheathed/run/south-west 3` | 0 | 0 | -2 | 8, 0 | 9 | 9 | 155 |
| run_SW_4 | `art/clean/kindled-clay-sheathed/run/south-west 4` | 0 | 0 | -2 | 8, 0 | 8 | 9 | 113 |
| run_SW_5 | `art/clean/kindled-clay-sheathed/run/south-west 5` | 0 | 0 | -2 | 8, 0 | 3 | 9 | 131 |
| run_SW_6 | `art/clean/kindled-clay-sheathed/run/south-west 6` | 0 | 0 | -2 | 8, 0 | 12 | 9 | 145 |
| run_SW_7 | `art/clean/kindled-clay-sheathed/run/south-west 7` | 0 | 0 | -2 | 8, 0 | 17 | 9 | 148 |
| run_start_S_0 | `art/clean/kindled-clay-sheathed/run_start/south 0` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 192 |
| run_start_S_1 | `art/clean/kindled-clay-sheathed/run_start/south 1` | 0 | 0 | -2 | 8, 0 | 8 | 9 | 166 |
| run_start_SE_0 | `art/clean/kindled-clay-sheathed/run_start/south-east 0` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 156 |
| run_start_SE_1 | `art/clean/kindled-clay-sheathed/run_start/south-east 1` | 0 | 0 | -2 | 8, 0 | 34 | 9 | 174 |
| run_start_E_0 | `art/clean/kindled-clay-sheathed/run_start/east 0` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 104 |
| run_start_E_1 | `art/clean/kindled-clay-sheathed/run_start/east 1` | 0 | 0 | -2 | 8, 0 | 9 | 9 | 112 |
| run_start_NE_0 | `art/clean/kindled-clay-sheathed/run_start/north-east 0` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 55 |
| run_start_NE_1 | `art/clean/kindled-clay-sheathed/run_start/north-east 1` | 0 | 0 | -3 | 8, -1 | 10 | 9 | 31 |
| run_start_N_0 | `art/clean/kindled-clay-sheathed/run_start/north 0` | 0 | 0 | -2 | 8, 0 | 0 | 8 | 44 |
| run_start_N_1 | `art/clean/kindled-clay-sheathed/run_start/north 1` | 0 | 0 | -2 | 8, 0 | 9 | 8 | 52 |
| run_start_NW_0 | `art/clean/kindled-clay-sheathed/run_start/north-west 0` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 47 |
| run_start_NW_1 | `art/clean/kindled-clay-sheathed/run_start/north-west 1` | 0 | 0 | -2 | 8, 0 | 7 | 8 | 44 |
| run_start_W_0 | `art/clean/kindled-clay-sheathed/run_start/west 0` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 104 |
| run_start_W_1 | `art/clean/kindled-clay-sheathed/run_start/west 1` | 0 | 0 | -1 | 8, 1 | 15 | 9 | 117 |
| run_start_SW_0 | `art/clean/kindled-clay-sheathed/run_start/south-west 0` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 156 |
| run_start_SW_1 | `art/clean/kindled-clay-sheathed/run_start/south-west 1` | 0 | 0 | -2 | 8, 0 | 17 | 9 | 148 |
| run_stop_S_0 | `art/clean/kindled-clay-sheathed/run_stop/south 0` | 0 | 0 | -2 | 8, 0 | 3 | 9 | 165 |
| run_stop_S_1 | `art/clean/kindled-clay-sheathed/run_stop/south 1` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 192 |
| run_stop_SE_0 | `art/clean/kindled-clay-sheathed/run_stop/south-east 0` | 0 | 0 | -2 | 8, 0 | 13 | 9 | 163 |
| run_stop_SE_1 | `art/clean/kindled-clay-sheathed/run_stop/south-east 1` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 156 |
| run_stop_E_0 | `art/clean/kindled-clay-sheathed/run_stop/east 0` | 0 | 0 | -2 | 8, 0 | 8 | 8 | 120 |
| run_stop_E_1 | `art/clean/kindled-clay-sheathed/run_stop/east 1` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 104 |
| run_stop_NE_0 | `art/clean/kindled-clay-sheathed/run_stop/north-east 0` | 0 | 0 | -3 | 8, -1 | 9 | 9 | 42 |
| run_stop_NE_1 | `art/clean/kindled-clay-sheathed/run_stop/north-east 1` | 0 | 0 | -3 | 8, -1 | 0 | 9 | 55 |
| run_stop_N_0 | `art/clean/kindled-clay-sheathed/run_stop/north 0` | 0 | 0 | -2 | 8, 0 | 8 | 8 | 24 |
| run_stop_N_1 | `art/clean/kindled-clay-sheathed/run_stop/north 1` | 0 | 0 | -2 | 8, 0 | 0 | 8 | 44 |
| run_stop_NW_0 | `art/clean/kindled-clay-sheathed/run_stop/north-west 0` | 0 | 0 | -2 | 8, 0 | 9 | 9 | 50 |
| run_stop_NW_1 | `art/clean/kindled-clay-sheathed/run_stop/north-west 1` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 47 |
| run_stop_W_0 | `art/clean/kindled-clay-sheathed/run_stop/west 0` | 0 | 0 | -1 | 8, 1 | 11 | 8 | 123 |
| run_stop_W_1 | `art/clean/kindled-clay-sheathed/run_stop/west 1` | 0 | 0 | -1 | 8, 1 | 0 | 9 | 104 |
| run_stop_SW_0 | `art/clean/kindled-clay-sheathed/run_stop/south-west 0` | 0 | 0 | -2 | 8, 0 | 11 | 9 | 134 |
| run_stop_SW_1 | `art/clean/kindled-clay-sheathed/run_stop/south-west 1` | 0 | 0 | -2 | 8, 0 | 0 | 9 | 156 |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

