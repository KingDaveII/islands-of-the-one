# npc-tally (draft)

Built by `pnpm art:build npc-tally` from `art/sheets/npc-tally.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind npc, outline other, cell 64×64, origin (32, 54). A draft writes this review only, never `packages/shared/assets`.

## Summary

- Frames: 8.
- Off-palette pixels snapped: 275 (largest ΔE 7.97).
- Outline gaps (edge pixels not in an outline colour): 6.
- Loop seam flags (last → first above 1.5× the mean change): none.
- Body bob flags (top row moves more than 1 px): none.
- Held frames (identical neighbours): none.
- Frames with more than 12 colours: none.
- Missing against the contract's table: no animation table for npc sheets in the contract.

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
