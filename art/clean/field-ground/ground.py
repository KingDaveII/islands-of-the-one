"""ART: the field's ground inside a named plot (M2 Task 5's "Questions for ART": the field ground, sown and
unsown, and the faded plot). Hand-made in code, no generations; deterministic (a fixed seed).

Three 64 x 64 patterns, each seamless (it tiles from the plot's corner, as the placeholder dither does), on
one cell sheet in the engine sheets' format (packages/shared/assets/field-ground-64px.png and
field-ground.json, meta version 2, 1 world px per px, untinted):

- `unsown`: "dark and crumbly" (Task 5): turned earth in hollow-below, broken into clods of sleeper-ochre lit
  sleeper-flesh on their top-left, the cracks between them hollow-deep. Dark against the holding's pale
  earth (sleeper-soil), and not the seal ring's sleeper-ochre, so the ring still reads round it.
- `sown`: the same earth drawn up into furrows running across (one every 8 px: a lit ridge, its body, a
  dark trench), with grey seed sprouting along the ridges: a stem of wheel-brass and a sleeper-soil tip, the
  pale grain to come.
- `faded`: the sown furrows gone cold (Writ line dark too long, the plot can't be worked): the warm clay
  turned watcher-stone and hollow-dusk on hollow-below, no sprouts. It stands for a faded plot sown or not.

The patterns don't fill the whole plot: `inset` in the JSON leaves a headland of plain holding ground inside
the plot's rect (26 px at the top, 10 at the sides, 14 at the bottom), where the seal ring, its letters and
the divider sit, dark ink on pale earth.

Light from the top left, no dither, no alpha, only whitelist colours.

    python3 art/clean/field-ground/ground.py
"""
import json
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT_PNG = ROOT / "packages/shared/assets/field-ground-64px.png"
OUT_JSON = ROOT / "packages/shared/assets/field-ground.json"
N = 64
# The headland: plain holding ground left round the tilled earth inside the plot's rect, so the seal ring
# (inset 4, 2 px), the letters along its top (8 px down, 16 px tall) and the divider at its bottom join stay
# dark ink on pale earth (readability.md §4), as a real field keeps a headland for the plough to turn on.
INSET = {"top": 26, "right": 10, "bottom": 14, "left": 10}


def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


T = {k: hx(v) for k, v in {
    "deep": "#2a2540", "below": "#5b5478", "dusk": "#a99fc4", "ochre": "#9c5b4a", "flesh": "#c98f78",
    "soil": "#e3c29e", "brass": "#c79a3e", "brass-dark": "#8a6420", "stone": "#7d8794", "iron": "#4a4e57",
}.items()}


def wrap(x, y):
    return x % N, y % N


def clods(rng, px, base, lit, crack, count, rows=None):
    """Scatter clods: small blobs of `base`, each lit on its top-left pixels and cracked dark below-right.
    `rows`, if given, limits their centres to those rows (the furrows' ridges)."""
    for _ in range(count):
        cx = rng.randrange(N)
        cy = rng.choice(rows) if rows else rng.randrange(N)
        w, h = rng.choice([(3, 2), (2, 2), (4, 2), (3, 3), (2, 1), (5, 2)])
        cells = [(cx + i, cy + j) for i in range(w) for j in range(h)
                 if not ((i in (0, w - 1)) and (j in (0, h - 1)) and w > 2 and h > 2)]
        for x, y in cells:
            px[wrap(x, y)] = base
        # the light on the top-left edge, the crack under the bottom-right edge
        for x, y in cells:
            if (x - 1, y) not in cells or (x, y - 1) not in cells:
                if (x + y) <= (cx + cy + 1):
                    px[wrap(x, y)] = lit
        for x, y in cells:
            if (x, y + 1) not in cells:
                px[wrap(x + 1, y + 1)] = crack


def unsown(rng):
    """Turned earth: a bed of sleeper-ochre heaped into clods, each lit on its top-left (sleeper-flesh) and
    casting a shadow under its bottom edge (hollow-below), with a few deep pockets (hollow-deep)."""
    px = {(x, y): T["ochre"] for x in range(N) for y in range(N)}
    for _ in range(95):
        cx, cy = rng.randrange(N), rng.randrange(N)
        w = rng.choice([2, 3, 3, 4])
        for i in range(w):
            px[wrap(cx + i, cy + 1)] = T["below"]          # the shadow under the clod
        for i in range(w - 1):
            px[wrap(cx + i, cy)] = T["flesh"] if i < 2 else T["ochre"]  # its lit top
        px[wrap(cx + w - 1, cy)] = T["ochre"]
    for _ in range(12):
        x, y = rng.randrange(N), rng.randrange(N)
        px[wrap(x, y)] = T["deep"]
        px[wrap(x + 1, y)] = T["below"]
    return px


RIDGE = 16  # a furrow every 16 px: row 0 the lit crest, 1-8 the ridge, 9-10 its shadow, 11-13 the trench, 14-15 rising


def furrows(rng, warm=True):
    lit, body, shade, trench = ((T["flesh"], T["ochre"], T["below"], T["deep"]) if warm
                                else (T["dusk"], T["stone"], T["below"], T["deep"]))
    px = {}
    for y in range(N):
        r = y % RIDGE
        for x in range(N):
            px[x, y] = (lit if r == 0 else body if r <= 8 else shade if r <= 10 else trench if r <= 13 else shade)
    # break the ridges' edges so the rows aren't ruled: notches in the top, crumbs in the trench
    for _ in range(40):
        x, y0 = rng.randrange(N), rng.randrange(N // RIDGE) * RIDGE
        for k in range(rng.choice([1, 2, 3])):
            px[wrap(x + k, y0)] = body
    for _ in range(30):
        x, y0 = rng.randrange(N), rng.randrange(N // RIDGE) * RIDGE
        px[wrap(x, y0 + rng.choice([11, 12, 13]))] = shade
    # clods on the ridges, lit top-left
    for _ in range(36):
        x, y0 = rng.randrange(N), rng.randrange(N // RIDGE) * RIDGE
        y = y0 + rng.randrange(2, 8)
        px[wrap(x, y)] = lit
        px[wrap(x + 1, y + 1)] = shade
    return px


def sown(rng):
    px = furrows(rng)
    # sprouts along each ridge: a stem rising out of the ridge top, its tip pale
    for row in range(N // RIDGE):
        y0 = row * RIDGE
        x = rng.randrange(4)
        while x < N:
            tall = rng.choice([2, 3, 3])
            px[wrap(x, y0 + 1)] = T["brass-dark"]
            for k in range(tall):
                px[wrap(x, y0 - k)] = T["brass"]
            px[wrap(x, y0 - tall)] = T["soil"]
            x += rng.choice([6, 7, 8, 9, 10])
    return px


def faded(rng):
    return furrows(rng, warm=False)


def image(px):
    im = Image.new("RGBA", (N, N))
    for (x, y), c in px.items():
        im.putpixel((x, y), c)
    return im


def main():
    names = ["unsown", "sown", "faded"]
    makers = {"unsown": unsown, "sown": sown, "faded": faded}
    sheet = Image.new("RGBA", (N * len(names), N))
    cells = []
    for i, name in enumerate(names):
        sheet.paste(image(makers[name](random.Random(f"field-ground-{name}"))), (i * N, 0))
        cells.append({"name": name, "x": i * N, "y": 0, "w": N, "h": N})
    sheet.save(OUT_PNG)
    OUT_JSON.write_text(json.dumps({
        "image": OUT_PNG.name,
        "cell": N,
        "meta": {"version": "2", "pixelScale": 1, "tinted": False},
        "cells": cells,
        "inset": INSET,
        "notes": "The field's ground inside a named plot (ART, M2 Task 5): each cell a seamless 64 px pattern, "
                 "tiled over the plot's rect less `inset` (world px; the headland of plain holding ground that "
                 "keeps the seal ring, its letters and the divider on pale earth), from that inner rect's corner, "
                 "under the props and the Kindled. unsown: a named field before SOW; sown: once sown; faded: a "
                 "faded plot, sown or not. Made by art/clean/field-ground/ground.py.",
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
