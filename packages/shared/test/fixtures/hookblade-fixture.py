#!/usr/bin/env python3
"""
The engine-sheet test fixture (docs/design/sprites.md "Engine sheets"): a
hookblade-fx sheet the way ART's B redraw will deliver it, `"version": "2"`,
`"pixelScale": 1`, `"tinted": false`, its colours and outline drawn in from the
whitelist. Every number is in sheet px (twice M1's: the cells, the hook's
origin, the chain spacing). Never shipped; the sheet test and the client's
hookblade tests read it.

    python3 packages/shared/test/fixtures/hookblade-fixture.py
"""
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
T = {k: v.lower() for k, v in json.loads((HERE / "../../data/palette.json").read_text())["tokens"].items()}


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) + (255,)


OUTLINE, STEEL, EDGE, GLOW, CORE = T["dream-night"], T["watcher-stone"], T["husk-shell"], T["spark-amber"], T["husk-core"]

CELLS = [
    ("chain_link", 6, 6),
    ("chain_link_taut", 6, 6),
    ("hook", 8, 8),
    ("hook_set", 8, 8),
    ("spark_0", 10, 10),
    ("spark_1", 10, 10),
    ("spark_2", 10, 10),
]


def draw(name, w, h):
    """One cell's pixels {(x, y): hex}: an outlined ring for a link, an outlined bar for the hook, a cross for a spark."""
    px = {}
    if name.startswith("chain"):
        for y in range(h):
            for x in range(w):
                edge = x in (0, w - 1) or y in (0, h - 1)
                if (x, y) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
                    continue
                if edge:
                    px[(x, y)] = OUTLINE
                elif x in (1, w - 2) or y in (1, h - 2):
                    px[(x, y)] = EDGE if name.endswith("taut") else STEEL
    elif name.startswith("hook"):
        for x in range(w):
            for y in (2, 3, 4):
                px[(x, y)] = OUTLINE if y != 3 else (EDGE if name == "hook_set" else STEEL)
        for y in range(1, 7):
            px[(w - 1, y)] = OUTLINE
    else:
        stage = int(name[-1])
        c = w // 2
        for d in range(-(2 + stage), 3 + stage):
            for x, y in ((c + d, c), (c, c + d)):
                if 0 <= x < w and 0 <= y < h:
                    px[(x, y)] = CORE if stage == 2 and abs(d) <= 1 else GLOW
    return px


def main():
    width = sum(w for _, w, _ in CELLS) + len(CELLS) - 1
    height = max(h for _, _, h in CELLS)
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    cells, x0 = [], 0
    for name, w, h in CELLS:
        for (x, y), colour in draw(name, w, h).items():
            img.putpixel((x0 + x, y), rgb(colour))
        cells.append({"name": name, "x": x0, "y": 0, "w": w, "h": h})
        x0 += w + 1
    img.save(HERE / "hookblade-fixture.png")
    contract = {
        "image": "hookblade-fixture.png",
        "meta": {"version": "2", "pixelScale": 1, "tinted": False},
        "cells": cells,
        "anims": {"charge_spark": {"frames": ["spark_0", "spark_1", "spark_2"], "fps": 12, "loop": False}},
        "chain": {"link": "chain_link", "spacing": 32, "taut": "chain_link_taut"},
        "hook": {"flight": "hook", "set": "hook_set", "origin": [0, 3]},
    }
    (HERE / "hookblade-fixture.json").write_text(json.dumps(contract, indent=1) + "\n")


if __name__ == "__main__":
    main()
