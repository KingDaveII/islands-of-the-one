"""ART: redraws ps_touchpad in packages/shared/assets/controller-glyphs-12px.png (white on transparent,
tinted at draw time, like every glyph there). The DualSense touchpad as a wide panel narrowing a little
towards the player, with the split down its middle at the top edge, so it reads apart from ps_options
(a pill with lines). key_i (#68's placeholder) already follows the key-cap family and stays.

    python3 art/clean/controller-glyphs/touchpad.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "packages/shared/assets"
ROWS = [
    "............",
    "............",
    "############",
    "#....##....#",
    "#..........#",
    "#..........#",
    "#..........#",
    ".#........#.",
    ".#........#.",
    "..########..",
    "............",
    "............",
]

sheet = json.loads((ASSETS / "controller-glyphs.json").read_text())
cell = next(c for c in sheet["cells"] if c["name"] == "ps_touchpad")
img = Image.open(ASSETS / sheet["image"]).convert("RGBA")
for y, row in enumerate(ROWS):
    for x, ch in enumerate(row):
        img.putpixel((cell["x"] + x, cell["y"] + y), (255, 255, 255, 255) if ch == "#" else (0, 0, 0, 0))
img.save(ASSETS / sheet["image"])
