#!/usr/bin/env python3
"""
The Sparkglass pickup test fixture (docs/design/sprites.md §4 "Props", M1
polish 2026-10-17): a `prop-sparkglass` sheet in the shape ART's will have, a
prop without a table of its own, so `idle` alone: a 9x11 Sparkglass chip with
a 2-frame glint, on 64x64 cells with the origin at (32, 54), the chip's base
on canvas row 53. Whitelist colours (spark-amber faces, spark-ember shade, a
hollow-deep outline, the glint in choir-paper). Never shipped; the sheet test
and the client's pickup tests read it.

    python3 packages/shared/test/fixtures/prop-sparkglass.py
"""
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
T = {k: v.lower() for k, v in json.loads((HERE / "../../data/palette.json").read_text())["tokens"].items()}

CELL = 64
ORIGIN = (32, 54)
FRAMES = 2
FPS = 2
OUTLINE, FACE, SHADE, GLINT = T["hollow-deep"], T["spark-amber"], T["spark-ember"], T["choir-paper"]

# The chip, 9 wide and 11 high (outline included), '.' clear, 'o' outline, 'a' amber, 'e' ember, 'g' the glint (frame 1 only).
CHIP = [
    "....o....",
    "...oao...",
    "..oagao..",
    ".oaaaaao.",
    "oaaaaaeao",
    "oaaaaeeao",
    ".oaaeeao.",
    "..oaeao..",
    "...oao...",
    "....o....",
    "....o....",
]


def chip(n):
    """Canvas pixels {(x, y): hex} of one frame: the chip with its base on row 53, the glint lit on frame 1."""
    px = {}
    top = 53 - (len(CHIP) - 1)
    left = 32 - len(CHIP[0]) // 2
    for y, row in enumerate(CHIP):
        for x, c in enumerate(row):
            if c == ".":
                continue
            colour = {"o": OUTLINE, "a": FACE, "e": SHADE, "g": GLINT if n == 1 else FACE}[c]
            px[(left + x, top + y)] = colour
    return px


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) + (255,)


def main():
    width, height = FRAMES * CELL, CELL
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    frames = {}
    for n in range(FRAMES):
        x0 = n * CELL
        for (x, y), colour in chip(n).items():
            img.putpixel((x0 + x, y), rgb(colour))
        frames[f"idle_{n}"] = {
            "frame": {"x": x0, "y": 0, "w": CELL, "h": CELL},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": CELL, "h": CELL},
            "sourceSize": {"w": CELL, "h": CELL},
            "anchor": {"x": ORIGIN[0] / CELL, "y": ORIGIN[1] / CELL},
        }
    img.save(HERE / "prop-sparkglass.png")
    sheet = {
        "frames": frames,
        "meta": {
            "image": "prop-sparkglass.png",
            "size": {"w": width, "h": height},
            "scale": "1",
            "format": "RGBA8888",
            "app": "fixture",
            "version": "2",
            "cell": {"w": CELL, "h": CELL},
            "origin": {"x": ORIGIN[0], "y": ORIGIN[1]},
            "pixelScale": 1,
        },
        "anims": {"idle": {"frames": [f"idle_{n}" for n in range(FRAMES)], "frameRate": FPS, "repeat": -1}},
    }
    (HERE / "prop-sparkglass.json").write_text(json.dumps(sheet, indent=2) + "\n")


if __name__ == "__main__":
    main()
