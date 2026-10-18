# kindled-ash

Built by `pnpm art:build kindled-ash` from `art/sheets/kindled-ash.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind kindled, outline player, cell 96×80, origin (48, 64).

## Summary

- Frames: 456.
- Off-palette pixels snapped: 21031 (largest ΔE 9.61).
- Outline gaps (edge pixels not in an outline colour): 2620.
- Masked skin pixels: 33888.
- Loop seam flags (last → first above 1.5× the mean change): walk_S.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: idle_S_1, idle_SE_0, idle_SE_1, idle_E_0, idle_E_1, idle_SW_0, idle_SW_1, walk_S_2, walk_SE_0, walk_SE_1, walk_SE_2, walk_SE_3, walk_SE_4, walk_SE_5, walk_E_0, walk_E_1, walk_E_2, walk_E_3, walk_E_4, walk_E_5, walk_SW_0, walk_SW_1, walk_SW_2, walk_SW_3, walk_SW_4, walk_SW_5, run_S_3, run_S_4, run_SE_0, run_SE_1, run_SE_2, run_SE_3, run_SE_4, run_SE_5, run_SE_6, run_SE_7, run_E_1, run_E_2, run_E_3, run_E_4, run_E_5, run_E_6, run_E_7, run_NE_3, run_SW_0, run_SW_1, run_SW_2, run_SW_3, run_SW_4, run_SW_5, run_SW_6, run_SW_7, run_start_SE_0, run_start_SE_1, run_start_E_0, run_start_E_1, run_start_SW_0, run_start_SW_1, run_stop_SE_0, run_stop_SE_1, run_stop_E_1, run_stop_SW_0, run_stop_SW_1, run_back_S_1, run_back_S_2, run_back_S_3, run_back_SE_0, run_back_SE_1, run_back_SE_2, run_back_SE_3, run_back_E_0, run_back_E_1, run_back_E_3, run_back_NE_0, run_back_NE_1, run_back_NE_3, run_back_N_1, run_back_W_1, run_back_SW_0, run_back_SW_1, run_back_SW_2, run_back_SW_3, dodge_S_0, dodge_S_1, dodge_S_2, dodge_S_3, dodge_SE_0, dodge_SE_1, dodge_SE_2, dodge_SE_3, dodge_E_1, dodge_E_2, dodge_NE_0, dodge_NE_1, dodge_NE_2, dodge_NE_3, dodge_N_1, dodge_N_2, dodge_NW_0, dodge_NW_1, dodge_NW_2, dodge_NW_3, dodge_W_1, dodge_W_2, dodge_SW_0, dodge_SW_1, dodge_SW_2, dodge_SW_3, light_1_S_0, light_1_S_1, light_1_S_2, light_1_SE_0, light_1_SE_1, light_1_SE_2, light_1_E_0, light_1_E_1, light_1_E_2, light_1_NE_0, light_1_NW_0, light_1_W_0, light_1_W_1, light_1_W_2, light_1_SW_0, light_1_SW_1, light_1_SW_2, light_2_S_0, light_2_S_1, light_2_S_2, light_2_SE_0, light_2_SE_1, light_2_SE_2, light_2_E_0, light_2_E_1, light_2_E_2, light_2_NW_0, light_2_NW_1, light_2_NW_2, light_2_W_0, light_2_W_1, light_2_W_2, light_2_SW_0, light_2_SW_1, light_2_SW_2, light_3_S_0, light_3_S_1, light_3_S_2, light_3_SE_0, light_3_SE_1, light_3_SE_2, light_3_E_0, light_3_E_1, light_3_E_2, light_3_NE_0, light_3_NW_0, light_3_W_0, light_3_SW_0, light_3_SW_1, light_3_SW_2, heavy_charge_S_0, heavy_charge_S_1, heavy_charge_S_2, heavy_charge_SE_0, heavy_charge_SE_1, heavy_charge_SE_2, heavy_charge_E_0, heavy_charge_E_1, heavy_charge_E_2, heavy_charge_NE_1, heavy_charge_NW_1, heavy_charge_W_0, heavy_charge_W_1, heavy_charge_SW_0, heavy_charge_SW_1, heavy_charge_SW_2, heavy_thrust_S_0, heavy_thrust_S_1, heavy_thrust_SE_0, heavy_thrust_SE_1, heavy_thrust_E_0, heavy_thrust_E_1, heavy_thrust_NE_1, heavy_thrust_NW_1, heavy_thrust_SW_0, heavy_thrust_SW_1, heavy_hold_S_0, heavy_hold_SE_0, heavy_hold_E_0, heavy_hold_NE_0, heavy_hold_NW_0, heavy_hold_SW_0, heavy_recover_S_0, heavy_recover_S_1, heavy_recover_SE_0, heavy_recover_SE_1, heavy_recover_E_0, heavy_recover_E_1, heavy_recover_NE_0, heavy_recover_NW_0, heavy_recover_W_0, heavy_recover_W_1, heavy_recover_SW_0, heavy_recover_SW_1, haul_throw_S_0, haul_throw_S_1, haul_throw_SE_0, haul_throw_SE_1, haul_throw_E_0, haul_throw_E_1, haul_throw_NE_1, haul_throw_W_0, haul_throw_W_1, haul_throw_SW_0, haul_throw_SW_1, haul_recover_S_1, haul_recover_SE_0, haul_recover_SE_1, haul_recover_E_0, haul_recover_E_1, haul_recover_W_0, haul_recover_W_1, haul_recover_SW_0, haul_recover_SW_1, haul_pull_S_0, haul_pull_S_1, haul_pull_SE_0, haul_pull_SE_1, haul_pull_E_0, haul_pull_E_1, haul_pull_NW_1, haul_pull_SW_0, haul_pull_SW_1, haul_slide_S_0, haul_slide_S_1, haul_slide_SE_0, haul_slide_SE_1, haul_slide_E_0, haul_slide_E_1, haul_slide_NE_1, haul_slide_W_0, haul_slide_SW_0, haul_slide_SW_1, hit_S_0, hit_S_1, hit_E_1, hit_W_1, death_E_0, death_E_2.
- Skin regions to resolve: 0.
- Points: 88 placed (11 mirrored from their twin); missing: 0.
- Remap rules: 8; stale (match no pixel in any frame they apply to): none.
- Missing against the contract's table: carry_idle (all facings), carry_walk (all facings), sit (all facings).
- Optional (after M1, or awaiting art: a finished sheet may leave them out, but carries every facing of any it has): run_back (awaiting art), carry_idle (M2), carry_walk (M2), sit (M2).

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row. `tones.png` has the same rows in the four clay tones, through the mask: clay-grey-ochre, clay-pale, clay-red, clay-river-dark.

Rows, top to bottom: idle_S, idle_SE, idle_E, idle_NE, idle_N, idle_NW, idle_W, idle_SW, walk_S, walk_SE, walk_E, walk_NE, walk_N, walk_NW, walk_W, walk_SW, run_S, run_SE, run_E, run_NE, run_N, run_NW, run_W, run_SW, run_start_S, run_start_SE, run_start_E, run_start_NE, run_start_N, run_start_NW, run_start_W, run_start_SW, run_stop_S, run_stop_SE, run_stop_E, run_stop_NE, run_stop_N, run_stop_NW, run_stop_W, run_stop_SW, run_back_S, run_back_SE, run_back_E, run_back_NE, run_back_N, run_back_NW, run_back_W, run_back_SW, dodge_S, dodge_SE, dodge_E, dodge_NE, dodge_N, dodge_NW, dodge_W, dodge_SW, light_1_S, light_1_SE, light_1_E, light_1_NE, light_1_N, light_1_NW, light_1_W, light_1_SW, light_2_S, light_2_SE, light_2_E, light_2_NE, light_2_N, light_2_NW, light_2_W, light_2_SW, light_3_S, light_3_SE, light_3_E, light_3_NE, light_3_N, light_3_NW, light_3_W, light_3_SW, heavy_charge_S, heavy_charge_SE, heavy_charge_E, heavy_charge_NE, heavy_charge_N, heavy_charge_NW, heavy_charge_W, heavy_charge_SW, heavy_thrust_S, heavy_thrust_SE, heavy_thrust_E, heavy_thrust_NE, heavy_thrust_N, heavy_thrust_NW, heavy_thrust_W, heavy_thrust_SW, heavy_hold_S, heavy_hold_SE, heavy_hold_E, heavy_hold_NE, heavy_hold_N, heavy_hold_NW, heavy_hold_W, heavy_hold_SW, heavy_recover_S, heavy_recover_SE, heavy_recover_E, heavy_recover_NE, heavy_recover_N, heavy_recover_NW, heavy_recover_W, heavy_recover_SW, haul_throw_S, haul_throw_SE, haul_throw_E, haul_throw_NE, haul_throw_N, haul_throw_NW, haul_throw_W, haul_throw_SW, haul_recover_S, haul_recover_SE, haul_recover_E, haul_recover_NE, haul_recover_N, haul_recover_NW, haul_recover_W, haul_recover_SW, haul_pull_S, haul_pull_SE, haul_pull_E, haul_pull_NE, haul_pull_N, haul_pull_NW, haul_pull_W, haul_pull_SW, haul_slide_S, haul_slide_SE, haul_slide_E, haul_slide_NE, haul_slide_N, haul_slide_NW, haul_slide_W, haul_slide_SW, hit_S, hit_E, hit_N, hit_W, death_S, death_E, death_N, death_W.

`points.png` has the rows of the animations that carry points, at 4× on the floor, each point marked by a 1 px cross in telegraph pink round its pixel (listed under "Points").

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle_S | 2 | 278 / 278 | 45 46 (range 1) |  |
| idle_SE | 2 | 340 / 340 | 44 45 (range 1) |  |
| idle_E | 2 | 505 / 505 | 45 45 (range 0) |  |
| idle_NE | 2 | 359 / 359 | 45 45 (range 0) |  |
| idle_N | 2 | 91 / 91 | 45 45 (range 0) |  |
| idle_NW | 2 | 192 / 192 | 45 45 (range 0) |  |
| idle_W | 2 | 402 / 402 | 45 45 (range 0) |  |
| idle_SW | 2 | 397 / 397 | 44 45 (range 1) |  |
| walk_S | 6 | 640 / 383.4 **flag** | 44 45 45 44 45 45 (range 1) |  |
| walk_SE | 6 | 363 / 343.4 | 45 45 45 45 45 45 (range 0) |  |
| walk_E | 6 | 150 / 325 | 45 45 45 45 45 45 (range 0) |  |
| walk_NE | 6 | 215 / 364.8 | 45 47 46 45 46 45 (range 2) |  |
| walk_N | 6 | 169 / 244.2 | 45 46 46 45 46 45 (range 1) |  |
| walk_NW | 6 | 110 / 227.6 | 45 45 45 45 46 45 (range 1) |  |
| walk_W | 6 | 262 / 349.6 | 45 44 45 45 45 45 (range 1) |  |
| walk_SW | 6 | 114 / 216.6 | 45 45 45 45 45 45 (range 0) |  |
| run_S | 8 | 437 / 427.86 |  |  |
| run_SE | 8 | 560 / 501.14 |  |  |
| run_E | 8 | 430 / 515.29 |  |  |
| run_NE | 8 | 491 / 363.14 |  |  |
| run_N | 8 | 353 / 251.57 |  |  |
| run_NW | 8 | 271 / 301 |  |  |
| run_W | 8 | 559 / 492 |  |  |
| run_SW | 8 | 352 / 507.57 |  |  |
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
| run_back_S | 4 | 632 / 714.67 |  |  |
| run_back_SE | 4 | 659 / 649.33 |  |  |
| run_back_E | 4 | 470 / 619.33 |  |  |
| run_back_NE | 4 | 296 / 354.67 |  |  |
| run_back_N | 4 | 314 / 411.33 |  |  |
| run_back_NW | 4 | 489 / 510.67 |  |  |
| run_back_W | 4 | 489 / 484.67 |  |  |
| run_back_SW | 4 | 675 / 603 |  |  |
| dodge_S | 4 |  |  |  |
| dodge_SE | 4 |  |  |  |
| dodge_E | 4 |  |  |  |
| dodge_NE | 4 |  |  |  |
| dodge_N | 4 |  |  |  |
| dodge_NW | 4 |  |  |  |
| dodge_W | 4 |  |  |  |
| dodge_SW | 4 |  |  |  |
| light_1_S | 3 |  |  |  |
| light_1_SE | 3 |  |  |  |
| light_1_E | 3 |  |  |  |
| light_1_NE | 3 |  |  |  |
| light_1_N | 3 |  |  |  |
| light_1_NW | 3 |  |  |  |
| light_1_W | 3 |  |  |  |
| light_1_SW | 3 |  |  |  |
| light_2_S | 3 |  |  |  |
| light_2_SE | 3 |  |  |  |
| light_2_E | 3 |  |  |  |
| light_2_NE | 3 |  |  |  |
| light_2_N | 3 |  |  |  |
| light_2_NW | 3 |  |  |  |
| light_2_W | 3 |  |  |  |
| light_2_SW | 3 |  |  |  |
| light_3_S | 3 |  |  |  |
| light_3_SE | 3 |  |  |  |
| light_3_E | 3 |  |  |  |
| light_3_NE | 3 |  |  |  |
| light_3_N | 3 |  |  |  |
| light_3_NW | 3 |  |  |  |
| light_3_W | 3 |  |  |  |
| light_3_SW | 3 |  |  |  |
| heavy_charge_S | 3 |  |  |  |
| heavy_charge_SE | 3 |  |  |  |
| heavy_charge_E | 3 |  |  |  |
| heavy_charge_NE | 3 |  |  |  |
| heavy_charge_N | 3 |  |  |  |
| heavy_charge_NW | 3 |  |  |  |
| heavy_charge_W | 3 |  |  |  |
| heavy_charge_SW | 3 |  |  |  |
| heavy_thrust_S | 2 |  |  |  |
| heavy_thrust_SE | 2 |  |  |  |
| heavy_thrust_E | 2 |  |  |  |
| heavy_thrust_NE | 2 |  |  |  |
| heavy_thrust_N | 2 |  |  |  |
| heavy_thrust_NW | 2 |  |  |  |
| heavy_thrust_W | 2 |  |  |  |
| heavy_thrust_SW | 2 |  |  |  |
| heavy_hold_S | 1 |  |  |  |
| heavy_hold_SE | 1 |  |  |  |
| heavy_hold_E | 1 |  |  |  |
| heavy_hold_NE | 1 |  |  |  |
| heavy_hold_N | 1 |  |  |  |
| heavy_hold_NW | 1 |  |  |  |
| heavy_hold_W | 1 |  |  |  |
| heavy_hold_SW | 1 |  |  |  |
| heavy_recover_S | 2 |  |  |  |
| heavy_recover_SE | 2 |  |  |  |
| heavy_recover_E | 2 |  |  |  |
| heavy_recover_NE | 2 |  |  |  |
| heavy_recover_N | 2 |  |  |  |
| heavy_recover_NW | 2 |  |  |  |
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
| haul_pull_S | 2 | 711 / 711 |  |  |
| haul_pull_SE | 2 | 1047 / 1047 |  |  |
| haul_pull_E | 2 | 817 / 817 |  |  |
| haul_pull_NE | 2 | 823 / 823 |  |  |
| haul_pull_N | 2 | 571 / 571 |  |  |
| haul_pull_NW | 2 | 950 / 950 |  |  |
| haul_pull_W | 2 | 941 / 941 |  |  |
| haul_pull_SW | 2 | 733 / 733 |  |  |
| haul_slide_S | 2 | 826 / 826 |  |  |
| haul_slide_SE | 2 | 932 / 932 |  |  |
| haul_slide_E | 2 | 649 / 649 |  |  |
| haul_slide_NE | 2 | 521 / 521 |  |  |
| haul_slide_N | 2 | 599 / 599 |  |  |
| haul_slide_NW | 2 | 800 / 800 |  |  |
| haul_slide_W | 2 | 1072 / 1072 |  |  |
| haul_slide_SW | 2 | 782 / 782 |  |  |
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
| idle_S_0 | `art/raw/ss01-kindled-ash/idle/south 0` | 0 | 0 | -2 | 8, 0 | 4 | 11 | 178 |
| idle_S_1 | `art/raw/ss01-kindled-ash/idle/south 2` | 8 | 7.27 | -2 | 8, 0 | 5 | 13 **flag** | 180 |
| idle_SE_0 | `art/raw/ss01-kindled-ash/idle/south-east 0` | 81 | 6.92 | -1 | 8, 1 | 5 | 15 **flag** | 148 |
| idle_SE_1 | `art/raw/ss01-kindled-ash/idle/south-east 2` | 78 | 6.92 | -1 | 8, 1 | 2 | 15 **flag** | 149 |
| idle_E_0 | `art/clean/kindled-ash/idle/east 0` | 72 | 6.15 | -1 | 8, 1 | 16 | 14 **flag** | 65 |
| idle_E_1 | `art/clean/kindled-ash/idle/east 2` | 62 | 6.15 | -1 | 8, 1 | 10 | 14 **flag** | 72 |
| idle_NE_0 | `art/raw/ss01-kindled-ash/idle/north-east 0` | 12 | 6.15 | -1 | 8, 1 | 3 | 11 | 13 |
| idle_NE_1 | `art/raw/ss01-kindled-ash/idle/north-east 2` | 13 | 6.15 | -1 | 8, 1 | 1 | 11 | 13 |
| idle_N_0 | `art/raw/ss01-kindled-ash/idle/north 0` | 0 | 0 | -1 | 8, 1 | 6 | 4 | 0 |
| idle_N_1 | `art/raw/ss01-kindled-ash/idle/north 2` | 0 | 0 | -1 | 8, 1 | 3 | 4 | 0 |
| idle_NW_0 | `art/raw/ss01-kindled-ash/idle/north-west 0` | 26 | 5.53 | -1 | 8, 1 | 0 | 9 | 22 |
| idle_NW_1 | `art/raw/ss01-kindled-ash/idle/north-west 2` | 19 | 5.53 | -1 | 8, 1 | 0 | 10 | 19 |
| idle_W_0 | `art/clean/kindled-ash/idle/west 0` | 37 | 6.52 | -1 | 8, 1 | 7 | 12 | 69 |
| idle_W_1 | `art/clean/kindled-ash/idle/west 2` | 30 | 6.52 | -1 | 8, 1 | 4 | 12 | 69 |
| idle_SW_0 | `art/raw/ss01-kindled-ash/idle/south-west 0` | 70 | 6.92 | -1 | 8, 1 | 4 | 16 **flag** | 151 |
| idle_SW_1 | `art/raw/ss01-kindled-ash/idle/south-west 2` | 61 | 6.92 | -1 | 8, 1 | 5 | 16 **flag** | 144 |
| walk_S_0 | `art/raw/ss01-kindled-ash/walk/south 0` | 0 | 0 | 0 | 8, 2 | 9 | 12 | 178 |
| walk_S_1 | `art/raw/ss01-kindled-ash/walk/south 1` | 0 | 0 | -1 | 8, 1 | 4 | 12 | 178 |
| walk_S_2 | `art/raw/ss01-kindled-ash/walk/south 2` | 9 | 6.81 | -1 | 8, 1 | 5 | 15 **flag** | 173 |
| walk_S_3 | `art/raw/ss01-kindled-ash/walk/south 3` | 0 | 0 | 0 | 8, 2 | 1 | 12 | 172 |
| walk_S_4 | `art/raw/ss01-kindled-ash/walk/south 4` | 0 | 0 | -1 | 8, 1 | 2 | 12 | 172 |
| walk_S_5 | `art/raw/ss01-kindled-ash/walk/south 5` | 0 | 0 | -1 | 8, 1 | 7 | 11 | 177 |
| walk_SE_0 | `art/raw/ss01-kindled-ash/walk/south-east 0` | 85 | 6.92 | -1 | 8, 1 | 2 | 14 **flag** | 151 |
| walk_SE_1 | `art/raw/ss01-kindled-ash/walk/south-east 1` | 91 | 6.92 | -1 | 8, 1 | 1 | 15 **flag** | 140 |
| walk_SE_2 | `art/raw/ss01-kindled-ash/walk/south-east 2` | 81 | 6.92 | -1 | 8, 1 | 1 | 15 **flag** | 142 |
| walk_SE_3 | `art/raw/ss01-kindled-ash/walk/south-east 3` | 42 | 6.92 | -1 | 8, 1 | 1 | 15 **flag** | 151 |
| walk_SE_4 | `art/raw/ss01-kindled-ash/walk/south-east 4` | 100 | 6.92 | -1 | 8, 1 | 0 | 14 **flag** | 154 |
| walk_SE_5 | `art/raw/ss01-kindled-ash/walk/south-east 5` | 118 | 6.92 | -1 | 8, 1 | 10 | 14 **flag** | 155 |
| walk_E_0 | `art/clean/kindled-ash/walk/east 0` | 25 | 6.15 | -1 | 8, 1 | 3 | 14 **flag** | 78 |
| walk_E_1 | `art/clean/kindled-ash/walk/east 1` | 62 | 6.15 | -1 | 8, 1 | 13 | 13 **flag** | 83 |
| walk_E_2 | `art/clean/kindled-ash/walk/east 2` | 48 | 6.15 | -1 | 8, 1 | 13 | 14 **flag** | 82 |
| walk_E_3 | `art/clean/kindled-ash/walk/east 3` | 19 | 6.15 | -1 | 8, 1 | 0 | 14 **flag** | 79 |
| walk_E_4 | `art/clean/kindled-ash/walk/east 4` | 38 | 6.15 | -1 | 8, 1 | 13 | 14 **flag** | 84 |
| walk_E_5 | `art/clean/kindled-ash/walk/east 5` | 36 | 6.15 | -1 | 8, 1 | 11 | 14 **flag** | 78 |
| walk_NE_0 | `art/raw/ss01-kindled-ash/walk/north-east 0` | 13 | 6.15 | -1 | 8, 1 | 8 | 11 | 12 |
| walk_NE_1 | `art/raw/ss01-kindled-ash/walk/north-east 1` | 26 | 6.15 | -3 | 8, -1 | 9 | 11 | 13 |
| walk_NE_2 | `art/raw/ss01-kindled-ash/walk/north-east 2` | 24 | 6.15 | -2 | 8, 0 | 5 | 11 | 12 |
| walk_NE_3 | `art/raw/ss01-kindled-ash/walk/north-east 3` | 8 | 6.15 | -1 | 8, 1 | 0 | 11 | 13 |
| walk_NE_4 | `art/raw/ss01-kindled-ash/walk/north-east 4` | 32 | 6.15 | -1 | 8, 1 | 1 | 12 | 12 |
| walk_NE_5 | `art/raw/ss01-kindled-ash/walk/north-east 5` | 23 | 6.15 | -1 | 8, 1 | 6 | 11 | 13 |
| walk_N_0 | `art/raw/ss01-kindled-ash/walk/north 0` | 0 | 0 | -1 | 8, 1 | 0 | 4 | 0 |
| walk_N_1 | `art/raw/ss01-kindled-ash/walk/north 1` | 0 | 0 | -2 | 8, 0 | 0 | 4 | 0 |
| walk_N_2 | `art/raw/ss01-kindled-ash/walk/north 2` | 0 | 0 | -2 | 8, 0 | 0 | 4 | 0 |
| walk_N_3 | `art/raw/ss01-kindled-ash/walk/north 3` | 0 | 0 | -1 | 8, 1 | 0 | 4 | 0 |
| walk_N_4 | `art/raw/ss01-kindled-ash/walk/north 4` | 0 | 0 | -2 | 8, 0 | 3 | 4 | 0 |
| walk_N_5 | `art/raw/ss01-kindled-ash/walk/north 5` | 0 | 0 | -1 | 8, 1 | 2 | 4 | 0 |
| walk_NW_0 | `art/raw/ss01-kindled-ash/walk/north-west 0` | 20 | 5.53 | -1 | 8, 1 | 0 | 10 | 15 |
| walk_NW_1 | `art/raw/ss01-kindled-ash/walk/north-west 1` | 31 | 5.53 | -1 | 8, 1 | 3 | 10 | 11 |
| walk_NW_2 | `art/raw/ss01-kindled-ash/walk/north-west 2` | 26 | 5.53 | -1 | 8, 1 | 3 | 10 | 13 |
| walk_NW_3 | `art/raw/ss01-kindled-ash/walk/north-west 3` | 16 | 5.53 | -1 | 8, 1 | 0 | 10 | 19 |
| walk_NW_4 | `art/raw/ss01-kindled-ash/walk/north-west 4` | 24 | 5.53 | -2 | 8, 0 | 0 | 10 | 15 |
| walk_NW_5 | `art/raw/ss01-kindled-ash/walk/north-west 5` | 26 | 5.53 | -1 | 8, 1 | 1 | 9 | 15 |
| walk_W_0 | `art/clean/kindled-ash/walk/west 0` | 12 | 6.52 | -1 | 8, 1 | 1 | 11 | 69 |
| walk_W_1 | `art/clean/kindled-ash/walk/west 1` | 39 | 6.1 | 0 | 8, 2 | 7 | 12 | 75 |
| walk_W_2 | `art/clean/kindled-ash/walk/west 2` | 50 | 6.1 | -1 | 8, 1 | 10 | 12 | 70 |
| walk_W_3 | `art/clean/kindled-ash/walk/west 3` | 11 | 6.1 | -1 | 8, 1 | 1 | 12 | 69 |
| walk_W_4 | `art/clean/kindled-ash/walk/west 4` | 46 | 6.52 | -1 | 8, 1 | 2 | 11 | 67 |
| walk_W_5 | `art/clean/kindled-ash/walk/west 5` | 51 | 6.1 | -1 | 8, 1 | 7 | 12 | 68 |
| walk_SW_0 | `art/raw/ss01-kindled-ash/walk/south-west 0` | 44 | 6.92 | -1 | 8, 1 | 3 | 15 **flag** | 142 |
| walk_SW_1 | `art/raw/ss01-kindled-ash/walk/south-west 1` | 47 | 6.92 | -1 | 8, 1 | 4 | 15 **flag** | 139 |
| walk_SW_2 | `art/raw/ss01-kindled-ash/walk/south-west 2` | 48 | 6.92 | -1 | 8, 1 | 10 | 15 **flag** | 142 |
| walk_SW_3 | `art/raw/ss01-kindled-ash/walk/south-west 3` | 42 | 6.92 | -1 | 8, 1 | 1 | 15 **flag** | 144 |
| walk_SW_4 | `art/raw/ss01-kindled-ash/walk/south-west 4` | 49 | 6.92 | -1 | 8, 1 | 3 | 14 **flag** | 130 |
| walk_SW_5 | `art/raw/ss01-kindled-ash/walk/south-west 5` | 54 | 6.92 | -1 | 8, 1 | 3 | 14 **flag** | 140 |
| run_S_0 | `art/clean/kindled-ash/run/south 2` | 0 | 0 | -1 | 8, 1 | 4 | 10 | 148 |
| run_S_1 | `art/clean/kindled-ash/run/south 3` | 0 | 0 | -1 | 8, 1 | 4 | 10 | 156 |
| run_S_2 | `art/clean/kindled-ash/run/south 4` | 0 | 0 | -1 | 8, 1 | 7 | 11 | 141 |
| run_S_3 | `art/clean/kindled-ash/run/south 5` | 46 | 8.02 | -1 | 8, 1 | 22 | 15 **flag** | 138 |
| run_S_4 | `art/clean/kindled-ash/run/south 6` | 31 | 5.87 | -1 | 8, 1 | 12 | 14 **flag** | 162 |
| run_S_5 | `art/clean/kindled-ash/run/south 7` | 0 | 0 | -1 | 8, 1 | 9 | 10 | 154 |
| run_S_6 | `art/clean/kindled-ash/run/south 0` | 0 | 0 | -1 | 8, 1 | 18 | 12 | 160 |
| run_S_7 | `art/clean/kindled-ash/run/south 1` | 0 | 0 | -1 | 8, 1 | 1 | 10 | 141 |
| run_SE_0 | `art/clean/kindled-ash/run/south-east 5` | 192 | 6.92 | -2 | 8, 0 | 17 | 13 **flag** | 129 |
| run_SE_1 | `art/clean/kindled-ash/run/south-east 6` | 188 | 6.92 | -2 | 8, 0 | 22 | 14 **flag** | 134 |
| run_SE_2 | `art/clean/kindled-ash/run/south-east 7` | 179 | 7.69 | -2 | 8, 0 | 17 | 14 **flag** | 125 |
| run_SE_3 | `art/clean/kindled-ash/run/south-east 0` | 158 | 7.69 | -2 | 8, 0 | 21 | 15 **flag** | 110 |
| run_SE_4 | `art/clean/kindled-ash/run/south-east 1` | 170 | 6.92 | -2 | 8, 0 | 16 | 14 **flag** | 119 |
| run_SE_5 | `art/clean/kindled-ash/run/south-east 2` | 179 | 7.69 | -2 | 8, 0 | 18 | 16 **flag** | 113 |
| run_SE_6 | `art/clean/kindled-ash/run/south-east 3` | 159 | 6.92 | -2 | 8, 0 | 21 | 14 **flag** | 119 |
| run_SE_7 | `art/clean/kindled-ash/run/south-east 4` | 142 | 6.92 | -2 | 8, 0 | 8 | 14 **flag** | 124 |
| run_E_0 | `art/clean/kindled-ash/run/east 4` | 108 | 6.15 | -1 | 8, 1 | 25 | 11 | 88 |
| run_E_1 | `art/clean/kindled-ash/run/east 5` | 113 | 6.15 | -1 | 8, 1 | 48 | 13 **flag** | 90 |
| run_E_2 | `art/clean/kindled-ash/run/east 6` | 118 | 6.15 | -1 | 8, 1 | 35 | 14 **flag** | 81 |
| run_E_3 | `art/clean/kindled-ash/run/east 7` | 80 | 6.15 | -1 | 8, 1 | 24 | 14 **flag** | 83 |
| run_E_4 | `art/clean/kindled-ash/run/east 0` | 107 | 6.15 | -1 | 8, 1 | 36 | 13 **flag** | 84 |
| run_E_5 | `art/clean/kindled-ash/run/east 1` | 110 | 6.15 | -1 | 8, 1 | 27 | 14 **flag** | 68 |
| run_E_6 | `art/clean/kindled-ash/run/east 2` | 117 | 6.15 | -1 | 8, 1 | 28 | 14 **flag** | 82 |
| run_E_7 | `art/clean/kindled-ash/run/east 3` | 84 | 6.15 | -1 | 8, 1 | 31 | 14 **flag** | 75 |
| run_NE_0 | `art/clean/kindled-ash/run/north-east 4` | 70 | 6.15 | -2 | 8, 0 | 11 | 10 | 19 |
| run_NE_1 | `art/clean/kindled-ash/run/north-east 5` | 121 | 6.15 | -2 | 8, 0 | 38 | 10 | 11 |
| run_NE_2 | `art/clean/kindled-ash/run/north-east 6` | 76 | 6.15 | -2 | 8, 0 | 22 | 11 | 17 |
| run_NE_3 | `art/clean/kindled-ash/run/north-east 7` | 80 | 6.15 | -2 | 8, 0 | 30 | 15 **flag** | 18 |
| run_NE_4 | `art/clean/kindled-ash/run/north-east 0` | 89 | 6.15 | -2 | 8, 0 | 39 | 10 | 17 |
| run_NE_5 | `art/clean/kindled-ash/run/north-east 1` | 79 | 6.15 | -2 | 8, 0 | 37 | 10 | 3 |
| run_NE_6 | `art/clean/kindled-ash/run/north-east 2` | 84 | 6.15 | -2 | 8, 0 | 26 | 11 | 9 |
| run_NE_7 | `art/clean/kindled-ash/run/north-east 3` | 85 | 6.15 | -2 | 8, 0 | 20 | 12 | 19 |
| run_N_0 | `art/clean/kindled-ash/run/north 3` | 0 | 0 | -2 | 8, 0 | 6 | 4 | 0 |
| run_N_1 | `art/clean/kindled-ash/run/north 4` | 0 | 0 | -2 | 8, 0 | 1 | 4 | 0 |
| run_N_2 | `art/clean/kindled-ash/run/north 5` | 0 | 0 | -2 | 8, 0 | 1 | 4 | 0 |
| run_N_3 | `art/clean/kindled-ash/run/north 6` | 0 | 0 | -2 | 8, 0 | 1 | 4 | 0 |
| run_N_4 | `art/clean/kindled-ash/run/north 7` | 0 | 0 | -2 | 8, 0 | 9 | 4 | 0 |
| run_N_5 | `art/clean/kindled-ash/run/north 0` | 0 | 0 | -2 | 8, 0 | 2 | 4 | 0 |
| run_N_6 | `art/clean/kindled-ash/run/north 1` | 0 | 0 | -2 | 8, 0 | 2 | 4 | 0 |
| run_N_7 | `art/clean/kindled-ash/run/north 2` | 0 | 0 | -2 | 8, 0 | 3 | 4 | 0 |
| run_NW_0 | `art/clean/kindled-ash/run/north-west 0` | 62 | 6 | -2 | 8, 0 | 5 | 11 | 14 |
| run_NW_1 | `art/clean/kindled-ash/run/north-west 1` | 67 | 5.53 | -2 | 8, 0 | 13 | 10 | 4 |
| run_NW_2 | `art/clean/kindled-ash/run/north-west 2` | 71 | 4.7 | -2 | 8, 0 | 5 | 10 | 7 |
| run_NW_3 | `art/clean/kindled-ash/run/north-west 3` | 50 | 5.53 | -2 | 8, 0 | 8 | 11 | 14 |
| run_NW_4 | `art/clean/kindled-ash/run/north-west 4` | 79 | 5.53 | -2 | 8, 0 | 7 | 10 | 11 |
| run_NW_5 | `art/clean/kindled-ash/run/north-west 5` | 104 | 5.53 | -2 | 8, 0 | 17 | 10 | 11 |
| run_NW_6 | `art/clean/kindled-ash/run/north-west 6` | 79 | 4.7 | -2 | 8, 0 | 7 | 10 | 4 |
| run_NW_7 | `art/clean/kindled-ash/run/north-west 7` | 57 | 5.53 | -2 | 8, 0 | 5 | 10 | 10 |
| run_W_0 | `art/clean/kindled-ash/run/west 0` | 151 | 6.52 | -1 | 8, 1 | 8 | 12 | 57 |
| run_W_1 | `art/clean/kindled-ash/run/west 1` | 149 | 6.52 | -1 | 8, 1 | 6 | 12 | 64 |
| run_W_2 | `art/clean/kindled-ash/run/west 2` | 130 | 6.52 | -1 | 8, 1 | 11 | 12 | 63 |
| run_W_3 | `art/clean/kindled-ash/run/west 3` | 126 | 6.52 | -1 | 8, 1 | 15 | 12 | 55 |
| run_W_4 | `art/clean/kindled-ash/run/west 4` | 108 | 6.52 | -1 | 8, 1 | 4 | 11 | 54 |
| run_W_5 | `art/clean/kindled-ash/run/west 5` | 159 | 6.1 | -1 | 8, 1 | 25 | 12 | 51 |
| run_W_6 | `art/clean/kindled-ash/run/west 6` | 142 | 6.52 | -1 | 8, 1 | 9 | 12 | 52 |
| run_W_7 | `art/clean/kindled-ash/run/west 7` | 141 | 6.1 | -1 | 8, 1 | 18 | 12 | 56 |
| run_SW_0 | `art/clean/kindled-ash/run/south-west 1` | 197 | 6.92 | -2 | 8, 0 | 20 | 15 **flag** | 126 |
| run_SW_1 | `art/clean/kindled-ash/run/south-west 2` | 158 | 6.92 | -2 | 8, 0 | 21 | 15 **flag** | 130 |
| run_SW_2 | `art/clean/kindled-ash/run/south-west 3` | 135 | 6.92 | -2 | 8, 0 | 13 | 14 **flag** | 118 |
| run_SW_3 | `art/clean/kindled-ash/run/south-west 4` | 112 | 6.92 | -2 | 8, 0 | 11 | 16 **flag** | 103 |
| run_SW_4 | `art/clean/kindled-ash/run/south-west 5` | 174 | 6.92 | -2 | 8, 0 | 33 | 14 **flag** | 105 |
| run_SW_5 | `art/clean/kindled-ash/run/south-west 6` | 135 | 6.92 | -2 | 8, 0 | 19 | 16 **flag** | 99 |
| run_SW_6 | `art/clean/kindled-ash/run/south-west 7` | 147 | 6.92 | -2 | 8, 0 | 12 | 13 **flag** | 126 |
| run_SW_7 | `art/clean/kindled-ash/run/south-west 0` | 196 | 6.92 | -2 | 8, 0 | 30 | 14 **flag** | 143 |
| run_start_S_0 | `art/clean/kindled-ash/run_start/south 0` | 0 | 0 | -2 | 0, 0 | 4 | 11 | 176 |
| run_start_S_1 | `art/clean/kindled-ash/run_start/south 1` | 0 | 0 | -2 | 0, 0 | 1 | 10 | 141 |
| run_start_SE_0 | `art/clean/kindled-ash/run_start/south-east 0` | 0 | 0 | -2 | 0, 0 | 6 | 15 **flag** | 147 |
| run_start_SE_1 | `art/clean/kindled-ash/run_start/south-east 1` | 0 | 0 | -2 | 0, 0 | 8 | 14 **flag** | 124 |
| run_start_E_0 | `art/clean/kindled-ash/run_start/east 0` | 0 | 0 | -2 | 0, 0 | 17 | 14 **flag** | 65 |
| run_start_E_1 | `art/clean/kindled-ash/run_start/east 1` | 0 | 0 | -2 | 0, 0 | 31 | 14 **flag** | 75 |
| run_start_NE_0 | `art/clean/kindled-ash/run_start/north-east 0` | 0 | 0 | -2 | 0, 0 | 3 | 11 | 13 |
| run_start_NE_1 | `art/clean/kindled-ash/run_start/north-east 1` | 0 | 0 | -2 | 0, 0 | 20 | 12 | 19 |
| run_start_N_0 | `art/clean/kindled-ash/run_start/north 0` | 0 | 0 | -2 | 0, 0 | 6 | 4 | 0 |
| run_start_N_1 | `art/clean/kindled-ash/run_start/north 1` | 0 | 0 | -2 | 0, 0 | 3 | 4 | 0 |
| run_start_NW_0 | `art/clean/kindled-ash/run_start/north-west 0` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| run_start_NW_1 | `art/clean/kindled-ash/run_start/north-west 1` | 0 | 0 | -2 | 0, 0 | 5 | 10 | 10 |
| run_start_W_0 | `art/clean/kindled-ash/run_start/west 0` | 0 | 0 | -2 | 0, 0 | 6 | 12 | 68 |
| run_start_W_1 | `art/clean/kindled-ash/run_start/west 1` | 0 | 0 | -2 | 0, 0 | 18 | 12 | 56 |
| run_start_SW_0 | `art/clean/kindled-ash/run_start/south-west 0` | 0 | 0 | -2 | 0, 0 | 4 | 16 **flag** | 149 |
| run_start_SW_1 | `art/clean/kindled-ash/run_start/south-west 1` | 0 | 0 | -2 | 0, 0 | 30 | 14 **flag** | 143 |
| run_stop_S_0 | `art/clean/kindled-ash/run_stop/south 0` | 0 | 0 | -2 | 0, 0 | 4 | 10 | 148 |
| run_stop_S_1 | `art/clean/kindled-ash/run_stop/south 1` | 0 | 0 | -2 | 0, 0 | 4 | 11 | 176 |
| run_stop_SE_0 | `art/clean/kindled-ash/run_stop/south-east 0` | 0 | 0 | -2 | 0, 0 | 17 | 13 **flag** | 129 |
| run_stop_SE_1 | `art/clean/kindled-ash/run_stop/south-east 1` | 0 | 0 | -2 | 0, 0 | 5 | 15 **flag** | 147 |
| run_stop_E_0 | `art/clean/kindled-ash/run_stop/east 0` | 0 | 0 | -2 | 0, 0 | 25 | 11 | 88 |
| run_stop_E_1 | `art/clean/kindled-ash/run_stop/east 1` | 0 | 0 | -2 | 0, 0 | 16 | 14 **flag** | 65 |
| run_stop_NE_0 | `art/clean/kindled-ash/run_stop/north-east 0` | 0 | 0 | -2 | 0, 0 | 11 | 10 | 19 |
| run_stop_NE_1 | `art/clean/kindled-ash/run_stop/north-east 1` | 0 | 0 | -2 | 0, 0 | 3 | 11 | 13 |
| run_stop_N_0 | `art/clean/kindled-ash/run_stop/north 0` | 0 | 0 | -2 | 0, 0 | 6 | 4 | 0 |
| run_stop_N_1 | `art/clean/kindled-ash/run_stop/north 1` | 0 | 0 | -2 | 0, 0 | 6 | 4 | 0 |
| run_stop_NW_0 | `art/clean/kindled-ash/run_stop/north-west 0` | 0 | 0 | -2 | 0, 0 | 5 | 11 | 14 |
| run_stop_NW_1 | `art/clean/kindled-ash/run_stop/north-west 1` | 0 | 0 | -2 | 0, 0 | 0 | 9 | 22 |
| run_stop_W_0 | `art/clean/kindled-ash/run_stop/west 0` | 0 | 0 | -2 | 0, 0 | 8 | 12 | 57 |
| run_stop_W_1 | `art/clean/kindled-ash/run_stop/west 1` | 0 | 0 | -2 | 0, 0 | 6 | 12 | 68 |
| run_stop_SW_0 | `art/clean/kindled-ash/run_stop/south-west 0` | 0 | 0 | -2 | 0, 0 | 20 | 15 **flag** | 126 |
| run_stop_SW_1 | `art/clean/kindled-ash/run_stop/south-west 1` | 0 | 0 | -2 | 0, 0 | 4 | 16 **flag** | 149 |
| run_back_S_0 | `art/raw/run-back-kindled-ash/run_back/south 2` | 23 | 5.47 | 0 | 14, 8 | 0 | 12 | 165 |
| run_back_S_1 | `art/raw/run-back-kindled-ash/run_back/south 4` | 17 | 6.49 | 0 | 14, 8 | 1 | 15 **flag** | 152 |
| run_back_S_2 | `art/raw/run-back-kindled-ash/run_back/south 6` | 26 | 8.13 | 0 | 14, 8 | 1 | 15 **flag** | 163 |
| run_back_S_3 | `art/raw/run-back-kindled-ash/run_back/south 5` | 34 | 9.61 | 0 | 14, 8 | 0 | 15 **flag** | 154 |
| run_back_SE_0 | `art/raw/run-back-kindled-ash/run_back/south-east 2` | 34 | 6.92 | -1 | 14, 7 | 2 | 13 **flag** | 140 |
| run_back_SE_1 | `art/raw/run-back-kindled-ash/run_back/south-east 5` | 70 | 7.81 | -1 | 14, 7 | 2 | 19 **flag** | 141 |
| run_back_SE_2 | `art/raw/run-back-kindled-ash/run_back/south-east 1` | 47 | 7.81 | -1 | 14, 7 | 1 | 16 **flag** | 136 |
| run_back_SE_3 | `art/raw/run-back-kindled-ash/run_back/south-east 4` | 53 | 6.92 | -1 | 14, 7 | 2 | 17 **flag** | 139 |
| run_back_E_0 | `art/clean/kindled-ash/run_back/east 2` | 31 | 6.15 | -1 | 14, 7 | 1 | 14 **flag** | 78 |
| run_back_E_1 | `art/clean/kindled-ash/run_back/east 4` | 57 | 6.15 | -1 | 14, 7 | 1 | 14 **flag** | 93 |
| run_back_E_2 | `art/clean/kindled-ash/run_back/east 6` | 46 | 6.15 | -1 | 14, 7 | 1 | 12 | 82 |
| run_back_E_3 | `art/clean/kindled-ash/run_back/east 1` | 35 | 7.29 | -1 | 14, 7 | 1 | 15 **flag** | 80 |
| run_back_NE_0 | `art/raw/run-back-kindled-ash/run_back/north-east 5` | 34 | 7.2 | -1 | 14, 7 | 0 | 13 **flag** | 14 |
| run_back_NE_1 | `art/raw/run-back-kindled-ash/run_back/north-east 1` | 22 | 7 | -1 | 14, 7 | 1 | 13 **flag** | 11 |
| run_back_NE_2 | `art/raw/run-back-kindled-ash/run_back/north-east 6` | 17 | 6.15 | -1 | 14, 7 | 0 | 11 | 14 |
| run_back_NE_3 | `art/raw/run-back-kindled-ash/run_back/north-east 3` | 27 | 7 | -1 | 14, 7 | 0 | 14 **flag** | 11 |
| run_back_N_0 | `art/raw/run-back-kindled-ash/run_back/north 2` | 11 | 7.43 | -1 | 14, 7 | 0 | 8 | 0 |
| run_back_N_1 | `art/raw/run-back-kindled-ash/run_back/north 4` | 38 | 6.43 | -1 | 14, 7 | 0 | 14 **flag** | 0 |
| run_back_N_2 | `art/raw/run-back-kindled-ash/run_back/north 6` | 32 | 6.43 | -1 | 14, 7 | 1 | 11 | 1 |
| run_back_N_3 | `art/raw/run-back-kindled-ash/run_back/north 1` | 10 | 7.28 | -1 | 14, 7 | 0 | 7 | 0 |
| run_back_NW_0 | `art/raw/run-back-kindled-ash/run_back/north-west 4` | 22 | 5.47 | -1 | 14, 7 | 0 | 10 | 19 |
| run_back_NW_1 | `art/raw/run-back-kindled-ash/run_back/north-west 1` | 17 | 5.08 | -1 | 14, 7 | 0 | 11 | 13 |
| run_back_NW_2 | `art/raw/run-back-kindled-ash/run_back/north-west 6` | 14 | 5.74 | -1 | 14, 7 | 1 | 10 | 15 |
| run_back_NW_3 | `art/raw/run-back-kindled-ash/run_back/north-west 2` | 22 | 5.84 | -1 | 14, 7 | 3 | 10 | 20 |
| run_back_W_0 | `art/clean/kindled-ash/run_back/west 2` | 9 | 6.1 | -1 | 14, 7 | 1 | 12 | 62 |
| run_back_W_1 | `art/clean/kindled-ash/run_back/west 5` | 22 | 6.52 | -1 | 14, 7 | 1 | 13 **flag** | 65 |
| run_back_W_2 | `art/clean/kindled-ash/run_back/west 4` | 14 | 7.3 | -1 | 14, 7 | 1 | 12 | 65 |
| run_back_W_3 | `art/clean/kindled-ash/run_back/west 1` | 14 | 6.54 | -1 | 14, 7 | 0 | 12 | 65 |
| run_back_SW_0 | `art/raw/run-back-kindled-ash/run_back/south-west 3` | 67 | 6.92 | -1 | 14, 7 | 1 | 16 **flag** | 120 |
| run_back_SW_1 | `art/raw/run-back-kindled-ash/run_back/south-west 6` | 48 | 6.92 | -1 | 14, 7 | 0 | 13 **flag** | 149 |
| run_back_SW_2 | `art/raw/run-back-kindled-ash/run_back/south-west 5` | 61 | 7.52 | -1 | 14, 7 | 1 | 17 **flag** | 137 |
| run_back_SW_3 | `art/raw/run-back-kindled-ash/run_back/south-west 1` | 63 | 6.93 | -1 | 14, 7 | 3 | 16 **flag** | 141 |
| dodge_S_0 | `art/clean/kindled-ash/dodge/south 1` | 103 | 6.93 | 0 | 16, 10 | 1 | 14 **flag** | 173 |
| dodge_S_1 | `art/clean/kindled-ash/dodge/south 2` | 70 | 6.92 | 0 | 16, 10 | 3 | 18 **flag** | 83 |
| dodge_S_2 | `art/clean/kindled-ash/dodge/south 3` | 33 | 6.92 | 0 | 16, 10 | 1 | 15 **flag** | 75 |
| dodge_S_3 | `art/clean/kindled-ash/dodge/south 4` | 49 | 6.93 | 0 | 16, 10 | 0 | 17 **flag** | 154 |
| dodge_SE_0 | mirrored from `art/raw/ss01-kindled-ash/dodge/south-west 4` | 65 | 6.54 | -1 | 14, 7 | 3 | 18 **flag** | 118 |
| dodge_SE_1 | mirrored from `art/raw/ss01-kindled-ash/dodge/south-west 5` | 70 | 6.92 | -1 | 14, 7 | 3 | 18 **flag** | 83 |
| dodge_SE_2 | mirrored from `art/raw/ss01-kindled-ash/dodge/south-west 6` | 33 | 6.92 | -1 | 14, 7 | 1 | 15 **flag** | 75 |
| dodge_SE_3 | mirrored from `art/raw/ss01-kindled-ash/dodge/south-west 7` | 97 | 8.44 | -1 | 14, 7 | 0 | 17 **flag** | 114 |
| dodge_E_0 | mirrored from `art/raw/ss01-kindled-ash/dodge/west 4` | 35 | 6.52 | -1 | 14, 7 | 1 | 12 | 60 |
| dodge_E_1 | mirrored from `art/raw/ss01-kindled-ash/dodge/west 6` | 57 | 8.04 | -1 | 14, 7 | 3 | 13 **flag** | 58 |
| dodge_E_2 | mirrored from `art/raw/ss01-kindled-ash/dodge/west 7` | 73 | 8.04 | -1 | 14, 7 | 3 | 13 **flag** | 58 |
| dodge_E_3 | mirrored from `art/raw/ss01-kindled-ash/dodge/west 8` | 29 | 8.04 | -1 | 14, 7 | 1 | 12 | 65 |
| dodge_NE_0 | mirrored from `art/raw/ss01-kindled-ash/dodge/north-west 2` | 22 | 7.12 | -1 | 14, 7 | 0 | 13 **flag** | 15 |
| dodge_NE_1 | mirrored from `art/raw/ss01-kindled-ash/dodge/north-west 4` | 40 | 5.87 | -1 | 14, 7 | 1 | 13 **flag** | 16 |
| dodge_NE_2 | mirrored from `art/raw/ss01-kindled-ash/dodge/north-west 6` | 87 | 7.71 | -1 | 14, 7 | 1 | 13 **flag** | 21 |
| dodge_NE_3 | mirrored from `art/raw/ss01-kindled-ash/dodge/north-west 8` | 56 | 6.77 | -1 | 14, 7 | 1 | 13 **flag** | 17 |
| dodge_N_0 | `art/clean/kindled-ash/dodge/north 1` | 8 | 4.93 | -1 | 16, 9 | 0 | 6 | 0 |
| dodge_N_1 | `art/clean/kindled-ash/dodge/north 2` | 111 | 7.53 | -1 | 16, 9 | 2 | 13 **flag** | 6 |
| dodge_N_2 | `art/clean/kindled-ash/dodge/north 3` | 85 | 7.71 | -1 | 16, 9 | 1 | 13 **flag** | 21 |
| dodge_N_3 | `art/clean/kindled-ash/dodge/north 4` | 0 | 0 | -1 | 16, 9 | 0 | 4 | 0 |
| dodge_NW_0 | `art/raw/ss01-kindled-ash/dodge/north-west 2` | 22 | 7.12 | -1 | 14, 7 | 0 | 13 **flag** | 15 |
| dodge_NW_1 | `art/raw/ss01-kindled-ash/dodge/north-west 4` | 40 | 5.87 | -1 | 14, 7 | 1 | 13 **flag** | 16 |
| dodge_NW_2 | `art/raw/ss01-kindled-ash/dodge/north-west 6` | 87 | 7.71 | -1 | 14, 7 | 1 | 13 **flag** | 21 |
| dodge_NW_3 | `art/raw/ss01-kindled-ash/dodge/north-west 8` | 56 | 6.77 | -1 | 14, 7 | 1 | 13 **flag** | 17 |
| dodge_W_0 | `art/raw/ss01-kindled-ash/dodge/west 4` | 35 | 6.52 | -1 | 14, 7 | 1 | 12 | 60 |
| dodge_W_1 | `art/raw/ss01-kindled-ash/dodge/west 6` | 57 | 8.04 | -1 | 14, 7 | 3 | 13 **flag** | 58 |
| dodge_W_2 | `art/raw/ss01-kindled-ash/dodge/west 7` | 73 | 8.04 | -1 | 14, 7 | 3 | 13 **flag** | 58 |
| dodge_W_3 | `art/raw/ss01-kindled-ash/dodge/west 8` | 29 | 8.04 | -1 | 14, 7 | 1 | 12 | 65 |
| dodge_SW_0 | `art/raw/ss01-kindled-ash/dodge/south-west 4` | 65 | 6.54 | -1 | 14, 7 | 3 | 18 **flag** | 118 |
| dodge_SW_1 | `art/raw/ss01-kindled-ash/dodge/south-west 5` | 70 | 6.92 | -1 | 14, 7 | 3 | 18 **flag** | 83 |
| dodge_SW_2 | `art/raw/ss01-kindled-ash/dodge/south-west 6` | 33 | 6.92 | -1 | 14, 7 | 1 | 15 **flag** | 75 |
| dodge_SW_3 | `art/raw/ss01-kindled-ash/dodge/south-west 7` | 97 | 8.44 | -1 | 14, 7 | 0 | 17 **flag** | 114 |
| light_1_S_0 | `art/raw/ss01-kindled-ash/light_1/south 1` | 46 | 7.37 | 0 | 14, 8 | 0 | 14 **flag** | 168 |
| light_1_S_1 | `art/raw/ss01-kindled-ash/light_1/south 3` | 43 | 6.41 | 0 | 14, 8 | 0 | 14 **flag** | 165 |
| light_1_S_2 | `art/raw/ss01-kindled-ash/light_1/south 6` | 45 | 6.41 | 0 | 14, 8 | 0 | 16 **flag** | 177 |
| light_1_SE_0 | `art/raw/ss01-kindled-ash/light_1/south-east 2` | 60 | 6.92 | -1 | 14, 7 | 0 | 15 **flag** | 142 |
| light_1_SE_1 | `art/raw/ss01-kindled-ash/light_1/south-east 4` | 90 | 8 | -1 | 14, 7 | 6 | 16 **flag** | 136 |
| light_1_SE_2 | `art/raw/ss01-kindled-ash/light_1/south-east 6` | 54 | 6.92 | -1 | 14, 7 | 1 | 14 **flag** | 132 |
| light_1_E_0 | `art/clean/kindled-ash/light_1/east 2` | 17 | 6.15 | -1 | 14, 7 | 1 | 14 **flag** | 76 |
| light_1_E_1 | `art/clean/kindled-ash/light_1/east 3` | 66 | 6.85 | -1 | 14, 7 | 0 | 15 **flag** | 77 |
| light_1_E_2 | `art/clean/kindled-ash/light_1/east 6` | 28 | 6.15 | -1 | 14, 7 | 1 | 14 **flag** | 79 |
| light_1_NE_0 | `art/raw/ss01-kindled-ash/light_1/north-east 1` | 30 | 6.15 | -1 | 14, 7 | 1 | 14 **flag** | 14 |
| light_1_NE_1 | `art/raw/ss01-kindled-ash/light_1/north-east 4` | 39 | 8.36 | -1 | 14, 7 | 1 | 12 | 7 |
| light_1_NE_2 | `art/raw/ss01-kindled-ash/light_1/north-east 6` | 27 | 8.36 | -1 | 14, 7 | 1 | 12 | 15 |
| light_1_N_0 | `art/raw/ss01-kindled-ash/light_1/north 0` | 0 | 0 | -1 | 14, 7 | 0 | 4 | 0 |
| light_1_N_1 | `art/raw/ss01-kindled-ash/light_1/north 5` | 11 | 6.48 | -1 | 14, 7 | 0 | 9 | 1 |
| light_1_N_2 | `art/raw/ss01-kindled-ash/light_1/north 6` | 3 | 6.66 | -1 | 14, 7 | 3 | 7 | 0 |
| light_1_NW_0 | mirrored from `art/raw/ss01-kindled-ash/light_1/north-east 1` | 30 | 6.15 | -1 | 14, 7 | 1 | 14 **flag** | 14 |
| light_1_NW_1 | mirrored from `art/raw/ss01-kindled-ash/light_1/north-east 4` | 39 | 8.36 | -1 | 14, 7 | 1 | 12 | 7 |
| light_1_NW_2 | mirrored from `art/raw/ss01-kindled-ash/light_1/north-east 6` | 27 | 8.36 | -1 | 14, 7 | 1 | 12 | 15 |
| light_1_W_0 | `art/clean/kindled-ash/light_1/west 4` | 65 | 8.64 | -1 | 14, 7 | 1 | 16 **flag** | 108 |
| light_1_W_1 | `art/clean/kindled-ash/light_1/west 5` | 87 | 6.52 | -1 | 14, 7 | 5 | 14 **flag** | 95 |
| light_1_W_2 | `art/clean/kindled-ash/light_1/west 6` | 29 | 6.1 | -1 | 14, 7 | 0 | 14 **flag** | 67 |
| light_1_SW_0 | `art/raw/ss01-kindled-ash/light_1/south-west 2` | 69 | 6.92 | -1 | 14, 7 | 1 | 18 **flag** | 153 |
| light_1_SW_1 | `art/raw/ss01-kindled-ash/light_1/south-west 3` | 121 | 6.92 | -1 | 14, 7 | 18 | 18 **flag** | 131 |
| light_1_SW_2 | `art/raw/ss01-kindled-ash/light_1/south-west 6` | 71 | 6.92 | -1 | 14, 7 | 4 | 17 **flag** | 141 |
| light_2_S_0 | `art/raw/ss01-kindled-ash/light_2/south 2` | 34 | 6.45 | 0 | 14, 8 | 3 | 14 **flag** | 148 |
| light_2_S_1 | `art/raw/ss01-kindled-ash/light_2/south 4` | 30 | 6.45 | 0 | 14, 8 | 0 | 15 **flag** | 141 |
| light_2_S_2 | `art/raw/ss01-kindled-ash/light_2/south 6` | 33 | 6.45 | 0 | 14, 8 | 0 | 13 **flag** | 143 |
| light_2_SE_0 | `art/raw/ss01-kindled-ash/light_2/south-east 4` | 65 | 6.92 | -1 | 14, 7 | 0 | 14 **flag** | 164 |
| light_2_SE_1 | `art/raw/ss01-kindled-ash/light_2/south-east 5` | 107 | 6.92 | -1 | 14, 7 | 0 | 19 **flag** | 147 |
| light_2_SE_2 | `art/raw/ss01-kindled-ash/light_2/south-east 6` | 61 | 6.55 | -1 | 14, 7 | 3 | 17 **flag** | 139 |
| light_2_E_0 | `art/clean/kindled-ash/light_2/east 4` | 43 | 7.92 | -1 | 14, 7 | 0 | 16 **flag** | 73 |
| light_2_E_1 | `art/clean/kindled-ash/light_2/east 5` | 61 | 6.45 | -1 | 14, 7 | 4 | 16 **flag** | 73 |
| light_2_E_2 | `art/clean/kindled-ash/light_2/east 6` | 41 | 7.92 | -1 | 14, 7 | 1 | 17 **flag** | 70 |
| light_2_NE_0 | `art/raw/ss01-kindled-ash/light_2/north-east 2` | 10 | 5.06 | -1 | 14, 7 | 1 | 10 | 10 |
| light_2_NE_1 | `art/raw/ss01-kindled-ash/light_2/north-east 5` | 6 | 4.93 | -1 | 14, 7 | 1 | 8 | 8 |
| light_2_NE_2 | `art/raw/ss01-kindled-ash/light_2/north-east 6` | 14 | 6.15 | -1 | 14, 7 | 5 | 10 | 18 |
| light_2_N_0 | `art/raw/ss01-kindled-ash/light_1/north 0` | 0 | 0 | -1 | 14, 7 | 0 | 4 | 0 |
| light_2_N_1 | `art/raw/ss01-kindled-ash/light_1/north 5` | 11 | 6.48 | -1 | 14, 7 | 0 | 9 | 1 |
| light_2_N_2 | `art/raw/ss01-kindled-ash/light_1/north 6` | 3 | 6.66 | -1 | 14, 7 | 3 | 7 | 0 |
| light_2_NW_0 | `art/raw/ss01-kindled-ash/light_2/north-west 2` | 16 | 5.67 | -1 | 14, 7 | 0 | 17 **flag** | 3 |
| light_2_NW_1 | `art/raw/ss01-kindled-ash/light_2/north-west 5` | 61 | 6.32 | -1 | 14, 7 | 5 | 15 **flag** | 10 |
| light_2_NW_2 | `art/raw/ss01-kindled-ash/light_2/north-west 6` | 42 | 5.76 | -1 | 14, 7 | 5 | 14 **flag** | 15 |
| light_2_W_0 | `art/clean/kindled-ash/light_2/west 2` | 40 | 6.98 | -1 | 14, 7 | 2 | 14 **flag** | 75 |
| light_2_W_1 | `art/clean/kindled-ash/light_2/west 5` | 38 | 7.27 | -1 | 14, 7 | 1 | 13 **flag** | 54 |
| light_2_W_2 | `art/clean/kindled-ash/light_2/west 6` | 13 | 6.98 | -1 | 14, 7 | 0 | 13 **flag** | 60 |
| light_2_SW_0 | `art/raw/ss01-kindled-ash/light_2/south-west 2` | 56 | 6.92 | -1 | 14, 7 | 2 | 17 **flag** | 144 |
| light_2_SW_1 | `art/raw/ss01-kindled-ash/light_2/south-west 3` | 88 | 6.92 | -1 | 14, 7 | 0 | 17 **flag** | 119 |
| light_2_SW_2 | `art/raw/ss01-kindled-ash/light_2/south-west 6` | 93 | 6.92 | -1 | 14, 7 | 1 | 18 **flag** | 150 |
| light_3_S_0 | `art/raw/ss01-kindled-ash/light_3/south 2` | 44 | 6.45 | 0 | 14, 8 | 1 | 15 **flag** | 136 |
| light_3_S_1 | `art/raw/ss01-kindled-ash/light_3/south 3` | 55 | 6.45 | 0 | 14, 8 | 1 | 15 **flag** | 131 |
| light_3_S_2 | `art/raw/ss01-kindled-ash/light_3/south 6` | 20 | 6.45 | 0 | 14, 8 | 0 | 15 **flag** | 135 |
| light_3_SE_0 | `art/raw/ss01-kindled-ash/light_3/south-east 2` | 62 | 6.92 | -1 | 14, 7 | 2 | 17 **flag** | 154 |
| light_3_SE_1 | `art/raw/ss01-kindled-ash/light_3/south-east 3` | 64 | 6.92 | -1 | 14, 7 | 1 | 15 **flag** | 153 |
| light_3_SE_2 | `art/raw/ss01-kindled-ash/light_3/south-east 6` | 44 | 6.55 | -1 | 14, 7 | 8 | 15 **flag** | 153 |
| light_3_E_0 | `art/clean/kindled-ash/light_3/east 2` | 30 | 7.87 | -1 | 14, 7 | 0 | 14 **flag** | 83 |
| light_3_E_1 | `art/clean/kindled-ash/light_3/east 4` | 34 | 7.87 | -1 | 14, 7 | 0 | 15 **flag** | 90 |
| light_3_E_2 | `art/clean/kindled-ash/light_3/east 6` | 25 | 7.87 | -1 | 14, 7 | 0 | 16 **flag** | 80 |
| light_3_NE_0 | mirrored from `art/raw/ss01-kindled-ash/light_3/north-west 2` | 34 | 5.84 | -1 | 14, 7 | 0 | 13 **flag** | 12 |
| light_3_NE_1 | mirrored from `art/raw/ss01-kindled-ash/light_3/north-west 4` | 11 | 5.53 | -1 | 14, 7 | 1 | 11 | 17 |
| light_3_NE_2 | mirrored from `art/raw/ss01-kindled-ash/light_3/north-west 6` | 12 | 5.53 | -1 | 14, 7 | 1 | 11 | 17 |
| light_3_N_0 | `art/raw/ss01-kindled-ash/light_3/north 2` | 4 | 5 | -1 | 14, 7 | 0 | 8 | 0 |
| light_3_N_1 | `art/raw/ss01-kindled-ash/light_3/north 4` | 7 | 8.56 | -1 | 14, 7 | 2 | 9 | 0 |
| light_3_N_2 | `art/raw/ss01-kindled-ash/light_3/north 5` | 9 | 7.48 | -1 | 14, 7 | 1 | 12 | 0 |
| light_3_NW_0 | `art/raw/ss01-kindled-ash/light_3/north-west 2` | 34 | 5.84 | -1 | 14, 7 | 0 | 13 **flag** | 12 |
| light_3_NW_1 | `art/raw/ss01-kindled-ash/light_3/north-west 4` | 11 | 5.53 | -1 | 14, 7 | 1 | 11 | 17 |
| light_3_NW_2 | `art/raw/ss01-kindled-ash/light_3/north-west 6` | 12 | 5.53 | -1 | 14, 7 | 1 | 11 | 17 |
| light_3_W_0 | `art/clean/kindled-ash/light_3/west 2` | 24 | 6.52 | -1 | 14, 7 | 1 | 13 **flag** | 69 |
| light_3_W_1 | `art/clean/kindled-ash/light_3/west 4` | 14 | 6.1 | -1 | 14, 7 | 2 | 11 | 59 |
| light_3_W_2 | `art/clean/kindled-ash/light_3/west 6` | 15 | 6.52 | -1 | 14, 7 | 2 | 12 | 56 |
| light_3_SW_0 | `art/raw/ss01-kindled-ash/light_3/south-west 2` | 42 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 150 |
| light_3_SW_1 | `art/raw/ss01-kindled-ash/light_3/south-west 4` | 62 | 6.92 | -1 | 14, 7 | 3 | 16 **flag** | 154 |
| light_3_SW_2 | `art/raw/ss01-kindled-ash/light_3/south-west 6` | 50 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 142 |
| heavy_charge_S_0 | `art/raw/ss01-kindled-ash/heavy/south 2` | 29 | 6.22 | 0 | 14, 8 | 1 | 14 **flag** | 162 |
| heavy_charge_S_1 | `art/raw/ss01-kindled-ash/heavy/south 3` | 48 | 7.46 | 0 | 14, 8 | 1 | 14 **flag** | 156 |
| heavy_charge_S_2 | `art/raw/ss01-kindled-ash/heavy/south 4` | 28 | 6.8 | 0 | 14, 8 | 1 | 15 **flag** | 145 |
| heavy_charge_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 2` | 48 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 149 |
| heavy_charge_SE_1 | `art/raw/ss01-kindled-ash/heavy/south-east 3` | 68 | 7.44 | -1 | 14, 7 | 3 | 17 **flag** | 137 |
| heavy_charge_SE_2 | `art/raw/ss01-kindled-ash/heavy/south-east 4` | 44 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 150 |
| heavy_charge_E_0 | `art/clean/kindled-ash/heavy/east 2` | 29 | 6.15 | -1 | 14, 7 | 4 | 16 **flag** | 78 |
| heavy_charge_E_1 | `art/clean/kindled-ash/heavy/east 3` | 42 | 7.71 | -1 | 14, 7 | 0 | 15 **flag** | 83 |
| heavy_charge_E_2 | `art/clean/kindled-ash/heavy/east 4` | 25 | 7.88 | -1 | 14, 7 | 1 | 13 **flag** | 77 |
| heavy_charge_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 2` | 9 | 5.94 | -1 | 14, 7 | 1 | 11 | 2 |
| heavy_charge_NE_1 | `art/raw/ss01-kindled-ash/heavy/north-east 3` | 16 | 6.37 | -1 | 14, 7 | 1 | 13 **flag** | 2 |
| heavy_charge_NE_2 | `art/raw/ss01-kindled-ash/heavy/north-east 5` | 13 | 6.15 | -1 | 14, 7 | 0 | 12 | 4 |
| heavy_charge_N_0 | `art/clean/kindled-ash/heavy/north 1` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_charge_N_1 | `art/clean/kindled-ash/heavy/north 2` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_charge_N_2 | `art/clean/kindled-ash/heavy/north 3` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_charge_NW_0 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 2` | 9 | 5.94 | -1 | 14, 7 | 1 | 11 | 2 |
| heavy_charge_NW_1 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 3` | 16 | 6.37 | -1 | 14, 7 | 1 | 13 **flag** | 2 |
| heavy_charge_NW_2 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 5` | 13 | 6.15 | -1 | 14, 7 | 0 | 12 | 4 |
| heavy_charge_W_0 | `art/clean/kindled-ash/heavy/west 2` | 23 | 6.18 | -1 | 14, 7 | 1 | 13 **flag** | 72 |
| heavy_charge_W_1 | `art/clean/kindled-ash/heavy/west 3` | 28 | 6.52 | -1 | 14, 7 | 0 | 13 **flag** | 66 |
| heavy_charge_W_2 | `art/clean/kindled-ash/heavy/west 4` | 7 | 6.1 | -1 | 14, 7 | 0 | 12 | 71 |
| heavy_charge_SW_0 | `art/raw/ss01-kindled-ash/heavy/south-west 1` | 93 | 6.92 | -1 | 14, 7 | 2 | 17 **flag** | 151 |
| heavy_charge_SW_1 | `art/raw/ss01-kindled-ash/heavy/south-west 2` | 46 | 6.92 | -1 | 14, 7 | 0 | 15 **flag** | 141 |
| heavy_charge_SW_2 | `art/raw/ss01-kindled-ash/heavy/south-west 4` | 19 | 6.92 | -1 | 14, 7 | 0 | 14 **flag** | 106 |
| heavy_thrust_S_0 | `art/clean/kindled-ash/heavy/south 11` | 23 | 4.9 | 0 | 14, 8 | 0 | 14 **flag** | 151 |
| heavy_thrust_S_1 | `art/clean/kindled-ash/heavy/south 12` | 23 | 4.9 | 0 | 14, 8 | 0 | 14 **flag** | 154 |
| heavy_thrust_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 7` | 61 | 7.69 | -1 | 14, 7 | 1 | 17 **flag** | 120 |
| heavy_thrust_SE_1 | `art/raw/ss01-kindled-ash/heavy/south-east 8` | 38 | 6.92 | -1 | 14, 7 | 0 | 17 **flag** | 128 |
| heavy_thrust_E_0 | `art/clean/kindled-ash/heavy/east 6` | 16 | 6.15 | -1 | 14, 7 | 0 | 13 **flag** | 70 |
| heavy_thrust_E_1 | `art/clean/kindled-ash/heavy/east 7` | 20 | 6.15 | -1 | 14, 7 | 1 | 14 **flag** | 58 |
| heavy_thrust_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 6` | 10 | 6.15 | -1 | 14, 7 | 0 | 11 | 3 |
| heavy_thrust_NE_1 | `art/raw/ss01-kindled-ash/heavy/north-east 7` | 59 | 6.15 | -1 | 14, 7 | 3 | 16 **flag** | 23 |
| heavy_thrust_N_0 | `art/clean/kindled-ash/heavy/north 4` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_thrust_N_1 | `art/clean/kindled-ash/heavy/north 5` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_thrust_NW_0 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 6` | 10 | 6.15 | -1 | 14, 7 | 0 | 11 | 3 |
| heavy_thrust_NW_1 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 7` | 59 | 6.15 | -1 | 14, 7 | 3 | 16 **flag** | 23 |
| heavy_thrust_W_0 | `art/clean/kindled-ash/heavy/west 7` | 38 | 6.52 | -1 | 14, 7 | 1 | 12 | 66 |
| heavy_thrust_W_1 | `art/clean/kindled-ash/heavy/west 8` | 31 | 6.1 | -1 | 14, 7 | 0 | 12 | 72 |
| heavy_thrust_SW_0 | mirrored from `art/raw/ss01-kindled-ash/heavy/south-east 7` | 61 | 7.69 | -1 | 14, 7 | 1 | 17 **flag** | 120 |
| heavy_thrust_SW_1 | mirrored from `art/raw/ss01-kindled-ash/heavy/south-east 8` | 38 | 6.92 | -1 | 14, 7 | 0 | 17 **flag** | 128 |
| heavy_hold_S_0 | `art/clean/kindled-ash/heavy/south 12` | 23 | 4.9 | 0 | 14, 8 | 0 | 14 **flag** | 154 |
| heavy_hold_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 8` | 38 | 6.92 | -1 | 14, 7 | 0 | 17 **flag** | 128 |
| heavy_hold_E_0 | `art/clean/kindled-ash/heavy/east 8` | 17 | 6.15 | -1 | 14, 7 | 1 | 13 **flag** | 58 |
| heavy_hold_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 8` | 56 | 6.15 | -1 | 14, 7 | 1 | 13 **flag** | 29 |
| heavy_hold_N_0 | `art/clean/kindled-ash/heavy/north 6` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_hold_NW_0 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 8` | 56 | 6.15 | -1 | 14, 7 | 1 | 13 **flag** | 29 |
| heavy_hold_W_0 | `art/clean/kindled-ash/heavy/west 8` | 31 | 6.1 | -1 | 14, 7 | 0 | 12 | 72 |
| heavy_hold_SW_0 | mirrored from `art/raw/ss01-kindled-ash/heavy/south-east 8` | 38 | 6.92 | -1 | 14, 7 | 0 | 17 **flag** | 128 |
| heavy_recover_S_0 | `art/clean/kindled-ash/heavy/south 11` | 23 | 4.9 | 0 | 14, 8 | 0 | 14 **flag** | 151 |
| heavy_recover_S_1 | `art/clean/kindled-ash/heavy/south 1` | 47 | 6.22 | 0 | 14, 8 | 0 | 13 **flag** | 161 |
| heavy_recover_SE_0 | `art/raw/ss01-kindled-ash/heavy/south-east 10` | 34 | 7.44 | -1 | 14, 7 | 1 | 17 **flag** | 130 |
| heavy_recover_SE_1 | `art/raw/ss01-kindled-ash/heavy/south-east 1` | 72 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 141 |
| heavy_recover_E_0 | `art/clean/kindled-ash/heavy/east 10` | 16 | 6.15 | -1 | 14, 7 | 1 | 13 **flag** | 59 |
| heavy_recover_E_1 | `art/clean/kindled-ash/heavy/east 1` | 44 | 7.71 | -1 | 14, 7 | 3 | 15 **flag** | 71 |
| heavy_recover_NE_0 | `art/raw/ss01-kindled-ash/heavy/north-east 10` | 51 | 6.15 | -1 | 14, 7 | 0 | 13 **flag** | 25 |
| heavy_recover_NE_1 | `art/raw/ss01-kindled-ash/heavy/north-east 1` | 16 | 6.15 | -1 | 14, 7 | 0 | 11 | 3 |
| heavy_recover_N_0 | `art/clean/kindled-ash/heavy/north 7` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_recover_N_1 | `art/clean/kindled-ash/heavy/north 8` | 0 | 0 | -1 | 16, 9 | 0 | 9 | 4 |
| heavy_recover_NW_0 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 10` | 51 | 6.15 | -1 | 14, 7 | 0 | 13 **flag** | 25 |
| heavy_recover_NW_1 | mirrored from `art/raw/ss01-kindled-ash/heavy/north-east 1` | 16 | 6.15 | -1 | 14, 7 | 0 | 11 | 3 |
| heavy_recover_W_0 | `art/clean/kindled-ash/heavy/west 10` | 21 | 5.31 | -1 | 14, 7 | 2 | 13 **flag** | 71 |
| heavy_recover_W_1 | `art/clean/kindled-ash/heavy/west 1` | 40 | 7.66 | -1 | 14, 7 | 4 | 14 **flag** | 72 |
| heavy_recover_SW_0 | mirrored from `art/raw/ss01-kindled-ash/heavy/south-east 10` | 34 | 7.44 | -1 | 14, 7 | 1 | 17 **flag** | 130 |
| heavy_recover_SW_1 | mirrored from `art/raw/ss01-kindled-ash/heavy/south-east 1` | 72 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 141 |
| haul_throw_S_0 | `art/clean/kindled-ash/haul_hand/haul_throw/south 7` | 52 | 6.45 | 0 | 14, 8 | 2 | 14 **flag** | 142 |
| haul_throw_S_1 | `art/clean/kindled-ash/haul_hand/haul_throw/south 8` | 19 | 6.45 | 0 | 14, 8 | 9 | 14 **flag** | 149 |
| haul_throw_SE_0 | `art/clean/kindled-ash/haul_hand/haul_throw/south-east 2` | 77 | 6.92 | -1 | 14, 7 | 3 | 15 **flag** | 136 |
| haul_throw_SE_1 | `art/clean/kindled-ash/haul_hand/haul_throw/south-east 4` | 35 | 6.92 | -1 | 14, 7 | 1 | 13 **flag** | 113 |
| haul_throw_E_0 | `art/clean/kindled-ash/haul_hand/haul_throw/east 2` | 36 | 6.15 | -1 | 14, 7 | 2 | 16 **flag** | 75 |
| haul_throw_E_1 | `art/clean/kindled-ash/haul_hand/haul_throw/east 3` | 41 | 6.4 | -1 | 14, 7 | 3 | 15 **flag** | 75 |
| haul_throw_NE_0 | `art/clean/kindled-ash/haul_hand/haul_throw/north-east 2` | 29 | 7.25 | -1 | 14, 7 | 1 | 12 | 17 |
| haul_throw_NE_1 | `art/clean/kindled-ash/haul_hand/haul_throw/north-east 3` | 40 | 6.25 | -1 | 14, 7 | 0 | 13 **flag** | 10 |
| haul_throw_N_0 | `art/clean/kindled-ash/haul_hand/haul_throw/north 2` | 10 | 4.2 | -1 | 14, 7 | 1 | 6 | 0 |
| haul_throw_N_1 | `art/clean/kindled-ash/haul_hand/haul_throw/north 3` | 14 | 5.57 | -1 | 14, 7 | 2 | 10 | 0 |
| haul_throw_NW_0 | `art/clean/kindled-ash/haul_hand/haul_throw/north-west 1` | 17 | 7.42 | -1 | 14, 7 | 1 | 9 | 16 |
| haul_throw_NW_1 | `art/clean/kindled-ash/haul_hand/haul_throw/north-west 2` | 12 | 7.42 | -1 | 14, 7 | 1 | 10 | 16 |
| haul_throw_W_0 | mirrored from `art/clean/kindled-ash/haul_hand/haul_throw/east 2` | 36 | 6.15 | -1 | 14, 7 | 2 | 16 **flag** | 75 |
| haul_throw_W_1 | mirrored from `art/clean/kindled-ash/haul_hand/haul_throw/east 3` | 41 | 6.4 | -1 | 14, 7 | 3 | 15 **flag** | 75 |
| haul_throw_SW_0 | mirrored from `art/clean/kindled-ash/haul_hand/haul_throw/south-east 2` | 77 | 6.92 | -1 | 14, 7 | 3 | 15 **flag** | 136 |
| haul_throw_SW_1 | mirrored from `art/clean/kindled-ash/haul_hand/haul_throw/south-east 4` | 35 | 6.92 | -1 | 14, 7 | 1 | 13 **flag** | 113 |
| haul_recover_S_0 | `art/clean/kindled-ash/haul_hand/haul_recover/south 0` | 0 | 0 | 0 | 14, 8 | 0 | 12 | 170 |
| haul_recover_S_1 | `art/clean/kindled-ash/haul_hand/haul_recover/south 1` | 67 | 7.06 | 0 | 14, 8 | 4 | 15 **flag** | 156 |
| haul_recover_SE_0 | `art/clean/kindled-ash/haul_hand/haul_recover/south-east 5` | 41 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 118 |
| haul_recover_SE_1 | `art/clean/kindled-ash/haul_hand/haul_recover/south-east 6` | 32 | 6.55 | -1 | 14, 7 | 0 | 14 **flag** | 125 |
| haul_recover_E_0 | `art/clean/kindled-ash/haul_hand/haul_recover/east 5` | 48 | 6.92 | -1 | 14, 7 | 1 | 14 **flag** | 77 |
| haul_recover_E_1 | `art/clean/kindled-ash/haul_hand/haul_recover/east 6` | 30 | 6.92 | -1 | 14, 7 | 2 | 15 **flag** | 76 |
| haul_recover_NE_0 | `art/clean/kindled-ash/haul_hand/haul_recover/north-east 5` | 44 | 6.25 | -1 | 14, 7 | 1 | 11 | 20 |
| haul_recover_NE_1 | `art/clean/kindled-ash/haul_hand/haul_recover/north-east 6` | 26 | 7.25 | -1 | 14, 7 | 0 | 11 | 15 |
| haul_recover_N_0 | `art/clean/kindled-ash/haul_hand/haul_recover/north 5` | 14 | 5.83 | -1 | 14, 7 | 0 | 7 | 0 |
| haul_recover_N_1 | `art/clean/kindled-ash/haul_hand/haul_recover/north 6` | 4 | 5.57 | -1 | 14, 7 | 0 | 5 | 0 |
| haul_recover_NW_0 | `art/clean/kindled-ash/haul_hand/haul_recover/north-west 5` | 11 | 4.7 | -1 | 14, 7 | 0 | 9 | 22 |
| haul_recover_NW_1 | `art/clean/kindled-ash/haul_hand/haul_recover/north-west 6` | 9 | 4.7 | -1 | 14, 7 | 1 | 8 | 6 |
| haul_recover_W_0 | mirrored from `art/clean/kindled-ash/haul_hand/haul_recover/east 5` | 48 | 6.92 | -1 | 14, 7 | 1 | 14 **flag** | 77 |
| haul_recover_W_1 | mirrored from `art/clean/kindled-ash/haul_hand/haul_recover/east 6` | 30 | 6.92 | -1 | 14, 7 | 2 | 15 **flag** | 76 |
| haul_recover_SW_0 | mirrored from `art/clean/kindled-ash/haul_hand/haul_recover/south-east 5` | 41 | 6.92 | -1 | 14, 7 | 0 | 16 **flag** | 118 |
| haul_recover_SW_1 | mirrored from `art/clean/kindled-ash/haul_hand/haul_recover/south-east 6` | 32 | 6.55 | -1 | 14, 7 | 0 | 14 **flag** | 125 |
| haul_pull_S_0 | `art/clean/kindled-ash/haul_hand/haul_pull/south 1` | 126 | 6.27 | 0 | 14, 8 | 0 | 16 **flag** | 144 |
| haul_pull_S_1 | `art/clean/kindled-ash/haul_hand/haul_pull/south 3` | 109 | 7.49 | 0 | 14, 8 | 0 | 17 **flag** | 136 |
| haul_pull_SE_0 | `art/clean/kindled-ash/haul_hand/haul_pull/south-east 1` | 101 | 6.92 | -1 | 14, 7 | 3 | 15 **flag** | 140 |
| haul_pull_SE_1 | `art/clean/kindled-ash/haul_hand/haul_pull/south-east 4` | 67 | 6.92 | -1 | 14, 7 | 1 | 15 **flag** | 116 |
| haul_pull_E_0 | `art/clean/kindled-ash/haul_hand/haul_pull/east 1` | 158 | 8.89 | -1 | 14, 7 | 3 | 16 **flag** | 95 |
| haul_pull_E_1 | `art/clean/kindled-ash/haul_hand/haul_pull/east 2` | 76 | 7.42 | -1 | 14, 7 | 4 | 14 **flag** | 111 |
| haul_pull_NE_0 | `art/clean/kindled-ash/haul_hand/haul_pull/north-east 2` | 24 | 5.35 | -1 | 14, 7 | 2 | 10 | 5 |
| haul_pull_NE_1 | `art/clean/kindled-ash/haul_hand/haul_pull/north-east 4` | 22 | 6.15 | -1 | 14, 7 | 0 | 11 | 12 |
| haul_pull_N_0 | `art/clean/kindled-ash/haul_hand/haul_pull/north 1` | 1 | 2.21 | -1 | 14, 7 | 0 | 5 | 0 |
| haul_pull_N_1 | `art/clean/kindled-ash/haul_hand/haul_pull/north 3` | 4 | 5.31 | -1 | 14, 7 | 2 | 6 | 0 |
| haul_pull_NW_0 | `art/clean/kindled-ash/haul_hand/haul_pull/north-west 1` | 37 | 7.72 | -1 | 14, 7 | 1 | 12 | 19 |
| haul_pull_NW_1 | `art/clean/kindled-ash/haul_hand/haul_pull/north-west 3` | 71 | 7.72 | -1 | 14, 7 | 4 | 15 **flag** | 34 |
| haul_pull_W_0 | `art/clean/kindled-ash/haul_hand/haul_pull/west 1` | 43 | 6.52 | -1 | 14, 7 | 4 | 12 | 61 |
| haul_pull_W_1 | `art/clean/kindled-ash/haul_hand/haul_pull/west 4` | 17 | 5.53 | -1 | 14, 7 | 1 | 12 | 65 |
| haul_pull_SW_0 | `art/clean/kindled-ash/haul_hand/haul_pull/south-west 2` | 46 | 6.52 | -1 | 14, 7 | 0 | 16 **flag** | 138 |
| haul_pull_SW_1 | `art/clean/kindled-ash/haul_hand/haul_pull/south-west 4` | 49 | 6.92 | -1 | 14, 7 | 0 | 14 **flag** | 146 |
| haul_slide_S_0 | `art/clean/kindled-ash/haul_hand/haul_slide/south 1` | 57 | 8.24 | 0 | 14, 8 | 6 | 15 **flag** | 169 |
| haul_slide_S_1 | `art/clean/kindled-ash/haul_hand/haul_slide/south 3` | 55 | 7.07 | 0 | 14, 8 | 12 | 15 **flag** | 142 |
| haul_slide_SE_0 | `art/clean/kindled-ash/haul_hand/haul_slide/south-east 1` | 77 | 7.81 | -1 | 14, 7 | 2 | 16 **flag** | 147 |
| haul_slide_SE_1 | `art/clean/kindled-ash/haul_hand/haul_slide/south-east 4` | 60 | 6.92 | -1 | 14, 7 | 0 | 14 **flag** | 153 |
| haul_slide_E_0 | `art/clean/kindled-ash/haul_hand/haul_slide/east 1` | 61 | 8.11 | -1 | 14, 7 | 1 | 15 **flag** | 76 |
| haul_slide_E_1 | `art/clean/kindled-ash/haul_hand/haul_slide/east 3` | 47 | 7.62 | -1 | 14, 7 | 3 | 15 **flag** | 91 |
| haul_slide_NE_0 | `art/clean/kindled-ash/haul_hand/haul_slide/north-east 1` | 39 | 6.15 | -1 | 14, 7 | 1 | 12 | 6 |
| haul_slide_NE_1 | `art/clean/kindled-ash/haul_hand/haul_slide/north-east 3` | 44 | 6.72 | -1 | 14, 7 | 5 | 13 **flag** | 20 |
| haul_slide_N_0 | `art/clean/kindled-ash/haul_hand/haul_slide/north 2` | 0 | 0 | -1 | 14, 7 | 0 | 4 | 0 |
| haul_slide_N_1 | `art/clean/kindled-ash/haul_hand/haul_slide/north 4` | 6 | 4.63 | -1 | 14, 7 | 0 | 6 | 0 |
| haul_slide_NW_0 | `art/clean/kindled-ash/haul_hand/haul_slide/north-west 1` | 18 | 5.53 | -1 | 14, 7 | 1 | 11 | 12 |
| haul_slide_NW_1 | `art/clean/kindled-ash/haul_hand/haul_slide/north-west 3` | 30 | 5.61 | -1 | 14, 7 | 3 | 12 | 15 |
| haul_slide_W_0 | `art/clean/kindled-ash/haul_hand/haul_slide/west 1` | 68 | 7.58 | -1 | 14, 7 | 2 | 18 **flag** | 64 |
| haul_slide_W_1 | `art/clean/kindled-ash/haul_hand/haul_slide/west 4` | 39 | 6.1 | -1 | 14, 7 | 1 | 11 | 15 |
| haul_slide_SW_0 | `art/clean/kindled-ash/haul_hand/haul_slide/south-west 1` | 73 | 6.92 | -1 | 14, 7 | 1 | 16 **flag** | 134 |
| haul_slide_SW_1 | `art/clean/kindled-ash/haul_hand/haul_slide/south-west 4` | 37 | 6.92 | -1 | 14, 7 | 0 | 15 **flag** | 150 |
| hit_S_0 | `art/raw/ss01-kindled-ash/hit/south 1` | 38 | 7.9 | -1 | 8, 1 | 24 | 14 **flag** | 132 |
| hit_S_1 | `art/raw/ss01-kindled-ash/hit/south 2` | 52 | 7.9 | -1 | 8, 1 | 10 | 14 **flag** | 140 |
| hit_E_0 | `art/clean/kindled-ash/hit/east 1` | 154 | 6.15 | -1 | 8, 1 | 30 | 10 | 95 |
| hit_E_1 | `art/clean/kindled-ash/hit/east 3` | 136 | 6.15 | -1 | 8, 1 | 21 | 14 **flag** | 101 |
| hit_N_0 | `art/raw/ss01-kindled-ash/hit/north 1` | 25 | 6.78 | -1 | 8, 1 | 3 | 9 | 1 |
| hit_N_1 | `art/raw/ss01-kindled-ash/hit/north 3` | 26 | 6.78 | -1 | 8, 1 | 3 | 11 | 1 |
| hit_W_0 | `art/clean/kindled-ash/hit/west 1` | 62 | 6.52 | -1 | 8, 1 | 9 | 11 | 48 |
| hit_W_1 | `art/clean/kindled-ash/hit/west 2` | 119 | 6.89 | -1 | 8, 1 | 20 | 13 **flag** | 57 |
| death_S_0 | `art/raw/ss01-kindled-ash/death/south 1` | 0 | 0 | -1 | 8, 1 | 8 | 11 | 153 |
| death_S_1 | `art/raw/ss01-kindled-ash/death/south 2` | 0 | 0 | -1 | 8, 1 | 5 | 11 | 143 |
| death_S_2 | `art/raw/ss01-kindled-ash/death/south 3` | 0 | 0 | -1 | 8, 1 | 6 | 11 | 142 |
| death_S_3 | `art/raw/ss01-kindled-ash/death/south 4` | 0 | 0 | -1 | 8, 1 | 10 | 10 | 126 |
| death_S_4 | `art/raw/ss01-kindled-ash/death/south 5` | 0 | 0 | -1 | 8, 1 | 23 | 9 | 116 |
| death_S_5 | `art/raw/ss01-kindled-ash/death/south 6` | 0 | 0 | -1 | 8, 1 | 20 | 10 | 80 |
| death_E_0 | `art/clean/kindled-ash/death/east 1` | 118 | 6.15 | -1 | 8, 1 | 26 | 14 **flag** | 61 |
| death_E_1 | `art/clean/kindled-ash/death/east 2` | 154 | 6.15 | -1 | 8, 1 | 59 | 12 | 81 |
| death_E_2 | `art/clean/kindled-ash/death/east 3` | 132 | 6.15 | -1 | 8, 1 | 25 | 13 **flag** | 65 |
| death_E_3 | `art/clean/kindled-ash/death/east 4` | 101 | 6.15 | -1 | 8, 1 | 27 | 12 | 61 |
| death_E_4 | `art/clean/kindled-ash/death/east 5` | 229 | 6.15 | -1 | 8, 1 | 93 | 12 | 85 |
| death_E_5 | `art/clean/kindled-ash/death/east 6` | 318 | 6.33 | -1 | 8, 1 | 89 | 9 | 229 |
| death_N_0 | `art/raw/ss01-kindled-ash/death/north 1` | 40 | 7.55 | -3 | 8, -1 | 5 | 12 | 2 |
| death_N_1 | `art/raw/ss01-kindled-ash/death/north 2` | 30 | 7.55 | -3 | 8, -1 | 7 | 8 | 1 |
| death_N_2 | `art/raw/ss01-kindled-ash/death/north 3` | 0 | 0 | -3 | 8, -1 | 1 | 4 | 0 |
| death_N_3 | `art/raw/ss01-kindled-ash/death/north 4` | 0 | 0 | -3 | 8, -1 | 1 | 4 | 0 |
| death_N_4 | `art/raw/ss01-kindled-ash/death/north 5` | 0 | 0 | -3 | 8, -1 | 4 | 4 | 0 |
| death_N_5 | `art/raw/ss01-kindled-ash/death/north 6` | 34 | 7.55 | -3 | 8, -1 | 5 | 11 | 2 |
| death_W_0 | `art/clean/kindled-ash/death/west 1` | 106 | 6.52 | -1 | 8, 1 | 13 | 12 | 59 |
| death_W_1 | `art/clean/kindled-ash/death/west 2` | 197 | 6.52 | -1 | 8, 1 | 47 | 10 | 136 |
| death_W_2 | `art/clean/kindled-ash/death/west 3` | 168 | 6.1 | -1 | 8, 1 | 25 | 11 | 115 |
| death_W_3 | `art/clean/kindled-ash/death/west 4` | 138 | 6.52 | -1 | 8, 1 | 8 | 10 | 112 |
| death_W_4 | `art/clean/kindled-ash/death/west 5` | 233 | 6.52 | -1 | 8, 1 | 27 | 10 | 126 |
| death_W_5 | `art/clean/kindled-ash/death/west 6` | 190 | 6.52 | -1 | 8, 1 | 23 | 10 | 122 |

## Remap

Each rule of the recipe's `remap`, in order, and the pixels it took per animation it applies to (a pixel takes the first rule that matches it).

| Rule | Maps | Scope | Pixels per animation | Total |
|---|---|---|---|---|
| 0 | from #fdd274 → spark-amber | frames light_3_NE_0 light_3_NW_0 | light_3 2 | 2 |
| 1 | from #f6fbe6 #f8e9c5 #f9feb0 #f9feb5 #fbf9dd #fcf5cc #fcfdbe #fcfee1 #fef3bf → husk-shell | everywhere | idle 0, walk 0, run 0, run_start 0, run_stop 0, run_back 0, dodge 11, light_1 15, light_2 30, light_3 165, heavy_charge 0, heavy_thrust 0, heavy_hold 0, heavy_recover 0, haul_throw 0, haul_recover 0, haul_pull 0, haul_slide 0, hit 0, death 0 | 221 |
| 2 | from #624541 #634341 #644448 #662e2f #6a3e40 #6a4043 #6a4244 #6a4345 #6b3c3f #6b484a #6c4041 #6c4144 #6c4247 #6c4549 #6d3f46 #6f4748 #6f4b4e #704243 #704848 #723038 #723c44 #724f4a #743c3e #744340 #744645 #744a48 #774f4a #78403d #794c48 #7a4a49 #7b4a45 #7d404f #7e4136 #7e524c #7f403d #814345 #834943 #883427 → sleeper-ochre | everywhere | idle 0, walk 2, run 0, run_start 0, run_stop 0, run_back 4, dodge 15, light_1 13, light_2 6, light_3 2, heavy_charge 6, heavy_thrust 0, heavy_hold 0, heavy_recover 2, haul_throw 6, haul_recover 0, haul_pull 10, haul_slide 3, hit 1, death 0 | 70 |
| 3 | near #f2b65a within 4 → choir-flame | facings N | idle 91, walk 261, run 413, run_start 0, run_stop 0, run_back 236, dodge 87, light_1 152, light_2 152, light_3 133, heavy_charge 147, heavy_thrust 98, heavy_hold 49, heavy_recover 98, haul_throw 101, haul_recover 106, haul_pull 91, haul_slide 92, hit 12, death 13 | 2332 |
| 4 | from #b0babf #b2bba7 #b5b5b2 #b5b6b2 #b5b6b9 #b6b6b6 #b6b8bb #b6bab6 #b7b8bc #b7b9b7 #b8bbbd #b9b7ae #b9bbbf #babcad #babcbe #bbb8b6 #bcb7b3 #bcb8ae #bdbcb5 #bebcc9 #bebdb8 #bebeba #bebebe #bfbcb7 #c0c0c1 #c0c2be #c1c2c5 #c2b7ad #c2c0bb #c2c1c2 #c2c1c6 #c2c4b8 #c4beb8 #c4c8c7 #c5c1bd #c5c8c7 #c6c2ba #c6c4be #c6c6b4 #c6c6bd #c6c8c4 #c7bba4 #c7c6c6 #c8b69f #c8b8a8 #c8beb6 #c8c5b3 #c9b9b7 #c9c6c1 #c9cccd #cac5ba #cac9c9 #cbc4b2 #cbc6c2 #cbc8c0 #cbc9bf #cbc9c4 #cbcac6 #ccbab8 #ccc8bf #cccbca #cdc9c4 #cdc9c6 #cec8ba #cecac2 #cecec8 #cfcec8 #d0cac3 #d0cec9 #d0d0c9 #d1c4ac #d1cccd #d1cec9 #d2cbbd #d2ccc8 #d3d1c7 #d6d0cb #d6d2ca #d6d4cc #d6d8d5 #d7d0c6 #d7d3d0 #d7d4d0 #d8d2c8 #d8d7d4 #d9d3d0 #dac4ae #dacdc0 #dbd4bb #decdb8 #e0d3b8 → husk-shell | exclude face | idle 7, walk 25, run 53, run_start 0, run_stop 0, run_back 3, dodge 48, light_1 16, light_2 22, light_3 75, heavy_charge 41, heavy_thrust 18, heavy_hold 11, heavy_recover 20, haul_throw 7, haul_recover 1, haul_pull 3, haul_slide 0, hit 11, death 10 | 371 |
| 5 | from #6f7476 #707275 #76787a #77787a #7a7c7d #7a7d7e #7b7878 #7b7b7a #808080 #828280 #82857e #86757f #8d9182 #918f81 #939aa4 #949da4 #9599a0 #959ea7 #9698a5 #989da5 #99a0a9 #99a0aa #9a9c9c #9a9faf #9aa0ae #9b9cb3 #9ba4a9 #9ca0a8 #9ea4ae #a0a2a7 #a0a6ac #a1a9b2 #a2a29f #a2a5b1 #a2a6aa #a3a6a7 #a3a8aa #a4a8ae #a4aeb8 #a5a29e #a6aab2 #a7a2a4 #a7a7a4 #a8a5b3 #a8ad9f #a9afb6 #aaabad #aaafb2 #ababab #acadaf #acafac #adaba2 #adafb4 #adb2a0 #aeacb0 #afb0b4 #b0aead #b0b0b4 #b0b0b5 #b2b4b3 #b2b4b4 #b3b3b6 #b4b2b2 #b9b2b2 → watcher-stone | exclude face | idle 2, walk 28, run 30, run_start 0, run_stop 0, run_back 4, dodge 57, light_1 25, light_2 49, light_3 15, heavy_charge 19, heavy_thrust 13, heavy_hold 4, heavy_recover 10, haul_throw 10, haul_recover 3, haul_pull 1, haul_slide 1, hit 14, death 8 | 293 |
| 6 | from #495140 #575b62 #595a60 #5c5756 #5c5960 #5d545d #5d5a5f #5d5b5d #5e5a61 #5f585f #5f5c64 #605f67 #636067 #645e5a #655962 #655e5e #666268 #67615f #686a6d #6a5e61 #6c6a6c → watcher-iron | exclude face | idle 41, walk 78, run 182, run_start 0, run_stop 0, run_back 62, dodge 104, light_1 24, light_2 29, light_3 32, heavy_charge 55, heavy_thrust 22, heavy_hold 11, heavy_recover 32, haul_throw 53, haul_recover 43, haul_pull 52, haul_slide 52, hit 6, death 0 | 878 |
| 7 | from #554621 #6c5626 #6e5038 #6e5639 #725837 #74573e #745c3f #7d5035 → wheel-brass-dark | exclude face | idle 15, walk 8, run 10, run_start 0, run_stop 0, run_back 1, dodge 0, light_1 7, light_2 4, light_3 11, heavy_charge 1, heavy_thrust 0, heavy_hold 0, heavy_recover 1, haul_throw 4, haul_recover 2, haul_pull 3, haul_slide 1, hit 5, death 12 | 85 |

## Off-palette colours the snap moved

1082 source colours reached the snap off the whitelist (after `remap`). The 20 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

| Colour | Pixels | Snapped to | ΔE | Ramp | Frames |
|---|---|---|---|---|---|
| #363347 | 3615 | sleeper-night #24305a | 4.7 | water, hair | idle_SE 0 1; idle_NW 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–5; walk_NW 0–5; walk_W 1–5; walk_SW 0–5; run_SE 0–7; run_NW 0–7; run_W 0–7; run_SW 0–7; run_back_SE 0–3; run_back_NW 0 3; run_back_W 1–3; run_back_SW 0–3; dodge_S 1 2; dodge_SE 0–3; dodge_E 0–3; dodge_NE 0–2; dodge_N 2; dodge_NW 0–2; dodge_W 0–3; dodge_SW 0–3; light_1_SE 1 2; light_1_W 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_NW 1 2; light_2_W 0 1; light_2_SW 0–2; light_3_SE 0–2; light_3_NE 0–2; light_3_NW 0–2; light_3_W 0 1; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_W 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_W 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_W 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NW 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_NW 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_NW 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_NW 0 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_W 0 1; death_W 0–5 |
| #3d3c4c | 3372 | watcher-iron #4a4e57 | 6.15 | cloth, steel | idle_SE 0 1; idle_E 0 1; idle_NE 0 1; idle_SW 0 1; walk_SE 0–5; walk_E 0–5; walk_NE 0–5; walk_SW 0–5; run_SE 0–7; run_E 0–7; run_NE 0–7; run_SW 0–7; run_back_SE 0–3; run_back_E 0–3; run_back_NE 0–3; run_back_SW 0–3; dodge_S 1 2; dodge_SE 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_E 0–2; light_1_NE 0 1; light_1_NW 0 1; light_1_SW 0–2; light_2_SE 0–2; light_2_E 0–2; light_2_NE 2; light_2_SW 0–2; light_3_SE 1 2; light_3_E 0–2; light_3_SW 0 2; heavy_charge_SE 0–2; heavy_charge_E 0–2; heavy_charge_NE 2; heavy_charge_NW 2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_E 0 1; heavy_thrust_NE 0 1; heavy_thrust_NW 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_E 0; heavy_hold_NE 0; heavy_hold_NW 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_E 0 1; heavy_recover_NE 0 1; heavy_recover_NW 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_throw_NE 0 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_E 0 1; haul_recover_NE 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_E 0 1; haul_pull_NE 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_E 0 1; haul_slide_NE 0 1; haul_slide_SW 0; hit_E 0 1; death_E 0–5 |
| #7e7063 | 1663 | unwritten-sail #8c7f6e | 4.93 | skin | idle_SE 0 1; idle_E 0 1; idle_NE 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–5; walk_E 0–5; walk_NE 0–2 4 5; walk_W 0–5; walk_SW 0–5; run_SE 0–7; run_E 0–7; run_NE 0–7; run_W 0–7; run_SW 0–7; run_back_SE 0–3; run_back_E 0–3; run_back_NE 0–3; run_back_W 1 3; run_back_SW 0–3; dodge_S 1 2; dodge_SE 0–3; dodge_E 0–3; dodge_W 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_E 0–2; light_1_NE 0–2; light_1_NW 0–2; light_1_W 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_E 1 2; light_2_NE 0–2; light_2_W 0–2; light_2_SW 0–2; light_3_SE 0–2; light_3_E 0 2; light_3_W 0–2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_E 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_NE 1; heavy_thrust_NW 1; heavy_thrust_W 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_NW 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_E 1; heavy_recover_NE 0; heavy_recover_NW 0; heavy_recover_W 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_throw_NE 0 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_E 0 1; haul_recover_NE 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_E 0 1; haul_pull_NE 0 1; haul_pull_W 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_E 0 1; haul_slide_NE 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_E 0 1; hit_W 0 1; death_E 0–5; death_W 0–5 |
| #6f6356 | 1257 | unwritten-tar #5e5448 | 5.53 | skin | idle_SE 0 1; idle_E 0 1; idle_NW 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–2; walk_E 0–5; walk_NW 0–5; walk_W 0–5; walk_SW 0–5; run_SE 0–6; run_E 0–7; run_NW 0 1 3–5 7; run_W 0–7; run_SW 0–7; run_back_SE 0–3; run_back_E 0–3; run_back_W 0–3; run_back_SW 0–3; dodge_S 1 2; dodge_SE 0–3; dodge_E 0–3; dodge_NE 3; dodge_NW 3; dodge_W 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_E 0–2; light_1_W 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_E 0–2; light_2_NW 1; light_2_W 0–2; light_2_SW 0–2; light_3_SE 0–2; light_3_E 0–2; light_3_NE 0–2; light_3_NW 0–2; light_3_W 0–2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_E 0 1; heavy_charge_W 1; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_E 1; heavy_thrust_W 0; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_E 1; heavy_recover_W 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_E 0 1; haul_recover_W 0 1; haul_pull_SE 0 1; haul_pull_E 0 1; haul_pull_NW 0 1; haul_pull_W 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_E 0 1; haul_slide_NW 0 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_E 0 1; hit_W 0 1; death_E 0–5; death_W 0–5 |
| #626383 | 886 | hollow-below #5b5478 | 4.57 | stone, hair | idle_SE 0 1; idle_NW 0 1; idle_W 0 1; idle_SW 0 1; walk_SE 0–5; walk_NW 3 4; walk_W 1–5; walk_SW 0–5; run_SE 0–7; run_NW 1–7; run_W 0–7; run_SW 0 1 3–7; run_back_SE 0–3; run_back_NW 1–3; run_back_W 1–3; run_back_SW 0–3; dodge_S 1 2; dodge_SE 0–3; dodge_E 0–3; dodge_NE 1; dodge_N 1; dodge_NW 1; dodge_W 0–3; dodge_SW 0–3; light_1_SE 0–2; light_1_W 0 1; light_1_SW 0–2; light_2_SE 0–2; light_2_NW 0; light_2_W 0–2; light_2_SW 1 2; light_3_SE 0; light_3_NE 0–2; light_3_NW 0–2; light_3_W 1 2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_W 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_W 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_W 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NW 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_NW 0 1; haul_pull_W 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_NW 1; haul_slide_W 0 1; haul_slide_SW 0 1; hit_W 0 1; death_W 0–5 |
| #685c56 | 861 | unwritten-tar #5e5448 | 3.39 | skin | idle_SE 0 1; idle_NW 0 1; walk_SE 0–2 4 5; walk_NE 3; walk_NW 0–5; run_SE 0–7; run_NE 3 4; run_NW 0–7; run_SW 0 4 6 7; run_back_SE 0–3; run_back_NE 0 2 3; run_back_NW 0–3; run_back_SW 0–3; dodge_S 2; dodge_SE 0 2 3; dodge_NE 0–3; dodge_N 1 2; dodge_NW 0–3; dodge_SW 0 2 3; light_1_SE 0–2; light_1_NE 0–2; light_1_NW 0–2; light_1_SW 0–2; light_2_SE 0–2; light_2_NE 0–2; light_2_NW 1 2; light_2_SW 0–2; light_3_SE 0–2; light_3_NE 1 2; light_3_NW 1 2; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_NE 0–2; heavy_charge_NW 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_NE 0 1; heavy_thrust_NW 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_NW 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_NE 0 1; heavy_recover_NW 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_NW 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_NE 0; haul_recover_NW 0 1; haul_recover_SW 0 1; haul_pull_SE 0 1; haul_pull_NE 0 1; haul_pull_NW 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_NE 0 1; haul_slide_NW 0 1; haul_slide_SW 0 1 |
| #707084 | 656 | watcher-stone #7d8794 | 6.92 | cloth, steel | idle_SE 0 1; idle_SW 0 1; walk_SE 0–5; walk_SW 0–5; run_SE 0–7; run_SW 0–7; run_back_SE 0–3; run_back_SW 0–3; dodge_S 1 2; dodge_SE 1–3; dodge_SW 1–3; light_1_SE 0–2; light_1_SW 0–2; light_2_SE 0 1; light_2_SW 0–2; light_3_SE 0 1; light_3_SW 0–2; heavy_charge_SE 0–2; heavy_charge_SW 0–2; heavy_thrust_SE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_SW 0 1; haul_throw_SE 0 1; haul_throw_SW 0 1; haul_recover_SE 0; haul_recover_SW 0; haul_pull_SE 0 1; haul_pull_SW 1; haul_slide_SE 0 1; haul_slide_SW 0 1 |
| #454069 | 424 | watcher-iron #4a4e57 | 6.1 | cloth, steel | idle_SE 0 1; idle_W 0 1; walk_SE 0 3–5; walk_W 0–5; run_SE 0–7; run_W 0–7; run_back_SE 1 2; run_back_W 0 2; dodge_E 0–3; dodge_W 0–3; light_1_SE 0 1; light_1_W 0 2; light_2_SE 1 2; light_2_W 0–2; light_3_SE 0 1; light_3_W 0 1; heavy_charge_SE 0 1; heavy_charge_W 0–2; heavy_thrust_SE 1; heavy_thrust_W 0 1; heavy_thrust_SW 1; heavy_hold_SE 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 1; heavy_recover_W 1; heavy_recover_SW 1; haul_throw_SE 0; haul_throw_SW 0; haul_pull_SE 0; haul_pull_W 0; haul_slide_SE 1; haul_slide_W 0 1; hit_W 0 1; death_W 0–5 |
| #d67345 | 422 | spark-ember #c9733a | 2.67 | ember | idle_SE 0 1; idle_E 0 1; idle_NE 0 1; idle_SW 0 1; walk_SE 0–2 4 5; walk_E 0 1 5; walk_NE 0–5; run_SE 0–7; run_E 1–3; run_NE 0–7; run_SW 0–7; run_back_SE 1 3; run_back_E 1; run_back_NE 1; run_back_SW 0–3; dodge_S 1 2; dodge_SE 0–3; dodge_SW 0–3; light_1_SE 1 2; light_1_E 0–2; light_1_SW 0–2; light_2_SE 0 1; light_2_SW 0 1; light_3_SE 0 2; light_3_SW 0–2; heavy_charge_SE 0 1; heavy_charge_E 0; heavy_charge_NE 0–2; heavy_charge_NW 0–2; heavy_charge_SW 0 1; heavy_thrust_SE 0 1; heavy_thrust_NE 0 1; heavy_thrust_NW 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_NW 0; heavy_hold_SW 0; heavy_recover_SE 0; heavy_recover_E 1; heavy_recover_NE 0; heavy_recover_NW 0; heavy_recover_SW 0; haul_throw_SE 0 1; haul_throw_E 1; haul_throw_W 1; haul_throw_SW 0 1; haul_recover_SE 1; haul_recover_E 1; haul_recover_W 1; haul_recover_SW 1; haul_pull_SE 0 1; haul_pull_NE 0 1; haul_pull_SW 0 1; haul_slide_SE 0 1; haul_slide_SW 0 1; hit_E 1; death_E 0–4 |
| #3b3c5d | 341 | sleeper-night #24305a | 5.45 | water, hair | idle_SE 0 1; idle_SW 0 1; walk_SE 0–5; walk_SW 0 2 4 5; run_SE 0–7; run_SW 0–7; run_back_SE 1–3; run_back_SW 0 3; dodge_S 1; dodge_SE 0 1 3; dodge_SW 0 1 3; light_1_SE 0–2; light_1_SW 1; light_2_SE 1 2; light_2_SW 1 2; light_3_SE 1; light_3_SW 1 2; heavy_charge_SE 0–2; heavy_charge_SW 0; heavy_thrust_SE 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_SW 0; heavy_recover_SE 0 1; heavy_recover_SW 0 1; haul_throw_SE 0; haul_throw_SW 0; haul_recover_SE 1; haul_recover_SW 1; haul_pull_SE 0 1; haul_pull_SW 0; haul_slide_SE 0; haul_slide_SW 0 |
| #8e969f | 316 | watcher-stone #7d8794 | 5.04 | cloth, steel | idle_SE 0 1; idle_NE 0 1; idle_SW 0 1; walk_SE 0–5; walk_NE 1 3–5; walk_SW 1 2 5; run_SE 0–7; run_NE 0 4 7; run_SW 0 2 3 5–7; run_back_SE 0 2 3; run_back_NE 0–3; run_back_SW 0–2; dodge_SE 3; dodge_E 0–3; dodge_W 0–3; dodge_SW 3; light_1_SE 0 2; light_1_NE 0–2; light_1_NW 0–2; light_1_SW 0–2; light_2_SE 0 2; light_2_NE 0 2; light_2_SW 0–2; light_3_SE 1 2; light_3_SW 1 2; heavy_charge_SE 0–2; heavy_charge_NE 1; heavy_charge_NW 1; heavy_charge_W 2; heavy_charge_SW 0 1; heavy_thrust_SE 1; heavy_thrust_SW 1; heavy_hold_SE 0; heavy_hold_NE 0; heavy_hold_NW 0; heavy_hold_SW 0; heavy_recover_SE 1; heavy_recover_NE 0; heavy_recover_NW 0; heavy_recover_W 1; heavy_recover_SW 1; haul_throw_SE 0; haul_throw_NE 0; haul_throw_SW 0; haul_slide_SE 0; haul_slide_W 1; haul_slide_SW 0 1 |
| #ad644c | 269 | sleeper-ochre #9c5b4a | 4.1 | ember, red clay | idle_SE 0; idle_W 0; walk_SE 0 2–5; walk_W 0 2 3; run_SE 0 3 4 7; run_W 0–3 5–7; run_back_SE 0 1 3; dodge_E 0; dodge_W 0; light_1_SE 0–2; light_1_W 1; light_2_SE 0–2; light_2_W 0; light_3_SE 0–2; light_3_W 0; heavy_charge_SE 0–2; heavy_charge_W 0–2; heavy_thrust_SE 0 1; heavy_thrust_W 0 1; heavy_thrust_SW 0 1; heavy_hold_SE 0; heavy_hold_W 0; heavy_hold_SW 0; heavy_recover_SE 1; heavy_recover_W 0 1; heavy_recover_SW 1; haul_throw_SE 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_SW 0 1; haul_pull_SE 1; haul_pull_W 0; haul_slide_SE 0 1; haul_slide_W 1; hit_W 0 1; death_W 0–5 |
| #bc6a4c | 199 | spark-ember #c9733a | 4.15 | ember | idle_SE 0 1; walk_SE 0–5; walk_E 0–5; run_E 1–7; run_back_SE 1; run_back_E 0–3; light_1_SE 0–2; light_1_E 0–2; light_2_E 0 2; light_3_SE 0 2; heavy_charge_SE 0 2; heavy_charge_E 0; heavy_recover_E 1; haul_throw_SE 0 1; haul_throw_E 0 1; haul_throw_W 0 1; haul_throw_SW 0 1; haul_recover_SE 0 1; haul_recover_E 0 1; haul_recover_W 0 1; haul_recover_SW 0 1; haul_pull_SE 0; haul_slide_SE 0 1; haul_slide_E 0; hit_E 1; death_E 1 3 4 |
| #4e3844 | 174 | watcher-iron #4a4e57 | 6.52 | cloth, steel | idle_W 0 1; idle_SW 0 1; walk_W 0 4; walk_SW 0–5; run_W 0–4 6; run_SW 0 2 4 7; run_back_W 1; run_back_SW 0–3; dodge_S 1; dodge_SE 0 1 3; dodge_E 0–2; dodge_W 0–2; dodge_SW 0 1 3; light_1_W 1; light_1_SW 1; light_2_W 0 1; light_2_SW 0–2; light_3_W 0 2; heavy_charge_W 1; heavy_charge_SW 0–2; heavy_thrust_W 0; haul_pull_W 0; haul_pull_SW 0 1; haul_slide_W 0; haul_slide_SW 0; hit_W 0 1; death_W 0 1 3–5 |
| #7c664f | 152 | wheel-brass-dark #8a6420 | 5.3 | brass, leather | idle_E 0 1; idle_SW 0 1; walk_SW 0–5; run_E 0 2–6; run_SW 0–7; run_back_E 1; run_back_SW 0 2 3; dodge_S 1; dodge_SE 0 1 3; dodge_SW 0 1 3; light_1_SW 0–2; light_2_E 0–2; light_2_SW 0–2; light_3_E 0; light_3_SW 1 2; heavy_charge_E 0; heavy_charge_SW 0; haul_throw_E 0 1; haul_throw_W 0 1; haul_recover_E 0 1; haul_recover_W 0 1; haul_pull_E 0 1; haul_slide_E 0 1; haul_slide_SW 0 1; hit_E 1; death_E 1 |
| #413a45 | 144 | watcher-iron #4a4e57 | 6.55 | cloth, steel | idle_SE 1; walk_SE 0–2 4 5; run_SE 0–7; run_back_SE 1; light_1_SE 0; light_2_SE 2; light_3_SE 0–2; heavy_charge_SE 0; heavy_thrust_SE 0; heavy_thrust_SW 0; heavy_recover_SE 0; heavy_recover_SW 0; haul_throw_SE 0 1; haul_throw_SW 0 1; haul_recover_SE 1; haul_recover_SW 1; haul_pull_SE 0 1; haul_slide_SE 0 1 |
| #383360 | 127 | sleeper-night #24305a | 3.58 | water, hair | idle_SW 0; walk_SW 0–2 4 5; run_SW 0–7; run_back_SW 3; dodge_SE 0 3; dodge_SW 0 3; light_1_SW 0–2; light_2_SW 2; light_3_SW 0–2; heavy_charge_SW 0 1 |
| #ac814a | 102 | watcher-bronze #a8743a | 3.48 | leather | idle_E 0 1; walk_E 3–5; run_back_E 0 3; light_1_E 0–2; light_3_E 0–2; heavy_charge_E 0 1; heavy_thrust_E 0 1; heavy_hold_E 0; heavy_recover_E 0 1; haul_throw_E 0 1; haul_throw_W 0 1; haul_recover_E 0 1; haul_recover_W 0 1; haul_pull_E 1; hit_E 1; death_E 0 |
| #9e7642 | 95 | watcher-bronze #a8743a | 1.74 | leather | idle_E 0 1; walk_E 0–5; run_E 2 3 5–7; light_1_E 0–2; light_2_E 0–2; light_3_E 0–2; heavy_charge_E 1; heavy_thrust_E 1; heavy_hold_E 0; heavy_recover_E 0; haul_throw_E 0 1; haul_throw_W 0 1; haul_recover_E 1; haul_recover_W 1; haul_pull_E 0 1; haul_slide_E 0 1; death_E 0 2 |
| #5d545d | 94 | unwritten-tar #5e5448 | 3.38 | skin | run_SE 0–6; run_SW 0–7; run_back_SE 0–2; run_back_SW 0–2; dodge_SE 0; dodge_NE 3; dodge_NW 3; dodge_SW 0; light_1_SE 1; light_1_SW 0 1; light_2_SE 0–2; light_2_NW 0; light_2_SW 0 2; light_3_SE 0–2; light_3_SW 0–2; heavy_charge_SE 2; heavy_thrust_SE 0; heavy_thrust_SW 0; heavy_recover_SE 0; heavy_recover_SW 0; haul_pull_SW 0 1; haul_slide_SE 1 |

## Points

Each point in the cell (where the sheet stores it) and in the frame's source pixels (where the recipe's `points` gives it). A mirrored facing inherits its twin's points, mirrored, unless the recipe lists its own.

| Frame | Point | Cell | Source | From |
|---|---|---|---|---|
| heavy_charge_S_0 | tip | 26, 55 | 12, 47 | recipe |
| heavy_charge_S_1 | tip | 26, 55 | 12, 47 | recipe |
| heavy_charge_S_2 | tip | 25, 51 | 11, 43 | recipe |
| heavy_charge_SE_0 | tip | 36, 61 | 22, 54 | recipe |
| heavy_charge_SE_1 | tip | 28, 56 | 14, 49 | recipe |
| heavy_charge_SE_2 | tip | 24, 52 | 10, 45 | recipe |
| heavy_charge_E_0 | tip | 51, 52 | 37, 45 | recipe |
| heavy_charge_E_1 | tip | 50, 57 | 36, 50 | recipe |
| heavy_charge_E_2 | tip | 49, 56 | 35, 49 | recipe |
| heavy_charge_NE_0 | tip | 33, 33 | 19, 26 | recipe |
| heavy_charge_NE_1 | tip | 36, 33 | 22, 26 | recipe |
| heavy_charge_NE_2 | tip | 36, 34 | 22, 27 | recipe |
| heavy_charge_N_0 | tip | 64, 61 | 48, 52 | recipe |
| heavy_charge_N_1 | tip | 68, 59 | 52, 50 | recipe |
| heavy_charge_N_2 | tip | 70, 57 | 54, 48 | recipe |
| heavy_charge_NW_0 | tip | 62, 33 | 48, 26 | heavy_charge_NE_0, mirrored |
| heavy_charge_NW_1 | tip | 59, 33 | 45, 26 | heavy_charge_NE_1, mirrored |
| heavy_charge_NW_2 | tip | 59, 34 | 45, 27 | heavy_charge_NE_2, mirrored |
| heavy_charge_W_0 | tip | 35, 55 | 21, 48 | recipe |
| heavy_charge_W_1 | tip | 66, 57 | 52, 50 | recipe |
| heavy_charge_W_2 | tip | 66, 57 | 52, 50 | recipe |
| heavy_charge_SW_0 | tip | 24, 55 | 10, 48 | recipe |
| heavy_charge_SW_1 | tip | 24, 55 | 10, 48 | recipe |
| heavy_charge_SW_2 | tip | 23, 44 | 9, 37 | recipe |
| haul_throw_S_0 | hand | 32, 44 | 18, 36 | recipe |
| haul_throw_S_1 | hand | 43, 50 | 29, 42 | recipe |
| haul_throw_SE_0 | hand | 30, 44 | 16, 37 | recipe |
| haul_throw_SE_1 | hand | 60, 41 | 46, 34 | recipe |
| haul_throw_E_0 | hand | 48, 52 | 34, 45 | recipe |
| haul_throw_E_1 | hand | 58, 45 | 44, 38 | recipe |
| haul_throw_NE_0 | hand | 56, 52 | 42, 45 | recipe |
| haul_throw_NE_1 | hand | 60, 39 | 46, 32 | recipe |
| haul_throw_N_0 | hand | 29, 48 | 15, 41 | recipe |
| haul_throw_N_1 | hand | 27, 47 | 13, 40 | recipe |
| haul_throw_NW_0 | hand | 33, 47 | 19, 40 | recipe |
| haul_throw_NW_1 | hand | 25, 44 | 11, 37 | recipe |
| haul_throw_W_0 | hand | 47, 52 | 33, 45 | haul_throw_E_0, mirrored |
| haul_throw_W_1 | hand | 37, 45 | 23, 38 | haul_throw_E_1, mirrored |
| haul_throw_SW_0 | hand | 65, 44 | 51, 37 | haul_throw_SE_0, mirrored |
| haul_throw_SW_1 | hand | 35, 41 | 21, 34 | haul_throw_SE_1, mirrored |
| haul_recover_S_0 | hand | 37, 54 | 23, 46 | recipe |
| haul_recover_S_1 | hand | 35, 55 | 21, 47 | recipe |
| haul_recover_SE_0 | hand | 60, 44 | 46, 37 | recipe |
| haul_recover_SE_1 | hand | 53, 51 | 39, 44 | recipe |
| haul_recover_E_0 | hand | 55, 48 | 41, 41 | recipe |
| haul_recover_E_1 | hand | 50, 52 | 36, 45 | recipe |
| haul_recover_NE_0 | hand | 61, 45 | 47, 38 | recipe |
| haul_recover_NE_1 | hand | 61, 48 | 47, 41 | recipe |
| haul_recover_N_0 | hand | 32, 50 | 18, 43 | recipe |
| haul_recover_N_1 | hand | 48, 50 | 34, 43 | recipe |
| haul_recover_NW_0 | hand | 35, 49 | 21, 42 | recipe |
| haul_recover_NW_1 | hand | 48, 50 | 34, 43 | recipe |
| haul_recover_W_0 | hand | 40, 48 | 26, 41 | haul_recover_E_0, mirrored |
| haul_recover_W_1 | hand | 45, 52 | 31, 45 | haul_recover_E_1, mirrored |
| haul_recover_SW_0 | hand | 35, 44 | 21, 37 | haul_recover_SE_0, mirrored |
| haul_recover_SW_1 | hand | 42, 51 | 28, 44 | haul_recover_SE_1, mirrored |
| haul_pull_S_0 | hand | 52, 54 | 38, 46 | recipe |
| haul_pull_S_1 | hand | 44, 52 | 30, 44 | recipe |
| haul_pull_SE_0 | hand | 46, 52 | 32, 45 | recipe |
| haul_pull_SE_1 | hand | 70, 51 | 56, 44 | recipe |
| haul_pull_E_0 | hand | 52, 49 | 38, 42 | recipe |
| haul_pull_E_1 | hand | 56, 43 | 42, 36 | recipe |
| haul_pull_NE_0 | hand | 53, 47 | 39, 40 | recipe |
| haul_pull_NE_1 | hand | 59, 47 | 45, 40 | recipe |
| haul_pull_N_0 | hand | 48, 50 | 34, 43 | recipe |
| haul_pull_N_1 | hand | 48, 50 | 34, 43 | recipe |
| haul_pull_NW_0 | hand | 31, 51 | 17, 44 | recipe |
| haul_pull_NW_1 | hand | 38, 39 | 24, 32 | recipe |
| haul_pull_W_0 | hand | 36, 50 | 22, 43 | recipe |
| haul_pull_W_1 | hand | 40, 46 | 26, 39 | recipe |
| haul_pull_SW_0 | hand | 41, 49 | 27, 42 | recipe |
| haul_pull_SW_1 | hand | 38, 50 | 24, 43 | recipe |
| haul_slide_S_0 | hand | 39, 54 | 25, 46 | recipe |
| haul_slide_S_1 | hand | 54, 57 | 40, 49 | recipe |
| haul_slide_SE_0 | hand | 41, 53 | 27, 46 | recipe |
| haul_slide_SE_1 | hand | 44, 58 | 30, 51 | recipe |
| haul_slide_E_0 | hand | 48, 52 | 34, 45 | recipe |
| haul_slide_E_1 | hand | 45, 53 | 31, 46 | recipe |
| haul_slide_NE_0 | hand | 55, 53 | 41, 46 | recipe |
| haul_slide_NE_1 | hand | 53, 55 | 39, 48 | recipe |
| haul_slide_N_0 | hand | 48, 50 | 34, 43 | recipe |
| haul_slide_N_1 | hand | 48, 50 | 34, 43 | recipe |
| haul_slide_NW_0 | hand | 35, 50 | 21, 43 | recipe |
| haul_slide_NW_1 | hand | 34, 59 | 20, 52 | recipe |
| haul_slide_W_0 | hand | 44, 53 | 30, 46 | recipe |
| haul_slide_W_1 | hand | 37, 52 | 23, 45 | recipe |
| haul_slide_SW_0 | hand | 38, 52 | 24, 45 | recipe |
| haul_slide_SW_1 | hand | 39, 49 | 25, 42 | recipe |
