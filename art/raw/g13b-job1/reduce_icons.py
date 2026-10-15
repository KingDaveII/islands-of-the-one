"""Reduce the picked 32x32 icons of art job g13b-job1 to 16x16 (not app code).

For each 2x2 block: the most frequent opaque colour wins; the block is transparent
if fewer than 2 of its 4 pixels are opaque; a tie goes to the darker colour (lower
OKLab L). Then every colour is snapped to the nearest of the 28 palette colours in
OKLab. Writes <id>-16.png next to the 32 px original.

Usage: python3 reduce_icons.py            (from anywhere; paths are relative to this file)
"""

from collections import Counter
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ICONS = ["icon-ration", "icon-sparkglass", "icon-tonic", "icon-bomb"]
# (option, path of the 32 px original relative to HERE)
SOURCES = [("b", "b/{id}/{id}.png"), ("c", "c/{id}/pick.png")]

PALETTE = [
    "#F4EFE6", "#D9D2E9", "#A99FC4", "#5B5478", "#2A2540", "#F2B65A", "#C9733A",
    "#4A4E57", "#7D8794", "#3E5C7A", "#A8743A", "#C79A3E", "#8A6420", "#E9E4D4",
    "#2F7F7A", "#C98F78", "#9C5B4A", "#E3C29E", "#24305A", "#E8E2D6", "#FFF4C7",
    "#8C7F6E", "#5E5448", "#FBF8F0", "#D8B24A", "#F07A3A", "#B5402E", "#1C2147",
]
OPAQUE = 128  # alpha at or above this counts as an opaque pixel


def hex_rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def oklab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    def lin(c: int) -> float:
        v = c / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(c) for c in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (x ** (1 / 3) for x in (l, m, s))
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


PAL_RGB = [hex_rgb(h) for h in PALETTE]
PAL_LAB = [oklab(c) for c in PAL_RGB]


def snap(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    lab = oklab(rgb)
    best = min(range(len(PAL_LAB)), key=lambda i: sum((a - b) ** 2 for a, b in zip(lab, PAL_LAB[i])))
    return PAL_RGB[best]


def reduce(src: Image.Image) -> Image.Image:
    im = src.convert("RGBA")
    assert im.size == (32, 32), im.size
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            block = [im.getpixel((2 * x + dx, 2 * y + dy)) for dy in (0, 1) for dx in (0, 1)]
            opaque = [p[:3] for p in block if p[3] >= OPAQUE]
            if len(opaque) < 2:
                continue
            counts = Counter(opaque)
            top = max(counts.values())
            tied = [c for c, n in counts.items() if n == top]
            colour = min(tied, key=lambda c: oklab(c)[0])  # ties go to the darker colour
            out.putpixel((x, y), (*snap(colour), 255))
    return out


def main() -> None:
    for icon in ICONS:
        for option, pattern in SOURCES:
            src = HERE / pattern.format(id=icon)
            dst = src.parent / f"{icon}-16.png"
            reduce(Image.open(src)).save(dst)
            print(f"{option}/{icon}: {src.relative_to(HERE)} -> {dst.relative_to(HERE)}")


if __name__ == "__main__":
    main()
