"""ART: every tiles-holding piece (the shore rule's 16, sprites.md "The shore rule") into
art/clean/tiles-holding/, replacing MAIN's placeholders.

Sources: the floors are the holding job's Wang tiles after reduce_colors (art/raw/holding/ground/
tiles-reduced/, PR #82); the drops and lips are drawn here, so every piece joins its neighbours.

- floor_0: the all-lower tile (nearly flat warm earth); floor_1 and floor_2 are it turned, with a
  pebble or a hairline crack; floor_3 is the all-upper tile, its pebbles and moss tufts (rare, weight 1,
  so its tufts never form a grid). The generator's grit, snapped to the skin ramp, becomes sleeper-flesh.
- drops (a void cell under the island): the ground's front lip (2 lit rows and an outline), a band of
  earth (sleeper-ochre, sleeper-flesh light), then rock (hollow-below lit hollow-dusk top-left, hollow-
  deep cracks) whose underside hangs in an uneven edge that repeats every 32 px, dithered into the void.
  drop_mid_1 hangs one longer spur. drop_w / drop_e round the run's end; drop_we does both.
- drop_corner_w / _e: the cliff's side turning the corner, a wedge of earth and rock tapering away.
- lips (overlays on ground cells beside the void): the outline and a lit rim; lit on N and W (light from
  the top left), shaded on E; lip_nw / lip_ne turn an inner corner.

    python3 art/clean/tiles-holding/_scripts/compose.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "art/clean/tiles-holding"
RAW = ROOT / "art/raw/holding/ground/tiles-reduced"
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]


def rgb(k):
    h = T[k]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


SOIL, FLESH, OCHRE, EYE = rgb("sleeper-soil"), rgb("sleeper-flesh"), rgb("sleeper-ochre"), rgb("wheel-eye")
DUSK, BELOW, DEEP = rgb("hollow-dusk"), rgb("hollow-below"), rgb("hollow-deep")
CLEAR = (0, 0, 0, 0)
S = 32


def new(fill=CLEAR):
    return Image.new("RGBA", (S, S), fill)


def checker(x, y):
    return (x + y) % 2 == 0


def ground(name):
    im = Image.open(RAW / name).convert("RGBA")
    px = im.load()
    for y in range(S):
        for x in range(S):
            if px[x, y][:3] == rgb("unwritten-sail")[:3]:
                px[x, y] = FLESH
            elif px[x, y][:3] == rgb("watcher-iron")[:3]:
                px[x, y] = rgb("watcher-rain")      # the moss tufts' shade: teal's own ramp
    return im


def floors():
    f0 = ground("wang_0.png")
    f1 = f0.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    for x, y in [(12, 11), (13, 11), (12, 12)]:      # one pebble, lit top left
        f1.putpixel((x, y), EYE)
    f1.putpixel((13, 12), FLESH)
    f1.putpixel((12, 13), FLESH)
    f1.putpixel((13, 13), OCHRE)
    f2 = f0.transpose(Image.Transpose.ROTATE_180)
    for x, y in [(9, 18), (10, 18), (11, 19), (12, 19), (13, 19), (14, 20), (15, 21), (16, 21)]:
        f2.putpixel((x, y), FLESH)                   # a hairline crack, lit on its lower side
    for x, y in [(10, 19), (13, 20), (15, 22)]:
        f2.putpixel((x, y), EYE)
    f3 = ground("wang_15.png")
    return {"floor_0": f0, "floor_1": f1, "floor_2": f2, "floor_3": f3}


# The cliff's underside: how deep the rock hangs in each column (repeats every 32 px).
HANG = [d + 5 for d in [14, 15, 15, 16, 17, 17, 16, 15, 15, 16, 18, 19, 19, 18, 16, 15,
                        14, 14, 15, 16, 16, 17, 18, 18, 17, 16, 15, 15, 14, 14, 14, 14]]
SPUR = {12: 25, 13: 27, 14: 28, 15: 27, 16: 25}             # drop_mid_1's longer hanging spur


def drop_column(img, x, depth, lit_left=False):
    """One column of the cliff: the lip, the earth band, the rock down to `depth`, then the dither."""
    px = img.load()
    for y in range(S):
        if y == 0:
            c = SOIL
        elif y == 1:
            c = FLESH                                 # the front lip, its edge in shade
        elif y == 2:
            c = DEEP                                  # the lip's outline
        elif y <= 6:
            c = FLESH if y == 3 else OCHRE            # the earth band, its top catching light
        elif y < depth:
            c = BELOW
            if y == 7:
                c = DEEP                              # where earth meets rock
            elif lit_left and x <= 1:
                c = DUSK
        elif y == depth:
            c = DEEP                                  # the underside's outline
        elif y <= depth + 4:
            c = DEEP if checker(x, y) else CLEAR      # dithered into the void
        else:
            c = CLEAR
        px[x, y] = c


def rock_texture(img, seed):
    """Strata and lit chips on the rock, kept 2 px off the joints."""
    px = img.load()
    for x0, y0, w in [(3 + seed, 10, 4), (12, 12, 5), (21 - seed, 9, 4), (26, 13, 3), (7, 14, 3)]:
        for k in range(w):
            x = (x0 + k) % S
            if 2 <= x <= S - 3 and px[x, y0] == BELOW:
                px[x, y0] = DUSK if k == 0 else DEEP
    for x in range(2, S - 2):
        if px[x, 8] == BELOW and x % 5 == 1:
            px[x, 8] = DUSK                           # light on the rock's top edge


def drop_mid(variant):
    img = new()
    for x in range(S):
        depth = HANG[x]
        if variant == 1 and x in SPUR:
            depth = SPUR[x]
        drop_column(img, x, depth)
    rock_texture(img, variant)
    return img


def end_shape(img, side):
    """Round the run's end: the lip turns down and the rock tapers to the end column."""
    px = img.load()
    cols = range(0, 4) if side == "w" else range(S - 4, S)
    for x in cols:
        k = x if side == "w" else S - 1 - x           # 0 at the end
        cut = {0: 22, 1: 12, 2: 5, 3: 2}[k]          # how many rows from the bottom of the face stay
        for y in range(S):
            if y > 2 + cut + (HANG[x] - 7) * k // 4:
                if px[x, y][3] and px[x, y] != CLEAR:
                    px[x, y] = CLEAR
        # outline the new end
    for y in range(S):
        row = [x for x in range(S) if px[x, y][3]]
        if not row:
            continue
        x = row[0] if side == "w" else row[-1]
        if y > 2:
            px[x, y] = DEEP
    # the lip's corner: outline the top edge's end
    x_end = 0 if side == "w" else S - 1
    px[x_end, 0] = DEEP
    px[x_end, 1] = DEEP


def drop_end(sides):
    img = drop_mid(0)
    for s in sides:
        end_shape(img, s)
    return img


def drop_corner(side):
    """The cliff's side turning the corner: its face in shadow, a narrow dithered sliver beside the run's
    rounded end, so the corner reads as the rock going round rather than a new shape."""
    img = new()
    px = img.load()
    for x in range(S):
        k = (S - 1 - x) if side == "w" else x        # distance from the run (0 = touching it)
        if k > 2:
            continue
        for y in range(4 + 2 * k, 18 - 3 * k):
            if (x + y) % 2 == 0 or k == 0:
                px[x, y] = DEEP
    return img


def lips():
    n, w, e, nw, ne = (new() for _ in range(5))
    for i in range(S):
        n.putpixel((i, 0), DEEP)
        n.putpixel((i, 1), EYE)                       # the back edge, lit
        w.putpixel((0, i), DEEP)
        w.putpixel((1, i), EYE)                       # the west edge, lit
        e.putpixel((S - 1, i), DEEP)
        e.putpixel((S - 2, i), FLESH)                 # the east edge, in shade
    nw.putpixel((0, 0), DEEP)
    for p in [(1, 0), (0, 1), (1, 1)]:
        nw.putpixel(p, EYE)
    ne.putpixel((S - 1, 0), DEEP)
    ne.putpixel((S - 2, 0), EYE)
    ne.putpixel((S - 1, 1), FLESH)
    ne.putpixel((S - 2, 1), EYE)
    return {"lip_n": n, "lip_w": w, "lip_e": e, "lip_nw": nw, "lip_ne": ne}


def main():
    pieces = {**floors(), "drop_mid_0": drop_mid(0), "drop_mid_1": drop_mid(1),
              "drop_w": drop_end("w"), "drop_e": drop_end("e"), "drop_we": drop_end("we"),
              "drop_corner_w": drop_corner("w"), "drop_corner_e": drop_corner("e"), **lips()}
    for name, img in pieces.items():
        img.save(OUT / f"{name}.png")
    print(len(pieces), "pieces")


if __name__ == "__main__":
    main()
