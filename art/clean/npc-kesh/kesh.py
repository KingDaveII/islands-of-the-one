"""ART: npc-kesh's seated rows and prop-kesh-rock's seat (M2 Task 4b; MAIN #92's contract), from the kesh job's
raw frames (art/raw/kesh/fishing/, PR #90). Whole-pixel edits only, no scaling.

Kesh sits on his rock: npc-kesh is drawn at prop-kesh-rock's world point, so its 96 x 128 cell (origin
(48, 118)) is the rock's 64 x 64 cell (origin (32, 54)) moved by (16, 64). This script draws him into that
cell, seated on the perch art/clean/holding/props.py cuts into the rock's tip (kesh_rock()), and writes:

- art/clean/npc-kesh/<anim>/frame-<n>.png for fish (raw 1-4), talk (raw 1-2) and toss (raw 3-6), each
  96 x 128 and already where the cell wants it, plus frame-<count>.png, the ground reference: one pixel on
  the soles row (117), so the recipe's { "ref": <count> } moves nothing;
- art/clean/npc-kesh/hand.json: the toss frames' `hand` points, in cell pixels.

Per frame:
1. the raw frame's own fishing line and the drops it drew on the ground go, and so does anything detached
   (the thrown thing in mid-air: the engine flies its own sprite from toss_2);
2. toss: the generator planted his feet in a squat from raw frame 2; below the hip his legs are fish 1's,
   still dangling, so only his upper body throws;
3. colours by part: his skin in the river-dark clay tone (unwritten-tar, its shade hollow-deep), the
   tunic sailcloth (unwritten-sail) with an ochre patch and a wet grey one, the trousers watcher-iron,
   the foot wraps hollow-below, the hair and beard wheel-eye shaded hollow-lavender, the outline hollow-
   deep; three amber freckles (spark-amber) on his face, as every Kindled has;
4. placed on the perch, then a fishing line drawn from the rod tip down into the Hollow: lit hollow-dusk
   near the rod, hollow-below below, dithered out, its foot swaying 1 px through the fish loop.

    python3 art/clean/npc-kesh/kesh.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "art/raw/kesh/fishing"
OUT = ROOT / "art/clean/npc-kesh"
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]


def rgb(k):
    h = T[k]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


CLEAR = (0, 0, 0, 0)
# the generator's five colours, which every drifted pixel is read as first
BASE = {"line": (0x1E, 0x1C, 0x36), "dark": (0x5B, 0x51, 0x49), "cloth": (0x83, 0x6F, 0x51),
        "hair_shade": (0xCC, 0xBE, 0xD7), "hair": (0xE3, 0xDC, 0xCF)}
ROWS = {"fish": [1, 2, 3, 4], "talk": [1, 2], "toss": [3, 4, 5, 6]}
CELL_W, CELL_H, SOLES = 96, 128, 117
ROCK_SHIFT = (16, 64)          # rock cell -> Kesh's cell
# raw 76 x 76 canvas -> Kesh's cell. Measured against the BUILT prop-kesh-rock (the prop grounds its lowest
# pixel on the soles row, which lifts the clean frame 7 rows): the perch's lit top lands on cell rows 83-84,
# beside his thighs (raw 49-51), his shins hang over the needle's face and his feet hang against its face below
# the step where it widens (cell row 94), never standing on it.
PLACE = (7, 34)
HIP = 49                       # raw rows from here down are legs
SWAY = {"fish": [0, 1, 1, 0], "talk": [0, 0], "toss": [0, 1, 1, 0]}
LINE = 30                      # the line's length in px, the last 8 dithered


def part(p):
    return min(BASE, key=lambda k: sum((a - b) ** 2 for a, b in zip(BASE[k], p[:3])))


def load(anim, n):
    im = Image.open(RAW / anim / "south-east" / f"frame-{n}.png").convert("RGBA")
    return {(x, y): part(im.getpixel((x, y))) for y in range(im.height) for x in range(im.width)
            if im.getpixel((x, y))[3]}


def groups(cells):
    seen, out = set(), []
    for p in sorted(cells):
        if p in seen:
            continue
        stack, g = [p], set()
        seen.add(p)
        while stack:
            x, y = stack.pop()
            g.add((x, y))
            for q in ((x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                if q in cells and q not in seen:
                    seen.add(q)
                    stack.append(q)
        out.append(g)
    return out


def rod_tip(px):
    """The rod's far end: the rightmost pixel right of the body, the highest of those."""
    right = max(x for x, _ in px)
    return min((p for p in px if p[0] >= right - 1), key=lambda p: (p[1], -p[0]))


def strip(px):
    """The generated line hangs straight down from the rod tip; it and the drops on the ground go, and so
    does any detached bit (the thrown thing in the air)."""
    tx, ty = rod_tip(px)
    for p in [p for p in px if p[0] >= tx - 2 and p[1] > ty + 2 and p[0] > 50]:
        del px[p]
    parts = groups(set(px))
    body = max(parts, key=len)
    for g in parts:
        if g is not body:
            for p in g:
                del px[p]


# His legs, drawn by hand (David's playtest, 2026-10-18: the generator's trousers read as one block and
# the wraps vanished into the rock): two short thighs on the perch, narrower than it so its lit top shows
# either side, the knees at its lip, two thin shins hanging down the needle's face with its light showing
# between them, the feet in sailcloth wraps pointing south-east.
# Lit on the left (watcher-stone), trousers watcher-iron, wraps unwritten-sail shaded sleeper-ochre, all
# outlined. Raw pixels from (LEGS_X, HIP); '.' leaves the pixel as it is.
LEGS_X = 30
LEGS = [
    ".....OSIIOSSIIO......",
    ".....OSIIOSIIIO......",
    ".....OSIIOSIIIO......",
    ".....OSIO.OSIIO......",
    ".....OSIO.OSIIO......",
    ".....OSIO..OSIO......",
    ".....OSIO..OSIO......",
    ".....OSIO..OSIO......",
    ".....OSIO..OSIO......",
    ".....OSIO..OSIO......",
    ".....OSIO..OSIO......",
    ".....OSIO..OSIO......",
    ".....OOOO..OOOO......",
    ".....OWWwO.OWWwO.....",
    ".....OWWWwO.OWWWwO...",
    "......OOOOO..OOOOO...",
]
LEG_INK = {"O": "hollow-deep", "S": "watcher-stone", "I": "watcher-iron", "W": "unwritten-sail",
           "w": "sleeper-ochre"}


def clear_legs(px, donor=None):
    """Everything the generator drew below the hip goes (in toss the squat as well), but the coat's hem at
    his left and, in toss, the throwing hand; toss takes its hem from the donor (fish 1)."""
    hem = lambda p: HIP <= p[1] < HIP + 3 and 26 <= p[0] < LEGS_X + 3
    for p in [p for p in px if p[1] >= HIP and not (p[0] < 26 and p[1] < HIP + 3) and not hem(p)]:
        del px[p]
    if donor is not None:
        for p in [p for p in px if hem(p)]:
            del px[p]
        for p, c in donor.items():
            if hem(p):
                px[p] = c


def draw_legs(px):
    for dy, row in enumerate(LEGS):
        for dx, ch in enumerate(row):
            if ch != ".":
                px[(LEGS_X + dx, HIP + dy)] = rgb(LEG_INK[ch])


def colour(px):
    head_top = min(y for _, y in px)
    out = {}
    for (x, y), c in px.items():
        if c == "line":
            col = rgb("hollow-deep")
        elif c == "dark":
            col = rgb("unwritten-tar")
        elif c == "cloth":
            col = rgb("unwritten-tar") if y <= head_top + 12 else rgb("unwritten-sail")   # face lights: skin
        elif c == "hair_shade":
            col = rgb("hollow-lavender")
        else:
            col = rgb("wheel-eye")
        out[(x, y)] = col
    return out


def freckles(px, raw):
    """Three amber freckles, widely spaced: one high on the brow, one on each cheek (skin pixels only)."""
    head_top = min(y for _, y in raw)
    skin = [p for p, c in raw.items() if c == "dark" and head_top + 3 <= p[1] <= head_top + 11]
    if not skin:
        return
    x0, x1 = min(x for x, _ in skin), max(x for x, _ in skin)
    y0 = min(y for _, y in skin)
    for want in ((x0 + 2, y0 + 7), (x1 - 1, y0 + 6), ((x0 + x1) // 2 + 1, y0 + 1)):
        p = min(skin, key=lambda q: (q[0] - want[0]) ** 2 + (q[1] - want[1]) ** 2)
        px[p] = rgb("spark-amber")


def patches(px):
    """An ochre patch low on his left and a wet grey one on his belly, on the tunic only."""
    cloth = [p for p, c in px.items() if c == rgb("unwritten-sail")]
    if not cloth:
        return
    lx = min(x for x, _ in cloth)
    by = max(y for _, y in cloth)
    for dx in range(3):
        for dy in range(2):
            p = (lx + 2 + dx, by - 5 + dy)
            if px.get(p) == rgb("unwritten-sail"):
                px[p] = rgb("sleeper-ochre")
    mx = (lx + max(x for x, _ in cloth)) // 2
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (2, 1), (1, 2)):
        p = (mx + 2 + dx, by - 8 + dy)
        if px.get(p) == rgb("unwritten-sail"):
            px[p] = rgb("watcher-stone")


def line(img, tip, sway):
    tx, ty = tip
    for k in range(1, LINE + 1):
        x = tx + (sway if k > LINE // 2 else 0)
        y = ty + k
        if k > LINE - 8 and k % 2:
            continue
        if img.getpixel((x, y))[3]:
            continue
        img.putpixel((x, y), rgb("hollow-dusk") if k <= 6 else rgb("hollow-below"))


# the toss frames' `hand` points in raw pixels (read off the raw frames): toss_0 the throwing hand low at
# his left, toss_1 swung out to the left, toss_2 the release, where the generator drew the thing already
# leaving (raw 5's (8-10, 38-39): the engine's flying sprite starts where the eye last saw it), toss_3 the
# hand back on the rod
HAND = {0: (18, 48), 1: (14, 46), 2: (9, 38), 3: (44, 42)}


def main():
    donor = load("fish", 1)
    strip(donor)
    points = {}
    for anim, raws in ROWS.items():
        d = OUT / anim
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("frame-*.png"):
            old.unlink()
        for i, n in enumerate(raws):
            raw = load(anim, n)
            strip(raw)
            clear_legs(raw, donor if anim == "toss" else None)
            if anim == "toss":
                hx, hy = HAND[i]
                points[f"toss_{i}"] = [hx + PLACE[0], hy + PLACE[1]]
            px = colour(raw)
            freckles(px, raw)
            patches(px)
            draw_legs(px)
            img = Image.new("RGBA", (CELL_W, CELL_H), CLEAR)
            for (x, y), c in px.items():
                img.putpixel((x + PLACE[0], y + PLACE[1]), c)
            tx, ty = rod_tip(raw)
            line(img, (tx + PLACE[0], ty + PLACE[1] + 1), SWAY[anim][i])
            img.save(d / f"frame-{i}.png")
        ref = Image.new("RGBA", (CELL_W, CELL_H), CLEAR)
        ref.putpixel((CELL_W // 2, SOLES), rgb("hollow-deep"))
        ref.save(d / f"frame-{len(raws)}.png")
    (OUT / "hand.json").write_text(json.dumps(points, indent=1) + "\n")
    print(points)


if __name__ == "__main__":
    main()
