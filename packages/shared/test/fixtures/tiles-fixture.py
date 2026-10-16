#!/usr/bin/env python3
"""
The tile-sheet test fixture (docs/design/sprites.md "Tiles"): a `tiles-` sheet
in the shape ART's `tiles-cave` will have, every piece and door frame of
packages/shared/src/tiles.ts, packed whole in rows of at most 256 px the way
the art pipeline packs them. Each piece is a flat whitelist colour with its
name's initials in hollow-deep or choir-paper (FL0 for floor_0, FANW for
face_nw, TOM1 for top_mid_1, DNO3 for door_n_opening_3...), so a wrong pick
shows in a screenshot. Overlays are transparent but for a band or a corner
square where the shade or corner falls. Never shipped; the shared tests, the
pipeline's rooms.png test and the client's tile tests read it.

    python3 packages/shared/test/fixtures/tiles-fixture.py
"""
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
T = {k: v.lower() for k, v in json.loads((HERE / "../../data/palette.json").read_text())["tokens"].items()}

TILE = 32
ROW_W = 256
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
STATES = [("closed", 1, 0), ("opening", 6, 12), ("open", 1, 0)]
FLOOR_WEIGHTS = [6, 3, 2, 1]

# A 3×5 font for the initials; '#' is ink.
FONT = {
    "A": ["###", "#.#", "###", "#.#", "#.#"],
    "C": ["###", "#..", "#..", "#..", "###"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "E": ["###", "#..", "##.", "#..", "###"],
    "F": ["###", "#..", "##.", "#..", "#.."],
    "H": ["#.#", "#.#", "###", "#.#", "#.#"],
    "L": ["#..", "#..", "#..", "#..", "###"],
    "M": ["#.#", "###", "###", "#.#", "#.#"],
    "N": ["##.", "#.#", "#.#", "#.#", "#.#"],
    "O": ["###", "#.#", "#.#", "#.#", "###"],
    "P": ["###", "#.#", "###", "#..", "#.."],
    "S": ["###", "#..", "###", "..#", "###"],
    "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "W": ["#.#", "#.#", "###", "###", "#.#"],
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", ".##", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
}

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


def initials(name):
    """FL0, SHNW, FANWE, FAM0, TOM1 (overlays draw only the part that fits their band: N, W, NW, CNW)."""
    word, *rest = name.split("_")
    return word[:2].upper() + "".join("M" if p == "mid" else p.upper() for p in rest)


def draw_static(name):
    px = {}
    label = initials(name)
    if name.startswith("floor"):
        colour = [T["hollow-lavender"], T["husk-shell"], T["hollow-light"], T["wheel-eye"]][int(name[-1])]
        fill(px, 0, 0, TILE, TILE, colour)
        text(px, 8, 14, label, INK)
    elif name == "shade_n":
        fill(px, 0, 0, TILE, 7, T["hollow-dusk"])
        text(px, 10, 1, label, INK)
    elif name in ("shade_w", "shade_e"):
        x0 = 0 if name == "shade_w" else TILE - 6
        fill(px, x0, 0, 6, TILE, T["watcher-stone"] if name == "shade_w" else T["sleeper-soil"])
        text(px, x0 + 1, 8, "S" + label[2], INK, vertical=True)
    elif name in ("shade_nw", "shade_ne"):
        x0 = 0 if name == "shade_nw" else TILE - 9
        fill(px, x0, 0, 9, 7, T["sleeper-flesh"])
        text(px, x0 + 1, 1, label[2:], INK)
    elif name.startswith("face"):
        fill(px, 0, 0, TILE, 8, T["hollow-dusk"])
        fill(px, 0, 8, TILE, TILE - 8, T["watcher-iron"] if name == "face_mid_1" else T["hollow-below"])
        text(px, 2, 16, label, PAPER)
    elif name.startswith("top"):
        fill(px, 0, 0, TILE, TILE, T["wheel-brass"] if name == "top_mid_1" else T["sleeper-ochre"])
        text(px, 2, 14, label, PAPER)
    elif name.startswith("corner"):
        x0 = 0 if name == "corner_nw" else TILE - 13
        fill(px, x0, 0, 13, 7, T["spark-amber"])
        text(px, x0 + 1, 1, "C" + name[-2:].upper(), INK)
    return px


def draw_door(door, w, h, state, n):
    px = {}
    colour = {"closed": T["watcher-rain"], "opening": T["choir-flame"], "open": T["hollow-lavender"]}[state]
    fill(px, 0, 0, w, h, colour)
    tag = {"closed": "C", "opening": f"O{n}", "open": "OP"}[state]
    label = "D" + door[-1].upper() + tag
    text(px, (w - (4 * len(label) - 1)) // 2, (h - 5) // 2, label, PAPER if state != "open" else INK)
    return px


def frames():
    """(name, w, h, pixels) of every frame, in sheet order."""
    out = [(name, TILE, TILE, draw_static(name)) for name in STATIC]
    for door, w, h in DOORS:
        for state, count, _ in STATES:
            for n in range(count):
                out.append((f"{door}_{state}_{n}", w, h, draw_door(door, w, h, state, n)))
    return out


def pack(items):
    """Shelf packing, in order: left to right in rows of at most ROW_W px, each row as tall as its tallest frame."""
    placed, x, y, row_h = [], 0, 0, 0
    for name, w, h, px in items:
        if x + w > ROW_W:
            x, y, row_h = 0, y + row_h, 0
        placed.append((name, x, y, w, h, px))
        x += w
        row_h = max(row_h, h)
    return placed, ROW_W, y + row_h


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) + (255,)


def main():
    placed, width, height = pack(frames())
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    out_frames = {}
    for name, x0, y0, w, h, px in placed:
        for (x, y), colour in px.items():
            img.putpixel((x0 + x, y0 + y), rgb(colour))
        out_frames[name] = {
            "frame": {"x": x0, "y": y0, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
            "anchor": {"x": 0, "y": 0},
        }
    img.save(HERE / "tiles-fixture.png")
    anims = {}
    for door, _, _ in DOORS:
        for state, count, fps in STATES:
            anims[f"{door}_{state}"] = {
                "frames": [f"{door}_{state}_{n}" for n in range(count)],
                "frameRate": fps,
                "repeat": 0,
                "hold": True,
            }
    sheet = {
        "frames": out_frames,
        "meta": {
            "image": "tiles-fixture.png",
            "size": {"w": width, "h": height},
            "scale": "1",
            "format": "RGBA8888",
            "app": "fixture",
            "version": "2",
            "pixelScale": 1,
        },
        "anims": anims,
        "tiles": {"tileSize": TILE, "floorWeights": FLOOR_WEIGHTS},
    }
    (HERE / "tiles-fixture.json").write_text(json.dumps(sheet, indent=2) + "\n")


if __name__ == "__main__":
    main()
