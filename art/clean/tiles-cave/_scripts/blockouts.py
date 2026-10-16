"""ART: flat-colour layout references for the tiles-cave job (art/jobs/tiles-cave.md).

PixelLab paints texture onto these; their geometry is the tile contract's (G1.5e), in world px:
a wall cell's bottom 24 px is the face and its top 8 px the cap, light from the top left.

- tiles-blockout-wall-64.png: the cap (y 0-7, the wall top's front edge, lit lip on its last row),
  the face (y 8-31, strata, a dark foot), the floor below (y 32-63) with the face's shade band.
- tiles-blockout-door-64.png: the same with the 64 px north door in the face: bronze posts,
  two shell-stone leaves with a bronze band, the seam in the middle.

    python3 art/clean/tiles-cave/_scripts/blockouts.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]
DEEP, BELOW, DUSK, LAV, LIGHT = (T[k] for k in ("hollow-deep", "hollow-below", "hollow-dusk", "hollow-lavender", "hollow-light"))
BRONZE, BRASS_DARK = T["watcher-bronze"], T["wheel-brass-dark"]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def base():
    img = Image.new("RGBA", (64, 64), rgb(LAV))
    px = img.load()
    for x in range(64):
        for y in range(0, 6):
            px[x, y] = rgb(DEEP)
        px[x, 6] = rgb(BELOW)
        px[x, 7] = rgb(DUSK)                    # the lit lip where the top meets the face
        for y in range(8, 31):
            px[x, y] = rgb(BELOW)
        px[x, 31] = rgb(DEEP)                   # the foot
        for y in (15, 23):                      # strata
            if (x // 7) % 3 != 2:
                px[x, y] = rgb(DEEP)
        for y in range(32, 38):                 # the shade on the floor below the face
            if y < 35 or (x + y) % 2 == 0:
                if y < 34 or (x + y) % 2 == 0:
                    px[x, y] = rgb(DUSK)
    return img


def wall():
    return base()


def door():
    img = base()
    px = img.load()
    for y in range(8, 31):
        for x in range(64):
            if x < 6 or x > 57:                 # posts
                px[x, y] = rgb(BRONZE if x in (1, 2, 59, 60) or y == 8 else BRASS_DARK)
            else:                               # the leaves
                px[x, y] = rgb(DUSK)
                if x in (6, 57) or y == 30:
                    px[x, y] = rgb(BELOW)
                if x in (31, 32):
                    px[x, y] = rgb(DEEP)        # the seam
                if 18 <= y <= 20:
                    px[x, y] = rgb(BRONZE if y != 20 else BRASS_DARK)
                if y == 9 and 7 <= x <= 56 and x not in (31, 32):
                    px[x, y] = rgb(LAV)         # the leaves' lit top edge
    return img


def main():
    out = ROOT / "art/anchors"
    wall().save(out / "tiles-blockout-wall-64.png")
    door().save(out / "tiles-blockout-door-64.png")


if __name__ == "__main__":
    main()
