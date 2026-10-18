"""ART: the M2 item icons, 16 x 16 UI px each, drawn by hand as pixel maps in the style of the icon
anchors (art/anchors/icon-ref-*-32.png: a dream-night outline, flat 2-3 step shading, light from the
top left). One per item in packages/shared/data/items.json, named by its id, in colour (never tinted).

The three Sparkglass grades read as a progression: the wild sliver a thin brittle shard, humming glass
the same faceted chip as the Husks' drop and the pickup, deep glass a bigger stone with dark edges and a
bright heart. Sealed gin is a round bead with the Concord's ring stamped in it (no letters). No
husk-core anywhere: that colour is the Husks'.

Writes packages/shared/assets/item-icons-16px.png and item-icons.json.

    python3 art/clean/item-icons/icons.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]
K = {
    "o": "dream-night", "L": "hollow-light", "P": "choir-paper", "A": "spark-amber", "e": "spark-ember",
    "G": "choir-gold", "B": "wheel-brass", "b": "wheel-brass-dark", "W": "watcher-bronze",
    "s": "sleeper-soil", "q": "sleeper-ochre", "i": "watcher-iron", "t": "watcher-stone",
    "D": "hollow-dusk", "v": "hollow-lavender", "u": "hollow-below", "d": "hollow-deep",
    "n": "sleeper-night", "E": "wheel-eye",
}
S = 16

ICONS = {
    "sealed-gin": [
        "................",
        ".....oooooo.....",
        "...ooLLAAAAoo...",
        "..oLLAAAAAAAeo..",
        "..oLAAbbbbAAeo..",
        ".oLAAbAAAAbAAeo.",
        ".oLAbAAGGAAbAeo.",
        ".oAAbAGAAGAbAeo.",
        ".oAAbAGAAGAbAeo.",
        ".oAAbAAGGAAbeeo.",
        ".oAAAbAAAAbAeeo.",
        "..oAAAbbbbAeeo..",
        "..oeAAAAAAeeeo..",
        "...ooeeeeeeoo...",
        ".....oooooo.....",
        "................",
    ],
    "wild-sliver": [
        "................",
        "................",
        "................",
        "..........oo....",
        ".........oLo....",
        "........oLAeo...",
        ".......oLAAeo...",
        "......oLLAeo....",
        ".....oLAAeo.....",
        "....oLAAeo......",
        "....oAAeo.......",
        "...oAeeo........",
        "...oeo..........",
        "...oo...........",
        "................",
        "................",
    ],
    "glass-chip": [
        "................",
        "................",
        "........o.......",
        ".......oPo......",
        "......oPLGo.....",
        ".....oLLAGeo....",
        "..G..oLAAGeo..G.",
        ".....oLAAGeo....",
        "..G..oLAAGeo..G.",
        ".....oLAAGeo....",
        ".....oAAAeeo....",
        "......oAAeo.....",
        ".......oeo......",
        "........o.......",
        "................",
        "................",
    ],
    "deep-glass": [
        "................",
        ".......oo.......",
        "......onno......",
        ".....onuuno.....",
        "....onuGGuno....",
        "...onuGAAGuno...",
        "..onuGAPAAGuno..",
        "..onuGAAAAGuno..",
        "..onuGAAAAGuno..",
        "..onuuGAAGuuno..",
        "...onuuGGuuno...",
        "....onuuuuno....",
        ".....onnnno.....",
        "......oooo......",
        "................",
        "................",
    ],
    "twisted-log": [
        "................",
        "................",
        "................",
        "................",
        "...ooooooooooo..",
        "..osssoWWWWWWWo.",
        ".osqqqsoWWbWWWWo",
        ".osqsqsoWWWWbWWo",
        ".osqqssobWWWWWbo",
        ".ossssobWWbWWWbo",
        "..ossobbbbbbbbo.",
        "...oooooooooooo.",
        "................",
        "................",
        "................",
        "................",
    ],
    "black-stone": [
        "................",
        "................",
        "................",
        "................",
        ".....oooooo.....",
        "...oottiiiioo...",
        "..otttiiiiiiio..",
        ".ottiiiiiiiiido.",
        ".otiiiiiiiiiddo.",
        ".oiiiiiiieiiddo.",
        ".oiiiiiiiiidddo.",
        "..oiiiiiidddo...",
        "...ooooooooo....",
        "................",
        "................",
        "................",
    ],
}

# streaked stone: the black stone with a pale porous vein across it
streak = [list(r) for r in ICONS["black-stone"]]
streak[9][8] = "i"                                   # no ember fleck: the vein is its mark
for x, y in [(3, 10), (4, 10), (5, 9), (6, 9), (7, 8), (8, 8), (9, 7), (10, 7), (11, 6), (12, 6)]:
    streak[y][x] = "E"
for x, y in [(4, 9), (6, 8), (8, 7), (10, 6)]:
    streak[y][x] = "v"
for x, y in [(5, 10), (9, 8), (11, 7)]:
    streak[y][x] = "D"
ICONS["streaked-stone"] = ["".join(r) for r in streak]


def stamp(grid, rows, x0, y0):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".":
                grid[y0 + y][x0 + x] = ch


seeds = [["."] * S for _ in range(S)]
SEED = [".ooo.", "oLtto", "ottio", "ottio", "oiio.", ".oo.."]
for x0, y0 in [(2, 3), (9, 4), (5, 9)]:
    stamp(seeds, SEED, x0, y0)
ICONS["grey-seeds"] = ["".join(r) for r in seeds]

grain = [["."] * S for _ in range(S)]
for x, y in [(4, 7), (5, 8), (5, 9), (6, 10), (7, 7), (7, 8), (7, 9), (7, 10), (10, 7), (9, 8), (9, 9), (8, 10)]:
    grain[y][x] = "b"                                # the stalks, gathering to the tie
for x, y in [(6, 11), (7, 11), (8, 11), (6, 12), (7, 12), (8, 12), (6, 13), (8, 13)]:
    grain[y][x] = "b"
for x in (5, 6, 7, 8, 9):
    grain[11][x] = "W" if x in (6, 7, 8) else "o"    # the tie: a bronze band
HEAD = [".oo.", "oPEo", "oEso", "osEo", "oEso", "osso", ".oo."]
for x0, y0 in [(2, 1), (6, 0), (10, 1)]:
    stamp(grain, HEAD, x0, y0)
ICONS["pale-grain"] = ["".join(r) for r in grain]

ORDER = ["sealed-gin", "wild-sliver", "glass-chip", "deep-glass", "twisted-log", "black-stone",
         "streaked-stone", "grey-seeds", "pale-grain"]


def rgb(name):
    h = T[name]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def main():
    items = [it["id"] for it in json.loads((ROOT / "packages/shared/data/items.json").read_text())["items"]]
    assert sorted(items) == sorted(ORDER), (items, ORDER)
    img = Image.new("RGBA", (S * len(ORDER), S), (0, 0, 0, 0))
    cells = []
    for i, name in enumerate(ORDER):
        rows = ICONS[name]
        assert len(rows) == S and all(len(r) == S for r in rows), name
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != ".":
                    img.putpixel((i * S + x, y), rgb(K[ch]))
        cells.append({"name": name, "x": i * S, "y": 0, "w": S, "h": S})
    out = ROOT / "packages/shared/assets"
    img.save(out / "item-icons-16px.png")
    sheet = {
        "image": "item-icons-16px.png",
        "cell": S,
        "meta": {"version": "2", "pixelScale": 1, "tinted": False},
        "cells": cells,
        "notes": "ART's M2 item icons, one per item id in items.json, 16 x 16 UI px, drawn in colour (never tinted). Draw at 1 UI px per px, centred in the 24 px inventory cell; the count sits over the bottom right.",
    }
    (out / "item-icons.json").write_text(json.dumps(sheet, indent=1) + "\n")


if __name__ == "__main__":
    main()
