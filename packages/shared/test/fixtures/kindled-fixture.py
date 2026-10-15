#!/usr/bin/env python3
"""
The v2 test fixture (docs/design/sprites.md §6): a tiny Kindled sheet on the
v2 contract, two `idle_S` frames on 112x80 cells with the 64x64 art canvas at
(24, 10), soles on canvas row 53, and its skin mask. The belt and boots are
unwritten-tar, the clay ramp's shade, like the 45 px exemplar: the mask leaves
them out, so a tone swap recolours the face and hands only. Never shipped; the
sheet test and the client's masked-swap test read it.

    python3 packages/shared/test/fixtures/kindled-fixture.py
"""
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PALETTE = json.loads((HERE / "../../data/palette.json").read_text())
T = {k: v.lower() for k, v in PALETTE["tokens"].items()}

CELL_W, CELL_H = 112, 80
CANVAS_X, CANVAS_Y = 24, 10
SOLE = 53

OUTLINE = T["dream-night"]
SKIN, SHADE = T["unwritten-sail"], T["unwritten-tar"]
CLOTH, CLOTH_DARK = T["watcher-stone"], T["watcher-iron"]
TAR = T["unwritten-tar"]
FRECKLE = T["spark-amber"]


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) + (255,)


def figure(breath):
    """Canvas pixels {(x, y): (hex, is_skin)} for one frame; `breath` lifts the top by a pixel."""
    px = {}

    def rect(x0, y0, w, h, colour, skin=False, lift=True):
        dy = -breath if lift else 0
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                px[(x, y + dy)] = (colour, skin)

    rect(27, 10, 10, 11, SKIN, True)  # head
    rect(35, 12, 2, 8, SHADE, True)  # the face's shade side (skin, masked)
    rect(30, 14, 1, 2, OUTLINE)  # eyes
    rect(33, 14, 1, 2, OUTLINE)
    for x, y in ((29, 17), (31, 18), (34, 17)):
        rect(x, y, 1, 1, FRECKLE)
    rect(25, 21, 14, 12, CLOTH)  # body
    rect(36, 21, 3, 12, CLOTH_DARK)
    rect(22, 22, 3, 10, CLOTH)  # arms
    rect(39, 22, 3, 10, CLOTH_DARK)
    rect(22, 32, 3, 2, SKIN, True)  # hands
    rect(39, 32, 3, 2, SHADE, True)
    # The belt and boots are deliberately drawn in the skin-shade colour (unwritten-tar), unlike
    # ART's sheets, which keep the skin colours for skin only: they prove the masked swap leaves
    # non-skin pixels in a swap colour alone.
    rect(25, 33, 14, 2, TAR)  # the belt: unwritten-tar, not skin
    rect(26, 35, 12, 7, CLOTH)  # skirt of the coat
    rect(27, 42, 4, 8, CLOTH_DARK, lift=False)  # legs
    rect(33, 42, 4, 8, CLOTH_DARK, lift=False)
    rect(26, 50, 5, 4, TAR, lift=False)  # boots, soles on row 53
    rect(33, 50, 5, 4, TAR, lift=False)
    # A 1 px outline all round.
    out = {}
    for (x, y) in px:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in px and n[1] <= SOLE:
                out[n] = (OUTLINE, False)
    px.update(out)
    return px


def main():
    names = ["idle_S_0", "idle_S_1"]
    sheet = Image.new("RGBA", (CELL_W * len(names), CELL_H), (0, 0, 0, 0))
    mask = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
    frames = {}
    for i, name in enumerate(names):
        ox, oy = i * CELL_W + CANVAS_X, CANVAS_Y
        for (x, y), (colour, skin) in figure(i).items():
            assert 0 <= x < 64 and 0 <= y <= SOLE, (x, y)
            sheet.putpixel((ox + x, oy + y), rgb(colour))
            if skin:
                mask.putpixel((ox + x, oy + y), (255, 255, 255, 255))
        frames[name] = {
            "frame": {"x": i * CELL_W, "y": 0, "w": CELL_W, "h": CELL_H},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": CELL_W, "h": CELL_H},
            "sourceSize": {"w": CELL_W, "h": CELL_H},
            "anchor": {"x": 56 / CELL_W, "y": 64 / CELL_H},
        }
    drawn = PALETTE["clay"]["drawn"]
    tones = PALETTE["clay"]["tones"]
    base = tones[drawn]
    swaps = {
        tone: {base["skin"]: t["skin"], base["shade"]: t["shade"]}
        for tone, t in tones.items()
        if tone != drawn
    }
    contract = {
        "frames": frames,
        "meta": {
            "image": "kindled-fixture.png",
            "size": {"w": sheet.width, "h": sheet.height},
            "scale": "1",
            "format": "RGBA8888",
            "app": "fixture",
            "version": "2",
            "cell": {"w": CELL_W, "h": CELL_H},
            "origin": {"x": 56, "y": 64},
            "facings": ["S", "SE", "E", "NE", "N", "NW", "W", "SW"],
            "pixelScale": 1,
        },
        "anims": {"idle_S": {"frames": names, "frameRate": 2, "repeat": -1}},
        "palette": {"drawn": drawn, "mask": "kindled-fixture.skin.png", "swaps": swaps},
    }
    sheet.save(HERE / "kindled-fixture.png")
    mask.save(HERE / "kindled-fixture.skin.png")
    (HERE / "kindled-fixture.json").write_text(json.dumps(contract, indent=2) + "\n")


if __name__ == "__main__":
    main()
