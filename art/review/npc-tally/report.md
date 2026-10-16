# npc-tally (draft)

Built by `pnpm art:build npc-tally` from `art/sheets/npc-tally.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind npc, outline other, cell 64×64, origin (32, 54). A draft writes this review only, never `packages/shared/assets`.

## Summary

- Frames: 8.
- Off-palette pixels snapped: 275 (largest ΔE 7.97).
- Outline gaps (edge pixels not in an outline colour): 6.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 2 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Missing against the contract's table: idle_S: 1 of 2 frames, idle_SE: 1 of 2 frames, idle_E: 1 of 2 frames, idle_NE: 1 of 2 frames, idle_N: 1 of 2 frames, idle_NW: 1 of 2 frames, idle_W: 1 of 2 frames, idle_SW: 1 of 2 frames, walk (all facings).

## Review images

`contact.png` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.

Rows, top to bottom: idle_S, idle_SE, idle_E, idle_NE, idle_N, idle_NW, idle_W, idle_SW.

## Animations

| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |
|---|---|---|---|---|
| idle_S | 1 |  | 46 (range 0) |  |
| idle_SE | 1 |  | 46 (range 0) |  |
| idle_E | 1 |  | 46 (range 0) |  |
| idle_NE | 1 |  | 45 (range 0) |  |
| idle_N | 1 |  | 45 (range 0) |  |
| idle_NW | 1 |  | 46 (range 0) |  |
| idle_W | 1 |  | 48 (range 0) |  |
| idle_SW | 1 |  | 48 (range 0) |  |

## Frames

Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.

| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours | Interior dream-night |
|---|---|---|---|---|---|---|---|---|
| idle_S_0 | `art/raw/g13b-job4/npc-tally/south.png 0` | 0 | 0 | 0 | 0, 0 | 0 | 8 | 98 |
| idle_SE_0 | `art/raw/g13b-job4/npc-tally/south-east.png 0` | 42 | 7.97 | -1 | 0, -1 | 0 | 11 | 87 |
| idle_E_0 | `art/raw/g13b-job4/npc-tally/east.png 0` | 27 | 7.74 | -3 | 0, -3 | 1 | 12 | 77 |
| idle_NE_0 | `art/raw/g13b-job4/npc-tally/north-east.png 0` | 48 | 7.97 | -1 | 0, -1 | 2 | 12 | 84 |
| idle_N_0 | `art/raw/g13b-job4/npc-tally/north.png 0` | 50 | 6.82 | 0 | 0, 0 | 0 | 12 | 82 |
| idle_NW_0 | `art/raw/g13b-job4/npc-tally/north-west.png 0` | 38 | 6.33 | -2 | 0, -2 | 1 | 12 | 94 |
| idle_W_0 | `art/raw/g13b-job4/npc-tally/west.png 0` | 20 | 6.82 | -3 | 0, -3 | 0 | 11 | 84 |
| idle_SW_0 | `art/raw/g13b-job4/npc-tally/south-west.png 0` | 50 | 6.93 | -1 | 0, -1 | 2 | 12 | 91 |

## Off-palette colours the snap moved

28 source colours reached the snap off the whitelist. The 20 with the most pixels, with the colour the snap sent each to and that colour's ramp (the material rows of `art/anchors/style-sheet.md`). A colour that lands in the wrong material needs a `remap` rule.

| Colour | Pixels | Snapped to | ΔE | Ramp | Frames |
|---|---|---|---|---|---|
| #8c4a44 | 78 | sleeper-ochre #9c5b4a | 5.52 | ember, red clay | idle_SE 0; idle_E 0; idle_NE 0; idle_N 0; idle_NW 0; idle_SW 0 |
| #e9d3b6 | 35 | husk-shell #e8e2d6 | 4.67 | shell, steel | idle_SE 0; idle_E 0; idle_NE 0; idle_NW 0; idle_W 0; idle_SW 0 |
| #3c3049 | 18 | sleeper-night #24305a | 4.93 | water, hair | idle_SE 0; idle_E 0; idle_NE 0; idle_N 0; idle_NW 0; idle_SW 0 |
| #e8d9c4 | 18 | husk-shell #e8e2d6 | 2.73 | shell, steel | idle_SE 0; idle_NE 0; idle_N 0; idle_NW 0; idle_W 0; idle_SW 0 |
| #d7a889 | 16 | sleeper-flesh #c98f78 | 6.82 | red clay | idle_E 0; idle_NE 0; idle_N 0; idle_W 0; idle_SW 0 |
| #4e4669 | 15 | watcher-iron #4a4e57 | 4.52 | cloth, steel | idle_SE 0; idle_E 0; idle_NE 0; idle_N 0; idle_NW 0; idle_W 0; idle_SW 0 |
| #dbb28f | 14 | sleeper-soil #e3c29e | 4.31 | red clay | idle_SE 0; idle_E 0; idle_NE 0; idle_NW 0; idle_W 0; idle_SW 0 |
| #574151 | 9 | watcher-iron #4a4e57 | 4.14 | cloth, steel | idle_SE 0; idle_NE 0; idle_N 0; idle_NW 0; idle_SW 0 |
| #865549 | 8 | sleeper-ochre #9c5b4a | 4.56 | ember, red clay | idle_SE 0; idle_NW 0; idle_SW 0 |
| #76584e | 7 | unwritten-tar #5e5448 | 4.55 | skin | idle_SE 0; idle_NW 0; idle_W 0; idle_SW 0 |
| #ba7e68 | 6 | spark-ember #c9733a | 5.23 | ember | idle_E 0; idle_N 0; idle_NW 0 |
| #4e4245 | 6 | watcher-iron #4a4e57 | 3.94 | cloth, steel | idle_SE 0; idle_E 0; idle_W 0; idle_SW 0 |
| #e1b488 | 5 | sleeper-soil #e3c29e | 3.8 | red clay | idle_SE 0; idle_SW 0 |
| #3c3954 | 4 | sleeper-night #24305a | 5.23 | water, hair | idle_NE 0; idle_NW 0; idle_W 0 |
| #a26d5e | 4 | sleeper-ochre #9c5b4a | 4.87 | ember, red clay | idle_SE 0; idle_N 0; idle_W 0 |
| #825e53 | 4 | sleeper-ochre #9c5b4a | 4.67 | ember, red clay | idle_SE 0; idle_E 0; idle_W 0 |
| #c68366 | 4 | sleeper-flesh #c98f78 | 3.28 | red clay | idle_NE 0; idle_N 0; idle_SW 0 |
| #5c3340 | 3 | watcher-iron #4a4e57 | 7.97 | cloth, steel | idle_SE 0; idle_NE 0 |
| #453a44 | 3 | watcher-iron #4a4e57 | 6.33 | cloth, steel | idle_E 0; idle_NE 0; idle_NW 0 |
| #403a5e | 3 | sleeper-night #24305a | 5.75 | water, hair | idle_E 0; idle_NE 0; idle_W 0 |
