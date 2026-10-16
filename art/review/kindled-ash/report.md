# kindled-ash (draft)

Built by `pnpm art:build kindled-ash` from `art/sheets/kindled-ash.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind kindled, outline player, cell 112×80, origin (56, 64). A draft writes this review only, never `packages/shared/assets`.

## Summary

- Frames: 305.
- Off-palette pixels snapped: 16651 (largest ΔE 11.94).
- Outline gaps (edge pixels not in an outline colour): 1450.
- Masked skin pixels: 24312.
- Loop seam flags (last → first above 1.5× the mean change): walk_S.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: idle_S_1, idle_SE_0, idle_SE_1, idle_E_0, idle_E_1, idle_W_0, idle_W_1, idle_SW_0, idle_SW_1, walk_S_2, walk_SE_0, walk_SE_1, walk_SE_2, walk_SE_3, walk_SE_4, walk_SE_5, walk_E_0, walk_E_1, walk_E_2, walk_E_3, walk_E_4, walk_E_5, walk_W_0, walk_W_1, walk_W_2, walk_W_3, walk_W_4, walk_W_5, walk_SW_0, walk_SW_1, walk_SW_2, walk_SW_3, walk_SW_4, walk_SW_5, dodge_S_0, dodge_S_1, dodge_S_2, dodge_S_3, dodge_SE_0, dodge_SE_1, dodge_SE_2, dodge_SE_3, dodge_E_0, dodge_E_1, dodge_E_2, dodge_E_3, dodge_NE_0, dodge_N_2, dodge_NW_0, dodge_NW_1, dodge_NW_2, dodge_NW_3, dodge_W_1, dodge_W_2, dodge_W_3, dodge_SW_0, dodge_SW_1, dodge_SW_2, dodge_SW_3, light_1_S_0, light_1_S_1, light_1_S_2, light_1_SE_0, light_1_SE_1, light_1_SE_2, light_1_E_0, light_1_E_1, light_1_E_2, light_1_NE_0, light_1_W_0, light_1_W_1, light_1_W_2, light_1_SW_0, light_1_SW_1, light_1_SW_2, light_2_S_0, light_2_S_1, light_2_S_2, light_2_SE_0, light_2_SE_1, light_2_SE_2, light_2_E_0, light_2_E_1, light_2_E_2, light_2_NE_1, light_2_NW_0, light_2_NW_1, light_2_NW_2, light_2_W_0, light_2_W_1, light_2_W_2, light_2_SW_0, light_2_SW_1, light_3_S_0, light_3_S_1, light_3_S_2, light_3_SE_0, light_3_SE_1, light_3_SE_2, light_3_E_0, light_3_E_1, light_3_E_2, light_3_W_0, light_3_W_1, light_3_W_2, light_3_SW_0, light_3_SW_1, light_3_SW_2, heavy_charge_S_0, heavy_charge_S_1, heavy_charge_S_2, heavy_charge_SE_0, heavy_charge_SE_1, heavy_charge_SE_2, heavy_charge_E_0, heavy_charge_E_1, heavy_charge_E_2, heavy_charge_NE_0, heavy_charge_NE_1, heavy_charge_NE_2, heavy_charge_W_0, heavy_charge_W_1, heavy_charge_SW_0, heavy_charge_SW_1, heavy_charge_SW_2, heavy_thrust_S_0, heavy_thrust_S_1, heavy_thrust_SE_0, heavy_thrust_SE_1, heavy_thrust_E_1, heavy_thrust_NE_0, heavy_thrust_NE_1, heavy_thrust_W_1, heavy_thrust_SW_0, heavy_thrust_SW_1, heavy_hold_S_0, heavy_hold_SE_0, heavy_hold_E_0, heavy_hold_NE_0, heavy_hold_W_0, heavy_hold_SW_0, heavy_recover_S_0, heavy_recover_S_1, heavy_recover_SE_0, heavy_recover_SE_1, heavy_recover_E_0, heavy_recover_E_1, heavy_recover_NE_0, heavy_recover_W_0, heavy_recover_W_1, heavy_recover_SW_0, heavy_recover_SW_1, haul_throw_S_0, haul_throw_S_1, haul_throw_SE_0, haul_throw_SE_1, haul_throw_E_0, haul_throw_E_1, haul_throw_NE_0, haul_throw_NE_1, haul_throw_W_1, haul_throw_SW_0, haul_throw_SW_1, haul_recover_S_0, haul_recover_S_1, haul_recover_SE_0, haul_recover_SE_1, haul_recover_E_0, haul_recover_E_1, haul_recover_NE_0, haul_recover_W_0, haul_recover_W_1, haul_recover_SW_0, haul_recover_SW_1, haul_pull_S_0, haul_pull_S_1, haul_pull_SE_0, haul_pull_SE_1, haul_pull_E_0, haul_pull_E_1, haul_pull_NE_0, haul_pull_NE_1, haul_pull_NW_1, haul_pull_W_0, haul_pull_W_1, haul_pull_SW_0, haul_pull_SW_1, haul_slide_S_0, haul_slide_S_1, haul_slide_SE_0, haul_slide_SE_1, haul_slide_E_0, haul_slide_E_1, haul_slide_NE_0, haul_slide_NE_1, haul_slide_W_0, haul_slide_W_1, haul_slide_SW_0, haul_slide_SW_1, hit_S_0, hit_S_1, hit_E_1, death_E_0, death_E_2, death_W_2.
- Skin regions to resolve: 678 (reported because this is a draft; a finished sheet fails on them).
- Missing against the contract's table: dodge_N: 3 of 4 frames, light_1_N: 2 of 3 frames, light_2 N, light_2_SW: 2 of 3 frames, light_3 NE, light_3_NW: 2 of 3 frames, heavy_charge NW, heavy_thrust N NW, heavy_hold N NW, heavy_recover N NW, carry_idle (all facings), carry_walk (all facings), sit (all facings).
- Optional (after M1: a finished sheet may leave them out, but carries every facing of any it has): carry_idle (M2), carry_walk (M2), sit (M2).

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row. `tones.png` has the same rows in the four clay tones, through the mask: clay-grey-ochre, clay-pale, clay-red, clay-river-dark.

Rows, top to bottom: idle_S, idle_SE, idle_E, idle_NE, idle_N, idle_NW, idle_W, idle_SW, walk_S, walk_SE, walk_E, walk_NE, walk_N, walk_NW, walk_W, walk_SW, dodge_S, dodge_SE, dodge_E, dodge_NE, dodge_N, dodge_NW, dodge_W, dodge_SW, light_1_S, light_1_SE, light_1_E, light_1_NE, light_1_N, light_1_NW, light_1_W, light_1_SW, light_2_S, light_2_SE, light_2_E, light_2_NE, light_2_NW, light_2_W, light_2_SW, light_3_S, light_3_SE, light_3_E, light_3_N, light_3_NW, light_3_W, light_3_SW, heavy_charge_S, heavy_charge_SE, heavy_charge_E, heavy_charge_NE, heavy_charge_N, heavy_charge_W, heavy_charge_SW, heavy_thrust_S, heavy_thrust_SE, heavy_thrust_E, heavy_thrust_NE, heavy_thrust_W, heavy_thrust_SW, heavy_hold_S, heavy_hold_SE, heavy_hold_E, heavy_hold_NE, heavy_hold_W, heavy_hold_SW, heavy_recover_S, heavy_recover_SE, heavy_recover_E, heavy_recover_NE, heavy_recover_W, heavy_recover_SW, haul_throw_S, haul_throw_SE, haul_throw_E, haul_throw_NE, haul_throw_N, haul_throw_NW, haul_throw_W, haul_throw_SW, haul_recover_S, haul_recover_SE, haul_recover_E, haul_recover_NE, haul_recover_N, haul_recover_NW, haul_recover_W, haul_recover_SW, haul_pull_S, haul_pull_SE, haul_pull_E, haul_pull_NE, haul_pull_N, haul_pull_NW, haul_pull_W, haul_pull_SW, haul_slide_S, haul_slide_SE, haul_slide_E, haul_slide_NE, haul_slide_N, haul_slide_NW, haul_slide_W, haul_slide_SW, hit_S, hit_E, hit_N, hit_W, death_S, death_E, death_N, death_W.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle_S | 2 | 277 / 277 | 45 46 (range 1) |  |
| idle_SE | 2 | 341 / 341 | 44 45 (range 1) |  |
| idle_E | 2 | 492 / 492 | 45 45 (range 0) |  |
| idle_NE | 2 | 360 / 360 | 45 45 (range 0) |  |
| idle_N | 2 | 91 / 91 | 45 45 (range 0) |  |
| idle_NW | 2 | 196 / 196 | 45 45 (range 0) |  |
| idle_W | 2 | 422 / 422 | 45 45 (range 0) |  |
| idle_SW | 2 | 396 / 396 | 44 45 (range 1) |  |
| walk_S | 6 | 640 / 383.8 **flag** | 44 45 45 44 45 45 (range 1) |  |
| walk_SE | 6 | 364 / 343.6 | 45 45 45 45 45 45 (range 0) |  |
| walk_E | 6 | 178 / 336.8 | 45 45 45 45 45 45 (range 0) |  |
| walk_NE | 6 | 216 / 366 | 45 47 46 45 46 45 (range 2) |  |
| walk_N | 6 | 169 / 244.2 | 45 46 46 45 46 45 (range 1) |  |
| walk_NW | 6 | 116 / 232.4 | 45 45 45 45 46 45 (range 1) |  |
| walk_W | 6 | 283 / 364 | 45 44 45 45 45 45 (range 1) |  |
| walk_SW | 6 | 115 / 217 | 45 45 45 45 45 45 (range 0) |  |
| dodge_S | 4 |  |  |  |
| dodge_SE | 4 |  |  |  |
| dodge_E | 4 |  |  |  |
| dodge_NE | 4 |  |  |  |
| dodge_N | 3 |  |  |  |
| dodge_NW | 4 |  |  |  |
| dodge_W | 4 |  |  |  |
| dodge_SW | 4 |  |  |  |
| light_1_S | 3 |  |  |  |
| light_1_SE | 3 |  |  |  |
| light_1_E | 3 |  |  |  |
| light_1_NE | 3 |  |  |  |
| light_1_N | 2 |  |  |  |
| light_1_NW | 3 |  |  |  |
| light_1_W | 3 |  |  |  |
| light_1_SW | 3 |  |  |  |
| light_2_S | 3 |  |  |  |
| light_2_SE | 3 |  |  |  |
| light_2_E | 3 |  |  |  |
| light_2_NE | 3 |  |  |  |
| light_2_NW | 3 |  |  |  |
| light_2_W | 3 |  |  |  |
| light_2_SW | 2 |  |  |  |
| light_3_S | 3 |  |  |  |
| light_3_SE | 3 |  |  |  |
| light_3_E | 3 |  |  |  |
| light_3_N | 3 |  |  |  |
| light_3_NW | 2 |  |  |  |
| light_3_W | 3 |  |  |  |
| light_3_SW | 3 |  |  |  |
| heavy_charge_S | 3 |  |  |  |
| heavy_charge_SE | 3 |  |  |  |
| heavy_charge_E | 3 |  |  |  |
| heavy_charge_NE | 3 |  |  |  |
| heavy_charge_N | 3 |  |  |  |
| heavy_charge_W | 3 |  |  |  |
| heavy_charge_SW | 3 |  |  |  |
| heavy_thrust_S | 2 |  |  |  |
| heavy_thrust_SE | 2 |  |  |  |
| heavy_thrust_E | 2 |  |  |  |
| heavy_thrust_NE | 2 |  |  |  |
| heavy_thrust_W | 2 |  |  |  |
| heavy_thrust_SW | 2 |  |  |  |
| heavy_hold_S | 1 |  |  |  |
| heavy_hold_SE | 1 |  |  |  |
| heavy_hold_E | 1 |  |  |  |
| heavy_hold_NE | 1 |  |  |  |
| heavy_hold_W | 1 |  |  |  |
| heavy_hold_SW | 1 |  |  |  |
| heavy_recover_S | 2 |  |  |  |
| heavy_recover_SE | 2 |  |  |  |
| heavy_recover_E | 2 |  |  |  |
| heavy_recover_NE | 2 |  |  |  |
| heavy_recover_W | 2 |  |  |  |
| heavy_recover_SW | 2 |  |  |  |
| haul_throw_S | 2 |  |  |  |
| haul_throw_SE | 2 |  |  |  |
| haul_throw_E | 2 |  |  |  |
| haul_throw_NE | 2 |  |  |  |
| haul_throw_N | 2 |  |  |  |
| haul_throw_NW | 2 |  |  |  |
| haul_throw_W | 2 |  |  |  |
| haul_throw_SW | 2 |  |  |  |
| haul_recover_S | 2 |  |  |  |
| haul_recover_SE | 2 |  |  |  |
| haul_recover_E | 2 |  |  |  |
| haul_recover_NE | 2 |  |  |  |
| haul_recover_N | 2 |  |  |  |
| haul_recover_NW | 2 |  |  |  |
| haul_recover_W | 2 |  |  |  |
| haul_recover_SW | 2 |  |  |  |
| haul_pull_S | 2 | 712 / 712 |  |  |
| haul_pull_SE | 2 | 1089 / 1089 |  |  |
| haul_pull_E | 2 | 941 / 941 |  |  |
| haul_pull_NE | 2 | 872 / 872 |  |  |
| haul_pull_N | 2 | 571 / 571 |  |  |
| haul_pull_NW | 2 | 960 / 960 |  |  |
| haul_pull_W | 2 | 1129 / 1129 |  |  |
| haul_pull_SW | 2 | 808 / 808 |  |  |
| haul_slide_S | 2 | 836 / 836 |  |  |
| haul_slide_SE | 2 | 933 / 933 |  |  |
| haul_slide_E | 2 | 706 / 706 |  |  |
| haul_slide_NE | 2 | 570 / 570 |  |  |
| haul_slide_N | 2 | 599 / 599 |  |  |
| haul_slide_NW | 2 | 800 / 800 |  |  |
| haul_slide_W | 2 | 1143 / 1143 |  |  |
| haul_slide_SW | 2 | 874 / 874 |  |  |
| hit_S | 2 |  |  |  |
| hit_E | 2 |  |  |  |
| hit_N | 2 |  |  |  |
| hit_W | 2 |  |  |  |
| death_S | 6 |  |  |  |
| death_E | 6 |  |  |  |
| death_N | 6 |  |  |  |
| death_W | 6 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Masked |
|---|---|---|---|---|---|---|---|---|
| idle_S_0 | `art/raw/ss01-kindled-ash/idle/south 0` | 0 | 0 | -2 | 16, 0 | 4 | 11 | 179 |
| idle_S_1 | `art/raw/ss01-kindled-ash/idle/south 2` | 11 | 7.27 | -2 | 16, 0 | 5 | 15 **flag** | 181 |
| idle_SE_0 | `art/raw/ss01-kindled-ash/idle/south-east 0` | 81 | 6.92 | -1 | 16, 1 | 5 | 15 **flag** | 148 |
| idle_SE_1 | `art/raw/ss01-kindled-ash/idle/south-east 2` | 78 | 6.92 | -1 | 16, 1 | 2 | 15 **flag** | 149 |
| idle_E_0 | `art/raw/ss01-kindled-ash/idle/east 0` | 82 | 6.15 | -1 | 16, 1 | 18 | 14 **flag** | 69 |
| idle_E_1 | `art/raw/ss01-kindled-ash/idle/east 2` | 69 | 6.15 | -1 | 16, 1 | 10 | 14 **flag** | 77 |
| idle_NE_0 | `art/raw/ss01-kindled-ash/idle/north-east 0` | 15 | 6.15 | -1 | 16, 1 | 3 | 11 | 13 |
| idle_NE_1 | `art/raw/ss01-kindled-ash/idle/north-east 2` | 15 | 6.15 | -1 | 16, 1 | 1 | 11 | 13 |
| idle_N_0 | `art/raw/ss01-kindled-ash/idle/north 0` | 0 | 0 | -1 | 16, 1 | 6 | 4 | 0 |
| idle_N_1 | `art/raw/ss01-kindled-ash/idle/north 2` | 0 | 0 | -1 | 16, 1 | 3 | 4 | 0 |
| idle_NW_0 | `art/raw/ss01-kindled-ash/idle/north-west 0` | 38 | 5.53 | -1 | 16, 1 | 0 | 8 | 13 |
| idle_NW_1 | `art/raw/ss01-kindled-ash/idle/north-west 2` | 28 | 5.53 | -1 | 16, 1 | 0 | 9 | 13 |
| idle_W_0 | `art/raw/ss01-kindled-ash/idle/west 0` | 82 | 6.89 | -1 | 16, 1 | 34 | 14 **flag** | 69 |
| idle_W_1 | `art/raw/ss01-kindled-ash/idle/west 2` | 63 | 6.89 | -1 | 16, 1 | 11 | 14 **flag** | 69 |
| idle_SW_0 | `art/raw/ss01-kindled-ash/idle/south-west 0` | 83 | 6.92 | -1 | 16, 1 | 4 | 17 **flag** | 149 |
| idle_SW_1 | `art/raw/ss01-kindled-ash/idle/south-west 2` | 72 | 6.92 | -1 | 16, 1 | 5 | 16 **flag** | 142 |
| walk_S_0 | `art/raw/ss01-kindled-ash/walk/south 0` | 0 | 0 | 0 | 16, 2 | 9 | 12 | 175 |
| walk_S_1 | `art/raw/ss01-kindled-ash/walk/south 1` | 0 | 0 | -1 | 16, 1 | 4 | 12 | 175 |
| walk_S_2 | `art/raw/ss01-kindled-ash/walk/south 2` | 13 | 6.81 | -1 | 16, 1 | 5 | 16 **flag** | 170 |
| walk_S_3 | `art/raw/ss01-kindled-ash/walk/south 3` | 0 | 0 | 0 | 16, 2 | 1 | 12 | 172 |
| walk_S_4 | `art/raw/ss01-kindled-ash/walk/south 4` | 0 | 0 | -1 | 16, 1 | 2 | 12 | 172 |
| walk_S_5 | `art/raw/ss01-kindled-ash/walk/south 5` | 0 | 0 | -1 | 16, 1 | 7 | 11 | 177 |
| walk_SE_0 | `art/raw/ss01-kindled-ash/walk/south-east 0` | 95 | 6.92 | -1 | 16, 1 | 2 | 16 **flag** | 151 |
| walk_SE_1 | `art/raw/ss01-kindled-ash/walk/south-east 1` | 92 | 6.92 | -1 | 16, 1 | 1 | 15 **flag** | 140 |
| walk_SE_2 | `art/raw/ss01-kindled-ash/walk/south-east 2` | 82 | 6.92 | -1 | 16, 1 | 1 | 15 **flag** | 143 |
| walk_SE_3 | `art/raw/ss01-kindled-ash/walk/south-east 3` | 42 | 6.92 | -1 | 16, 1 | 1 | 15 **flag** | 151 |
| walk_SE_4 | `art/raw/ss01-kindled-ash/walk/south-east 4` | 102 | 6.92 | -1 | 16, 1 | 0 | 14 **flag** | 154 |
| walk_SE_5 | `art/raw/ss01-kindled-ash/walk/south-east 5` | 119 | 6.92 | -1 | 16, 1 | 10 | 14 **flag** | 155 |
| walk_E_0 | `art/raw/ss01-kindled-ash/walk/east 0` | 27 | 6.15 | -1 | 16, 1 | 10 | 14 **flag** | 78 |
| walk_E_1 | `art/raw/ss01-kindled-ash/walk/east 1` | 67 | 6.15 | -1 | 16, 1 | 18 | 13 **flag** | 86 |
| walk_E_2 | `art/raw/ss01-kindled-ash/walk/east 2` | 56 | 6.15 | -1 | 16, 1 | 15 | 14 **flag** | 81 |
| walk_E_3 | `art/raw/ss01-kindled-ash/walk/east 3` | 19 | 6.15 | -1 | 16, 1 | 0 | 14 **flag** | 79 |
| walk_E_4 | `art/raw/ss01-kindled-ash/walk/east 4` | 39 | 6.15 | -1 | 16, 1 | 14 | 14 **flag** | 79 |
| walk_E_5 | `art/raw/ss01-kindled-ash/walk/east 5` | 42 | 6.15 | -1 | 16, 1 | 24 | 13 **flag** | 78 |
| walk_NE_0 | `art/raw/ss01-kindled-ash/walk/north-east 0` | 24 | 6.15 | -1 | 16, 1 | 8 | 12 | 11 |
| walk_NE_1 | `art/raw/ss01-kindled-ash/walk/north-east 1` | 33 | 6.15 | -3 | 16, -1 | 9 | 12 | 12 |
| walk_NE_2 | `art/raw/ss01-kindled-ash/walk/north-east 2` | 29 | 6.15 | -2 | 16, 0 | 5 | 12 | 10 |
| walk_NE_3 | `art/raw/ss01-kindled-ash/walk/north-east 3` | 11 | 6.15 | -1 | 16, 1 | 0 | 11 | 12 |
| walk_NE_4 | `art/raw/ss01-kindled-ash/walk/north-east 4` | 36 | 6.15 | -1 | 16, 1 | 1 | 12 | 11 |
| walk_NE_5 | `art/raw/ss01-kindled-ash/walk/north-east 5` | 28 | 6.15 | -1 | 16, 1 | 6 | 12 | 11 |
| walk_N_0 | `art/raw/ss01-kindled-ash/walk/north 0` | 0 | 0 | -1 | 16, 1 | 0 | 4 | 0 |
| walk_N_1 | `art/raw/ss01-kindled-ash/walk/north 1` | 0 | 0 | -2 | 16, 0 | 0 | 4 | 0 |
| walk_N_2 | `art/raw/ss01-kindled-ash/walk/north 2` | 0 | 0 | -2 | 16, 0 | 0 | 4 | 0 |
| walk_N_3 | `art/raw/ss01-kindled-ash/walk/north 3` | 0 | 0 | -1 | 16, 1 | 0 | 4 | 0 |
| walk_N_4 | `art/raw/ss01-kindled-ash/walk/north 4` | 0 | 0 | -2 | 16, 0 | 3 | 4 | 0 |
| walk_N_5 | `art/raw/ss01-kindled-ash/walk/north 5` | 0 | 0 | -1 | 16, 1 | 2 | 4 | 0 |
| walk_NW_0 | `art/raw/ss01-kindled-ash/walk/north-west 0` | 22 | 5.53 | -1 | 16, 1 | 0 | 9 | 8 |
| walk_NW_1 | `art/raw/ss01-kindled-ash/walk/north-west 1` | 44 | 5.53 | -1 | 16, 1 | 3 | 9 | 4 |
| walk_NW_2 | `art/raw/ss01-kindled-ash/walk/north-west 2` | 40 | 5.53 | -1 | 16, 1 | 3 | 9 | 6 |
| walk_NW_3 | `art/raw/ss01-kindled-ash/walk/north-west 3` | 24 | 5.53 | -1 | 16, 1 | 0 | 9 | 12 |
| walk_NW_4 | `art/raw/ss01-kindled-ash/walk/north-west 4` | 33 | 5.53 | -2 | 16, 0 | 0 | 9 | 8 |
| walk_NW_5 | `art/raw/ss01-kindled-ash/walk/north-west 5` | 34 | 5.53 | -1 | 16, 1 | 1 | 9 | 9 |
| walk_W_0 | `art/raw/ss01-kindled-ash/walk/west 0` | 22 | 6.89 | -1 | 16, 1 | 1 | 14 **flag** | 69 |
| walk_W_1 | `art/raw/ss01-kindled-ash/walk/west 1` | 56 | 6.89 | 0 | 16, 2 | 6 | 13 **flag** | 68 |
| walk_W_2 | `art/raw/ss01-kindled-ash/walk/west 2` | 70 | 6.89 | -1 | 16, 1 | 12 | 15 **flag** | 70 |
| walk_W_3 | `art/raw/ss01-kindled-ash/walk/west 3` | 20 | 6.89 | -1 | 16, 1 | 1 | 15 **flag** | 69 |
| walk_W_4 | `art/raw/ss01-kindled-ash/walk/west 4` | 59 | 6.89 | -1 | 16, 1 | 10 | 14 **flag** | 67 |
| walk_W_5 | `art/raw/ss01-kindled-ash/walk/west 5` | 71 | 6.89 | -1 | 16, 1 | 9 | 14 **flag** | 68 |
| walk_SW_0 | `art/raw/ss01-kindled-ash/walk/south-west 0` | 50 | 6.92 | -1 | 16, 1 | 3 | 17 **flag** | 143 |
| walk_SW_1 | `art/raw/ss01-kindled-ash/walk/south-west 1` | 53 | 6.92 | -1 | 16, 1 | 4 | 17 **flag** | 139 |
| walk_SW_2 | `art/raw/ss01-kindled-ash/walk/south-west 2` | 57 | 6.92 | -1 | 16, 1 | 10 | 17 **flag** | 142 |
| walk_SW_3 | `art/raw/ss01-kindled-ash/walk/south-west 3` | 49 | 6.92 | -1 | 16, 1 | 1 | 17 **flag** | 145 |
| walk_SW_4 | `art/raw/ss01-kindled-ash/walk/south-west 4` | 52 | 6.92 | -1 | 16, 1 | 3 | 14 **flag** | 129 |
| walk_SW_5 | `art/raw/ss01-kindled-ash/walk/south-west 5` | 60 | 6.92 | -1 | 16, 1 | 3 | 16 **flag** | 140 |
| dodge_S_0 | `art/raw/ss01-kindled-ash/dodge/south 3` | 116 | 7.82 | 0 | 22, 8 | 1 | 15 **flag** | 172 |
| dodge_S_1 | `art/raw/ss01-kindled-ash/dodge/south 4` | 62 | 6.93 | 0 | 22, 8 | 1 | 17 **flag** | 97 |
| dodge_S_2 | `art/raw/ss01-kindled-ash/dodge/south 6` | 92 | 6.93 | 0 | 22, 8 | 5 | 16 **flag** | 83 |
| dodge_S_3 | `art/raw/ss01-kindled-ash/dodge/south 7` | 94 | 6.93 | 0 | 22, 8 | 2 | 16 **flag** | 124 |
| dodge_SE_0 | `art/raw/ss01-kindled-ash/dodge/south-east 2` | 84 | 7.08 | -1 | 22, 7 | 14 | 17 **flag** | 135 |
| dodge_SE_1 | `art/raw/ss01-kindled-ash/dodge/south-east 3` | 115 | 7.15 | -1 | 22, 7 | 6 | 17 **flag** | 90 |
| dodge_SE_2 | `art/raw/ss01-kindled-ash/dodge/south-east 6` | 82 | 6.92 | -1 | 22, 7 | 2 | 18 **flag** | 100 |
| dodge_SE_3 | `art/raw/ss01-kindled-ash/dodge/south-east 7` | 88 | 7.5 | -1 | 22, 7 | 7 | 17 **flag** | 131 |
| dodge_E_0 | `art/raw/ss01-kindled-ash/dodge/east 3` | 121 | 9.84 | -1 | 22, 7 | 3 | 17 **flag** | 86 |
| dodge_E_1 | `art/raw/ss01-kindled-ash/dodge/east 4` | 55 | 6.15 | -1 | 22, 7 | 0 | 14 **flag** | 98 |
| dodge_E_2 | `art/raw/ss01-kindled-ash/dodge/east 5` | 82 | 7.74 | -1 | 22, 7 | 1 | 15 **flag** | 89 |
| dodge_E_3 | `art/raw/ss01-kindled-ash/dodge/east 7` | 81 | 8.35 | -1 | 22, 7 | 0 | 15 **flag** | 74 |
| dodge_NE_0 | `art/raw/ss01-kindled-ash/dodge-take1/north-east 3` | 36 | 6.15 | -1 | 22, 7 | 1 | 15 **flag** | 18 |
| dodge_NE_1 | `art/raw/ss01-kindled-ash/dodge-take1/north-east 4` | 25 | 6.15 | -1 | 22, 7 | 1 | 12 | 17 |
| dodge_NE_2 | `art/raw/ss01-kindled-ash/dodge-take1/north-east 6` | 17 | 6.15 | -1 | 22, 7 | 2 | 12 | 21 |
| dodge_NE_3 | `art/raw/ss01-kindled-ash/dodge-take1/north-east 7` | 20 | 6.15 | -1 | 22, 7 | 1 | 12 | 5 |
| dodge_N_0 | `art/raw/ss01-kindled-ash/dodge-take1/north 1` | 10 | 4.93 | -1 | 22, 7 | 0 | 6 | 0 |
| dodge_N_1 | `art/raw/ss01-kindled-ash/dodge-take1/north 4` | 26 | 11.13 | -1 | 22, 7 | 13 | 9 | 1 |
| dodge_N_2 | `art/raw/ss01-kindled-ash/dodge-take1/north 6` | 42 | 10.92 | -1 | 22, 7 | 14 | 14 **flag** | 1 |
| dodge_NW_0 | `art/raw/ss01-kindled-ash/dodge/north-west 2` | 32 | 7.12 | -1 | 22, 7 | 0 | 13 **flag** | 15 |
| dodge_NW_1 | `art/raw/ss01-kindled-ash/dodge/north-west 4` | 50 | 5.87 | -1 | 22, 7 | 1 | 13 **flag** | 17 |
| dodge_NW_2 | `art/raw/ss01-kindled-ash/dodge/north-west 6` | 87 | 7.71 | -1 | 22, 7 | 1 | 13 **flag** | 21 |
| dodge_NW_3 | `art/raw/ss01-kindled-ash/dodge/north-west 8` | 62 | 6.77 | -1 | 22, 7 | 1 | 13 **flag** | 14 |
| dodge_W_0 | `art/raw/ss01-kindled-ash/dodge/west 4` | 42 | 6.52 | -1 | 22, 7 | 1 | 12 | 59 |
| dodge_W_1 | `art/raw/ss01-kindled-ash/dodge/west 6` | 75 | 8.04 | -1 | 22, 7 | 3 | 16 **flag** | 55 |
| dodge_W_2 | `art/raw/ss01-kindled-ash/dodge/west 7` | 94 | 8.04 | -1 | 22, 7 | 3 | 15 **flag** | 69 |
| dodge_W_3 | `art/raw/ss01-kindled-ash/dodge/west 8` | 38 | 8.04 | -1 | 22, 7 | 1 | 15 **flag** | 64 |
| dodge_SW_0 | `art/raw/ss01-kindled-ash/dodge/south-west 4` | 69 | 6.95 | -1 | 22, 7 | 3 | 18 **flag** | 118 |
| dodge_SW_1 | `art/raw/ss01-kindled-ash/dodge/south-west 5` | 78 | 6.95 | -1 | 22, 7 | 3 | 18 **flag** | 84 |
| dodge_SW_2 | `art/raw/ss01-kindled-ash/dodge/south-west 6` | 39 | 6.95 | -1 | 22, 7 | 1 | 14 **flag** | 77 |
| dodge_SW_3 | `art/raw/ss01-kindled-ash/dodge/south-west 7` | 102 | 8.44 | -1 | 22, 7 | 0 | 18 **flag** | 106 |
| light_1_S_0 | `art/raw/ss01-kindled-ash/light_1/south 1` | 50 | 7.37 | 0 | 22, 8 | 0 | 14 **flag** | 170 |
| light_1_S_1 | `art/raw/ss01-kindled-ash/light_1/south 3` | 56 | 6.41 | 0 | 22, 8 | 0 | 14 **flag** | 165 |
| light_1_S_2 | `art/raw/ss01-kindled-ash/light_1/south 6` | 52 | 6.41 | 0 | 22, 8 | 0 | 16 **flag** | 177 |
| light_1_SE_0 | `art/raw/ss01-kindled-ash/light_1/south-east 2` | 65 | 6.92 | -1 | 22, 7 | 0 | 15 **flag** | 140 |
| light_1_SE_1 | `art/raw/ss01-kindled-ash/light_1/south-east 4` | 94 | 8 | -1 | 22, 7 | 6 | 16 **flag** | 137 |
| light_1_SE_2 | `art/raw/ss01-kindled-ash/light_1/south-east 6` | 63 | 7.18 | -1 | 22, 7 | 1 | 15 **flag** | 133 |
| light_1_E_0 | `art/raw/ss01-kindled-ash/light_1/east 2` | 26 | 6.15 | -1 | 22, 7 | 1 | 17 **flag** | 76 |
| light_1_E_1 | `art/raw/ss01-kindled-ash/light_1/east 3` | 77 | 6.85 | -1 | 22, 7 | 1 | 17 **flag** | 77 |
| light_1_E_2 | `art/raw/ss01-kindled-ash/light_1/east 6` | 36 | 6.15 | -1 | 22, 7 | 3 | 17 **flag** | 79 |
| light_1_NE_0 | `art/raw/ss01-kindled-ash/light_1/north-east 1` | 37 | 6.15 | -1 | 22, 7 | 1 | 16 **flag** | 15 |
| light_1_NE_1 | `art/raw/ss01-kindled-ash/light_1/north-east 4` | 41 | 8.36 | -1 | 22, 7 | 1 | 11 | 7 |
| light_1_NE_2 | `art/raw/ss01-kindled-ash/light_1/north-east 6` | 29 | 8.36 | -1 | 22, 7 | 1 | 12 | 15 |
| light_1_N_0 | `art/raw/ss01-kindled-ash/light_1/north 5` | 15 | 6.48 | -1 | 22, 7 | 0 | 8 | 2 |
| light_1_N_1 | `art/raw/ss01-kindled-ash/light_1/north 6` | 16 | 7.59 | -1 | 22, 7 | 3 | 8 | 0 |
| light_1_NW_0 | `art/raw/ss01-kindled-ash/light_1/north-west 2` | 24 | 6.51 | -1 | 22, 7 | 1 | 9 | 8 |
| light_1_NW_1 | `art/raw/ss01-kindled-ash/light_1/north-west 4` | 86 | 6.72 | -1 | 22, 7 | 1 | 10 | 25 |
| light_1_NW_2 | `art/raw/ss01-kindled-ash/light_1/north-west 6` | 86 | 6.51 | -1 | 22, 7 | 0 | 12 | 22 |
| light_1_W_0 | `art/raw/ss01-kindled-ash/light_1/west 4` | 92 | 8.64 | -1 | 22, 7 | 1 | 17 **flag** | 108 |
| light_1_W_1 | `art/raw/ss01-kindled-ash/light_1/west 5` | 116 | 8.64 | -1 | 22, 7 | 7 | 17 **flag** | 95 |
| light_1_W_2 | `art/raw/ss01-kindled-ash/light_1/west 6` | 45 | 8.64 | -1 | 22, 7 | 0 | 16 **flag** | 66 |
| light_1_SW_0 | `art/raw/ss01-kindled-ash/light_1/south-west 2` | 71 | 6.92 | -1 | 22, 7 | 1 | 18 **flag** | 154 |
| light_1_SW_1 | `art/raw/ss01-kindled-ash/light_1/south-west 3` | 131 | 7.62 | -1 | 22, 7 | 18 | 19 **flag** | 128 |
| light_1_SW_2 | `art/raw/ss01-kindled-ash/light_1/south-west 6` | 81 | 7.72 | -1 | 22, 7 | 4 | 18 **flag** | 141 |
| light_2_S_0 | `art/raw/ss01-kindled-ash/light_2/south 2` | 38 | 6.45 | 0 | 22, 8 | 3 | 14 **flag** | 146 |
| light_2_S_1 | `art/raw/ss01-kindled-ash/light_2/south 4` | 31 | 6.45 | 0 | 22, 8 | 0 | 16 **flag** | 141 |
| light_2_S_2 | `art/raw/ss01-kindled-ash/light_2/south 6` | 36 | 6.45 | 0 | 22, 8 | 0 | 15 **flag** | 144 |
| light_2_SE_0 | `art/raw/ss01-kindled-ash/light_2/south-east 4` | 69 | 6.92 | -1 | 22, 7 | 0 | 16 **flag** | 165 |
| light_2_SE_1 | `art/raw/ss01-kindled-ash/light_2/south-east 5` | 112 | 6.92 | -1 | 22, 7 | 0 | 21 **flag** | 148 |
| light_2_SE_2 | `art/raw/ss01-kindled-ash/light_2/south-east 6` | 65 | 6.55 | -1 | 22, 7 | 3 | 17 **flag** | 140 |
| light_2_E_0 | `art/raw/ss01-kindled-ash/light_2/east 4` | 49 | 7.92 | -1 | 22, 7 | 0 | 18 **flag** | 67 |
| light_2_E_1 | `art/raw/ss01-kindled-ash/light_2/east 5` | 73 | 6.52 | -1 | 22, 7 | 4 | 18 **flag** | 67 |
| light_2_E_2 | `art/raw/ss01-kindled-ash/light_2/east 6` | 46 | 7.92 | -1 | 22, 7 | 1 | 17 **flag** | 70 |
| light_2_NE_0 | `art/raw/ss01-kindled-ash/light_2/north-east 2` | 13 | 6.71 | -1 | 22, 7 | 1 | 11 | 8 |
| light_2_NE_1 | `art/raw/ss01-kindled-ash/light_2/north-east 5` | 18 | 8.05 | -1 | 22, 7 | 4 | 13 **flag** | 5 |
| light_2_NE_2 | `art/raw/ss01-kindled-ash/light_2/north-east 6` | 19 | 6.71 | -1 | 22, 7 | 5 | 11 | 17 |
| light_2_NW_0 | `art/raw/ss01-kindled-ash/light_2/north-west 2` | 51 | 5.67 | -1 | 22, 7 | 0 | 16 **flag** | 3 |
| light_2_NW_1 | `art/raw/ss01-kindled-ash/light_2/north-west 5` | 75 | 6.32 | -1 | 22, 7 | 5 | 14 **flag** | 10 |
| light_2_NW_2 | `art/raw/ss01-kindled-ash/light_2/north-west 6` | 52 | 5.76 | -1 | 22, 7 | 5 | 13 **flag** | 15 |
| light_2_W_0 | `art/raw/ss01-kindled-ash/light_2/west 2` | 51 | 6.98 | -1 | 22, 7 | 2 | 15 **flag** | 75 |
| light_2_W_1 | `art/raw/ss01-kindled-ash/light_2/west 5` | 46 | 7.27 | -1 | 22, 7 | 2 | 16 **flag** | 53 |
| light_2_W_2 | `art/raw/ss01-kindled-ash/light_2/west 6` | 22 | 6.98 | -1 | 22, 7 | 0 | 14 **flag** | 60 |
| light_2_SW_0 | `art/raw/ss01-kindled-ash/light_2/south-west 2` | 63 | 6.92 | -1 | 22, 7 | 2 | 20 **flag** | 144 |
| light_2_SW_1 | `art/raw/ss01-kindled-ash/light_2/south-west 3` | 103 | 7.43 | -1 | 22, 7 | 0 | 19 **flag** | 123 |
| light_3_S_0 | `art/raw/ss01-kindled-ash/light_3/south 2` | 47 | 6.45 | 0 | 22, 8 | 1 | 16 **flag** | 136 |
| light_3_S_1 | `art/raw/ss01-kindled-ash/light_3/south 3` | 61 | 7.29 | 0 | 22, 8 | 1 | 17 **flag** | 133 |
| light_3_S_2 | `art/raw/ss01-kindled-ash/light_3/south 6` | 23 | 6.45 | 0 | 22, 8 | 0 | 17 **flag** | 136 |
| light_3_SE_0 | `art/raw/ss01-kindled-ash/light_3/south-east 2` | 70 | 6.92 | -1 | 22, 7 | 2 | 18 **flag** | 153 |
| light_3_SE_1 | `art/raw/ss01-kindled-ash/light_3/south-east 3` | 73 | 7.83 | -1 | 22, 7 | 1 | 16 **flag** | 156 |
| light_3_SE_2 | `art/raw/ss01-kindled-ash/light_3/south-east 6` | 57 | 7.83 | -1 | 22, 7 | 8 | 18 **flag** | 155 |
| light_3_E_0 | `art/raw/ss01-kindled-ash/light_3/east 2` | 39 | 7.87 | -1 | 22, 7 | 1 | 16 **flag** | 81 |
| light_3_E_1 | `art/raw/ss01-kindled-ash/light_3/east 4` | 42 | 7.87 | -1 | 22, 7 | 0 | 17 **flag** | 88 |
| light_3_E_2 | `art/raw/ss01-kindled-ash/light_3/east 6` | 30 | 7.87 | -1 | 22, 7 | 0 | 17 **flag** | 83 |
| light_3_N_0 | `art/raw/ss01-kindled-ash/light_3/north 2` | 44 | 7.48 | -1 | 22, 7 | 0 | 8 | 0 |
| light_3_N_1 | `art/raw/ss01-kindled-ash/light_3/north 4` | 50 | 8.56 | -1 | 22, 7 | 2 | 9 | 0 |
| light_3_N_2 | `art/raw/ss01-kindled-ash/light_3/north 5` | 44 | 8.56 | -1 | 22, 7 | 1 | 12 | 1 |
| light_3_NW_0 | `art/raw/ss01-kindled-ash/light_3/north-west 4` | 26 | 5.53 | -1 | 22, 7 | 1 | 11 | 14 |
| light_3_NW_1 | `art/raw/ss01-kindled-ash/light_3/north-west 6` | 27 | 5.53 | -1 | 22, 7 | 1 | 11 | 14 |
| light_3_W_0 | `art/raw/ss01-kindled-ash/light_3/west 2` | 33 | 7.7 | -1 | 22, 7 | 1 | 16 **flag** | 68 |
| light_3_W_1 | `art/raw/ss01-kindled-ash/light_3/west 4` | 23 | 6.89 | -1 | 22, 7 | 3 | 14 **flag** | 59 |
| light_3_W_2 | `art/raw/ss01-kindled-ash/light_3/west 6` | 27 | 7.7 | -1 | 22, 7 | 1 | 13 **flag** | 57 |
| light_3_SW_0 | `art/raw/ss01-kindled-ash/light_3/south-west 2` | 52 | 7.89 | -1 | 22, 7 | 0 | 18 **flag** | 153 |
| light_3_SW_1 | `art/raw/ss01-kindled-ash/light_3/south-west 4` | 67 | 6.92 | -1 | 22, 7 | 3 | 18 **flag** | 156 |
| light_3_SW_2 | `art/raw/ss01-kindled-ash/light_3/south-west 6` | 57 | 7.89 | -1 | 22, 7 | 0 | 18 **flag** | 144 |
| heavy_charge_S_0 | `art/raw/ss01-kindled-ash/heavy/south 2` | 32 | 6.22 | 0 | 22, 8 | 1 | 16 **flag** | 163 |
| heavy_charge_S_1 | `art/raw/ss01-kindled-ash/heavy/south 3` | 55 | 7.46 | 0 | 22, 8 | 1 | 16 **flag** | 156 |
| heavy_charge_S_2 | `art/raw/ss01-kindled-ash/heavy/south 4` | 31 | 6.8 | 0 | 22, 8 | 1 | 15 **flag** | 146 |
| heavy_charge_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 2` | 51 | 6.92 | -1 | 22, 7 | 0 | 17 **flag** | 150 |
| heavy_charge_SE_1 | `art/raw/ss01-kindled-ash/heavy/south-east 3` | 79 | 7.84 | -1 | 22, 7 | 3 | 19 **flag** | 141 |
| heavy_charge_SE_2 | `art/raw/ss01-kindled-ash/heavy/south-east 4` | 49 | 7.26 | -1 | 22, 7 | 0 | 17 **flag** | 149 |
| heavy_charge_E_0 | `art/raw/ss01-kindled-ash/heavy/east 2` | 38 | 7.79 | -1 | 22, 7 | 1 | 18 **flag** | 73 |
| heavy_charge_E_1 | `art/raw/ss01-kindled-ash/heavy/east 3` | 45 | 7.71 | -1 | 22, 7 | 0 | 16 **flag** | 72 |
| heavy_charge_E_2 | `art/raw/ss01-kindled-ash/heavy/east 4` | 30 | 7.88 | -1 | 22, 7 | 0 | 15 **flag** | 67 |
| heavy_charge_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 2` | 20 | 5.94 | -1 | 22, 7 | 1 | 13 **flag** | 0 |
| heavy_charge_NE_1 | `art/raw/ss01-kindled-ash/heavy/north-east 3` | 26 | 7.72 | -1 | 22, 7 | 1 | 15 **flag** | 0 |
| heavy_charge_NE_2 | `art/raw/ss01-kindled-ash/heavy/north-east 5` | 22 | 7.72 | -1 | 22, 7 | 0 | 15 **flag** | 1 |
| heavy_charge_N_0 | `art/raw/ss01-kindled-ash/heavy/north 2` | 64 | 11.75 | -1 | 22, 7 | 1 | 9 | 0 |
| heavy_charge_N_1 | `art/raw/ss01-kindled-ash/heavy/north 3` | 79 | 11.94 | -1 | 22, 7 | 1 | 11 | 2 |
| heavy_charge_N_2 | `art/raw/ss01-kindled-ash/heavy/north 4` | 74 | 11.75 | -1 | 22, 7 | 1 | 8 | 0 |
| heavy_charge_W_0 | `art/raw/ss01-kindled-ash/heavy/west 2` | 32 | 6.89 | -1 | 22, 7 | 2 | 16 **flag** | 72 |
| heavy_charge_W_1 | `art/raw/ss01-kindled-ash/heavy/west 3` | 28 | 6.52 | -1 | 22, 7 | 0 | 13 **flag** | 66 |
| heavy_charge_W_2 | `art/raw/ss01-kindled-ash/heavy/west 4` | 7 | 6.1 | -1 | 22, 7 | 0 | 12 | 71 |
| heavy_charge_SW_0 | `art/raw/ss01-kindled-ash/heavy/south-west 1` | 104 | 6.92 | -1 | 22, 7 | 2 | 19 **flag** | 151 |
| heavy_charge_SW_1 | `art/raw/ss01-kindled-ash/heavy/south-west 2` | 53 | 6.92 | -1 | 22, 7 | 0 | 17 **flag** | 144 |
| heavy_charge_SW_2 | `art/raw/ss01-kindled-ash/heavy/south-west 4` | 23 | 6.92 | -1 | 22, 7 | 0 | 15 **flag** | 106 |
| heavy_thrust_S_0 | `art/raw/ss01-kindled-ash/heavy/south 7` | 62 | 7.46 | 0 | 22, 8 | 0 | 13 **flag** | 147 |
| heavy_thrust_S_1 | `art/raw/ss01-kindled-ash/heavy/south 8` | 40 | 7.57 | 0 | 22, 8 | 0 | 15 **flag** | 129 |
| heavy_thrust_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 7` | 65 | 7.69 | -1 | 22, 7 | 1 | 17 **flag** | 121 |
| heavy_thrust_SE_1 | `art/raw/ss01-kindled-ash/heavy/south-east 8` | 40 | 6.92 | -1 | 22, 7 | 0 | 18 **flag** | 128 |
| heavy_thrust_E_0 | `art/raw/ss01-kindled-ash/heavy/east 6` | 20 | 6.26 | -1 | 22, 7 | 0 | 12 | 73 |
| heavy_thrust_E_1 | `art/raw/ss01-kindled-ash/heavy/east 7` | 34 | 7.22 | -1 | 22, 7 | 1 | 14 **flag** | 61 |
| heavy_thrust_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 6` | 18 | 7.72 | -1 | 22, 7 | 0 | 13 **flag** | 1 |
| heavy_thrust_NE_1 | `art/raw/ss01-kindled-ash/heavy/north-east 7` | 73 | 6.15 | -1 | 22, 7 | 3 | 19 **flag** | 23 |
| heavy_thrust_W_0 | `art/raw/ss01-kindled-ash/heavy/west 7` | 38 | 6.52 | -1 | 22, 7 | 1 | 12 | 66 |
| heavy_thrust_W_1 | `art/raw/ss01-kindled-ash/heavy/west 8` | 41 | 6.89 | -1 | 22, 7 | 0 | 15 **flag** | 72 |
| heavy_thrust_SW_0 | `art/raw/ss01-kindled-ash/heavy/south-west 7` | 103 | 6.92 | -1 | 22, 7 | 1 | 19 **flag** | 163 |
| heavy_thrust_SW_1 | `art/raw/ss01-kindled-ash/heavy/south-west 8` | 66 | 6.92 | -1 | 22, 7 | 0 | 19 **flag** | 136 |
| heavy_hold_S_0 | `art/raw/ss01-kindled-ash/heavy/south 8` | 40 | 7.57 | 0 | 22, 8 | 0 | 15 **flag** | 129 |
| heavy_hold_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 8` | 40 | 6.92 | -1 | 22, 7 | 0 | 18 **flag** | 128 |
| heavy_hold_E_0 | `art/raw/ss01-kindled-ash/heavy/east 8` | 24 | 7.71 | -1 | 22, 7 | 1 | 16 **flag** | 58 |
| heavy_hold_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 8` | 65 | 6.15 | -1 | 22, 7 | 1 | 15 **flag** | 29 |
| heavy_hold_W_0 | `art/raw/ss01-kindled-ash/heavy/west 8` | 41 | 6.89 | -1 | 22, 7 | 0 | 15 **flag** | 72 |
| heavy_hold_SW_0 | `art/raw/ss01-kindled-ash/heavy/south-west 8` | 66 | 6.92 | -1 | 22, 7 | 0 | 19 **flag** | 136 |
| heavy_recover_S_0 | `art/raw/ss01-kindled-ash/heavy/south 10` | 23 | 5.88 | 0 | 22, 8 | 1 | 13 **flag** | 129 |
| heavy_recover_S_1 | `art/raw/ss01-kindled-ash/heavy/south 1` | 53 | 6.22 | 0 | 22, 8 | 0 | 15 **flag** | 161 |
| heavy_recover_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 10` | 40 | 7.84 | -1 | 22, 7 | 1 | 19 **flag** | 127 |
| heavy_recover_SE_1 | `art/raw/ss01-kindled-ash/heavy/south-east 1` | 78 | 6.92 | -1 | 22, 7 | 0 | 17 **flag** | 142 |
| heavy_recover_E_0 | `art/raw/ss01-kindled-ash/heavy/east 10` | 20 | 6.15 | -1 | 22, 7 | 2 | 13 **flag** | 59 |
| heavy_recover_E_1 | `art/raw/ss01-kindled-ash/heavy/east 1` | 62 | 7.71 | -1 | 22, 7 | 2 | 17 **flag** | 75 |
| heavy_recover_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 10` | 62 | 7.72 | -1 | 22, 7 | 0 | 16 **flag** | 25 |
| heavy_recover_NE_1 | `art/raw/ss01-kindled-ash/heavy/north-east 1` | 20 | 6.15 | -1 | 22, 7 | 0 | 11 | 1 |
| heavy_recover_W_0 | `art/raw/ss01-kindled-ash/heavy/west 10` | 34 | 6.89 | -1 | 22, 7 | 3 | 16 **flag** | 71 |
| heavy_recover_W_1 | `art/raw/ss01-kindled-ash/heavy/west 1` | 49 | 7.66 | -1 | 22, 7 | 4 | 15 **flag** | 72 |
| heavy_recover_SW_0 | `art/raw/ss01-kindled-ash/heavy/south-west 10` | 45 | 6.15 | -1 | 22, 7 | 1 | 16 **flag** | 136 |
| heavy_recover_SW_1 | `art/raw/ss01-kindled-ash/heavy/south-west 1` | 104 | 6.92 | -1 | 22, 7 | 2 | 19 **flag** | 151 |
| haul_throw_S_0 | `art/raw/ss01-kindled-ash/haul/south 2` | 51 | 6.06 | 0 | 22, 8 | 0 | 15 **flag** | 176 |
| haul_throw_S_1 | `art/raw/ss01-kindled-ash/haul/south 3` | 48 | 7.06 | 0 | 22, 8 | 2 | 17 **flag** | 165 |
| haul_throw_SE_0 | `art/raw/ss01-kindled-ash/haul/south-east 2` | 87 | 6.92 | -1 | 22, 7 | 3 | 18 **flag** | 138 |
| haul_throw_SE_1 | `art/raw/ss01-kindled-ash/haul/south-east 4` | 40 | 6.92 | -1 | 22, 7 | 21 | 13 **flag** | 113 |
| haul_throw_E_0 | `art/raw/ss01-kindled-ash/haul/east 2` | 52 | 6.92 | -1 | 22, 7 | 2 | 18 **flag** | 78 |
| haul_throw_E_1 | `art/raw/ss01-kindled-ash/haul/east 3` | 50 | 6.4 | -1 | 22, 7 | 2 | 17 **flag** | 75 |
| haul_throw_NE_0 | `art/raw/ss01-kindled-ash/haul/north-east 2` | 58 | 7.56 | -1 | 22, 7 | 1 | 14 **flag** | 12 |
| haul_throw_NE_1 | `art/raw/ss01-kindled-ash/haul/north-east 3` | 76 | 6.25 | -1 | 22, 7 | 0 | 15 **flag** | 10 |
| haul_throw_N_0 | `art/raw/ss01-kindled-ash/haul/north 2` | 11 | 4.2 | -1 | 22, 7 | 1 | 6 | 0 |
| haul_throw_N_1 | `art/raw/ss01-kindled-ash/haul/north 3` | 20 | 5.57 | -1 | 22, 7 | 2 | 11 | 1 |
| haul_throw_NW_0 | `art/raw/ss01-kindled-ash/haul/north-west 1` | 28 | 7.42 | -1 | 22, 7 | 1 | 8 | 24 |
| haul_throw_NW_1 | `art/raw/ss01-kindled-ash/haul/north-west 2` | 22 | 7.42 | -1 | 22, 7 | 1 | 9 | 16 |
| haul_throw_W_0 | `art/raw/ss01-kindled-ash/haul/west 2` | 42 | 6.89 | -1 | 22, 7 | 0 | 12 | 51 |
| haul_throw_W_1 | `art/raw/ss01-kindled-ash/haul/west 3` | 76 | 6.89 | -1 | 22, 7 | 4 | 15 **flag** | 61 |
| haul_throw_SW_0 | `art/raw/ss01-kindled-ash/haul/south-west 2` | 60 | 6.92 | -1 | 22, 7 | 1 | 15 **flag** | 137 |
| haul_throw_SW_1 | `art/raw/ss01-kindled-ash/haul/south-west 4` | 60 | 6.92 | -1 | 22, 7 | 1 | 14 **flag** | 113 |
| haul_recover_S_0 | `art/raw/ss01-kindled-ash/haul/south 6` | 25 | 7.56 | 0 | 22, 8 | 0 | 16 **flag** | 166 |
| haul_recover_S_1 | `art/raw/ss01-kindled-ash/haul/south 1` | 72 | 7.06 | 0 | 22, 8 | 4 | 17 **flag** | 158 |
| haul_recover_SE_0 | `art/raw/ss01-kindled-ash/haul/south-east 5` | 43 | 6.92 | -1 | 22, 7 | 0 | 16 **flag** | 118 |
| haul_recover_SE_1 | `art/raw/ss01-kindled-ash/haul/south-east 6` | 34 | 6.55 | -1 | 22, 7 | 0 | 14 **flag** | 125 |
| haul_recover_E_0 | `art/raw/ss01-kindled-ash/haul/east 5` | 58 | 6.92 | -1 | 22, 7 | 1 | 15 **flag** | 82 |
| haul_recover_E_1 | `art/raw/ss01-kindled-ash/haul/east 6` | 35 | 6.92 | -1 | 22, 7 | 1 | 15 **flag** | 77 |
| haul_recover_NE_0 | `art/raw/ss01-kindled-ash/haul/north-east 5` | 60 | 7.91 | -1 | 22, 7 | 1 | 13 **flag** | 13 |
| haul_recover_NE_1 | `art/raw/ss01-kindled-ash/haul/north-east 6` | 33 | 7.25 | -1 | 22, 7 | 0 | 11 | 13 |
| haul_recover_N_0 | `art/raw/ss01-kindled-ash/haul/north 5` | 15 | 5.83 | -1 | 22, 7 | 0 | 7 | 1 |
| haul_recover_N_1 | `art/raw/ss01-kindled-ash/haul/north 6` | 4 | 5.57 | -1 | 22, 7 | 0 | 5 | 0 |
| haul_recover_NW_0 | `art/raw/ss01-kindled-ash/haul/north-west 5` | 20 | 4.7 | -1 | 22, 7 | 0 | 9 | 22 |
| haul_recover_NW_1 | `art/raw/ss01-kindled-ash/haul/north-west 6` | 15 | 4.7 | -1 | 22, 7 | 1 | 8 | 5 |
| haul_recover_W_0 | `art/raw/ss01-kindled-ash/haul/west 5` | 62 | 6.89 | -1 | 22, 7 | 1 | 15 **flag** | 66 |
| haul_recover_W_1 | `art/raw/ss01-kindled-ash/haul/west 6` | 47 | 6.89 | -1 | 22, 7 | 1 | 14 **flag** | 63 |
| haul_recover_SW_0 | `art/raw/ss01-kindled-ash/haul/south-west 5` | 63 | 6.92 | -1 | 22, 7 | 0 | 18 **flag** | 120 |
| haul_recover_SW_1 | `art/raw/ss01-kindled-ash/haul/south-west 6` | 46 | 7.06 | -1 | 22, 7 | 0 | 17 **flag** | 140 |
| haul_pull_S_0 | `art/raw/ss01-kindled-ash/haul_pull/south 1` | 116 | 6.64 | 0 | 22, 8 | 0 | 16 **flag** | 144 |
| haul_pull_S_1 | `art/raw/ss01-kindled-ash/haul_pull/south 3` | 109 | 7.49 | 0 | 22, 8 | 0 | 17 **flag** | 136 |
| haul_pull_SE_0 | `art/raw/ss01-kindled-ash/haul_pull/south-east 1` | 125 | 7.1 | -1 | 22, 7 | 4 | 16 **flag** | 147 |
| haul_pull_SE_1 | `art/raw/ss01-kindled-ash/haul_pull/south-east 4` | 78 | 6.92 | -1 | 22, 7 | 2 | 15 **flag** | 119 |
| haul_pull_E_0 | `art/raw/ss01-kindled-ash/haul_pull/east 1` | 184 | 8.89 | -1 | 22, 7 | 2 | 18 **flag** | 100 |
| haul_pull_E_1 | `art/raw/ss01-kindled-ash/haul_pull/east 2` | 85 | 7.42 | -1 | 22, 7 | 0 | 13 **flag** | 111 |
| haul_pull_NE_0 | `art/raw/ss01-kindled-ash/haul_pull/north-east 2` | 50 | 7.15 | -1 | 22, 7 | 4 | 13 **flag** | 9 |
| haul_pull_NE_1 | `art/raw/ss01-kindled-ash/haul_pull/north-east 4` | 40 | 6.15 | -1 | 22, 7 | 0 | 15 **flag** | 12 |
| haul_pull_N_0 | `art/raw/ss01-kindled-ash/haul_pull/north 1` | 2 | 5.83 | -1 | 22, 7 | 0 | 5 | 1 |
| haul_pull_N_1 | `art/raw/ss01-kindled-ash/haul_pull/north 3` | 4 | 5.31 | -1 | 22, 7 | 2 | 6 | 0 |
| haul_pull_NW_0 | `art/raw/ss01-kindled-ash/haul_pull/north-west 1` | 55 | 7.72 | -1 | 22, 7 | 1 | 12 | 22 |
| haul_pull_NW_1 | `art/raw/ss01-kindled-ash/haul_pull/north-west 3` | 76 | 7.72 | -1 | 22, 7 | 4 | 15 **flag** | 32 |
| haul_pull_W_0 | `art/raw/ss01-kindled-ash/haul_pull/west 1` | 58 | 7.39 | -1 | 22, 7 | 6 | 14 **flag** | 61 |
| haul_pull_W_1 | `art/raw/ss01-kindled-ash/haul_pull/west 4` | 34 | 6.89 | -1 | 22, 7 | 2 | 15 **flag** | 65 |
| haul_pull_SW_0 | `art/raw/ss01-kindled-ash/haul_pull/south-west 2` | 55 | 6.92 | -1 | 22, 7 | 1 | 18 **flag** | 141 |
| haul_pull_SW_1 | `art/raw/ss01-kindled-ash/haul_pull/south-west 4` | 66 | 6.92 | -1 | 22, 7 | 1 | 16 **flag** | 149 |
| haul_slide_S_0 | `art/raw/ss01-kindled-ash/haul_slide/south 1` | 62 | 8.24 | 0 | 22, 8 | 5 | 16 **flag** | 167 |
| haul_slide_S_1 | `art/raw/ss01-kindled-ash/haul_slide/south 3` | 45 | 7.07 | 0 | 22, 8 | 12 | 15 **flag** | 142 |
| haul_slide_SE_0 | `art/raw/ss01-kindled-ash/haul_slide/south-east 1` | 86 | 7.81 | -1 | 22, 7 | 7 | 19 **flag** | 141 |
| haul_slide_SE_1 | `art/raw/ss01-kindled-ash/haul_slide/south-east 4` | 63 | 6.92 | -1 | 22, 7 | 7 | 16 **flag** | 153 |
| haul_slide_E_0 | `art/raw/ss01-kindled-ash/haul_slide/east 1` | 84 | 8.11 | -1 | 22, 7 | 6 | 17 **flag** | 76 |
| haul_slide_E_1 | `art/raw/ss01-kindled-ash/haul_slide/east 3` | 51 | 7.62 | -1 | 22, 7 | 3 | 18 **flag** | 90 |
| haul_slide_NE_0 | `art/raw/ss01-kindled-ash/haul_slide/north-east 1` | 51 | 6.15 | -1 | 22, 7 | 1 | 15 **flag** | 7 |
| haul_slide_NE_1 | `art/raw/ss01-kindled-ash/haul_slide/north-east 3` | 62 | 7.7 | -1 | 22, 7 | 5 | 18 **flag** | 21 |
| haul_slide_N_0 | `art/raw/ss01-kindled-ash/haul_slide/north 2` | 0 | 0 | -1 | 22, 7 | 0 | 4 | 0 |
| haul_slide_N_1 | `art/raw/ss01-kindled-ash/haul_slide/north 4` | 6 | 4.63 | -1 | 22, 7 | 0 | 6 | 0 |
| haul_slide_NW_0 | `art/raw/ss01-kindled-ash/haul_slide/north-west 1` | 35 | 5.53 | -1 | 22, 7 | 1 | 11 | 15 |
| haul_slide_NW_1 | `art/raw/ss01-kindled-ash/haul_slide/north-west 3` | 36 | 5.61 | -1 | 22, 7 | 3 | 11 | 16 |
| haul_slide_W_0 | `art/raw/ss01-kindled-ash/haul_slide/west 1` | 91 | 7.58 | -1 | 22, 7 | 4 | 20 **flag** | 66 |
| haul_slide_W_1 | `art/raw/ss01-kindled-ash/haul_slide/west 4` | 53 | 6.89 | -1 | 22, 7 | 1 | 15 **flag** | 16 |
| haul_slide_SW_0 | `art/raw/ss01-kindled-ash/haul_slide/south-west 1` | 94 | 6.92 | -1 | 22, 7 | 6 | 19 **flag** | 136 |
| haul_slide_SW_1 | `art/raw/ss01-kindled-ash/haul_slide/south-west 4` | 49 | 6.92 | -1 | 22, 7 | 0 | 16 **flag** | 145 |
| hit_S_0 | `art/raw/ss01-kindled-ash/hit/south 1` | 59 | 7.9 | -1 | 16, 1 | 24 | 16 **flag** | 133 |
| hit_S_1 | `art/raw/ss01-kindled-ash/hit/south 2` | 66 | 7.9 | -1 | 16, 1 | 10 | 17 **flag** | 144 |
| hit_E_0 | `art/raw/ss01-kindled-ash/hit/east 1` | 158 | 6.79 | -1 | 16, 1 | 29 | 12 | 82 |
| hit_E_1 | `art/raw/ss01-kindled-ash/hit/east 3` | 139 | 6.79 | -1 | 16, 1 | 21 | 15 **flag** | 99 |
| hit_N_0 | `art/raw/ss01-kindled-ash/hit/north 1` | 28 | 6.78 | -1 | 16, 1 | 3 | 10 | 2 |
| hit_N_1 | `art/raw/ss01-kindled-ash/hit/north 3` | 27 | 6.78 | -1 | 16, 1 | 3 | 12 | 1 |
| hit_W_0 | `art/raw/ss01-kindled-ash/hit/west 1` | 64 | 6.52 | -1 | 16, 1 | 9 | 12 | 48 |
| hit_W_1 | `art/raw/ss01-kindled-ash/hit/west 2` | 120 | 6.89 | -1 | 16, 1 | 20 | 12 | 57 |
| death_S_0 | `art/raw/ss01-kindled-ash/death/south 1` | 0 | 0 | -1 | 16, 1 | 8 | 11 | 153 |
| death_S_1 | `art/raw/ss01-kindled-ash/death/south 2` | 0 | 0 | -1 | 16, 1 | 5 | 11 | 142 |
| death_S_2 | `art/raw/ss01-kindled-ash/death/south 3` | 0 | 0 | -1 | 16, 1 | 6 | 11 | 141 |
| death_S_3 | `art/raw/ss01-kindled-ash/death/south 4` | 0 | 0 | -1 | 16, 1 | 10 | 10 | 126 |
| death_S_4 | `art/raw/ss01-kindled-ash/death/south 5` | 0 | 0 | -1 | 16, 1 | 23 | 9 | 116 |
| death_S_5 | `art/raw/ss01-kindled-ash/death/south 6` | 0 | 0 | -1 | 16, 1 | 20 | 10 | 80 |
| death_E_0 | `art/raw/ss01-kindled-ash/death/east 1` | 130 | 6.15 | -1 | 16, 1 | 24 | 14 **flag** | 55 |
| death_E_1 | `art/raw/ss01-kindled-ash/death/east 2` | 169 | 6.49 | -1 | 16, 1 | 78 | 12 | 92 |
| death_E_2 | `art/raw/ss01-kindled-ash/death/east 3` | 163 | 6.15 | -1 | 16, 1 | 35 | 13 **flag** | 65 |
| death_E_3 | `art/raw/ss01-kindled-ash/death/east 4` | 112 | 6.15 | -1 | 16, 1 | 27 | 12 | 67 |
| death_E_4 | `art/raw/ss01-kindled-ash/death/east 5` | 266 | 6.59 | -1 | 16, 1 | 103 | 12 | 92 |
| death_E_5 | `art/raw/ss01-kindled-ash/death/east 6` | 315 | 6.59 | -1 | 16, 1 | 93 | 10 | 199 |
| death_N_0 | `art/raw/ss01-kindled-ash/death/north 1` | 40 | 7.55 | -3 | 16, -1 | 5 | 12 | 1 |
| death_N_1 | `art/raw/ss01-kindled-ash/death/north 2` | 32 | 7.55 | -3 | 16, -1 | 7 | 9 | 1 |
| death_N_2 | `art/raw/ss01-kindled-ash/death/north 3` | 0 | 0 | -3 | 16, -1 | 1 | 4 | 0 |
| death_N_3 | `art/raw/ss01-kindled-ash/death/north 4` | 0 | 0 | -3 | 16, -1 | 1 | 4 | 0 |
| death_N_4 | `art/raw/ss01-kindled-ash/death/north 5` | 0 | 0 | -3 | 16, -1 | 4 | 4 | 0 |
| death_N_5 | `art/raw/ss01-kindled-ash/death/north 6` | 34 | 7.55 | -3 | 16, -1 | 5 | 11 | 2 |
| death_W_0 | `art/raw/ss01-kindled-ash/death/west 1` | 108 | 6.52 | -1 | 16, 1 | 13 | 12 | 59 |
| death_W_1 | `art/raw/ss01-kindled-ash/death/west 2` | 198 | 6.52 | -1 | 16, 1 | 47 | 10 | 133 |
| death_W_2 | `art/raw/ss01-kindled-ash/death/west 3` | 208 | 6.89 | -1 | 16, 1 | 29 | 13 **flag** | 111 |
| death_W_3 | `art/raw/ss01-kindled-ash/death/west 4` | 140 | 6.52 | -1 | 16, 1 | 8 | 10 | 112 |
| death_W_4 | `art/raw/ss01-kindled-ash/death/west 5` | 239 | 6.52 | -1 | 16, 1 | 27 | 10 | 119 |
| death_W_5 | `art/raw/ss01-kindled-ash/death/west 6` | 192 | 6.52 | -1 | 16, 1 | 23 | 10 | 118 |

## Off-palette colours the snap moved

1314 source colours reached the snap off the whitelist. The 20 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

| Colour | Pixels | Snapped to | ΔE | Ramp | Frames |
|---|---|---|---|---|---|
| #363347 | 1720 | sleeper-night #24305a | 4.7 | water, hair | idle_SE 0 1; idle_NW 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–5; walk_NW 0–5; walk_W 0–5; walk_SW 0–5; dodge_SE 0–3; dodge_NW 0–2; dodge_W 0–3; dodge_SW 0–3; light_1_SE 1 2; light_1_NW 0–2; light_1_W 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_NW 1 2; light_2_W 0 1; light_2_SW 0 1; light_3_SE 0–2; light_3_NW 0 1; light_3_W 0–2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_W 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_W 0 1; heavy_thrust_SW 0; heavy_hold_SE 0; heavy_hold_W 0; heavy_recover_SE 0 1; heavy_recover_W 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NW 0 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_NW 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_NW 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_NW 0 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_W 0 1; death_W 0–5 |
| #3d3c4c | 1712 | watcher-iron #4a4e57 | 6.15 | cloth, steel | idle_SE 0 1; idle_E 0 1; idle_NE 0 1; idle_SW 0 1; walk_SE 0–5; walk_E 0–5; walk_NE 0–5; walk_SW 0–5; dodge_SE 0–3; dodge_E 0–3; dodge_NE 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_E 0–2; light_1_NE 0 1; light_1_SW 0–2; light_2_SE 0–2; light_2_E 0–2; light_2_NE 2; light_2_SW 0 1; light_3_SE 1 2; light_3_E 0–2; light_3_SW 0 2; heavy_charge_SE 0–2; heavy_charge_E 0–2; heavy_charge_NE 2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_E 0 1; heavy_thrust_NE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_E 0; heavy_hold_NE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_E 0 1; heavy_recover_NE 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_throw_NE 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_E 0 1; haul_recover_NE 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_E 0 1; haul_pull_NE 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_E 0 1; haul_slide_NE 0 1; haul_slide_SW 0; hit_E 0 1; death_E 0–5 |
| #7e7063 | 1220 | unwritten-sail #8c7f6e | 4.93 | skin | idle_SE 0 1; idle_E 0 1; idle_NE 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–5; walk_E 0–5; walk_NE 0–2 4 5; walk_W 0–5; walk_SW 0–5; dodge_SE 0–3; dodge_E 1–3; dodge_NE 1 3; dodge_W 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_E 0–2; light_1_NE 0–2; light_1_W 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_E 1 2; light_2_NE 0–2; light_2_W 0–2; light_2_SW 0 1; light_3_SE 0–2; light_3_E 0 2; light_3_W 0–2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_E 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_NE 1; heavy_thrust_W 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_E 1; heavy_recover_NE 0; heavy_recover_W 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_throw_NE 0 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_E 0 1; haul_recover_NE 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_E 0 1; haul_pull_NE 0 1; haul_pull_W 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_E 0 1; haul_slide_NE 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_E 0 1; hit_W 0 1; death_E 0–5; death_W 0–5 |
| #6f6356 | 1010 | unwritten-tar #5e5448 | 5.53 | skin | idle_SE 0 1; idle_E 0 1; idle_NW 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–2; walk_E 0–5; walk_NW 0–5; walk_W 0–5; walk_SW 0–5; dodge_SE 0–3; dodge_E 0–3; dodge_NW 3; dodge_W 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_E 0–2; light_1_NW 0 2; light_1_W 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_E 0–2; light_2_NW 0 1; light_2_W 0–2; light_2_SW 0 1; light_3_SE 0–2; light_3_E 0–2; light_3_NW 0 1; light_3_W 0–2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_E 0 1; heavy_charge_W 1; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_E 1; heavy_thrust_W 0; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_E 1; heavy_recover_W 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_SE 1; haul_recover_E 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_E 0 1; haul_pull_NW 0 1; haul_pull_W 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_E 0 1; haul_slide_NW 0 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_E 0 1; hit_W 0 1; death_E 0–5; death_W 0–5 |
| #685c56 | 645 | unwritten-tar #5e5448 | 3.39 | skin | idle_SE 0 1; idle_NW 0 1; walk_SE 0–2 4 5; walk_NE 3; walk_NW 0–5; dodge_SE 0–3; dodge_NE 0–3; dodge_NW 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_NE 0–2; light_1_NW 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_NE 0–2; light_2_NW 1 2; light_2_SW 0 1; light_3_SE 0–2; light_3_NW 0 1; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_NE 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_NE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_NE 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NE 0 1; haul_throw_NW 0 1; haul_throw_SW 1; haul_recover_SE 0 1; haul_recover_NE 0 1; haul_recover_NW 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_NE 0 1; haul_pull_NW 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_NE 0 1; haul_slide_NW 0 1; haul_slide_SW 0 1 |
| #5d545d | 581 | unwritten-tar #5e5448 | 3.38 | skin | idle_NE 0 1; idle_NW 0 1; idle_SW 0 1; walk_SE 2 4 5; walk_NE 0–4; walk_NW 0–5; walk_SW 0–5; dodge_SE 0–3; dodge_NE 0–3; dodge_NW 0 1 3; dodge_SW 0–2; light_1_SE 0–2; light_1_NE 0–2; light_1_NW 0 2; light_1_SW 0–2; light_2_SE 0–2; light_2_NE 0–2; light_2_NW 0 1; light_2_SW 0 1; light_3_SE 0–2; light_3_NW 0 1; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_NE 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_NE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_NE 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NE 0 1; haul_throw_NW 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_NE 0 1; haul_recover_NW 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_NE 0 1; haul_pull_NW 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_NE 0 1; haul_slide_NW 0 1; haul_slide_SW 0 1 |
| #626383 | 577 | hollow-below #5b5478 | 4.57 | stone, hair | idle_SE 0 1; idle_NW 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–5; walk_NW 3 4; walk_W 1–5; walk_SW 0–5; dodge_SE 0–3; dodge_NW 1; dodge_W 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_NW 0–2; light_1_W 0 1; light_1_SW 0–2; light_2_SE 0–2; light_2_NW 0; light_2_W 0–2; light_2_SW 1; light_3_SE 0; light_3_NW 0 1; light_3_W 1 2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_W 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_W 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_W 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NW 1; haul_throw_W 0 1; haul_throw_SW 1; haul_recover_SE 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_NW 0 1; haul_pull_W 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_NW 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_W 0 1; death_W 0–5 |
| #8e969f | 351 | watcher-stone #7d8794 | 5.04 | cloth, steel | idle_SE 0 1; idle_NE 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–5; walk_NE 1 3–5; walk_W 0–3 5; walk_SW 1 2 5; dodge_SE 0–3; dodge_NE 0–2; dodge_W 0–3; dodge_SW 3; light_1_SE 0 2; light_1_NE 0–2; light_1_W 0–2; light_1_SW 0–2; light_2_SE 0 2; light_2_NE 0–2; light_2_W 0 2; light_2_SW 0 1; light_3_SE 1 2; light_3_W 0 1; light_3_SW 1 2; heavy_charge_SE 0–2; heavy_charge_NE 1; heavy_charge_W 0 2; heavy_charge_SW 0 1; heavy_thrust_SE 1; heavy_thrust_W 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 1; heavy_recover_NE 0; heavy_recover_W 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NE 0 1; haul_throw_W 0 1; haul_throw_SW 1; haul_recover_NE 0; haul_recover_W 0 1; haul_pull_SE 0 1; haul_pull_NE 0 1; haul_pull_W 0 1; haul_pull_SW 0; haul_slide_SE 0; haul_slide_NE 0; haul_slide_W 0 1; haul_slide_SW 0 1; death_W 2 |
| #707084 | 318 | watcher-stone #7d8794 | 6.92 | cloth, steel | idle_SE 0 1; idle_SW 0 1; walk_SE 0–5; walk_SW 0–5; dodge_SE 0–3; dodge_SW 1–3; light_1_SE 0–2; light_1_SW 0–2; light_2_SE 0 1; light_2_SW 0 1; light_3_SE 0 1; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_SW 1; haul_throw_SE 0 1; haul_throw_SW 0 1; haul_recover_SE 0; haul_recover_SW 0; haul_pull_SE 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_SW 0 1 |
| #454069 | 278 | watcher-iron #4a4e57 | 6.1 | cloth, steel | idle_SE 0 1; idle_W 0 1; walk_SE 0 3–5; walk_W 0–5; dodge_SE 0 2 3; dodge_W 0–3; light_1_SE 0 1; light_1_W 0 2; light_2_SE 1 2; light_2_W 0–2; light_3_SE 0 1; light_3_W 0–2; heavy_charge_SE 0 1; heavy_charge_W 0–2; heavy_thrust_SE 1; heavy_thrust_W 0 1; heavy_hold_SE 0; heavy_hold_W 0; heavy_recover_SE 1; heavy_recover_W 1; haul_throw_SE 0; haul_throw_W 0 1; haul_recover_W 0 1; haul_pull_SE 0; haul_pull_W 0; haul_slide_SE 1; haul_slide_W 0 1; hit_W 0 1; death_W 0–5 |
| #d67345 | 224 | spark-ember #c9733a | 2.67 | ember | idle_SE 0 1; idle_E 0 1; idle_NE 0 1; idle_SW 0 1; walk_SE 0–2 4 5; walk_E 0 1 5; walk_NE 0–5; dodge_SE 0–2; dodge_E 0 1 3; dodge_SW 0–3; light_1_SE 1 2; light_1_E 0–2; light_1_SW 0–2; light_2_SE 0 1; light_2_SW 0 1; light_3_SE 0 2; light_3_SW 0–2; heavy_charge_SE 0 1; heavy_charge_E 0; heavy_charge_NE 0–2; heavy_charge_SW 0 1; heavy_thrust_SE 0 1; heavy_thrust_NE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_SW 0; heavy_recover_SE 0; heavy_recover_E 1; heavy_recover_NE 0; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_E 1; haul_throw_SW 0; haul_recover_SE 1; haul_recover_E 1; haul_recover_SW 0; haul_pull_SE 0 1; haul_pull_NE 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_SW 0 1; hit_E 1; death_E 0–4 |
| #ad644c | 213 | sleeper-ochre #9c5b4a | 4.1 | ember, red clay | idle_SE 0; idle_W 0; walk_SE 0 2–5; walk_W 0 2 3; dodge_SE 0 2; dodge_W 0; light_1_SE 0–2; light_1_W 1; light_2_SE 0–2; light_2_W 0; light_3_SE 0–2; light_3_W 0; heavy_charge_SE 0–2; heavy_charge_W 0–2; heavy_thrust_SE 0 1; heavy_thrust_W 0 1; heavy_hold_SE 0; heavy_hold_W 0; heavy_recover_SE 1; heavy_recover_W 0 1; haul_throw_SE 0 1; haul_recover_SE 0 1; haul_pull_SE 1; haul_pull_W 0; haul_slide_SE 0 1; haul_slide_W 1; hit_W 0 1; death_W 0–5 |
| #3b3c5d | 198 | sleeper-night #24305a | 5.45 | water, hair | idle_SE 0 1; idle_SW 0 1; walk_SE 0–5; walk_SW 0 2 4 5; dodge_SE 1–3; dodge_SW 0 1 3; light_1_SE 0–2; light_1_SW 1; light_2_SE 1 2; light_2_SW 1; light_3_SE 1; light_3_SW 1 2; heavy_charge_SE 0–2; heavy_charge_SW 0; heavy_thrust_SE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_SW 1; haul_throw_SE 0; haul_throw_SW 0; haul_recover_SE 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_SW 0; haul_slide_SE 0; haul_slide_SW 0 |
| #d0cec9 | 155 | hollow-lavender #d9d2e9 | 4.58 | stone | idle_W 1; idle_SW 0; walk_W 0–5; walk_SW 0–3 5; dodge_W 1–3; dodge_SW 1 3; light_1_W 0 2; light_1_SW 0 2; light_2_W 0–2; light_2_SW 0 1; light_3_W 0 1; light_3_SW 0–2; heavy_charge_W 0; heavy_charge_SW 0–2; heavy_thrust_W 1; heavy_thrust_SW 0 1; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_W 0; heavy_recover_SW 0 1; haul_throw_W 1; haul_recover_W 0; haul_recover_SW 0 1; haul_pull_W 0 1; haul_pull_SW 1; haul_slide_W 0 1; haul_slide_SW 0; death_W 2 |
| #4e3844 | 149 | watcher-iron #4a4e57 | 6.52 | cloth, steel | idle_W 0 1; idle_SW 0 1; walk_W 0 4; walk_SW 0–5; dodge_W 0–2; dodge_SW 0 1 3; light_1_W 1; light_1_SW 1; light_2_W 0 1; light_2_SW 0 1; light_3_W 0 2; heavy_charge_W 1; heavy_charge_SW 0–2; heavy_thrust_W 0; heavy_thrust_SW 0; heavy_recover_SW 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_W 0; haul_pull_SW 0 1; haul_slide_W 0; haul_slide_SW 0; hit_W 0 1; death_W 0 1 3–5 |
| #bc6a4c | 116 | spark-ember #c9733a | 4.15 | ember | idle_SE 0 1; walk_SE 0–5; walk_E 0–5; dodge_SE 0 1; dodge_E 1 3; light_1_SE 0–2; light_1_E 0–2; light_2_E 0 2; light_3_SE 0 2; heavy_charge_SE 0 2; heavy_charge_E 0; heavy_recover_E 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_recover_SE 0 1; haul_recover_E 0 1; haul_pull_SE 0; haul_slide_SE 0 1; haul_slide_E 0; hit_E 1; death_E 1 3 4 |
| #bebebe | 113 | sleeper-soil #e3c29e | 6.89 | red clay | idle_W 0 1; walk_W 0–5; dodge_W 1 3; light_1_W 0–2; light_2_W 0–2; light_3_W 0–2; heavy_charge_W 0; heavy_thrust_W 1; heavy_hold_W 0; heavy_recover_W 0 1; haul_throw_W 0 1; haul_recover_W 0 1; haul_pull_W 1; haul_pull_SW 0 1; haul_slide_W 1; hit_W 1; death_W 2 |
| #a4a8ae | 112 | hollow-dusk #a99fc4 | 4.74 | shell, stone | idle_W 0 1; walk_NE 0–2 4 5; walk_W 0 2–5; dodge_W 1 3; light_1_W 0 1; light_2_NE 1; light_2_W 1 2; light_3_W 0 1; heavy_charge_NE 0–2; heavy_charge_W 0; heavy_thrust_NE 0 1; heavy_thrust_W 1; heavy_hold_NE 0; heavy_hold_W 0; heavy_recover_NE 0; heavy_recover_W 0; haul_throw_NE 0; haul_throw_W 1; haul_recover_W 1; haul_pull_NE 0 1; haul_pull_W 0 1; haul_slide_NE 0 1; haul_slide_W 0 1; hit_W 0; death_W 2 |
| #69a191 | 103 | watcher-stone #7d8794 | 7.89 | cloth, steel | heavy_charge_N 0–2 |
| #7c664f | 98 | wheel-brass-dark #8a6420 | 5.3 | brass, leather | idle_E 0 1; idle_SW 0 1; walk_SW 0–5; dodge_E 0; dodge_SW 0 1 3; light_1_SW 0–2; light_2_E 0–2; light_2_SW 0 1; light_3_E 0; light_3_SW 1 2; heavy_charge_E 0; heavy_charge_SW 0; heavy_thrust_SW 0 1; heavy_hold_SW 0; heavy_recover_SW 1; haul_throw_E 0 1; haul_throw_SW 0; haul_recover_E 0 1; haul_recover_SW 0 1; haul_pull_E 0 1; haul_pull_SW 0 1; haul_slide_E 0 1; haul_slide_SW 0 1; hit_E 1; death_E 1 |

## Skin regions to resolve

- idle_S_0: a region of 1 px in the skin colours at [[28, 59], [28, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 1 px in the skin colours at [[52, 59], [52, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 1 px in the skin colours at [[29, 60], [29, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_1: a region of 1 px in the skin colours at [[52, 59], [52, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 1 px in the skin colours at [[41, 39], [41, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 2 px in the skin colours at [[32, 55], [33, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_1: a region of 1 px in the skin colours at [[40, 38], [40, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_1: a region of 1 px in the skin colours at [[33, 55], [33, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 1 px in the skin colours at [[43, 38], [43, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 1 px in the skin colours at [[24, 50], [24, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 2 px in the skin colours at [[37, 51], [37, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 1 px in the skin colours at [[25, 53], [25, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 2 px in the skin colours at [[34, 53], [35, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 1 px in the skin colours at [[29, 57], [29, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_1: a region of 1 px in the skin colours at [[36, 51], [36, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_1: a region of 2 px in the skin colours at [[34, 53], [35, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NE_0: a region of 2 px in the skin colours at [[50, 32], [50, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NE_0: a region of 1 px in the skin colours at [[34, 35], [34, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NE_1: a region of 2 px in the skin colours at [[48, 32], [48, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_0: a region of 10 px in the skin colours at [[29, 27], [30, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_0: a region of 11 px in the skin colours at [[51, 50], [53, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_0: a region of 1 px in the skin colours at [[48, 56], [48, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_0: a region of 1 px in the skin colours at [[44, 57], [44, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_1: a region of 5 px in the skin colours at [[30, 27], [31, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_1: a region of 2 px in the skin colours at [[30, 32], [30, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_1: a region of 7 px in the skin colours at [[50, 51], [51, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_1: a region of 1 px in the skin colours at [[47, 56], [47, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_1: a region of 1 px in the skin colours at [[43, 57], [43, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_0: a region of 2 px in the skin colours at [[42, 56], [42, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_0: a region of 1 px in the skin colours at [[48, 56], [48, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_1: a region of 2 px in the skin colours at [[42, 56], [42, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_1: a region of 1 px in the skin colours at [[48, 56], [48, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[31, 30], [31, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[39, 39], [39, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[38, 40], [38, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[37, 41], [37, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 2 px in the skin colours at [[35, 42], [36, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[35, 48], [35, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[38, 48], [38, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 2 px in the skin colours at [[40, 50], [41, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 2 px in the skin colours at [[33, 55], [34, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[46, 57], [46, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[51, 57], [51, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[27, 58], [27, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[32, 29], [32, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[39, 38], [39, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[38, 39], [38, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[37, 40], [37, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 2 px in the skin colours at [[35, 41], [36, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[44, 41], [44, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[35, 48], [35, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[38, 48], [38, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[40, 50], [40, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[34, 55], [34, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_1: a region of 1 px in the skin colours at [[51, 57], [51, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 3 px in the skin colours at [[33, 55], [33, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 1 px in the skin colours at [[27, 57], [27, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_1: a region of 3 px in the skin colours at [[33, 55], [33, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_2: a region of 3 px in the skin colours at [[33, 55], [33, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_2: a region of 1 px in the skin colours at [[30, 57], [30, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 1 px in the skin colours at [[32, 54], [32, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 1 px in the skin colours at [[51, 54], [51, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 1 px in the skin colours at [[53, 54], [53, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 2 px in the skin colours at [[31, 54], [32, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 1 px in the skin colours at [[51, 54], [51, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 1 px in the skin colours at [[46, 55], [46, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 1 px in the skin colours at [[47, 56], [47, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 1 px in the skin colours at [[49, 57], [49, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_1: a region of 2 px in the skin colours at [[41, 50], [41, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_4: a region of 1 px in the skin colours at [[43, 55], [43, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_4: a region of 1 px in the skin colours at [[41, 61], [41, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_5: a region of 1 px in the skin colours at [[45, 61], [45, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 2 px in the skin colours at [[35, 51], [35, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 1 px in the skin colours at [[43, 54], [43, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 1 px in the skin colours at [[33, 52], [33, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 2 px in the skin colours at [[31, 53], [32, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 1 px in the skin colours at [[34, 54], [34, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 4 px in the skin colours at [[33, 52], [35, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 2 px in the skin colours at [[37, 52], [37, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 1 px in the skin colours at [[27, 56], [27, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 1 px in the skin colours at [[26, 57], [26, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 1 px in the skin colours at [[28, 58], [28, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_3: a region of 2 px in the skin colours at [[33, 51], [33, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 5 px in the skin colours at [[47, 43], [49, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 2 px in the skin colours at [[31, 51], [31, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 2 px in the skin colours at [[33, 51], [33, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 2 px in the skin colours at [[26, 54], [26, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 1 px in the skin colours at [[35, 57], [35, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_0: a region of 2 px in the skin colours at [[48, 32], [48, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_0: a region of 1 px in the skin colours at [[33, 35], [33, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_0: a region of 1 px in the skin colours at [[45, 61], [45, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_1: a region of 2 px in the skin colours at [[49, 32], [49, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_1: a region of 1 px in the skin colours at [[34, 35], [34, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_2: a region of 2 px in the skin colours at [[48, 32], [48, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_2: a region of 1 px in the skin colours at [[33, 35], [33, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_3: a region of 2 px in the skin colours at [[48, 32], [48, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_3: a region of 1 px in the skin colours at [[33, 35], [33, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_3: a region of 1 px in the skin colours at [[45, 61], [45, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_4: a region of 1 px in the skin colours at [[48, 32], [48, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_4: a region of 1 px in the skin colours at [[33, 34], [33, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_4: a region of 1 px in the skin colours at [[36, 58], [36, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_4: a region of 1 px in the skin colours at [[42, 59], [42, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_5: a region of 2 px in the skin colours at [[48, 32], [48, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_0: a region of 5 px in the skin colours at [[30, 27], [31, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_0: a region of 2 px in the skin colours at [[30, 32], [30, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_0: a region of 2 px in the skin colours at [[50, 54], [50, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_0: a region of 1 px in the skin colours at [[36, 58], [36, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_0: a region of 1 px in the skin colours at [[34, 60], [34, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_1: a region of 5 px in the skin colours at [[31, 27], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_1: a region of 2 px in the skin colours at [[31, 32], [31, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_1: a region of 1 px in the skin colours at [[33, 43], [33, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_1: a region of 5 px in the skin colours at [[34, 45], [35, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_1: a region of 2 px in the skin colours at [[50, 54], [50, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_1: a region of 8 px in the skin colours at [[33, 58], [36, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_1: a region of 3 px in the skin colours at [[44, 60], [46, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 5 px in the skin colours at [[31, 27], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 2 px in the skin colours at [[31, 32], [31, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 1 px in the skin colours at [[33, 43], [33, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 5 px in the skin colours at [[34, 45], [35, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 2 px in the skin colours at [[51, 54], [51, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 5 px in the skin colours at [[35, 58], [36, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 2 px in the skin colours at [[37, 60], [38, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_2: a region of 1 px in the skin colours at [[46, 60], [46, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_3: a region of 5 px in the skin colours at [[31, 27], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_3: a region of 2 px in the skin colours at [[31, 32], [31, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_3: a region of 3 px in the skin colours at [[34, 44], [34, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_3: a region of 5 px in the skin colours at [[51, 51], [51, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_3: a region of 1 px in the skin colours at [[37, 58], [37, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_4: a region of 5 px in the skin colours at [[30, 27], [31, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_4: a region of 2 px in the skin colours at [[30, 32], [30, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_4: a region of 1 px in the skin colours at [[32, 43], [32, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_4: a region of 5 px in the skin colours at [[51, 51], [51, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_4: a region of 1 px in the skin colours at [[48, 56], [48, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_4: a region of 1 px in the skin colours at [[36, 58], [36, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_4: a region of 3 px in the skin colours at [[40, 61], [42, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_5: a region of 5 px in the skin colours at [[30, 27], [31, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_5: a region of 2 px in the skin colours at [[30, 32], [30, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_5: a region of 1 px in the skin colours at [[33, 45], [33, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_5: a region of 4 px in the skin colours at [[51, 52], [51, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NW_5: a region of 2 px in the skin colours at [[40, 61], [41, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_W_1: a region of 7 px in the skin colours at [[31, 44], [33, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_W_1: a region of 1 px in the skin colours at [[44, 55], [44, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_W_1: a region of 1 px in the skin colours at [[47, 59], [47, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_W_2: a region of 2 px in the skin colours at [[33, 45], [33, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_W_2: a region of 1 px in the skin colours at [[50, 54], [50, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_W_5: a region of 1 px in the skin colours at [[49, 58], [49, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_W_5: a region of 2 px in the skin colours at [[44, 60], [45, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_0: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_0: a region of 2 px in the skin colours at [[40, 50], [41, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_1: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_1: a region of 1 px in the skin colours at [[27, 50], [27, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_1: a region of 2 px in the skin colours at [[40, 50], [41, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_2: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_2: a region of 2 px in the skin colours at [[40, 50], [41, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_3: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_3: a region of 2 px in the skin colours at [[40, 50], [41, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_4: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_4: a region of 1 px in the skin colours at [[44, 52], [44, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_4: a region of 1 px in the skin colours at [[29, 59], [29, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_4: a region of 1 px in the skin colours at [[30, 61], [30, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_5: a region of 1 px in the skin colours at [[34, 47], [34, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SW_5: a region of 2 px in the skin colours at [[40, 50], [41, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_S_0: a region of 1 px in the skin colours at [[37, 40], [37, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_S_3: a region of 1 px in the skin colours at [[45, 38], [45, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_0: a region of 1 px in the skin colours at [[38, 45], [38, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_0: a region of 2 px in the skin colours at [[33, 46], [34, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_0: a region of 1 px in the skin colours at [[40, 46], [40, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_0: a region of 1 px in the skin colours at [[19, 50], [19, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_1: a region of 2 px in the skin colours at [[47, 32], [47, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_1: a region of 1 px in the skin colours at [[37, 42], [37, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_1: a region of 1 px in the skin colours at [[37, 45], [37, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_1: a region of 1 px in the skin colours at [[26, 46], [26, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_2: a region of 1 px in the skin colours at [[33, 39], [33, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_2: a region of 1 px in the skin colours at [[34, 40], [34, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_2: a region of 1 px in the skin colours at [[35, 43], [35, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_3: a region of 1 px in the skin colours at [[35, 34], [35, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_3: a region of 1 px in the skin colours at [[39, 36], [39, 36]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_3: a region of 1 px in the skin colours at [[36, 45], [36, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_3: a region of 3 px in the skin colours at [[30, 46], [32, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SE_3: a region of 1 px in the skin colours at [[31, 56], [31, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_0: a region of 1 px in the skin colours at [[34, 38], [34, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_1: a region of 2 px in the skin colours at [[46, 31], [47, 31]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_1: a region of 1 px in the skin colours at [[18, 45], [18, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_1: a region of 1 px in the skin colours at [[18, 48], [18, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_1: a region of 1 px in the skin colours at [[23, 48], [23, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_1: a region of 3 px in the skin colours at [[38, 51], [40, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_1: a region of 1 px in the skin colours at [[24, 52], [24, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_2: a region of 2 px in the skin colours at [[46, 31], [47, 31]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_3: a region of 1 px in the skin colours at [[41, 27], [41, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_3: a region of 1 px in the skin colours at [[39, 49], [39, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_E_3: a region of 1 px in the skin colours at [[38, 50], [38, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NE_0: a region of 6 px in the skin colours at [[36, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NE_1: a region of 4 px in the skin colours at [[37, 53], [38, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NE_2: a region of 1 px in the skin colours at [[46, 33], [46, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NE_3: a region of 2 px in the skin colours at [[44, 28], [44, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NE_3: a region of 1 px in the skin colours at [[43, 30], [43, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_0: a region of 2 px in the skin colours at [[24, 30], [24, 31]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_0: a region of 5 px in the skin colours at [[45, 46], [46, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_1: a region of 1 px in the skin colours at [[43, 43], [43, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_1: a region of 8 px in the skin colours at [[41, 44], [44, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_3: a region of 2 px in the skin colours at [[42, 30], [42, 31]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_3: a region of 2 px in the skin colours at [[24, 31], [24, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_3: a region of 1 px in the skin colours at [[44, 39], [44, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_3: a region of 2 px in the skin colours at [[43, 41], [44, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_NW_3: a region of 2 px in the skin colours at [[45, 42], [45, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_0: a region of 3 px in the skin colours at [[30, 20], [31, 21]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_0: a region of 3 px in the skin colours at [[23, 41], [24, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_0: a region of 2 px in the skin colours at [[30, 51], [30, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_0: a region of 1 px in the skin colours at [[43, 51], [43, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_0: a region of 2 px in the skin colours at [[37, 52], [38, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_1: a region of 2 px in the skin colours at [[47, 25], [48, 25]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_1: a region of 4 px in the skin colours at [[40, 30], [42, 31]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_1: a region of 2 px in the skin colours at [[38, 32], [38, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_1: a region of 2 px in the skin colours at [[21, 37], [22, 37]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_1: a region of 1 px in the skin colours at [[27, 47], [27, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_2: a region of 1 px in the skin colours at [[33, 25], [33, 25]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_2: a region of 1 px in the skin colours at [[38, 27], [38, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_2: a region of 1 px in the skin colours at [[42, 27], [42, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_2: a region of 1 px in the skin colours at [[28, 46], [28, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_3: a region of 1 px in the skin colours at [[29, 35], [29, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_W_3: a region of 1 px in the skin colours at [[34, 44], [34, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_0: a region of 2 px in the skin colours at [[19, 41], [19, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_0: a region of 1 px in the skin colours at [[39, 49], [39, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_0: a region of 1 px in the skin colours at [[31, 50], [31, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_1: a region of 1 px in the skin colours at [[42, 40], [42, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_1: a region of 1 px in the skin colours at [[21, 43], [21, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_1: a region of 1 px in the skin colours at [[31, 51], [31, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_1: a region of 2 px in the skin colours at [[32, 52], [33, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_2: a region of 1 px in the skin colours at [[26, 23], [26, 23]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_2: a region of 1 px in the skin colours at [[29, 35], [29, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_2: a region of 1 px in the skin colours at [[21, 43], [21, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_2: a region of 1 px in the skin colours at [[26, 48], [26, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_3: a region of 1 px in the skin colours at [[37, 26], [37, 26]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_3: a region of 9 px in the skin colours at [[23, 35], [27, 37]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- dodge_SW_3: a region of 1 px in the skin colours at [[38, 52], [38, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_0: a region of 1 px in the skin colours at [[22, 47], [22, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_1: a region of 1 px in the skin colours at [[40, 48], [40, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_0: a region of 5 px in the skin colours at [[41, 21], [42, 24]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_0: a region of 1 px in the skin colours at [[30, 29], [30, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_1: a region of 1 px in the skin colours at [[44, 40], [44, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_1: a region of 1 px in the skin colours at [[44, 42], [44, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_1: a region of 1 px in the skin colours at [[42, 49], [42, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_2: a region of 1 px in the skin colours at [[23, 43], [23, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_2: a region of 2 px in the skin colours at [[42, 45], [42, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_2: a region of 1 px in the skin colours at [[16, 49], [16, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_2: a region of 1 px in the skin colours at [[21, 50], [21, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SE_2: a region of 1 px in the skin colours at [[34, 50], [34, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_0: a region of 2 px in the skin colours at [[27, 43], [27, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_0: a region of 1 px in the skin colours at [[29, 45], [29, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_1: a region of 1 px in the skin colours at [[37, 32], [37, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_1: a region of 1 px in the skin colours at [[37, 36], [37, 36]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_1: a region of 2 px in the skin colours at [[31, 46], [31, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_1: a region of 1 px in the skin colours at [[25, 48], [25, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_2: a region of 2 px in the skin colours at [[30, 45], [30, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_2: a region of 1 px in the skin colours at [[40, 46], [40, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_0: a region of 1 px in the skin colours at [[42, 27], [42, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_0: a region of 1 px in the skin colours at [[26, 29], [26, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_0: a region of 1 px in the skin colours at [[22, 50], [22, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_1: a region of 1 px in the skin colours at [[26, 30], [26, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_1: a region of 1 px in the skin colours at [[15, 40], [15, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_1: a region of 1 px in the skin colours at [[39, 55], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_2: a region of 1 px in the skin colours at [[27, 30], [27, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NE_2: a region of 1 px in the skin colours at [[39, 55], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NW_0: a region of 1 px in the skin colours at [[23, 34], [23, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_NW_0: a region of 1 px in the skin colours at [[31, 50], [31, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_W_1: a region of 1 px in the skin colours at [[42, 41], [42, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_W_1: a region of 5 px in the skin colours at [[43, 47], [45, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_W_1: a region of 1 px in the skin colours at [[35, 50], [35, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_W_2: a region of 1 px in the skin colours at [[31, 34], [31, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_W_2: a region of 1 px in the skin colours at [[29, 36], [29, 36]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_0: a region of 1 px in the skin colours at [[27, 34], [27, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_1: a region of 1 px in the skin colours at [[41, 26], [41, 26]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_1: a region of 2 px in the skin colours at [[44, 33], [44, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_1: a region of 5 px in the skin colours at [[33, 34], [36, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_1: a region of 1 px in the skin colours at [[37, 34], [37, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_1: a region of 1 px in the skin colours at [[21, 38], [21, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_1: a region of 1 px in the skin colours at [[39, 43], [39, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_1: a region of 1 px in the skin colours at [[47, 49], [47, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_2: a region of 1 px in the skin colours at [[30, 33], [30, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_2: a region of 1 px in the skin colours at [[28, 41], [28, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_2: a region of 3 px in the skin colours at [[34, 43], [35, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_2: a region of 1 px in the skin colours at [[23, 44], [23, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_SW_2: a region of 1 px in the skin colours at [[51, 50], [51, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_S_0: a region of 3 px in the skin colours at [[20, 38], [20, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_S_0: a region of 2 px in the skin colours at [[17, 39], [18, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SE_0: a region of 1 px in the skin colours at [[41, 28], [41, 28]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SE_1: a region of 1 px in the skin colours at [[35, 41], [35, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SE_2: a region of 1 px in the skin colours at [[34, 50], [34, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_E_0: a region of 1 px in the skin colours at [[32, 33], [32, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_E_0: a region of 1 px in the skin colours at [[33, 34], [33, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_E_0: a region of 6 px in the skin colours at [[42, 35], [43, 37]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_E_1: a region of 6 px in the skin colours at [[42, 36], [43, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_E_2: a region of 1 px in the skin colours at [[35, 34], [35, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_E_2: a region of 2 px in the skin colours at [[35, 40], [36, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_0: a region of 2 px in the skin colours at [[43, 27], [43, 28]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_0: a region of 2 px in the skin colours at [[26, 29], [27, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_1: a region of 2 px in the skin colours at [[4, 26], [4, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_1: a region of 2 px in the skin colours at [[43, 26], [43, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_1: a region of 2 px in the skin colours at [[26, 29], [27, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_1: a region of 1 px in the skin colours at [[44, 39], [44, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_2: a region of 2 px in the skin colours at [[43, 26], [43, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_2: a region of 2 px in the skin colours at [[26, 29], [27, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NE_2: a region of 1 px in the skin colours at [[38, 53], [38, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NW_0: a region of 1 px in the skin colours at [[42, 22], [42, 22]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NW_0: a region of 1 px in the skin colours at [[25, 50], [25, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_NW_1: a region of 2 px in the skin colours at [[22, 43], [23, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_W_0: a region of 1 px in the skin colours at [[31, 19], [31, 19]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_W_1: a region of 1 px in the skin colours at [[33, 21], [33, 21]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_W_2: a region of 1 px in the skin colours at [[31, 23], [31, 23]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_W_2: a region of 1 px in the skin colours at [[47, 48], [47, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SW_0: a region of 1 px in the skin colours at [[27, 34], [27, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SW_0: a region of 1 px in the skin colours at [[28, 41], [28, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SW_0: a region of 1 px in the skin colours at [[26, 47], [26, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SW_0: a region of 1 px in the skin colours at [[49, 48], [49, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SW_1: a region of 2 px in the skin colours at [[29, 32], [30, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SW_1: a region of 3 px in the skin colours at [[38, 43], [40, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_2_SW_1: a region of 2 px in the skin colours at [[36, 44], [37, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_0: a region of 1 px in the skin colours at [[31, 30], [31, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_0: a region of 1 px in the skin colours at [[34, 33], [34, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_0: a region of 1 px in the skin colours at [[32, 44], [32, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_1: a region of 1 px in the skin colours at [[37, 28], [37, 28]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_1: a region of 1 px in the skin colours at [[32, 34], [32, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_1: a region of 1 px in the skin colours at [[33, 35], [33, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_2: a region of 1 px in the skin colours at [[33, 37], [33, 37]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SE_2: a region of 1 px in the skin colours at [[34, 38], [34, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_E_0: a region of 4 px in the skin colours at [[41, 43], [41, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_E_0: a region of 2 px in the skin colours at [[25, 44], [25, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_E_1: a region of 6 px in the skin colours at [[40, 47], [41, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_E_1: a region of 1 px in the skin colours at [[23, 49], [23, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_E_2: a region of 2 px in the skin colours at [[40, 47], [41, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_E_2: a region of 1 px in the skin colours at [[23, 51], [23, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_E_2: a region of 1 px in the skin colours at [[21, 55], [21, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_NW_0: a region of 4 px in the skin colours at [[22, 37], [23, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_NW_1: a region of 4 px in the skin colours at [[22, 37], [23, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_W_0: a region of 1 px in the skin colours at [[29, 36], [29, 36]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_W_0: a region of 1 px in the skin colours at [[29, 42], [29, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_W_0: a region of 1 px in the skin colours at [[38, 49], [38, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SW_0: a region of 1 px in the skin colours at [[22, 45], [22, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SW_0: a region of 1 px in the skin colours at [[50, 50], [50, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_3_SW_2: a region of 2 px in the skin colours at [[26, 46], [26, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_S_1: a region of 1 px in the skin colours at [[34, 38], [34, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_S_1: a region of 4 px in the skin colours at [[23, 42], [24, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_S_1: a region of 1 px in the skin colours at [[22, 45], [22, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_S_2: a region of 1 px in the skin colours at [[23, 39], [23, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SE_0: a region of 1 px in the skin colours at [[18, 51], [18, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SE_1: a region of 1 px in the skin colours at [[43, 48], [43, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SE_1: a region of 1 px in the skin colours at [[16, 51], [16, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SE_2: a region of 1 px in the skin colours at [[30, 32], [30, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SE_2: a region of 1 px in the skin colours at [[28, 33], [28, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SE_2: a region of 1 px in the skin colours at [[16, 49], [16, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SE_2: a region of 1 px in the skin colours at [[34, 49], [34, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_0: a region of 8 px in the skin colours at [[40, 39], [41, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_0: a region of 1 px in the skin colours at [[20, 41], [20, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_0: a region of 2 px in the skin colours at [[19, 42], [19, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_0: a region of 1 px in the skin colours at [[36, 43], [36, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_0: a region of 1 px in the skin colours at [[21, 50], [21, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_0: a region of 1 px in the skin colours at [[27, 50], [27, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_1: a region of 12 px in the skin colours at [[40, 38], [42, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_1: a region of 1 px in the skin colours at [[36, 43], [36, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_2: a region of 12 px in the skin colours at [[40, 38], [42, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_2: a region of 1 px in the skin colours at [[21, 41], [21, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_E_2: a region of 1 px in the skin colours at [[36, 43], [36, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_0: a region of 2 px in the skin colours at [[44, 28], [44, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_0: a region of 2 px in the skin colours at [[27, 29], [28, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_0: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_1: a region of 2 px in the skin colours at [[44, 28], [44, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_1: a region of 2 px in the skin colours at [[27, 29], [28, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_1: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_2: a region of 2 px in the skin colours at [[44, 28], [44, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_2: a region of 2 px in the skin colours at [[27, 29], [28, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_2: a region of 1 px in the skin colours at [[21, 35], [21, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_NE_2: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_N_0: a region of 5 px in the skin colours at [[18, 44], [18, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SW_0: a region of 2 px in the skin colours at [[22, 43], [22, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SW_0: a region of 1 px in the skin colours at [[35, 43], [35, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SW_0: a region of 1 px in the skin colours at [[35, 45], [35, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SW_1: a region of 1 px in the skin colours at [[29, 43], [29, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SW_2: a region of 1 px in the skin colours at [[31, 34], [31, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_charge_SW_2: a region of 2 px in the skin colours at [[26, 44], [27, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_S_0: a region of 1 px in the skin colours at [[30, 35], [30, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_S_0: a region of 1 px in the skin colours at [[37, 37], [37, 37]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_S_0: a region of 1 px in the skin colours at [[43, 47], [43, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SE_0: a region of 1 px in the skin colours at [[32, 31], [32, 31]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SE_0: a region of 1 px in the skin colours at [[36, 33], [36, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SE_0: a region of 1 px in the skin colours at [[35, 34], [35, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SE_1: a region of 1 px in the skin colours at [[32, 30], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_E_0: a region of 2 px in the skin colours at [[23, 44], [23, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_E_1: a region of 1 px in the skin colours at [[22, 50], [22, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_NE_0: a region of 2 px in the skin colours at [[44, 28], [44, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_NE_0: a region of 1 px in the skin colours at [[27, 29], [27, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_NE_0: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_NE_1: a region of 1 px in the skin colours at [[24, 30], [24, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_NE_1: a region of 2 px in the skin colours at [[41, 30], [42, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_NE_1: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SW_0: a region of 1 px in the skin colours at [[50, 43], [50, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SW_0: a region of 1 px in the skin colours at [[42, 50], [42, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SW_1: a region of 1 px in the skin colours at [[33, 32], [33, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SW_1: a region of 1 px in the skin colours at [[31, 43], [31, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_thrust_SW_1: a region of 1 px in the skin colours at [[26, 47], [26, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_hold_SE_0: a region of 1 px in the skin colours at [[32, 30], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_hold_E_0: a region of 2 px in the skin colours at [[37, 41], [37, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_hold_NE_0: a region of 1 px in the skin colours at [[24, 29], [24, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_hold_NE_0: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_hold_SW_0: a region of 1 px in the skin colours at [[33, 32], [33, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_hold_SW_0: a region of 1 px in the skin colours at [[31, 43], [31, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_hold_SW_0: a region of 1 px in the skin colours at [[26, 47], [26, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_S_0: a region of 1 px in the skin colours at [[40, 36], [40, 36]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_S_0: a region of 1 px in the skin colours at [[40, 41], [40, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_S_1: a region of 2 px in the skin colours at [[43, 47], [44, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SE_0: a region of 1 px in the skin colours at [[32, 30], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SE_0: a region of 3 px in the skin colours at [[37, 34], [38, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SE_0: a region of 1 px in the skin colours at [[14, 46], [14, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SE_1: a region of 1 px in the skin colours at [[29, 29], [29, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SE_1: a region of 1 px in the skin colours at [[20, 50], [20, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SE_1: a region of 2 px in the skin colours at [[31, 54], [31, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_E_0: a region of 1 px in the skin colours at [[37, 41], [37, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_E_1: a region of 1 px in the skin colours at [[40, 41], [40, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_E_1: a region of 1 px in the skin colours at [[36, 43], [36, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_NE_0: a region of 1 px in the skin colours at [[24, 29], [24, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_NE_0: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_NE_1: a region of 2 px in the skin colours at [[43, 26], [43, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_NE_1: a region of 1 px in the skin colours at [[27, 29], [27, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_NE_1: a region of 3 px in the skin colours at [[38, 54], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SW_0: a region of 1 px in the skin colours at [[34, 32], [34, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SW_0: a region of 1 px in the skin colours at [[38, 43], [38, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SW_1: a region of 2 px in the skin colours at [[22, 43], [22, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SW_1: a region of 1 px in the skin colours at [[35, 43], [35, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- heavy_recover_SW_1: a region of 1 px in the skin colours at [[35, 45], [35, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_S_0: a region of 1 px in the skin colours at [[45, 44], [45, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_S_1: a region of 1 px in the skin colours at [[26, 46], [26, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_S_1: a region of 1 px in the skin colours at [[40, 46], [40, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SE_0: a region of 1 px in the skin colours at [[29, 30], [29, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SE_0: a region of 2 px in the skin colours at [[29, 44], [30, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SE_0: a region of 2 px in the skin colours at [[18, 47], [19, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SE_1: a region of 1 px in the skin colours at [[32, 30], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SE_1: a region of 2 px in the skin colours at [[37, 32], [38, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SE_1: a region of 1 px in the skin colours at [[32, 44], [32, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_E_0: a region of 2 px in the skin colours at [[39, 44], [39, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_E_1: a region of 1 px in the skin colours at [[35, 42], [35, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_E_1: a region of 1 px in the skin colours at [[38, 42], [38, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NE_0: a region of 6 px in the skin colours at [[44, 26], [45, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NE_0: a region of 1 px in the skin colours at [[15, 43], [15, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NE_0: a region of 19 px in the skin colours at [[34, 46], [38, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NE_0: a region of 4 px in the skin colours at [[36, 55], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NE_1: a region of 1 px in the skin colours at [[44, 26], [44, 26]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NE_1: a region of 19 px in the skin colours at [[35, 45], [39, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NE_1: a region of 4 px in the skin colours at [[36, 55], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_N_1: a region of 1 px in the skin colours at [[15, 42], [15, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NW_0: a region of 2 px in the skin colours at [[25, 27], [25, 28]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NW_0: a region of 1 px in the skin colours at [[45, 45], [45, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NW_1: a region of 2 px in the skin colours at [[26, 26], [26, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NW_1: a region of 7 px in the skin colours at [[44, 45], [45, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_NW_1: a region of 1 px in the skin colours at [[45, 52], [45, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_W_0: a region of 1 px in the skin colours at [[31, 42], [31, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_W_1: a region of 1 px in the skin colours at [[46, 40], [46, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_W_1: a region of 1 px in the skin colours at [[45, 41], [45, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SW_0: a region of 3 px in the skin colours at [[36, 43], [38, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SW_0: a region of 2 px in the skin colours at [[34, 44], [35, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SW_1: a region of 3 px in the skin colours at [[36, 43], [38, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SW_1: a region of 2 px in the skin colours at [[34, 44], [35, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_throw_SW_1: a region of 1 px in the skin colours at [[51, 45], [51, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_S_1: a region of 1 px in the skin colours at [[32, 36], [32, 36]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SE_0: a region of 1 px in the skin colours at [[32, 30], [32, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SE_0: a region of 1 px in the skin colours at [[31, 45], [31, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SE_1: a region of 1 px in the skin colours at [[31, 44], [31, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SE_1: a region of 1 px in the skin colours at [[41, 45], [41, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_E_1: a region of 1 px in the skin colours at [[39, 43], [39, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_0: a region of 5 px in the skin colours at [[42, 26], [43, 28]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_0: a region of 3 px in the skin colours at [[39, 47], [39, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_0: a region of 1 px in the skin colours at [[38, 50], [38, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_0: a region of 4 px in the skin colours at [[36, 55], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_1: a region of 2 px in the skin colours at [[42, 26], [42, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_1: a region of 1 px in the skin colours at [[15, 44], [15, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_1: a region of 2 px in the skin colours at [[39, 48], [39, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NE_1: a region of 4 px in the skin colours at [[36, 55], [39, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NW_0: a region of 2 px in the skin colours at [[27, 26], [27, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NW_0: a region of 1 px in the skin colours at [[49, 38], [49, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NW_0: a region of 1 px in the skin colours at [[48, 39], [48, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NW_0: a region of 5 px in the skin colours at [[46, 46], [46, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NW_1: a region of 2 px in the skin colours at [[26, 26], [26, 27]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_NW_1: a region of 5 px in the skin colours at [[46, 46], [46, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SW_0: a region of 1 px in the skin colours at [[46, 42], [46, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SW_0: a region of 3 px in the skin colours at [[37, 43], [39, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SW_0: a region of 1 px in the skin colours at [[22, 44], [22, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_recover_SW_0: a region of 2 px in the skin colours at [[35, 44], [36, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_S_0: a region of 1 px in the skin colours at [[21, 51], [21, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_S_0: a region of 1 px in the skin colours at [[44, 51], [44, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SE_0: a region of 1 px in the skin colours at [[30, 30], [30, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SE_0: a region of 1 px in the skin colours at [[31, 31], [31, 31]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SE_0: a region of 2 px in the skin colours at [[17, 49], [18, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SE_0: a region of 1 px in the skin colours at [[28, 53], [28, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SE_1: a region of 4 px in the skin colours at [[27, 47], [29, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_E_0: a region of 1 px in the skin colours at [[30, 32], [30, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_E_0: a region of 1 px in the skin colours at [[27, 42], [27, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_E_0: a region of 1 px in the skin colours at [[28, 46], [28, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_E_0: a region of 1 px in the skin colours at [[27, 47], [27, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_E_0: a region of 1 px in the skin colours at [[29, 47], [29, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NE_0: a region of 1 px in the skin colours at [[18, 29], [18, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NE_0: a region of 1 px in the skin colours at [[41, 38], [41, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NE_0: a region of 1 px in the skin colours at [[35, 54], [35, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NE_1: a region of 1 px in the skin colours at [[27, 30], [27, 30]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NE_1: a region of 1 px in the skin colours at [[39, 45], [39, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NW_0: a region of 11 px in the skin colours at [[44, 42], [47, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NW_0: a region of 3 px in the skin colours at [[23, 44], [24, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NW_0: a region of 1 px in the skin colours at [[46, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NW_1: a region of 1 px in the skin colours at [[25, 26], [25, 26]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NW_1: a region of 2 px in the skin colours at [[31, 27], [31, 28]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NW_1: a region of 2 px in the skin colours at [[47, 45], [47, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_NW_1: a region of 2 px in the skin colours at [[46, 48], [46, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SW_1: a region of 1 px in the skin colours at [[22, 41], [22, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SW_1: a region of 1 px in the skin colours at [[36, 43], [36, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SW_1: a region of 5 px in the skin colours at [[38, 44], [41, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_pull_SW_1: a region of 1 px in the skin colours at [[44, 51], [44, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_S_1: a region of 2 px in the skin colours at [[26, 48], [26, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SE_0: a region of 8 px in the skin colours at [[35, 30], [38, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SE_0: a region of 1 px in the skin colours at [[32, 44], [32, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_E_0: a region of 4 px in the skin colours at [[25, 44], [26, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_E_0: a region of 1 px in the skin colours at [[21, 51], [21, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_E_1: a region of 1 px in the skin colours at [[36, 34], [36, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_0: a region of 1 px in the skin colours at [[27, 29], [27, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_0: a region of 1 px in the skin colours at [[39, 45], [39, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_0: a region of 1 px in the skin colours at [[19, 47], [19, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_0: a region of 1 px in the skin colours at [[37, 49], [37, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_0: a region of 3 px in the skin colours at [[39, 54], [40, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_1: a region of 1 px in the skin colours at [[16, 42], [16, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_1: a region of 1 px in the skin colours at [[32, 51], [32, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_1: a region of 1 px in the skin colours at [[37, 51], [37, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NE_1: a region of 5 px in the skin colours at [[38, 54], [41, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NW_0: a region of 9 px in the skin colours at [[44, 47], [46, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NW_0: a region of 2 px in the skin colours at [[41, 51], [42, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NW_0: a region of 1 px in the skin colours at [[29, 52], [29, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NW_0: a region of 2 px in the skin colours at [[28, 55], [29, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NW_1: a region of 2 px in the skin colours at [[18, 41], [19, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NW_1: a region of 2 px in the skin colours at [[45, 43], [46, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_NW_1: a region of 1 px in the skin colours at [[30, 49], [30, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_W_0: a region of 2 px in the skin colours at [[44, 47], [44, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_0: a region of 1 px in the skin colours at [[34, 34], [34, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_0: a region of 1 px in the skin colours at [[28, 41], [28, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_0: a region of 2 px in the skin colours at [[36, 43], [37, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_0: a region of 1 px in the skin colours at [[35, 44], [35, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_0: a region of 2 px in the skin colours at [[25, 51], [26, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_0: a region of 1 px in the skin colours at [[29, 52], [29, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_1: a region of 9 px in the skin colours at [[24, 41], [26, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_1: a region of 1 px in the skin colours at [[29, 43], [29, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- haul_slide_SW_1: a region of 5 px in the skin colours at [[35, 43], [38, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_0: a region of 1 px in the skin colours at [[35, 40], [35, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_0: a region of 2 px in the skin colours at [[26, 45], [26, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_0: a region of 2 px in the skin colours at [[22, 46], [23, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_0: a region of 2 px in the skin colours at [[20, 47], [21, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_0: a region of 2 px in the skin colours at [[32, 52], [32, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_1: a region of 1 px in the skin colours at [[24, 34], [24, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_1: a region of 2 px in the skin colours at [[25, 38], [25, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_S_1: a region of 1 px in the skin colours at [[32, 48], [32, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_0: a region of 1 px in the skin colours at [[44, 39], [44, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_0: a region of 1 px in the skin colours at [[27, 42], [27, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_0: a region of 5 px in the skin colours at [[27, 48], [28, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_0: a region of 1 px in the skin colours at [[44, 50], [44, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_0: a region of 1 px in the skin colours at [[34, 51], [34, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_1: a region of 1 px in the skin colours at [[26, 35], [26, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_1: a region of 1 px in the skin colours at [[38, 42], [38, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_1: a region of 1 px in the skin colours at [[34, 43], [34, 43]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_1: a region of 1 px in the skin colours at [[34, 56], [34, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_E_1: a region of 1 px in the skin colours at [[32, 58], [32, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_N_0: a region of 1 px in the skin colours at [[31, 49], [31, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_N_0: a region of 1 px in the skin colours at [[38, 55], [38, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_N_1: a region of 1 px in the skin colours at [[33, 48], [33, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_W_0: a region of 1 px in the skin colours at [[48, 54], [48, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_W_1: a region of 1 px in the skin colours at [[32, 38], [32, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_W_1: a region of 1 px in the skin colours at [[49, 56], [49, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- hit_W_1: a region of 1 px in the skin colours at [[47, 57], [47, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_0: a region of 2 px in the skin colours at [[29, 54], [30, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_0: a region of 2 px in the skin colours at [[47, 55], [48, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_0: a region of 1 px in the skin colours at [[53, 55], [53, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_0: a region of 1 px in the skin colours at [[32, 57], [32, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_0: a region of 1 px in the skin colours at [[39, 57], [39, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_1: a region of 1 px in the skin colours at [[46, 32], [46, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_1: a region of 1 px in the skin colours at [[42, 38], [42, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_1: a region of 4 px in the skin colours at [[27, 53], [29, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_1: a region of 1 px in the skin colours at [[51, 53], [51, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_1: a region of 2 px in the skin colours at [[49, 54], [50, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_1: a region of 1 px in the skin colours at [[33, 55], [33, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_1: a region of 1 px in the skin colours at [[48, 57], [48, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_2: a region of 1 px in the skin colours at [[32, 35], [32, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_2: a region of 4 px in the skin colours at [[27, 53], [29, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_2: a region of 2 px in the skin colours at [[34, 56], [35, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_2: a region of 1 px in the skin colours at [[41, 57], [41, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_2: a region of 2 px in the skin colours at [[49, 58], [50, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_3: a region of 1 px in the skin colours at [[44, 49], [44, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_3: a region of 2 px in the skin colours at [[25, 51], [26, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_3: a region of 2 px in the skin colours at [[49, 53], [49, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_3: a region of 1 px in the skin colours at [[29, 55], [29, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_3: a region of 2 px in the skin colours at [[38, 57], [39, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_4: a region of 3 px in the skin colours at [[38, 41], [39, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_4: a region of 1 px in the skin colours at [[43, 49], [43, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_4: a region of 1 px in the skin colours at [[22, 52], [22, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_4: a region of 5 px in the skin colours at [[38, 56], [41, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_5: a region of 1 px in the skin colours at [[55, 53], [55, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_5: a region of 4 px in the skin colours at [[41, 55], [44, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_5: a region of 1 px in the skin colours at [[55, 55], [55, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_5: a region of 1 px in the skin colours at [[24, 56], [24, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_5: a region of 1 px in the skin colours at [[39, 56], [39, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_5: a region of 1 px in the skin colours at [[47, 56], [47, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_S_5: a region of 2 px in the skin colours at [[53, 56], [54, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_0: a region of 6 px in the skin colours at [[46, 45], [48, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_0: a region of 1 px in the skin colours at [[22, 50], [22, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_0: a region of 1 px in the skin colours at [[28, 56], [28, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 1 px in the skin colours at [[24, 29], [24, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 6 px in the skin colours at [[34, 31], [37, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 1 px in the skin colours at [[49, 49], [49, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 1 px in the skin colours at [[43, 52], [43, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 1 px in the skin colours at [[45, 52], [45, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 1 px in the skin colours at [[27, 57], [27, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 1 px in the skin colours at [[34, 59], [34, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_1: a region of 2 px in the skin colours at [[36, 59], [36, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_2: a region of 1 px in the skin colours at [[46, 38], [46, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_2: a region of 2 px in the skin colours at [[32, 60], [33, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_2: a region of 1 px in the skin colours at [[37, 60], [37, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_3: a region of 1 px in the skin colours at [[28, 21], [28, 21]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_3: a region of 1 px in the skin colours at [[35, 26], [35, 26]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_3: a region of 1 px in the skin colours at [[43, 34], [43, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_3: a region of 2 px in the skin colours at [[45, 37], [46, 37]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_3: a region of 1 px in the skin colours at [[40, 60], [40, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_3: a region of 1 px in the skin colours at [[39, 61], [39, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_4: a region of 1 px in the skin colours at [[42, 60], [42, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_4: a region of 1 px in the skin colours at [[41, 61], [41, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 1 px in the skin colours at [[27, 40], [27, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 1 px in the skin colours at [[26, 41], [26, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 6 px in the skin colours at [[37, 41], [40, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 1 px in the skin colours at [[40, 48], [40, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 1 px in the skin colours at [[42, 48], [42, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 1 px in the skin colours at [[52, 48], [52, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 1 px in the skin colours at [[41, 49], [41, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_E_5: a region of 1 px in the skin colours at [[53, 49], [53, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_N_0: a region of 1 px in the skin colours at [[52, 53], [52, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_N_1: a region of 1 px in the skin colours at [[51, 52], [51, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_N_1: a region of 1 px in the skin colours at [[50, 53], [50, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_0: a region of 1 px in the skin colours at [[51, 53], [51, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_0: a region of 1 px in the skin colours at [[43, 57], [43, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_0: a region of 1 px in the skin colours at [[48, 58], [48, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_0: a region of 1 px in the skin colours at [[42, 59], [42, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_1: a region of 3 px in the skin colours at [[35, 37], [36, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_1: a region of 1 px in the skin colours at [[44, 53], [44, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_1: a region of 3 px in the skin colours at [[50, 54], [51, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_1: a region of 1 px in the skin colours at [[46, 55], [46, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_1: a region of 1 px in the skin colours at [[48, 55], [48, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_1: a region of 1 px in the skin colours at [[34, 57], [34, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_1: a region of 1 px in the skin colours at [[47, 57], [47, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 4 px in the skin colours at [[35, 31], [36, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[36, 34], [36, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[43, 34], [43, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[43, 40], [43, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[44, 41], [44, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[46, 42], [46, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[48, 42], [48, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[50, 56], [50, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 2 px in the skin colours at [[44, 57], [44, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[47, 59], [47, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_2: a region of 1 px in the skin colours at [[44, 60], [44, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_3: a region of 1 px in the skin colours at [[39, 40], [39, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_3: a region of 1 px in the skin colours at [[38, 41], [38, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_3: a region of 1 px in the skin colours at [[46, 41], [46, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_3: a region of 1 px in the skin colours at [[37, 44], [37, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_3: a region of 1 px in the skin colours at [[50, 44], [50, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 1 px in the skin colours at [[41, 34], [41, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 5 px in the skin colours at [[33, 38], [35, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 1 px in the skin colours at [[31, 39], [31, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 1 px in the skin colours at [[43, 41], [43, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 3 px in the skin colours at [[50, 43], [51, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 2 px in the skin colours at [[50, 45], [50, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 1 px in the skin colours at [[52, 46], [52, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 1 px in the skin colours at [[53, 48], [53, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_4: a region of 1 px in the skin colours at [[41, 49], [41, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_5: a region of 3 px in the skin colours at [[38, 40], [38, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_5: a region of 1 px in the skin colours at [[42, 40], [42, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_5: a region of 1 px in the skin colours at [[42, 51], [42, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- death_W_5: a region of 1 px in the skin colours at [[49, 56], [49, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
