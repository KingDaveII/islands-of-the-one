"""ART: hookblade-fx at B (pixelScale 1, drawn in colour: "tinted": false), the Haul's chain and flying
hook and the charge spark, drawn by hand as pixel maps.

- The hook is the Hookblade's own head, as kindled-ash draws it in the side views (blade_ew.py's stamp):
  a 9 px edge with its shade row and a 2 px hook turned back over the tip, pointing right, so the hook
  that flies is visibly the one that left the hand. `hook_set` is the same head lit (husk-shell edge,
  hollow-light glint) once it has bitten.
- The chain is small oval links along the chain (the engine rotates them to its angle), steel with a
  dark eye; `chain_link_taut` is the same link pale and bright during the pull.
- The spark grows over the charge: spark-amber, then the full charge in husk-core inside its 1 px
  ring (readability.md: husk-core always gets its ring; never spark-glow).
- Outline dream-night, the player's: the Hookblade is the player's weapon.
- `chain.spacing` 14: the Haul reaches 224 world px and the engine draws at most 16 links.

    python3 art/clean/hookblade-fx/hookblade_fx.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "packages/shared/assets"
T = {k: v.lower() for k, v in json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"].items()}
KEY = {
    "a": T["dream-night"],      # outline
    "i": T["watcher-iron"],     # steel, dark
    "s": T["watcher-stone"],    # steel, shade
    "W": T["husk-shell"],       # steel, edge
    "H": T["hollow-light"],     # glint
    "A": T["spark-amber"],
    "e": T["spark-ember"],
    "C": T["husk-core"],
    "d": T["hollow-deep"],      # the core's ring
}

CELLS = {
    "chain_link": [
        ".aaaaa.",
        "asWWWsa",
        "asaaasa",
        "aisssia",
        ".aaaaa.",
    ],
    "chain_link_taut": [
        ".aaaaa.",
        "aWHHHWa",
        "aWaaaWa",
        "asWWWsa",
        ".aaaaa.",
    ],
    # the shank end, where the chain ties on, is the left middle: origin [0, 4]
    "hook": [
        "........aaa.",
        ".......asWa.",
        "aaaaaaaaaWa.",
        "aWWWWWWWWWa.",
        "assssssssaa.",
        ".aaaaaaaaa..",
    ],
    "hook_set": [
        "........aaa.",
        ".......aWHa.",
        "aaaaaaaaaHa.",
        "aHWWWWWWHHa.",
        "aWsssssssaa.",
        ".aaaaaaaaa..",
    ],
    "spark_0": [
        ".......",
        "...a...",
        "..aAa..",
        ".aAAAa.",
        "..aAa..",
        "...a...",
        ".......",
    ],
    "spark_1": [
        "....a....",
        "...aAa...",
        ".a.aAa.a.",
        "..aAAAa..",
        "aAAAeAAAa",
        "..aAAAa..",
        ".a.aAa.a.",
        "...aAa...",
        "....a....",
    ],
    "spark_2": [
        ".....a.....",
        "....aAa....",
        ".a..aAa..a.",
        "..aAdddAa..",
        "..AdCCCdA..",
        "aAAdCCCdAAa",
        "..AdCCCdA..",
        "..aAdddAa..",
        ".a..aAa..a.",
        "....aAa....",
        ".....a.....",
    ],
}


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def main():
    names = list(CELLS)
    width = sum(len(CELLS[n][0]) for n in names) + len(names) - 1
    height = max(len(CELLS[n]) for n in names)
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    cells, x0 = [], 0
    for n in names:
        rows = CELLS[n]
        w, h = len(rows[0]), len(rows)
        assert all(len(r) == w for r in rows), n
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != ".":
                    img.putpixel((x0 + x, y), rgb(KEY[ch]))
        cells.append({"name": n, "x": x0, "y": 0, "w": w, "h": h})
        x0 += w + 1
    img.save(OUT / "hookblade-fx.png")
    sheet = {
        "image": "hookblade-fx.png",
        "meta": {"version": "2", "pixelScale": 1, "tinted": False},
        "cells": cells,
        "anims": {
            "charge_spark": {
                "frames": ["spark_0", "spark_1", "spark_2"],
                "fps": 12,
                "loop": False,
                "note": "spark_0 at the start of the charge, spark_2 held at full charge (armored); drawn at the frame's tip point, in its own colours (spark-amber, the full charge in husk-core inside its ring)",
            }
        },
        "chain": {
            "link": "chain_link",
            "spacing": 14,
            "taut": "chain_link_taut",
            "note": "one link per 14 sheet px from the hand to the hook (the Haul's 224 world px in 16 links); on a hit every link swaps to taut for the pull",
        },
        "hook": {
            "flight": "hook",
            "set": "hook_set",
            "origin": [0, 4],
            "note": "the Hookblade's head pointing right, rotate to the throw angle; origin is the shank end where the chain ties on, in sheet px",
        },
    }
    (OUT / "hookblade-fx.json").write_text(json.dumps(sheet, indent=1) + "\n")


if __name__ == "__main__":
    main()
