"""ART: the M2 toast glyphs (M2 Task 7; GAME DESIGN's toasts: "Bottom left, one line each, glyph plus text"), 12 x 12
UI px each, the size of the controller glyphs that already stand beside a line of HUD text, drawn by hand as pixel
maps in the item icons' style (art/clean/item-icons/icons.py: a dream-night outline, flat 2-3 step shading, light
from the top left), in colour, never tinted.

- skill-woodcutting, skill-mining, skill-farming: the skill's tool (an axe, a pick, a sickle), for "Woodcutting 2.";
- writ-low: the Writ's clay tablet with its marks burning down to ember (spark-ember), "about a day left";
- writ-dark: the same tablet gone cold and grey, its marks out, for "Your Writ reads מת.";
- store-full: the holding store's bin, its cloth bulging over the brim;
- pack-full: the pack, its flap strained shut over a bulge.

No husk-core, no reserved signal colour. Writes packages/shared/assets/toast-glyphs-12px.png and toast-glyphs.json.

    python3 art/clean/toast-glyphs/glyphs.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]
K = {
    "o": "dream-night", "L": "hollow-light", "E": "wheel-eye", "t": "watcher-stone", "i": "watcher-iron",
    "W": "watcher-bronze", "b": "wheel-brass-dark", "B": "wheel-brass", "f": "sleeper-flesh", "q": "sleeper-ochre",
    "e": "spark-ember", "A": "spark-amber", "D": "hollow-dusk", "u": "hollow-below", "s": "sleeper-soil",
    "S": "unwritten-sail",
}
S = 12

GLYPHS = {
    "skill-woodcutting": [
        "............",
        "......ooo...",
        ".....oLtoo..",
        "....oLttio..",
        "....otttiio.",
        "....oWoiiio.",
        "...oWboooo..",
        "..oWbo......",
        ".oWbo.......",
        "oWbo........",
        "obo.........",
        ".o..........",
    ],
    "skill-mining": [
        "............",
        "...ooooo....",
        "..oLtttioo..",
        ".oto.oWoiio.",
        ".oo..oWo.oo.",
        "....oWbo....",
        "...oWbo.....",
        "..oWbo......",
        ".oWbo.......",
        "oWbo........",
        "obo.........",
        ".o..........",
    ],
    "skill-farming": [
        "............",
        "....ooooo...",
        "...oLLttto..",
        "..oLoooootio",
        "..oo.....oto",
        "..........oo",
        ".........oto",
        "........otio",
        ".......oWoo.",
        "......oWbo..",
        ".....oWbo...",
        "......oo....",
    ],
    "writ-low": [
        "............",
        "...oooooo...",
        "..offfffqo..",
        "..ofAAeqqo..",
        "..ofqqqqqo..",
        "..ofqeAAqo..",
        "..ofqqqqqo..",
        "..ofAeqqqo..",
        "..ofqqqqqo..",
        "..oqqqqqqo..",
        "...oooooo...",
        "............",
    ],
    "writ-dark": [
        "............",
        "...oooooo...",
        "..otttttio..",
        "..otDiiiio..",
        "..otiiiDio..",
        "..otiiiiio..",
        "..otiDiiio..",
        "..otiiiiio..",
        "..otiiiiio..",
        "..oiiiiiio..",
        "...oooooo...",
        "............",
    ],
    "store-full": [
        "............",
        "....oooo....",
        "..ooEEEEoo..",
        ".oEEEEEESSo.",
        ".oEEEEESSSo.",
        ".ooqqqqqqqo.",
        ".oWWbWWWbbo.",
        ".oWWbWWWbbo.",
        ".oqqqqqqqqo.",
        ".oWWbWWWbbo.",
        ".oWWbWWWbbo.",
        "..oooooooo..",
    ],
    "pack-full": [
        "............",
        "....oooo....",
        "...obBBbo...",
        "..oooooooo..",
        ".oWWWWWWbbo.",
        ".oWWWBBWWbo.",
        ".oWWWBoWWbo.",
        ".oWWWWWWWbo.",
        ".oWWWWWWWbo.",
        ".obWWWWWbbo.",
        "..obbbbbbo..",
        "...oooooo...",
    ],
}


def rgb(k):
    h = T[k]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def main():
    names = list(GLYPHS)
    img = Image.new("RGBA", (S * len(names), S), (0, 0, 0, 0))
    cells = []
    for n, name in enumerate(names):
        rows = GLYPHS[name]
        assert len(rows) == S and all(len(r) == S for r in rows), name
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != ".":
                    img.putpixel((n * S + x, y), rgb(K[ch]))
        cells.append({"name": name, "x": n * S, "y": 0, "w": S, "h": S})
    img.save(ROOT / "packages/shared/assets/toast-glyphs-12px.png")
    meta = {
        "image": "toast-glyphs-12px.png",
        "cell": S,
        "meta": {"version": "2", "pixelScale": 1, "tinted": False},
        "cells": cells,
        "notes": "ART's M2 toast glyphs (M2 Task 7), 12 x 12 UI px, drawn in colour (never tinted): one before each "
        "toast's line, at 1 UI px per px, vertically centred on the line. skill-<skill> for a skill level (the "
        "skill's tool), writ-low, writ-dark, store-full, pack-full.",
    }
    (ROOT / "packages/shared/assets/toast-glyphs.json").write_text(json.dumps(meta, indent=2) + "\n")


if __name__ == "__main__":
    main()
