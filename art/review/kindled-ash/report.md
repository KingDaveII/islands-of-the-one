# kindled-ash (draft)

Built by `pnpm art:build kindled-ash` from `art/sheets/kindled-ash.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind kindled, outline player, cell 112×80, origin (56, 64). A draft writes this review only, never `packages/shared/assets`.

## Summary

- Frames: 44.
- Off-palette pixels snapped: 1227 (largest ΔE 7.6).
- Outline gaps (edge pixels not in an outline colour): 177.
- Masked skin pixels: 4126.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 1 px): walk_S, walk_E, walk_NE, walk_N.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: idle_SE_0, idle_E_0, idle_W_0, idle_SW_0, walk_SE_0, walk_SE_1, walk_SE_2, walk_SE_3, walk_SE_4, walk_SE_5, walk_E_0, walk_E_1, walk_E_2, walk_E_3, walk_E_4, walk_E_5, light_1_S_0, light_1_S_1, light_1_S_2, light_1_E_0, light_1_E_1, light_1_E_2.
- Skin regions to resolve: 171 (reported because this is a draft; a finished sheet fails on them).
- Missing against the contract's table: idle_S: 1 of 2 frames, idle_SE: 1 of 2 frames, idle_E: 1 of 2 frames, idle_NE: 1 of 2 frames, idle_N: 1 of 2 frames, idle_NW: 1 of 2 frames, idle_W: 1 of 2 frames, idle_SW: 1 of 2 frames, walk NW W SW, dodge (all facings), light_1 SE NE N NW W SW, light_2 (all facings), light_3 (all facings), heavy_charge (all facings), heavy_thrust (all facings), heavy_hold (all facings), heavy_recover (all facings), haul_throw (all facings), haul_recover (all facings), haul_pull (all facings), haul_slide (all facings), hit (all facings), death (all facings), carry_idle (all facings), carry_walk (all facings), sit (all facings).

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row. `tones.png` has the same rows in the four clay tones, through the mask: clay-grey-ochre, clay-pale, clay-red, clay-river-dark.

Rows, top to bottom: idle_S, idle_SE, idle_E, idle_NE, idle_N, idle_NW, idle_W, idle_SW, walk_S, walk_SE, walk_E, walk_NE, walk_N, light_1_S, light_1_E.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle_S | 1 |  | 47 (range 0) |  |
| idle_SE | 1 |  | 49 (range 0) |  |
| idle_E | 1 |  | 48 (range 0) |  |
| idle_NE | 1 |  | 48 (range 0) |  |
| idle_N | 1 |  | 47 (range 0) |  |
| idle_NW | 1 |  | 48 (range 0) |  |
| idle_W | 1 |  | 48 (range 0) |  |
| idle_SW | 1 |  | 49 (range 0) |  |
| walk_S | 6 | 599 / 634.8 | 47 49 48 47 49 48 (range 2) **flag** |  |
| walk_SE | 6 | 368 / 429.6 | 49 48 48 49 49 49 (range 1) |  |
| walk_E | 6 | 492 / 475 | 48 48 48 48 46 48 (range 2) **flag** |  |
| walk_NE | 6 | 273 / 393.2 | 48 50 49 48 49 49 (range 2) **flag** |  |
| walk_N | 6 | 169 / 319.4 | 48 49 48 47 49 48 (range 2) **flag** |  |
| light_1_S | 3 |  |  |  |
| light_1_E | 3 |  |  |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Masked |
|---|---|---|---|---|---|---|---|---|
| idle_S_0 | `art/raw/g13b-job4/player/south.png 0` | 0 | 0 | 0 | 24, 10 | 0 | 11 | 170 |
| idle_SE_0 | `art/raw/g13b-job4/player/south-east.png 0` | 53 | 7.11 | -3 | 24, 7 | 0 | 16 **flag** | 138 |
| idle_E_0 | `art/raw/g13b-job4/player/east.png 0` | 11 | 7.44 | -3 | 24, 7 | 0 | 13 **flag** | 110 |
| idle_NE_0 | `art/raw/g13b-job4/player/north-east.png 0` | 0 | 0 | -1 | 24, 9 | 0 | 11 | 16 |
| idle_N_0 | `art/raw/g13b-job4/player/north.png 0` | 0 | 0 | 0 | 24, 10 | 2 | 8 | 2 |
| idle_NW_0 | `art/raw/g13b-job4/player/north-west.png 0` | 0 | 0 | -2 | 24, 8 | 0 | 9 | 2 |
| idle_W_0 | `art/raw/g13b-job4/player/west.png 0` | 20 | 7.44 | -3 | 24, 7 | 0 | 17 **flag** | 108 |
| idle_SW_0 | `art/raw/g13b-job4/player/south-west.png 0` | 50 | 6.77 | -2 | 24, 8 | 0 | 15 **flag** | 153 |
| walk_S_0 | `art/raw/g13b-job4/player/walk-skel/south 0` | 0 | 0 | 0 | 16, 2 | 3 | 11 | 170 |
| walk_S_1 | `art/raw/g13b-job4/player/walk-skel/south 1` | 0 | 0 | -2 | 16, 0 | 5 | 11 | 197 |
| walk_S_2 | `art/raw/g13b-job4/player/walk-skel/south 2` | 0 | 0 | -1 | 16, 1 | 1 | 11 | 169 |
| walk_S_3 | `art/raw/g13b-job4/player/walk-skel/south 3` | 0 | 0 | 0 | 16, 2 | 0 | 11 | 166 |
| walk_S_4 | `art/raw/g13b-job4/player/walk-skel/south 4` | 0 | 0 | -2 | 16, 0 | 2 | 11 | 158 |
| walk_S_5 | `art/raw/g13b-job4/player/walk-skel/south 5` | 0 | 0 | -1 | 16, 1 | 9 | 11 | 167 |
| walk_SE_0 | `art/raw/g13b-job4/player/walk-skel/south-east 0` | 99 | 7.11 | -3 | 16, -1 | 3 | 16 **flag** | 144 |
| walk_SE_1 | `art/raw/g13b-job4/player/walk-skel/south-east 1` | 85 | 7.11 | -2 | 16, 0 | 2 | 16 **flag** | 130 |
| walk_SE_2 | `art/raw/g13b-job4/player/walk-skel/south-east 2` | 77 | 7.11 | -2 | 16, 0 | 4 | 16 **flag** | 130 |
| walk_SE_3 | `art/raw/g13b-job4/player/walk-skel/south-east 3` | 44 | 7.11 | -3 | 16, -1 | 0 | 16 **flag** | 140 |
| walk_SE_4 | `art/raw/g13b-job4/player/walk-skel/south-east 4` | 80 | 7.11 | -3 | 16, -1 | 6 | 16 **flag** | 142 |
| walk_SE_5 | `art/raw/g13b-job4/player/walk-skel/south-east 5` | 125 | 7.11 | -3 | 16, -1 | 16 | 16 **flag** | 148 |
| walk_E_0 | `art/raw/g13b-job4/player/walk-skel/east 0` | 61 | 7.44 | -3 | 16, -1 | 22 | 13 **flag** | 108 |
| walk_E_1 | `art/raw/g13b-job4/player/walk-skel/east 1` | 71 | 7.44 | -3 | 16, -1 | 16 | 15 **flag** | 108 |
| walk_E_2 | `art/raw/g13b-job4/player/walk-skel/east 2` | 55 | 7.44 | -3 | 16, -1 | 8 | 13 **flag** | 107 |
| walk_E_3 | `art/raw/g13b-job4/player/walk-skel/east 3` | 8 | 7.44 | -3 | 16, -1 | 0 | 13 **flag** | 109 |
| walk_E_4 | `art/raw/g13b-job4/player/walk-skel/east 4` | 38 | 7.44 | -1 | 16, 1 | 7 | 13 **flag** | 109 |
| walk_E_5 | `art/raw/g13b-job4/player/walk-skel/east 5` | 59 | 7.44 | -3 | 16, -1 | 22 | 13 **flag** | 109 |
| walk_NE_0 | `art/raw/g13b-job4/player/walk-skel/north-east 0` | 0 | 0 | -1 | 16, 1 | 5 | 10 | 12 |
| walk_NE_1 | `art/raw/g13b-job4/player/walk-skel/north-east 1` | 0 | 0 | -3 | 16, -1 | 9 | 11 | 7 |
| walk_NE_2 | `art/raw/g13b-job4/player/walk-skel/north-east 2` | 0 | 0 | -2 | 16, 0 | 1 | 11 | 13 |
| walk_NE_3 | `art/raw/g13b-job4/player/walk-skel/north-east 3` | 0 | 0 | -1 | 16, 1 | 0 | 11 | 15 |
| walk_NE_4 | `art/raw/g13b-job4/player/walk-skel/north-east 4` | 0 | 0 | -1 | 16, 1 | 2 | 11 | 11 |
| walk_NE_5 | `art/raw/g13b-job4/player/walk-skel/north-east 5` | 0 | 0 | -1 | 16, 1 | 10 | 11 | 14 |
| walk_N_0 | `art/raw/g13b-job4/player/walk-skel/north 0` | 0 | 0 | 0 | 16, 2 | 3 | 7 | 0 |
| walk_N_1 | `art/raw/g13b-job4/player/walk-skel/north 1` | 0 | 0 | -2 | 16, 0 | 2 | 7 | 0 |
| walk_N_2 | `art/raw/g13b-job4/player/walk-skel/north 2` | 0 | 0 | -1 | 16, 1 | 1 | 7 | 0 |
| walk_N_3 | `art/raw/g13b-job4/player/walk-skel/north 3` | 0 | 0 | 0 | 16, 2 | 2 | 7 | 0 |
| walk_N_4 | `art/raw/g13b-job4/player/walk-skel/north 4` | 0 | 0 | -2 | 16, 0 | 6 | 7 | 0 |
| walk_N_5 | `art/raw/g13b-job4/player/walk-skel/north 5` | 0 | 0 | -1 | 16, 1 | 2 | 7 | 0 |
| light_1_S_0 | `art/raw/g13b-job4/player/attack-v3/south 1` | 59 | 7.47 | 0 | 18, 4 | 0 | 16 **flag** | 161 |
| light_1_S_1 | `art/raw/g13b-job4/player/attack-v3/south 3` | 77 | 7.6 | 0 | 18, 4 | 2 | 18 **flag** | 167 |
| light_1_S_2 | `art/raw/g13b-job4/player/attack-v3/south 5` | 66 | 7.6 | 0 | 18, 4 | 0 | 19 **flag** | 169 |
| light_1_E_0 | `art/raw/g13b-job4/player/attack-v3/east 1` | 12 | 7.44 | -3 | 20, 3 | 0 | 13 **flag** | 110 |
| light_1_E_1 | `art/raw/g13b-job4/player/attack-v3/east 3` | 37 | 7.44 | -3 | 20, 3 | 3 | 18 **flag** | 115 |
| light_1_E_2 | `art/raw/g13b-job4/player/attack-v3/east 5` | 40 | 7.44 | -3 | 20, 3 | 1 | 16 **flag** | 122 |

## Skin regions to resolve

- idle_S_0: a region of 4 px in the skin colours at [[27, 39], [30, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 4 px in the skin colours at [[34, 39], [37, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 3 px in the skin colours at [[19, 44], [19, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 1 px in the skin colours at [[44, 46], [44, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 20 px in the skin colours at [[25, 48], [29, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 21 px in the skin colours at [[33, 48], [37, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_S_0: a region of 1 px in the skin colours at [[18, 49], [18, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 2 px in the skin colours at [[41, 18], [41, 19]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 1 px in the skin colours at [[38, 39], [38, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 6 px in the skin colours at [[29, 40], [34, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 1 px in the skin colours at [[37, 41], [37, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 12 px in the skin colours at [[35, 48], [38, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 1 px in the skin colours at [[20, 49], [20, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 1 px in the skin colours at [[27, 54], [27, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SE_0: a region of 1 px in the skin colours at [[28, 55], [28, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 4 px in the skin colours at [[35, 40], [37, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 2 px in the skin colours at [[33, 42], [34, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 25 px in the skin colours at [[30, 50], [35, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_E_0: a region of 7 px in the skin colours at [[35, 50], [37, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_0: a region of 4 px in the skin colours at [[24, 41], [24, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_NW_0: a region of 5 px in the skin colours at [[26, 53], [28, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_0: a region of 5 px in the skin colours at [[25, 40], [28, 41]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_0: a region of 2 px in the skin colours at [[29, 42], [30, 42]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_0: a region of 2 px in the skin colours at [[40, 49], [41, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_0: a region of 7 px in the skin colours at [[26, 50], [28, 53]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_W_0: a region of 25 px in the skin colours at [[28, 50], [33, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 2 px in the skin colours at [[37, 29], [38, 29]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[41, 32], [41, 32]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[42, 33], [42, 33]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 1 px in the skin colours at [[43, 36], [43, 36]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 2 px in the skin colours at [[25, 39], [26, 39]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 6 px in the skin colours at [[30, 40], [35, 40]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 17 px in the skin colours at [[25, 47], [28, 52]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- idle_SW_0: a region of 24 px in the skin colours at [[33, 49], [37, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 4 px in the skin colours at [[35, 47], [38, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 4 px in the skin colours at [[42, 47], [45, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 2 px in the skin colours at [[33, 53], [33, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 1 px in the skin colours at [[28, 54], [28, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 21 px in the skin colours at [[34, 56], [38, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 20 px in the skin colours at [[42, 56], [46, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_0: a region of 1 px in the skin colours at [[27, 57], [27, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_1: a region of 4 px in the skin colours at [[35, 47], [38, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_1: a region of 4 px in the skin colours at [[42, 47], [45, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_1: a region of 3 px in the skin colours at [[28, 54], [28, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_1: a region of 10 px in the skin colours at [[34, 57], [37, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_2: a region of 4 px in the skin colours at [[35, 47], [38, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_2: a region of 4 px in the skin colours at [[42, 47], [45, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_2: a region of 1 px in the skin colours at [[27, 54], [27, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_2: a region of 26 px in the skin colours at [[41, 56], [45, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_2: a region of 10 px in the skin colours at [[34, 57], [37, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_3: a region of 4 px in the skin colours at [[35, 47], [38, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_3: a region of 4 px in the skin colours at [[42, 47], [45, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_3: a region of 3 px in the skin colours at [[27, 52], [27, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_3: a region of 1 px in the skin colours at [[52, 54], [52, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_3: a region of 20 px in the skin colours at [[33, 56], [37, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_3: a region of 20 px in the skin colours at [[41, 56], [45, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_3: a region of 1 px in the skin colours at [[26, 57], [26, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 4 px in the skin colours at [[36, 47], [39, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 4 px in the skin colours at [[43, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 2 px in the skin colours at [[29, 48], [29, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 1 px in the skin colours at [[30, 54], [30, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 1 px in the skin colours at [[53, 54], [53, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 29 px in the skin colours at [[34, 56], [38, 62]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_4: a region of 11 px in the skin colours at [[42, 56], [45, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 4 px in the skin colours at [[36, 47], [39, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 4 px in the skin colours at [[43, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 1 px in the skin colours at [[53, 54], [53, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 1 px in the skin colours at [[30, 55], [30, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 24 px in the skin colours at [[34, 56], [38, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_S_5: a region of 13 px in the skin colours at [[42, 56], [45, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 1 px in the skin colours at [[46, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 4 px in the skin colours at [[39, 48], [42, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 1 px in the skin colours at [[34, 56], [34, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 1 px in the skin colours at [[47, 56], [47, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 1 px in the skin colours at [[28, 57], [28, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 9 px in the skin colours at [[44, 57], [46, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_0: a region of 10 px in the skin colours at [[36, 60], [40, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_1: a region of 1 px in the skin colours at [[46, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_1: a region of 4 px in the skin colours at [[39, 48], [42, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_1: a region of 3 px in the skin colours at [[39, 56], [40, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_1: a region of 1 px in the skin colours at [[28, 57], [28, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_1: a region of 14 px in the skin colours at [[33, 59], [36, 62]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_1: a region of 10 px in the skin colours at [[47, 59], [50, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_2: a region of 1 px in the skin colours at [[46, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_2: a region of 5 px in the skin colours at [[38, 48], [42, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_2: a region of 1 px in the skin colours at [[28, 57], [28, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_2: a region of 1 px in the skin colours at [[40, 57], [40, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_2: a region of 13 px in the skin colours at [[33, 59], [36, 62]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_2: a region of 10 px in the skin colours at [[45, 59], [49, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_3: a region of 1 px in the skin colours at [[46, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_3: a region of 6 px in the skin colours at [[37, 48], [42, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_3: a region of 12 px in the skin colours at [[43, 56], [46, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_3: a region of 1 px in the skin colours at [[28, 57], [28, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_3: a region of 1 px in the skin colours at [[35, 62], [35, 62]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_3: a region of 1 px in the skin colours at [[36, 63], [36, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_4: a region of 1 px in the skin colours at [[46, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_4: a region of 7 px in the skin colours at [[36, 48], [42, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_4: a region of 1 px in the skin colours at [[30, 58], [30, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_4: a region of 20 px in the skin colours at [[40, 58], [45, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_5: a region of 1 px in the skin colours at [[46, 47], [46, 47]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_5: a region of 6 px in the skin colours at [[37, 48], [42, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_5: a region of 3 px in the skin colours at [[32, 55], [32, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_5: a region of 1 px in the skin colours at [[45, 56], [45, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_5: a region of 9 px in the skin colours at [[43, 58], [45, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_SE_5: a region of 12 px in the skin colours at [[39, 59], [42, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 2 px in the skin colours at [[46, 48], [46, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 2 px in the skin colours at [[35, 55], [36, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 1 px in the skin colours at [[30, 56], [30, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 1 px in the skin colours at [[34, 56], [34, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 26 px in the skin colours at [[38, 58], [43, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_0: a region of 6 px in the skin colours at [[43, 58], [46, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 1 px in the skin colours at [[26, 51], [26, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 2 px in the skin colours at [[34, 54], [35, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 18 px in the skin colours at [[44, 56], [50, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 1 px in the skin colours at [[29, 57], [29, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_1: a region of 24 px in the skin colours at [[35, 58], [39, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 1 px in the skin colours at [[46, 48], [46, 48]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 2 px in the skin colours at [[29, 54], [29, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 5 px in the skin colours at [[34, 55], [36, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 14 px in the skin colours at [[44, 56], [48, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 1 px in the skin colours at [[34, 58], [34, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_2: a region of 22 px in the skin colours at [[34, 58], [39, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_3: a region of 4 px in the skin colours at [[43, 48], [45, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_3: a region of 2 px in the skin colours at [[41, 50], [42, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_3: a region of 1 px in the skin colours at [[29, 56], [29, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_3: a region of 25 px in the skin colours at [[38, 58], [43, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_3: a region of 7 px in the skin colours at [[43, 58], [45, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 4 px in the skin colours at [[49, 42], [50, 44]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 2 px in the skin colours at [[51, 44], [51, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 5 px in the skin colours at [[44, 48], [47, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 4 px in the skin colours at [[40, 50], [43, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 1 px in the skin colours at [[28, 54], [28, 54]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 1 px in the skin colours at [[30, 56], [30, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 1 px in the skin colours at [[35, 56], [35, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 19 px in the skin colours at [[35, 56], [39, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_4: a region of 1 px in the skin colours at [[40, 61], [40, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 5 px in the skin colours at [[43, 48], [46, 49]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 2 px in the skin colours at [[41, 50], [42, 50]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 1 px in the skin colours at [[29, 55], [29, 55]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 1 px in the skin colours at [[36, 56], [36, 56]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 1 px in the skin colours at [[34, 57], [34, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_E_5: a region of 27 px in the skin colours at [[37, 57], [44, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_0: a region of 4 px in the skin colours at [[43, 60], [45, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_1: a region of 6 px in the skin colours at [[40, 61], [42, 63]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_2: a region of 3 px in the skin colours at [[41, 61], [42, 62]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_2: a region of 1 px in the skin colours at [[43, 61], [43, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_4: a region of 3 px in the skin colours at [[35, 60], [36, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_5: a region of 1 px in the skin colours at [[45, 60], [45, 60]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- walk_NE_5: a region of 1 px in the skin colours at [[44, 61], [44, 61]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_0: a region of 1 px in the skin colours at [[40, 35], [40, 35]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_0: a region of 4 px in the skin colours at [[33, 45], [36, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_0: a region of 3 px in the skin colours at [[40, 45], [42, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_0: a region of 20 px in the skin colours at [[31, 54], [35, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_0: a region of 20 px in the skin colours at [[39, 54], [43, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_1: a region of 1 px in the skin colours at [[46, 38], [46, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_1: a region of 3 px in the skin colours at [[40, 46], [42, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_1: a region of 22 px in the skin colours at [[31, 54], [35, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_1: a region of 18 px in the skin colours at [[39, 54], [43, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_2: a region of 1 px in the skin colours at [[35, 38], [35, 38]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_2: a region of 1 px in the skin colours at [[48, 51], [48, 51]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_2: a region of 22 px in the skin colours at [[31, 54], [35, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_S_2: a region of 23 px in the skin colours at [[39, 54], [43, 58]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_0: a region of 4 px in the skin colours at [[39, 44], [41, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_0: a region of 2 px in the skin colours at [[37, 46], [38, 46]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_0: a region of 25 px in the skin colours at [[34, 54], [39, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_0: a region of 7 px in the skin colours at [[39, 54], [41, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_1: a region of 26 px in the skin colours at [[34, 54], [39, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_1: a region of 7 px in the skin colours at [[39, 54], [41, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_2: a region of 1 px in the skin colours at [[29, 45], [29, 45]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_2: a region of 25 px in the skin colours at [[34, 54], [39, 59]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
- light_1_E_2: a region of 7 px in the skin colours at [[39, 54], [41, 57]] (source pixels) has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not
