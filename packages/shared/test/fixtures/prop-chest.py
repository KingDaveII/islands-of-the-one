#!/usr/bin/env python3
"""
The chest test fixture (docs/design/sprites.md §4 "Props", G1.5f): a
`prop-chest` sheet in the shape ART's will have, every row of its table
(`PROP_TABLES.chest`) on 64x64 cells with the origin at (32, 54): `closed` in
two frames (the clasp glint), `opening` in four (the lid rising) and `open`
in one (the lid up, the inside dark), packed four cells a row the way the art
pipeline packs them. A bronze-and-wood coffer in whitelist colours, its soles
on canvas row 53, with the frame's tag (C0, C1, O0..O3, OP) in choir-paper on
the body so a wrong frame shows in a screenshot. Never shipped; the sheet
test, the pipeline's tests and the client's chest tests read it.

    python3 packages/shared/test/fixtures/prop-chest.py
"""
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
T = {k: v.lower() for k, v in json.loads((HERE / "../../data/palette.json").read_text())["tokens"].items()}

CELL = 64
ORIGIN = (32, 54)
COLS = 4
ANIMS = [("closed", 2, 2, -1, False), ("opening", 4, 12, 0, True), ("open", 1, 0, 0, True)]

OUTLINE = T["hollow-deep"]
WOOD, WOOD_DARK = T["watcher-bronze"], T["wheel-brass-dark"]
BAND, CLASP, GLINT = T["wheel-brass"], T["choir-gold"], T["choir-paper"]
INSIDE, PAPER = T["hollow-deep"], T["choir-paper"]

# A 3x5 font for the tags; '#' is ink.
FONT = {
    "C": ["###", "#..", "#..", "#..", "###"],
    "O": ["###", "#.#", "#.#", "#.#", "###"],
    "P": ["###", "#.#", "###", "#..", "#.."],
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", ".##", "..#", "###"],
}


def fill(px, x0, y0, w, h, colour):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            px[(x, y)] = colour


def text(px, x0, y0, s, colour):
    for i, ch in enumerate(s):
        for y, row in enumerate(FONT[ch]):
            for x, c in enumerate(row):
                if c == "#":
                    px[(x0 + i * 4 + x, y0 + y)] = colour


def chest(state, n):
    """Canvas pixels {(x, y): hex} of one frame: the box with its bands, the lid at its height, the clasp."""
    px = {}
    # The box: wood with two brass bands, soles on row 53.
    fill(px, 20, 40, 24, 14, WOOD)
    fill(px, 40, 40, 4, 14, WOOD_DARK)
    fill(px, 20, 43, 24, 2, BAND)
    fill(px, 20, 49, 24, 2, BAND)
    lift = {"closed": 0, "opening": 2 + 3 * n, "open": 12}[state]
    if lift:
        fill(px, 21, 36 - lift, 22, 4 + lift, INSIDE)  # the inside, dark
    # The lid: closed it caps the box; it rises and tilts back as it opens.
    fill(px, 19, 34 - lift, 26, 6, WOOD)
    fill(px, 19, 34 - lift, 26, 1, BAND)
    fill(px, 41, 34 - lift, 4, 6, WOOD_DARK)
    # The clasp, lit on the second closed frame (the glint).
    if state == "closed":
        fill(px, 30, 39, 4, 4, GLINT if n == 1 else CLASP)
    tag = {"closed": f"C{n}", "opening": f"O{n}", "open": "OP"}[state]
    text(px, 32 - 2 * len(tag), 45, tag, PAPER)
    # A 1 px outline round everything drawn.
    drawn = dict(px)
    for (x, y) in list(drawn):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in drawn:
                px[(x + dx, y + dy)] = OUTLINE
    return px


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) + (255,)


def main():
    names = [(f"{anim}_{n}", anim, n) for anim, count, _, _, _ in ANIMS for n in range(count)]
    rows = (len(names) + COLS - 1) // COLS
    width, height = COLS * CELL, rows * CELL
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    frames = {}
    for i, (name, anim, n) in enumerate(names):
        x0, y0 = (i % COLS) * CELL, (i // COLS) * CELL
        for (x, y), colour in chest(anim, n).items():
            img.putpixel((x0 + x, y0 + y), rgb(colour))
        frames[name] = {
            "frame": {"x": x0, "y": y0, "w": CELL, "h": CELL},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": CELL, "h": CELL},
            "sourceSize": {"w": CELL, "h": CELL},
            "anchor": {"x": ORIGIN[0] / CELL, "y": ORIGIN[1] / CELL},
        }
    img.save(HERE / "prop-chest.png")
    anims = {}
    for anim, count, fps, repeat, hold in ANIMS:
        entry = {"frames": [f"{anim}_{n}" for n in range(count)], "frameRate": fps, "repeat": repeat}
        if hold:
            entry["hold"] = True
        anims[anim] = entry
    sheet = {
        "frames": frames,
        "meta": {
            "image": "prop-chest.png",
            "size": {"w": width, "h": height},
            "scale": "1",
            "format": "RGBA8888",
            "app": "fixture",
            "version": "2",
            "cell": {"w": CELL, "h": CELL},
            "origin": {"x": ORIGIN[0], "y": ORIGIN[1]},
            "pixelScale": 1,
        },
        "anims": anims,
    }
    (HERE / "prop-chest.json").write_text(json.dumps(sheet, indent=2) + "\n")


if __name__ == "__main__":
    main()
