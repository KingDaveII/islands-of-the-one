# tiles-holding

Built by `pnpm art:build tiles-holding` from `art/sheets/tiles-holding.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind tiles, the shore rule, no doors, outline other, 32×32 tiles, floor weights 6:3:2:1 (floor_0 to floor_3), plain drop 3:1 (drop_mid_0 to drop_mid_1).

## Summary

- Frames: 16 (static pieces).
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels against the piece's own transparency, not in an outline colour; the border is no edge): 148.
- Missing against the contract: none.
- Opaque pieces with transparent pixels: 0.

## Review images

`contact.png` has every built piece at 2× on the floor (left) and the wall face (right): a row each for the floors, drops and lips.

`rooms.png` draws the holding's layouts (holding.json) from these pieces with the engine's shore rule (`tileAt`, sprites.md "Tiles"), at 1×, top to bottom:

| Room | Cells | At (px) | Pieces it needs that are missing |
|---|---|---|---|
| first-holding | 30×24 | 16, 16 | none |

## Pieces

| Frame | Source | Size | Off-palette | Max ΔE | Outline gaps | Colours | Holes |
|---|---|---|---|---|---|---|---|
| floor_0 | `art/clean/tiles-holding/floor_0.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| floor_1 | `art/clean/tiles-holding/floor_1.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| floor_2 | `art/clean/tiles-holding/floor_2.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| floor_3 | `art/clean/tiles-holding/floor_3.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| drop_mid_0 | `art/clean/tiles-holding/drop_mid_0.png 0` | 32×32 | 0 | 0 | 0 | 5 |  |
| drop_mid_1 | `art/clean/tiles-holding/drop_mid_1.png 0` | 32×32 | 0 | 0 | 0 | 5 |  |
| drop_w | `art/clean/tiles-holding/drop_w.png 0` | 32×32 | 0 | 0 | 0 | 5 |  |
| drop_e | `art/clean/tiles-holding/drop_e.png 0` | 32×32 | 0 | 0 | 0 | 5 |  |
| drop_we | `art/clean/tiles-holding/drop_we.png 0` | 32×32 | 0 | 0 | 0 | 5 |  |
| drop_corner_w | `art/clean/tiles-holding/drop_corner_w.png 0` | 32×32 | 0 | 0 | 29 | 5 |  |
| drop_corner_e | `art/clean/tiles-holding/drop_corner_e.png 0` | 32×32 | 0 | 0 | 15 | 5 |  |
| lip_n | `art/clean/tiles-holding/lip_n.png 0` | 32×32 | 0 | 0 | 32 | 2 |  |
| lip_w | `art/clean/tiles-holding/lip_w.png 0` | 32×32 | 0 | 0 | 32 | 2 |  |
| lip_e | `art/clean/tiles-holding/lip_e.png 0` | 32×32 | 0 | 0 | 32 | 2 |  |
| lip_nw | `art/clean/tiles-holding/lip_nw.png 0` | 32×32 | 0 | 0 | 4 | 2 |  |
| lip_ne | `art/clean/tiles-holding/lip_ne.png 0` | 32×32 | 0 | 0 | 4 | 2 |  |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp.

