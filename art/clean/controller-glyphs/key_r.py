"""MAIN: adds key_r to packages/shared/assets/controller-glyphs-12px.png (white on transparent, tinted
at draw time, like every glyph there), the key cap for the `rotate` binding of build mode (M2 Task 6),
in the same key-cap family as key_e and key_c (#68's placeholders) until ART's kit. Idempotent: the
cell goes in the first free 12 px slot and the JSON lists it once.

    python3 art/clean/controller-glyphs/key_r.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "packages/shared/assets"
NAME = "key_r"
ROWS = [
    ".#########..",
    "#.........#.",
    "#.........#.",
    "#...###...#.",
    "#...#..#..#.",
    "#...###...#.",
    "#...#.#...#.",
    "#...#..#..#.",
    "#.........#.",
    "#.........#.",
    ".#########..",
    "............",
]

path = ASSETS / "controller-glyphs.json"
sheet = json.loads(path.read_text())
cell = next((c for c in sheet["cells"] if c["name"] == NAME), None)
img = Image.open(ASSETS / sheet["image"]).convert("RGBA")
if cell is None:
    size = sheet["cell"]
    taken = {(c["x"], c["y"]) for c in sheet["cells"]}
    cols = img.width // size
    rows = img.height // size
    free = next(((x * size, y * size) for y in range(rows) for x in range(cols) if (x * size, y * size) not in taken), None)
    if free is None:
        raise SystemExit("no free cell in the sheet: grow it first")
    cell = {"name": NAME, "x": free[0], "y": free[1], "w": size, "h": size}
    sheet["cells"].append(cell)
    path.write_text(json.dumps(sheet, indent=2) + "\n")
for y, row in enumerate(ROWS):
    for x, ch in enumerate(row):
        img.putpixel((cell["x"] + x, cell["y"] + y), (255, 255, 255, 255) if ch == "#" else (0, 0, 0, 0))
img.save(ASSETS / sheet["image"])
print(f"{NAME} at ({cell['x']}, {cell['y']})")
