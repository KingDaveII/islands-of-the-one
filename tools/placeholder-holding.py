#!/usr/bin/env python3
"""
Placeholder source art for the holding (M2 Task 3b), written into art/clean/
for the art pipeline to build like any other sheet: flat, clearly placeholder
shapes in whitelist colours, each piece tagged with its name's initials. ART
replaces the pixels through the recipes (art/sheets/tiles-holding.json,
prop-writ-post.json, prop-twisted-tree.json, prop-stone-outcrop.json) without
an engine change; nothing here is final art.

- tiles-holding: the same piece names as tiles-cave (packages/shared/src/tiles.ts).
  The ground is a floor, the island edge the face and top. The holding has no
  doors, but a finished tile sheet carries every piece, so the door frames are
  plain blocks.
- prop-writ-post, prop-twisted-tree, prop-stone-outcrop: `idle`, one frame each,
  on the 64x64 prop canvas with the base on row 53, outlined in hollow-deep.

    python3 tools/placeholder-holding.py
    pnpm art:build tiles-holding prop-writ-post prop-twisted-tree prop-stone-outcrop
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
T = {k: v.lower() for k, v in json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"].items()}
TILE = 32
SIDES = ["n", "w", "e", "nw", "ne", "we", "nwe"]
STATIC = (
    [f"floor_{i}" for i in range(4)]
    + ["shade_n", "shade_w", "shade_e", "shade_nw", "shade_ne"]
    + [f"face_{s}" for s in SIDES]
    + ["face_mid_0", "face_mid_1"]
    + [f"top_{s}" for s in SIDES]
    + ["top_mid_0", "top_mid_1"]
    + ["corner_nw", "corner_ne"]
)
DOORS = [("door_n", 64, 32), ("door_w", 32, 64), ("door_e", 32, 64)]
STATES = [("closed", 1), ("opening", 6), ("open", 1)]

# A 3x5 font for the tags; '#' is ink.
FONT = {
    "A": ["###", "#.#", "###", "#.#", "#.#"], "C": ["###", "#..", "#..", "#..", "###"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."], "E": ["###", "#..", "##.", "#..", "###"],
    "F": ["###", "#..", "##.", "#..", "#.."], "H": ["#.#", "#.#", "###", "#.#", "#.#"],
    "L": ["#..", "#..", "#..", "#..", "###"], "M": ["#.#", "###", "###", "#.#", "#.#"],
    "N": ["##.", "#.#", "#.#", "#.#", "#.#"], "O": ["###", "#.#", "#.#", "#.#", "###"],
    "P": ["###", "#.#", "###", "#..", "#.."], "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "S": ["###", "#..", "###", "..#", "###"], "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "W": ["#.#", "#.#", "###", "###", "#.#"], "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", ".##", "..#", "###"], "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
}

GROUND, FLECK = T["hollow-lavender"], T["hollow-light"]
SHADE = T["hollow-dusk"]
FACE, JOINT, LIP = T["hollow-below"], T["hollow-deep"], T["hollow-dusk"]
TOP, PIT = T["hollow-deep"], T["hollow-below"]
INK, PAPER = T["hollow-deep"], T["choir-paper"]
OUTLINE = T["hollow-deep"]


def text(px, x0, y0, s, colour):
    for i, ch in enumerate(s):
        for y, row in enumerate(FONT[ch]):
            for x, c in enumerate(row):
                if c == "#":
                    px[(x0 + i * 4 + x, y0 + y)] = colour


def fill(px, x0, y0, w, h, colour):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            px[(x, y)] = colour


def dither(px, x0, y0, w, h, colour, phase=0):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if (x + y + phase) % 2 == 0:
                px[(x, y)] = colour


def initials(name):
    word, *rest = name.split("_")
    return word[:2].upper() + "".join("M" if p == "mid" else p.upper() for p in rest)


def floor(px, variant):
    fill(px, 0, 0, TILE, TILE, GROUND)
    # A few flecks, in different places per variant, so the ground is not one flat colour.
    for i in range(variant + 1):
        x = (7 * i + 3 * variant + 5) % 28 + 2
        y = (11 * i + 5 * variant + 3) % 20 + 4
        px[(x, y)] = FLECK
        px[(x + 1, y)] = FLECK


def draw_static(name):
    px = {}
    label = initials(name)
    if name.startswith("floor"):
        floor(px, int(name[-1]))
        text(px, 10, 24, label, INK)
    elif name == "shade_n":
        dither(px, 0, 0, TILE, 6, SHADE)
    elif name == "shade_w":
        dither(px, 0, 0, 6, TILE, SHADE)
    elif name == "shade_e":
        dither(px, TILE - 6, 0, 6, TILE, SHADE)
    elif name == "shade_nw":
        dither(px, 0, 0, 6, 6, SHADE)
    elif name == "shade_ne":
        dither(px, TILE - 6, 0, 6, 6, SHADE)
    elif name.startswith("face"):
        # The edge's face: the cap on top, the cliff face below, a dark joint every 8 rows.
        fill(px, 0, 0, TILE, 8, LIP)
        fill(px, 0, 8, TILE, TILE - 8, FACE)
        for y in (15, 23, 31):
            fill(px, 0, y, TILE, 1, JOINT)
        open_sides = name.split("_")[1]
        if "n" in open_sides:
            fill(px, 0, 0, TILE, 1, JOINT)
        if "w" in open_sides:
            fill(px, 0, 0, 1, TILE, JOINT)
        if "e" in open_sides:
            fill(px, TILE - 1, 0, 1, TILE, JOINT)
        text(px, 2, 10, label, PAPER)
    elif name.startswith("top"):
        # The edge's top: the dark of the Hollow, with pits, and a lit rim on each open side.
        fill(px, 0, 0, TILE, TILE, TOP)
        for i in range(6):
            x = (9 * i + 4) % 26 + 3
            y = (13 * i + 6) % 24 + 4
            fill(px, x, y, 2, 1, PIT)
        if name == "top_mid_1":
            fill(px, 12, 14, 8, 4, PIT)
        open_sides = name.split("_")[1]
        if "n" in open_sides:
            fill(px, 0, 0, TILE, 2, LIP)
        if "w" in open_sides:
            fill(px, 0, 0, 2, TILE, LIP)
        if "e" in open_sides:
            fill(px, TILE - 2, 0, 2, TILE, LIP)
        text(px, 2, 20, label, PAPER)
    elif name.startswith("corner"):
        x0 = 0 if name == "corner_nw" else TILE - 8
        fill(px, x0, 0, 8, 8, LIP)
    return px


def draw_door(door, w, h, state, n):
    # Plain placeholders: the holding has no doors; a finished sheet carries every piece.
    px = {}
    fill(px, 0, 0, w, h, FACE)
    fill(px, 0, 0, w, 1, JOINT)
    fill(px, 0, h - 1, w, 1, JOINT)
    fill(px, 0, 0, 1, h, JOINT)
    fill(px, w - 1, 0, 1, h, JOINT)
    if state == "opening":
        gap = 2 + 4 * n
        fill(px, (w - gap) // 2, 1, gap, h - 2, GROUND) if w > h else fill(px, 1, (h - gap) // 2, w - 2, gap, GROUND)
    elif state == "open":
        fill(px, 1, 1, w - 2, h - 2, GROUND)
    tag = {"closed": "C", "opening": f"O{n}", "open": "OP"}[state]
    label = "D" + door[-1].upper() + tag
    text(px, (w - (4 * len(label) - 1)) // 2, (h - 5) // 2, label, PAPER if state != "open" else INK)
    return px


def outlined(px):
    """A 1 px hollow-deep outline round everything drawn (the pipeline keeps it as the outline)."""
    out = dict(px)
    for (x, y) in list(px):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in px:
                out[(x + dx, y + dy)] = OUTLINE
    return out


def writ_post():
    # A post, 10 wide, from row 18 to the base at 53, with a tablet on top.
    px = {}
    fill(px, 27, 26, 10, 28, T["unwritten-tar"])
    fill(px, 27, 26, 2, 28, T["unwritten-sail"])
    for y in (33, 43):
        fill(px, 27, y, 10, 2, T["wheel-brass-dark"])
    fill(px, 23, 14, 18, 14, T["hollow-light"])
    fill(px, 23, 14, 18, 2, T["hollow-dusk"])
    fill(px, 23, 14, 2, 14, T["hollow-dusk"])
    text(px, 27, 19, "WP", INK)
    return outlined(px)


def twisted_tree():
    # A canopy over a leaning trunk, 44 wide, the roots at the base.
    px = {}
    fill(px, 28, 30, 8, 24, T["unwritten-tar"])
    fill(px, 28, 30, 2, 24, T["unwritten-sail"])
    fill(px, 22, 50, 20, 4, T["unwritten-tar"])
    fill(px, 14, 12, 36, 22, T["wheel-patina"])
    fill(px, 10, 18, 44, 12, T["wheel-patina"])
    fill(px, 14, 12, 36, 2, T["wheel-eye"])
    fill(px, 10, 18, 4, 12, T["watcher-rain"])
    fill(px, 14, 30, 36, 4, T["watcher-rain"])
    text(px, 27, 19, "TT", PAPER)
    return outlined(px)


def stone_outcrop():
    # A low mass of stone, 48 wide, 26 tall.
    px = {}
    fill(px, 8, 36, 48, 18, T["watcher-stone"])
    fill(px, 14, 28, 36, 8, T["watcher-stone"])
    fill(px, 22, 24, 20, 4, T["watcher-stone"])
    fill(px, 8, 36, 48, 2, T["husk-shell"])
    fill(px, 14, 28, 36, 2, T["husk-shell"])
    fill(px, 44, 38, 12, 16, T["watcher-iron"])
    fill(px, 8, 50, 48, 4, T["watcher-iron"])
    text(px, 27, 41, "SO", PAPER)
    return outlined(px)


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) + (255,)


def save(path, w, h, px):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for (x, y), colour in px.items():
        img.putpixel((x, y), rgb(colour))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def main():
    tiles = ROOT / "art/clean/tiles-holding"
    for name in STATIC:
        save(tiles / f"{name}.png", TILE, TILE, draw_static(name))
    for door, w, h in DOORS:
        for state, count in STATES:
            for n in range(count):
                save(tiles / f"{door}_{state}" / f"frame-{n}.png", w, h, draw_door(door, w, h, state, n))
    for name, draw in (("prop-writ-post", writ_post), ("prop-twisted-tree", twisted_tree), ("prop-stone-outcrop", stone_outcrop)):
        save(ROOT / "art/clean" / name / "idle" / "frame-0.png", 64, 64, draw())


if __name__ == "__main__":
    main()
