"""ART: the touch-control glyphs (M2 Task 10; ART's answers in docs/tasks/m2-10.md), 16 x 16 UI px each, drawn
in colour, never tinted, in the item icons' style: a dream-night outline round every shape (the buttons'
fill is a 50 % checker dither over the world, so the glyph carries its own dark edge), flat shading in two or
three steps, light from the top left.

- light: the quick slash, a steel crescent sweeping up to the right with a short trailing stroke;
- heavy: the Hookblade's thrust, the blade up to the right with its hook at the tip, a bronze grip, three
  short marks of force off the point;
- dodge: the roll, a ring turning round with its arrowhead;
- haul: the hook on its chain, the chain's links coming down from the top left;
- gear: the settings cog, eight teeth round a dark hub;
- use: an open hand reaching up, the forefinger raised (the verb is under it on the button).

Steel in the Hookblade's ramp (husk-shell, watcher-stone, watcher-iron); the grip in watcher-bronze and
wheel-brass-dark; the hand and the cog in hollow-light and hollow-dusk, the UI's own pale ink. No husk-core and
no reserved signal colour. Writes packages/shared/assets/touch-glyphs-16px.png and touch-glyphs.json.

    python3 art/clean/touch-glyphs/glyphs.py
"""
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]
S = 16
OUT_PNG = ROOT / "packages/shared/assets/touch-glyphs-16px.png"
OUT_JSON = ROOT / "packages/shared/assets/touch-glyphs.json"
REVIEW = ROOT / "docs/screenshots/touch-glyphs"


def rgb(name):
    h = T[name]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


OUTLINE = rgb("dream-night")
STEEL = (rgb("husk-shell"), rgb("watcher-stone"), rgb("watcher-iron"))
PALE = (rgb("hollow-light"), rgb("hollow-dusk"), rgb("hollow-below"))
GRIP = (rgb("watcher-bronze"), rgb("wheel-brass-dark"))


class Glyph:
    def __init__(self):
        self.px = {}

    def put(self, x, y, c):
        if 1 <= x < S - 1 and 1 <= y < S - 1:   # a 1 px margin for the outline
            self.px[x, y] = c

    def shade(self, cells, ramp):
        """Fill `cells` with a two- or three-step ramp: lit where the shape's top or left edge is, shaded where
        its bottom or right edge is, the base between."""
        cells = set(cells)
        light, base, dark = (ramp + (ramp[-1],))[:3]
        for x, y in cells:
            if (x + 1, y) not in cells or (x, y + 1) not in cells:
                c = dark
            elif (x - 1, y) not in cells or (x, y - 1) not in cells:
                c = light
            else:
                c = base
            self.put(x, y, c)

    def image(self):
        im = Image.new("RGBA", (S, S))
        for p, c in self.px.items():
            im.putpixel(p, c)
        for y in range(S):
            for x in range(S):
                if (x, y) not in self.px and any((x + dx, y + dy) in self.px
                                                 for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    im.putpixel((x, y), OUTLINE)
        return im


def disc(cx, cy, r0, r1, a0=0, a1=360):
    """Cells of an annulus between radii r0 and r1, from angle a0 to a1 (degrees, 0 = right, clockwise)."""
    out = []
    for y in range(S):
        for x in range(S):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx)) % 360
            inside = a0 <= a <= a1 if a0 <= a1 else (a >= a0 or a <= a1)
            if r0 <= d <= r1 and inside:
                out.append((x, y))
    return out


KEY = {"L": STEEL[0], "m": STEEL[1], "d": STEEL[2], "P": PALE[0], "D": PALE[1], "B": PALE[2],
       "g": GRIP[0], "G": GRIP[1]}


def drawn(rows):
    """A glyph from a pixel map (the outline is added round it)."""
    g = Glyph()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in KEY:
                g.put(x, y, KEY[ch])
    return g


def light():
    # the quick slash: a swoosh bowing up to the left, thick in its middle, tapering at both ends
    return drawn([
        "................",
        "................",
        "...........LL...",
        "........LLLLmd..",
        "......LLLmmd....",
        ".....LLmmd......",
        "....LLmd........",
        "....Lmd.........",
        "...Lmd..........",
        "...Lm...........",
        "...Lm...........",
        "...Ld...........",
        "....d...........",
        "................",
        "................",
        "................",
    ])


def heavy():
    # the thrust: the Hookblade driven up to the right, its hook turned back at the tip, force off the point
    return drawn([
        "................",
        "............P.P.",
        "...........LL...",
        "..........LLmm.P",
        ".........LLm.m..",
        "........LLm..d..",
        ".......LLm......",
        "......LLm.......",
        ".....LLm........",
        "....LLm.........",
        "...gLm..........",
        "..gGG...........",
        ".gG.G...........",
        ".GG.............",
        "................",
        "................",
    ])


def dodge():
    # the roll: a ring turning clockwise, its arrowhead at the upper right
    g = Glyph()
    ring = disc(7.5, 8.5, 3.4, 5.6, 35, 285)
    g.shade(ring, PALE)
    head = [(10, 1), (11, 2), (12, 2), (10, 2), (11, 3), (12, 3), (13, 3), (10, 3), (10, 4), (11, 4), (12, 4),
            (10, 5), (11, 5), (10, 6)]
    for x, y in head:
        g.put(x, y, PALE[0] if x <= 10 else PALE[1])
    return g


def haul():
    # the hook on its chain: two links and a bar coming down from the top left, the hook curling at the end
    return drawn([
        "................",
        ".LLm............",
        ".L.d............",
        ".Lmd............",
        "...Lm...........",
        "....Ld..........",
        ".....LLm........",
        ".....L.d........",
        ".....Lmd........",
        ".......Lm.......",
        ".......Lm.......",
        ".......Lm...Lm..",
        ".......Lm....d..",
        "........LmmmLd..",
        ".........dddd...",
        "................",
    ])


def gear():
    g = Glyph()
    body = disc(8, 8, 2.0, 4.6)
    teeth = []
    for k in range(8):
        a = math.radians(k * 45)
        cx, cy = 8 + 5.6 * math.cos(a), 8 + 5.6 * math.sin(a)
        teeth += [(x, y) for x, y in disc(cx, cy, 0, 1.25)]
    g.shade(set(body) | set(teeth), PALE)
    return g


def use():
    g = Glyph()
    finger = [(x, y) for x in (7, 8) for y in range(2, 8)]
    palm = [(x, y) for x in range(5, 12) for y in range(8, 14)] + [(x, 14) for x in range(6, 11)]
    fingers = [(x, y) for x in (9, 10) for y in range(6, 8)] + [(11, 7)]
    thumb = [(4, 9), (4, 10), (3, 9), (5, 11)]
    g.shade(set(finger) | set(palm) | set(fingers) | set(thumb), PALE)
    for x, y in ((9, 8), (10, 8)):                   # the folded fingers' line
        g.put(x, y, PALE[1])
    return g


# The large cells (24 x 24) for the biggest buttons: on a phone LIGHT is 60-80 UI px and HEAVY 48-64 (MAIN, #134),
# where a 16 px glyph reads small. Drawn again at the size, never scaled.
L = 24


def drawn24(rows):
    im = Image.new("RGBA", (L, L))
    px = {}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in KEY and 1 <= x < L - 1 and 1 <= y < L - 1:
                px[x, y] = KEY[ch]
    for p, c in px.items():
        im.putpixel(p, c)
    for y in range(L):
        for x in range(L):
            if (x, y) not in px and any((x + dx, y + dy) in px for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                im.putpixel((x, y), OUTLINE)
    return im


LARGE = {
    "light": [
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "..................LLL...",
        "..............LLLLLLmd..",
        "...........LLLLLmmmd....",
        ".........LLLLmmmdd......",
        "........LLLmmdd.........",
        ".......LLmmdd...........",
        "......LLmmd.............",
        "......LLmd..............",
        ".....LLmd...............",
        ".....LLmd...............",
        ".....Lmd................",
        ".....Lmd................",
        ".....Lmd................",
        ".....Ld.................",
        "......d.................",
        "........................",
        "........................",
        "........................",
        "........................",
    ],
    "heavy": [
        "........................",
        "........................",
        "..................P..P..",
        "...................P....",
        ".................LL...P.",
        "................LLLm....",
        "...............LLLmmm...",
        "..............LLLm.mm...",
        ".............LLLm...d...",
        "............LLLm........",
        "...........LLLm.........",
        "..........LLLm..........",
        ".........LLLm...........",
        "........LLLm............",
        ".......LLLm.............",
        "......gLLm..............",
        ".....gGGm...............",
        "....gGGG................",
        "...gGG.G................",
        "..gGG...................",
        "..GG....................",
        "........................",
        "........................",
        "........................",
    ],
}


GLYPHS = {"light": light, "heavy": heavy, "dodge": dodge, "haul": haul, "gear": gear, "use": use}


def main():
    names = list(GLYPHS)
    sheet = Image.new("RGBA", (S * len(names), S))
    cells = []
    for i, name in enumerate(names):
        sheet.alpha_composite(GLYPHS[name]().image(), (i * S, 0))
        cells.append({"name": name, "x": i * S, "y": 0, "w": S, "h": S})
    sheet.save(OUT_PNG)
    OUT_JSON.write_text(json.dumps({
        "image": OUT_PNG.name,
        "cell": S,
        "meta": {"version": "2", "pixelScale": 1, "tinted": False},
        "cells": cells,
        "notes": "The touch-control glyphs (ART, M2 Task 10): one 16 px cell per button, drawn in colour with "
                 "its own dream-night outline, centred on its button at 1 UI px per px. Made by "
                 "art/clean/touch-glyphs/glyphs.py.",
    }, indent=2) + "\n")
    # the large sheet: touch-glyphs-24px.png + touch-glyphs-24.json, the same format, cells light and heavy
    big = Image.new("RGBA", (L * len(LARGE), L))
    big_cells = []
    for i, name in enumerate(LARGE):
        big.alpha_composite(drawn24(LARGE[name]), (i * L, 0))
        big_cells.append({"name": name, "x": i * L, "y": 0, "w": L, "h": L})
    big.save(OUT_PNG.with_name("touch-glyphs-24px.png"))
    OUT_JSON.with_name("touch-glyphs-24.json").write_text(json.dumps({
        "image": "touch-glyphs-24px.png",
        "cell": L,
        "meta": {"version": "2", "pixelScale": 1, "tinted": False},
        "cells": big_cells,
        "notes": "The large touch glyphs (ART, M2 Task 10, after #134): LIGHT and HEAVY again at 24 px for a "
                 "button of 56 UI px or more (phones), the 16 px cells below that (the tablet). Made by "
                 "art/clean/touch-glyphs/glyphs.py.",
    }, indent=2) + "\n")
    # review: each glyph on a button face, the checker dither over the holding's earth, at 6x
    REVIEW.mkdir(parents=True, exist_ok=True)
    face, earth = rgb("hollow-deep"), rgb("sleeper-soil")
    B = 28
    review = Image.new("RGBA", (len(names) * (B + 4) + 4, B + 8), earth)
    for i, name in enumerate(names):
        ox, oy = 4 + i * (B + 4), 4
        for y in range(B):
            for x in range(B):
                if (x + y) % 2 == 0:
                    review.putpixel((ox + x, oy + y), face)
        review.alpha_composite(GLYPHS[name]().image(), (ox + (B - S) // 2, oy + (B - S) // 2))
    review.resize((review.width * 6, review.height * 6), Image.NEAREST).save(REVIEW / "buttons.png")
    # the large ones on a 64 UI px disc face (HEAVY on the small phone, LIGHT on the iPhone is 60)
    D = 64
    rv = Image.new("RGBA", (2 * (D + 4) + 4, D + 8), earth)
    for i, name in enumerate(LARGE):
        ox, oy = 4 + i * (D + 4), 4
        for y in range(D):
            for x in range(D):
                if (x - D / 2 + 0.5) ** 2 + (y - D / 2 + 0.5) ** 2 <= (D / 2) ** 2 and (x + y) % 2 == 0:
                    rv.putpixel((ox + x, oy + y), face)
        rv.alpha_composite(drawn24(LARGE[name]), (ox + (D - L) // 2, oy + (D - L) // 2))
    rv.resize((rv.width * 4, rv.height * 4), Image.NEAREST).save(REVIEW / "buttons-24.png")


if __name__ == "__main__":
    main()
