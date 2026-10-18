# tiles-holding

Built by `pnpm art:build tiles-holding` from `art/sheets/tiles-holding.json`; do not edit by hand (`pnpm art:check` rebuilds it).
Kind tiles, outline other, 32×32 tiles, floor weights 6:3:2:1 (floor_0 to floor_3), plain face 3:1 and plain top 3:1 (mid_0 to mid_1).

## Summary

- Frames: 53 (static pieces and door frames).
- Off-palette pixels snapped: 0 (largest ΔE 0).
- Outline gaps (edge pixels against the piece's own transparency, not in an outline colour; the border is no edge): 354.
- Missing against the contract: none.
- Opaque pieces with transparent pixels: 0.

## Review images

`contact.png` has every built piece at 2× on the floor (left) and the wall face (right): a row each for the floors, shades, faces, tops and corners, then a row per door animation.

`rooms.png` draws every room of rooms.json and the holding's layout (holding.json) from these pieces with the engine's rule (`tileAt`, sprites.md "Tiles"), at 1×, doors closed, top to bottom:

| Room | Cells | At (px) | Pieces it needs that are missing |
|---|---|---|---|
| Shell Gallery | 32×19 | 16, 16 | none |
| Crossing | 32×18 | 16, 640 | none |
| Narrow Hollow | 40×10 | 16, 1232 | none |
| Core Ring | 32×17 | 16, 1568 | none |
| Spill | 32×14 | 16, 2128 | none |
| first-holding | 28×20 | 16, 2592 | none |

## Pieces

| Frame | Source | Size | Off-palette | Max ΔE | Outline gaps | Colours | Holes |
|---|---|---|---|---|---|---|---|
| floor_0 | `art/clean/tiles-holding/floor_0.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| floor_1 | `art/clean/tiles-holding/floor_1.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| floor_2 | `art/clean/tiles-holding/floor_2.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| floor_3 | `art/clean/tiles-holding/floor_3.png 0` | 32×32 | 0 | 0 | 0 | 2 |  |
| shade_n | `art/clean/tiles-holding/shade_n.png 0` | 32×32 | 0 | 0 | 96 | 1 |  |
| shade_w | `art/clean/tiles-holding/shade_w.png 0` | 32×32 | 0 | 0 | 96 | 1 |  |
| shade_e | `art/clean/tiles-holding/shade_e.png 0` | 32×32 | 0 | 0 | 96 | 1 |  |
| shade_nw | `art/clean/tiles-holding/shade_nw.png 0` | 32×32 | 0 | 0 | 18 | 1 |  |
| shade_ne | `art/clean/tiles-holding/shade_ne.png 0` | 32×32 | 0 | 0 | 18 | 1 |  |
| face_n | `art/clean/tiles-holding/face_n.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_w | `art/clean/tiles-holding/face_w.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_e | `art/clean/tiles-holding/face_e.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_nw | `art/clean/tiles-holding/face_nw.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_ne | `art/clean/tiles-holding/face_ne.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_we | `art/clean/tiles-holding/face_we.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_nwe | `art/clean/tiles-holding/face_nwe.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_mid_0 | `art/clean/tiles-holding/face_mid_0.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| face_mid_1 | `art/clean/tiles-holding/face_mid_1.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_n | `art/clean/tiles-holding/top_n.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_w | `art/clean/tiles-holding/top_w.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_e | `art/clean/tiles-holding/top_e.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_nw | `art/clean/tiles-holding/top_nw.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_ne | `art/clean/tiles-holding/top_ne.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_we | `art/clean/tiles-holding/top_we.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_nwe | `art/clean/tiles-holding/top_nwe.png 0` | 32×32 | 0 | 0 | 0 | 4 |  |
| top_mid_0 | `art/clean/tiles-holding/top_mid_0.png 0` | 32×32 | 0 | 0 | 0 | 3 |  |
| top_mid_1 | `art/clean/tiles-holding/top_mid_1.png 0` | 32×32 | 0 | 0 | 0 | 3 |  |
| corner_nw | `art/clean/tiles-holding/corner_nw.png 0` | 32×32 | 0 | 0 | 15 | 1 |  |
| corner_ne | `art/clean/tiles-holding/corner_ne.png 0` | 32×32 | 0 | 0 | 15 | 1 |  |
| door_n_closed_0 | `art/clean/tiles-holding/door_n_closed 0` | 64×32 | 0 | 0 | 0 | 3 |  |
| door_n_opening_0 | `art/clean/tiles-holding/door_n_opening 0` | 64×32 | 0 | 0 | 0 | 4 |  |
| door_n_opening_1 | `art/clean/tiles-holding/door_n_opening 1` | 64×32 | 0 | 0 | 0 | 4 |  |
| door_n_opening_2 | `art/clean/tiles-holding/door_n_opening 2` | 64×32 | 0 | 0 | 0 | 4 |  |
| door_n_opening_3 | `art/clean/tiles-holding/door_n_opening 3` | 64×32 | 0 | 0 | 0 | 4 |  |
| door_n_opening_4 | `art/clean/tiles-holding/door_n_opening 4` | 64×32 | 0 | 0 | 0 | 4 |  |
| door_n_opening_5 | `art/clean/tiles-holding/door_n_opening 5` | 64×32 | 0 | 0 | 0 | 4 |  |
| door_n_open_0 | `art/clean/tiles-holding/door_n_open 0` | 64×32 | 0 | 0 | 0 | 2 |  |
| door_w_closed_0 | `art/clean/tiles-holding/door_w_closed 0` | 32×64 | 0 | 0 | 0 | 3 |  |
| door_w_opening_0 | `art/clean/tiles-holding/door_w_opening 0` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_w_opening_1 | `art/clean/tiles-holding/door_w_opening 1` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_w_opening_2 | `art/clean/tiles-holding/door_w_opening 2` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_w_opening_3 | `art/clean/tiles-holding/door_w_opening 3` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_w_opening_4 | `art/clean/tiles-holding/door_w_opening 4` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_w_opening_5 | `art/clean/tiles-holding/door_w_opening 5` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_w_open_0 | `art/clean/tiles-holding/door_w_open 0` | 32×64 | 0 | 0 | 0 | 2 |  |
| door_e_closed_0 | `art/clean/tiles-holding/door_e_closed 0` | 32×64 | 0 | 0 | 0 | 3 |  |
| door_e_opening_0 | `art/clean/tiles-holding/door_e_opening 0` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_e_opening_1 | `art/clean/tiles-holding/door_e_opening 1` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_e_opening_2 | `art/clean/tiles-holding/door_e_opening 2` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_e_opening_3 | `art/clean/tiles-holding/door_e_opening 3` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_e_opening_4 | `art/clean/tiles-holding/door_e_opening 4` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_e_opening_5 | `art/clean/tiles-holding/door_e_opening 5` | 32×64 | 0 | 0 | 0 | 4 |  |
| door_e_open_0 | `art/clean/tiles-holding/door_e_open 0` | 32×64 | 0 | 0 | 0 | 2 |  |

## Off-palette colours the snap moved

0 source colours reached the snap off the whitelist. The 0 with the most pixels, with the colour the snap sent each to and that colour's ramp.

