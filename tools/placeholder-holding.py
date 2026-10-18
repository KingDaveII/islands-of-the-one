#!/usr/bin/env python3
"""
Placeholder source art for the holding (M2 Task 3b, 3c), written into art/clean/
for the art pipeline to build like any other sheet: flat, clearly placeholder
shapes in whitelist colours. The drops and lips and the props carry their
name's initials, so a wrong pick shows in a shot; the floors carry none, only
their flecks, so the ground reads as ground while the four variants still
show. ART replaces the pixels through the recipes (art/sheets/tiles-holding.json,
prop-writ-post.json, prop-twisted-tree.json, prop-stone-outcrop.json,
prop-holding-store.json, prop-kesh-rock.json) in the holding art job without
an engine change; nothing here is final art.

- tiles-holding: a shore set without doors (packages/shared/src/tiles.ts,
  docs/design/sprites.md "Tiles"): the floors, the drops (the cliff hanging
  below the island: a lit lip, a short rock face, then a dither into
  hollow-deep that ends in transparent rows) and the lips (transparent
  overlays: an outline and a lit rim on a ground cell beside the void).
- prop-writ-post, prop-stone-outcrop, prop-holding-store, prop-kesh-rock:
  `idle`, one frame each, on the 64x64 prop canvas with the base on row 53,
  outlined in hollow-deep.
- prop-twisted-tree: `idle`, one frame, on the tall prop cell (64x96, the
  origin at (32, 86)): drawn 64x96 with the trunk's base on row 85, the
  canopy overhanging upwards.

    python3 tools/placeholder-holding.py
    pnpm art:build tiles-holding prop-writ-post prop-twisted-tree prop-stone-outcrop prop-holding-store prop-kesh-rock
"""
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
T = {k: v.lower() for k, v in json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"].items()}
TILE = 32
FLOORS = [f"floor_{i}" for i in range(4)]
DROPS = ["drop_mid_0", "drop_mid_1", "drop_w", "drop_e", "drop_we", "drop_corner_w", "drop_corner_e"]
LIPS = ["lip_n", "lip_w", "lip_e", "lip_nw", "lip_ne"]

# A 3x5 font for the tags; '#' is ink.
FONT = {
    "A": ["###", "#.#", "###", "#.#", "#.#"], "C": ["###", "#..", "#..", "#..", "###"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."], "E": ["###", "#..", "##.", "#..", "###"],
    "F": ["###", "#..", "##.", "#..", "#.."], "H": ["#.#", "#.#", "###", "#.#", "#.#"],
    "I": ["###", ".#.", ".#.", ".#.", "###"], "K": ["#.#", "#.#", "##.", "#.#", "#.#"],
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
RIM, OUTLINE = T["hollow-light"], T["hollow-deep"]
FACE, JOINT, DEEP = T["hollow-below"], T["hollow-dusk"], T["hollow-deep"]
INK, PAPER = T["hollow-deep"], T["choir-paper"]


def text(px, x0, y0, s, colour, vertical=False):
    for i, ch in enumerate(s):
        gx, gy = (x0, y0 + i * 6) if vertical else (x0 + i * 4, y0)
        for y, row in enumerate(FONT[ch]):
            for x, c in enumerate(row):
                if c == "#":
                    px[(gx + x, gy + y)] = colour


def fill(px, x0, y0, w, h, colour):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            px[(x, y)] = colour


def dither(px, x0, y0, w, h, colour, every=2, phase=0):
    """Every `every`-th pixel on the checkerboard, so a dither thins as `every` grows."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if (x + y + phase) % every == 0:
                px[(x, y)] = colour


def initials(name):
    """DRM0 for drop_mid_0, DRCW for drop_corner_w, LINW for lip_nw."""
    word, *rest = name.split("_")
    return word[:2].upper() + "".join({"mid": "M", "corner": "C"}.get(p, p.upper()) for p in rest)


def floor(px, variant):
    fill(px, 0, 0, TILE, TILE, GROUND)
    # A few flecks, in different places per variant, so the ground is not one flat colour.
    for i in range(variant + 1):
        x = (7 * i + 3 * variant + 5) % 28 + 2
        y = (11 * i + 5 * variant + 3) % 20 + 4
        px[(x, y)] = FLECK
        px[(x + 1, y)] = FLECK


def cliff(px, x0, w, variant=0):
    """Columns x0..x0+w of a drop: the lit lip (rows 0-2), a short rock face with joints, then the dither into hollow-deep ending in transparent rows."""
    fill(px, x0, 0, w, 1, RIM)
    fill(px, x0, 1, w, 2, JOINT)
    fill(px, x0, 3, w, 12, FACE)
    for y in (7, 11):
        fill(px, x0, y, w, 1, JOINT)
    if variant:
        fill(px, x0 + w // 2, 8, 1, 6, JOINT)
    fill(px, x0, 15, w, 4, DEEP)
    dither(px, x0, 15, w, 4, FACE, 2)
    fill(px, x0, 19, w, 5, DEEP)
    dither(px, x0, 24, w, 4, DEEP, 2)
    dither(px, x0, 28, w, 4, DEEP, 4)


def draw_drop(name):
    px = {}
    if name == "drop_corner_w":
        # The cliff turning round the corner west of the run: a wedge from the NE corner, tapering down and left.
        for y in range(0, 24):
            x0 = max(0, 16 - y)
            cliff_row(px, x0, TILE - x0, y)
        dither(px, 8, 24, 24, 4, DEEP, 2)
        dither(px, 12, 28, 20, 4, DEEP, 4)
    elif name == "drop_corner_e":
        for y in range(0, 24):
            w = min(TILE, 16 + y)
            cliff_row(px, 0, w, y)
        dither(px, 0, 24, 24, 4, DEEP, 2)
        dither(px, 0, 28, 20, 4, DEEP, 4)
    else:
        cliff(px, 0, TILE, 1 if name == "drop_mid_1" else 0)
        sides = name.split("_")[1]
        if "w" in sides:
            fill(px, 0, 0, 1, 24, OUTLINE)
        if "e" in sides:
            fill(px, TILE - 1, 0, 1, 24, OUTLINE)
    text(px, 2, 3 if not name.startswith("drop_corner") else 2, initials(name), PAPER)
    return px


def cliff_row(px, x0, w, y):
    """One row of a cliff (see `cliff`) over columns x0..x0+w."""
    if y == 0:
        fill(px, x0, y, w, 1, RIM)
    elif y <= 2:
        fill(px, x0, y, w, 1, JOINT)
    elif y < 15:
        fill(px, x0, y, w, 1, JOINT if y in (7, 11) else FACE)
    elif y < 19:
        fill(px, x0, y, w, 1, DEEP)
        dither(px, x0, y, w, 1, FACE, 2)
    else:
        fill(px, x0, y, w, 1, DEEP)
    if x0 > 0:
        px[(x0, y)] = OUTLINE


def draw_lip(name):
    # An outline and a lit rim where the ground meets the void, over the floor; transparent elsewhere.
    px = {}
    label = initials(name)
    if name == "lip_n":
        fill(px, 0, 0, TILE, 1, OUTLINE)
        fill(px, 0, 1, TILE, 2, RIM)
        text(px, 2, 4, label, INK)
    elif name == "lip_w":
        fill(px, 0, 0, 1, TILE, OUTLINE)
        fill(px, 1, 0, 2, TILE, RIM)
        text(px, 4, 2, label, INK, vertical=True)
    elif name == "lip_e":
        fill(px, TILE - 1, 0, 1, TILE, OUTLINE)
        fill(px, TILE - 3, 0, 2, TILE, RIM)
        text(px, TILE - 7, 2, label, INK, vertical=True)
    elif name == "lip_nw":
        fill(px, 0, 0, 4, 1, OUTLINE)
        fill(px, 0, 0, 1, 4, OUTLINE)
        fill(px, 1, 1, 3, 2, RIM)
        fill(px, 1, 1, 2, 3, RIM)
        text(px, 5, 5, label, INK)
    elif name == "lip_ne":
        fill(px, TILE - 4, 0, 4, 1, OUTLINE)
        fill(px, TILE - 1, 0, 1, 4, OUTLINE)
        fill(px, TILE - 4, 1, 3, 2, RIM)
        fill(px, TILE - 3, 1, 2, 3, RIM)
        text(px, TILE - 20, 5, label, INK)
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
    # On the tall cell: a leaning trunk from row 46 to the base at row 85, roots either side, and a canopy
    # from row 6 to 52 overhanging the trunk, so the Kindled standing behind it is hidden by the crown.
    px = {}
    fill(px, 28, 46, 8, 40, T["unwritten-tar"])
    fill(px, 28, 46, 2, 40, T["unwritten-sail"])
    fill(px, 24, 60, 4, 6, T["unwritten-tar"])
    fill(px, 36, 68, 4, 6, T["unwritten-tar"])
    fill(px, 20, 82, 24, 4, T["unwritten-tar"])
    fill(px, 14, 18, 36, 34, T["wheel-patina"])
    fill(px, 8, 26, 48, 16, T["wheel-patina"])
    fill(px, 20, 6, 24, 14, T["wheel-patina"])
    fill(px, 20, 6, 24, 2, T["wheel-eye"])
    fill(px, 14, 18, 36, 2, T["wheel-eye"])
    fill(px, 8, 26, 4, 16, T["watcher-rain"])
    fill(px, 14, 48, 36, 4, T["watcher-rain"])
    text(px, 27, 30, "TT", PAPER)
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


def holding_store():
    # A squat chest of planks, 40 wide, 24 tall, a lid and a brass band.
    px = {}
    fill(px, 12, 30, 40, 24, T["unwritten-tar"])
    fill(px, 12, 30, 40, 6, T["unwritten-sail"])
    fill(px, 12, 36, 40, 2, T["wheel-brass-dark"])
    fill(px, 12, 50, 40, 4, T["wheel-brass-dark"])
    fill(px, 30, 38, 4, 6, T["wheel-brass"])
    text(px, 27, 42, "HS", PAPER)
    return outlined(px)


def kesh_rock():
    # A needle of rock, 20 wide at the base and 6 at the tip, from row 4 to the base at 53.
    px = {}
    for y in range(4, 54):
        w = 6 + (y - 4) * 14 // 49
        fill(px, 32 - w // 2, y, w, 1, T["watcher-stone"])
    for y in range(20, 54):
        w = 2 + (y - 20) * 6 // 33
        fill(px, 32 + 1, y, w, 1, T["watcher-iron"])
    fill(px, 22, 50, 20, 4, T["watcher-iron"])
    text(px, 27, 38, "KR", PAPER)
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
    # The set changed from the cave's pieces to the shore's (3c): start from an empty folder.
    if tiles.exists():
        shutil.rmtree(tiles)
    for name in FLOORS:
        px = {}
        floor(px, int(name[-1]))
        save(tiles / f"{name}.png", TILE, TILE, px)
    for name in DROPS:
        save(tiles / f"{name}.png", TILE, TILE, draw_drop(name))
    for name in LIPS:
        save(tiles / f"{name}.png", TILE, TILE, draw_lip(name))
    for name, draw, h in (
        ("prop-writ-post", writ_post, 64),
        ("prop-twisted-tree", twisted_tree, 96),
        ("prop-stone-outcrop", stone_outcrop, 64),
        ("prop-holding-store", holding_store, 64),
        ("prop-kesh-rock", kesh_rock, 64),
    ):
        save(ROOT / "art/clean" / name / "idle" / "frame-0.png", 64, h, draw())


if __name__ == "__main__":
    main()
