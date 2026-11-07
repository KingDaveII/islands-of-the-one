"""ART: the home-screen icon (M2 Task 10, MAIN after #137): the Kindled (Ash, sheathed, facing you) standing on a
small island of the holding's earth, floating in the Hollow, a few Sparkglass motes round it. Drawn at 1x, scaled
only by whole numbers, nearest neighbour.

- icon-64.png, for the manifest: maskable, so the background (the Hollow, hollow-deep) runs to every edge and
  everything that matters (the Kindled and the island's top) sits inside the centre circle a launcher may crop
  to (radius 40 % of the size). The island's underside drips past it into the Hollow: a crop loses only that.
  Scaled x3 -> icon-192.png, x8 -> icon-512.png.
- icon-60.png, for iOS (apple-touch-icon; iOS rounds the corners itself, no circle): the same picture recentred
  in 60 px. Scaled x3 -> apple-touch-icon-180.png.

The Kindled is idle_S_0 of kindled-ash-sheathed as built, pixel for pixel, its skin in the sheet's own clay ramp.
The island is the holding's drop in little: its earth (sleeper-soil, a lit rim of hollow-light), the cut in
sleeper-flesh and sleeper-ochre, the rock of the Hollow below (hollow-below with hollow-deep cracks and
hollow-dusk flecks) breaking up into the Hollow in a checker. No alpha, no husk-core, no reserved signal colour.

    python3 art/clean/app-icon/icon.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]
OUT = ROOT / "apps/client/public/icons"
SRC = Path(__file__).parent


def rgb(name):
    h = T[name]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


HOLLOW, BELOW, DUSK = rgb("hollow-deep"), rgb("hollow-below"), rgb("hollow-dusk")
SOIL, FLESH, OCHRE, LIGHT = rgb("sleeper-soil"), rgb("sleeper-flesh"), rgb("sleeper-ochre"), rgb("hollow-light")
OUTLINE, SPARK, GOLD = rgb("dream-night"), rgb("spark-amber"), rgb("wheel-brass")


def kindled():
    meta = json.loads((ROOT / "packages/shared/assets/sprites/kindled-ash-sheathed.json").read_text())
    sheet = Image.open(ROOT / "packages/shared/assets/sprites/kindled-ash-sheathed.png").convert("RGBA")
    f = meta["frames"]["idle_S_0"]["frame"]
    cell = sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    return cell.crop(cell.getbbox())   # 28 x 44, the soles on its last row


def island(px, cx, top, half, size):
    """The island: a slab of earth seen from above, an oval `half` px either side of cx with its top row at
    `top`, its cut edge showing below it (sleeper-flesh, then sleeper-ochre) like a coin's rim, and the rock
    of the Hollow under that, tapering to a point and breaking into the Hollow in a checker. Returns the
    oval's middle row."""
    ry = 4.5
    mid = top + 4

    def oval(dy0):
        cells = []
        for y in range(int(mid - ry) - 1, int(mid + ry) + 2):
            for x in range(cx - half - 1, cx + half + 2):
                if ((x + 0.5 - cx) / (half + 0.5)) ** 2 + ((y + 0.5 - mid) / ry) ** 2 <= 1:
                    cells.append((x, y + dy0))
        return cells

    # the rock first, from the rim's widest row down, narrowing 2 px a row on each side
    rock_top = mid + 3
    depth = min(10, size - rock_top - 1)
    for dy in range(depth):
        w = half - 3 - dy * 2 + (1 if dy % 3 == 1 else 0)
        if w < 0:
            break
        for x in range(cx - w, cx + w + 1):
            if dy >= depth - 3 and (x + dy) % 2:
                continue                           # the checker into the Hollow
            px[x, rock_top + dy] = OUTLINE if abs(x - cx) >= w and dy >= 1 else BELOW
    for x, y in ((cx - 6, rock_top + 2), (cx - 5, rock_top + 2), (cx + 3, rock_top + 4), (cx + 4, rock_top + 4),
                 (cx - 1, rock_top + 6)):
        if y < rock_top + depth:
            px[x, y] = HOLLOW                      # cracks
    for x, y in ((cx + 8, rock_top + 2), (cx - 3, rock_top + 4)):
        px[x, y] = DUSK                            # flecks
    # the rim: the oval pushed down 3, 2, 1 rows in ochre, ochre, flesh
    for dy0, colour in ((3, OCHRE), (2, OCHRE), (1, FLESH)):
        for p in oval(dy0):
            px[p] = colour
    # the top: earth, lit along its top and left edge
    top_cells = set(oval(0))
    for x, y in top_cells:
        px[x, y] = SOIL
        if (x, y - 1) not in top_cells or ((x - 1, y) not in top_cells and y <= mid):
            px[x, y] = LIGHT
    for x, y in ((cx - 12, mid - 1), (cx + 9, mid + 2), (cx + 13, mid - 1), (cx - 8, mid + 3), (cx + 3, mid + 3)):
        px[x, y] = FLESH
    return mid


def picture(size, head_top):
    im = Image.new("RGBA", (size, size), HOLLOW)
    px = im.load()
    fig = kindled()
    cx = size // 2
    soles = head_top + fig.height - 1
    # the island's oval centred on the soles' row
    # the light behind the Kindled: a pale disc (hollow-dusk) ringed in hollow-below, breaking into the
    # Hollow in a checker, so the dark cloak and hood stand out against it
    lx, ly, r = cx, head_top + 19, 19
    for y in range(size):
        for x in range(size):
            d = ((x + 0.5 - lx) ** 2 + (y + 0.5 - ly) ** 2) ** 0.5
            if d <= r:
                px[x, y] = DUSK
            elif d <= r + 1.5 or (d <= r + 3 and (x + y) % 2 == 0):
                px[x, y] = BELOW
    island(px, cx, soles - 5, 17, size)
    im.alpha_composite(fig, (cx - fig.width // 2, head_top))
    # Sparkglass motes in the Hollow (+ shapes of 1 px arms, a lone pixel)
    for mx, my in ((cx + 15, head_top + 6), (cx - 18, head_top + 16)):
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            px[mx + dx, my + dy] = SPARK if (dx, dy) == (0, 0) else GOLD
    for mx, my in ((cx + 19, head_top + 21), (cx - 13, head_top + 3), (cx + 9, head_top - 1)):
        px[mx, my] = SPARK
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    big = picture(64, 7)      # head at row 7, soles at 50: inside the maskable circle (radius 25.6 round 32)
    small = picture(60, 5)
    big.save(SRC / "icon-64.png")
    small.save(SRC / "icon-60.png")
    for im, k, name in ((big, 3, "icon-192.png"), (big, 8, "icon-512.png"), (small, 3, "apple-touch-icon-180.png")):
        im.convert("RGB").resize((im.width * k, im.height * k), Image.NEAREST).save(OUT / name)
    # review: the 64 px icon at 4x, plain, then cropped to the maskable circle, then rounded as iOS does the 60
    review = Image.new("RGBA", (64 * 4 * 3 + 40, 64 * 4), (0, 0, 0, 0))
    a = big.resize((256, 256), Image.NEAREST)
    review.paste(a, (0, 0))
    circ = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for y in range(256):
        for x in range(256):
            if (x - 127.5) ** 2 + (y - 127.5) ** 2 <= (256 * 0.4) ** 2:
                circ.putpixel((x, y), a.getpixel((x, y)))
    review.paste(circ, (276, 0))
    b = small.resize((240, 240), Image.NEAREST)
    r = 54
    for y in range(240):
        for x in range(240):
            cx_, cy_ = min(max(x, r), 239 - r), min(max(y, r), 239 - r)
            if (x - cx_) ** 2 + (y - cy_) ** 2 > r * r:
                b.putpixel((x, y), (0, 0, 0, 0))
    review.paste(b, (552, 8))
    shots = ROOT / "docs/screenshots/app-icon"
    shots.mkdir(parents=True, exist_ok=True)
    review.save(shots / "icons.png")


if __name__ == "__main__":
    main()
