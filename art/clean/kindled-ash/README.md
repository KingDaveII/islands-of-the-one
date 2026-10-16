# kindled-ash: frames ART made by hand

Frames for `art/sheets/kindled-ash.json` that PixelLab didn't deliver. Each folder is laid out like a v3 output: `frame-0.png` is the rotation, used as the `ground` reference, and the frames after it are the animation. Everything is on a 64×64 canvas with the soles on row 53.

| Folder | Frames | How it was made |
|---|---|---|
| `heavy/north/` | 1–3 `heavy_charge`, 4–5 `heavy_thrust`, 6 `heavy_hold`, 7–8 `heavy_recover` | Drawn on the N rotation by `_scripts/heavy_n.py`. The right hand is on the viewer's right. The charge drops the hand behind the right hip and swings the blade further back each frame. The thrust raises the arm past the hood, with the blade pointing up (away from the viewer). The recover lowers it. Steel ramp, leather grip, dream-night outline. The v3 heavy N lost the blade to smears and turned the figure round. |
| `dodge/south/` | 1 crouch, 2–3 roll, 4 rise | Composed by `_scripts/dodge_sn.py` from SS-01's S dodge (crouch 3, rise 8) and the SW tumble (5, 6). The S output never rolled. The pale blob the generator left in the crouch's hands is painted out with the neighbouring colours. |
| `dodge/north/` | 1 crouch, 2–3 roll, 4 rise | Composed from take 1's N dodge (1), the NW tumble (5, 6) and the N rotation. |
| `<anim>/east/`, `<anim>/west/` for idle, walk, light_1–3, heavy, haul, haul_pull, haul_slide, hit, death | every frame, same numbering as `art/raw/ss01-kindled-ash/` | The side views' Hookblade, reshaped by `_scripts/blade_ew.py` (David's playtest, 2026-10-16: the generated crescent read as a sickle). The blade is erased and redrawn as the style sheet's icon: a straight 9 px blade from the hand with a 2 px hook at the tip, turned up. Where it crosses the legs (heavy charge E) the generator's first steps are kept and only the hook is added. A few frames have overrides in the script (walk W 1–2, idle W 0); death E 2 and 4 keep the generated blade, flying loose in the fall. |

To rebuild, from the repo root: `python3 art/clean/kindled-ash/_scripts/heavy_n.py art/raw/ss01-kindled-ash/rotation/north.png art/clean/kindled-ash`, `python3 art/clean/kindled-ash/_scripts/dodge_sn.py art/clean/kindled-ash` and `python3 art/clean/kindled-ash/_scripts/blade_ew.py art/raw/ss01-kindled-ash art/clean/kindled-ash`. Colours are left raw; the recipe's remap and snap handle them like every other source.
