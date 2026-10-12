#!/usr/bin/env python3
"""Compose the single shots of tools/screenshots.mjs into strips (PIL). Usage: screenshot-strips.py <dir>"""
import sys
from pathlib import Path
from PIL import Image

d = Path(sys.argv[1])
FACINGS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]
STRIPS = {
    "walk-facings.png": [f"walk-{i}-{f}.png" for i, f in enumerate(FACINGS)],
    "heavy-charge-thrust-hold.png": ["heavy-1-charge.png", "heavy-2-thrust.png", "heavy-3-hold.png", "heavy-4-recover.png"],
    "haul-throw-pull-slide.png": ["haul-1-throw.png", "haul-2-pull.png", "haul-3-slide.png"],
    "nutshell-regrow.png": ["regrow-0-chipped-outer.png", "regrow-1.png", "regrow-2.png", "regrow-3.png"],
}
for out, names in STRIPS.items():
    ims = [Image.open(d / n) for n in names if (d / n).exists()]
    if not ims:
        continue
    w = sum(i.width for i in ims) + 2 * (len(ims) - 1)
    h = max(i.height for i in ims)
    strip = Image.new("RGBA", (w, h), (42, 37, 64, 255))
    x = 0
    for i in ims:
        strip.paste(i, (x, 0))
        x += i.width + 2
    strip.save(d / out)
    for n in names:
        (d / n).unlink(missing_ok=True)
    print(out, strip.size)
