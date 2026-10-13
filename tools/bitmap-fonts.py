#!/usr/bin/env python3
"""
Bitmap fonts for the client's text (M1 task 8).

Rasterizes Silkscreen and Tiny5 (the woff2 files in apps/client/public/fonts,
both SIL OFL) at 8 px, with FreeType's monochrome renderer (no antialiasing,
no partial pixels), into one atlas PNG (white on transparent) plus one JSON
contract per face in packages/shared/assets/fonts. The client draws every
piece of text from these atlases (Phaser BitmapText), so the glyph pixels no
longer depend on the browser's font rasterizer; the sizes 16 and 24 are the
8 px glyphs scaled by a whole number.

Charset: printable ASCII plus every character the game data (rooms.json,
tuning.json, controls.json) and the client's scene strings use. A character
a face has no glyph for fails the run.

The outlines are rendered unhinted (the faces ship ttfautohint instructions,
which move Silkscreen's punctuation off its pixel grid at 8 px), so what the
atlas holds is the font's own pixel grid.

Checks, per glyph: no partial alpha (by construction, and asserted), a
whole-pixel advance, and the same pixels at 8 px as the 16 px rasterization
halved (so the glyph is on the font's own pixel grid, not a rounding
accident). A contact sheet for ART (every glyph at 4x with its character)
goes to docs/screenshots/m1-task8/font-sheets.png.

Re-runnable, deterministic:

    pip install pillow fonttools brotli
    python3 tools/bitmap-fonts.py          # writes the assets and the sheet
    python3 tools/bitmap-fonts.py --check  # fails if the committed assets differ
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC_FONTS = ROOT / "apps/client/public/fonts"
OUT = ROOT / "packages/shared/assets/fonts"
SHEET = ROOT / "docs/screenshots/m1-task8/font-sheets.png"
SIZE = 8

FACES = [
    # (family, source woff2, OFL file, output stem)
    ("Silkscreen", "Silkscreen-Regular.woff2", "Silkscreen-OFL.txt", "silkscreen-8px"),
    ("Tiny5", "Tiny5-Regular.woff2", "Tiny5-OFL.txt", "tiny5-8px"),
]

# Where the strings live that the fonts must cover.
DATA_FILES = [
    ROOT / "packages/shared/data/rooms.json",
    ROOT / "packages/shared/data/tuning.json",
    ROOT / "packages/shared/data/controls.json",
]
# Scene, HUD and input strings (not ui/: those are DOM dev panels in the browser's own fonts).
SOURCE_DIRS = [ROOT / "apps/client/src/scenes", ROOT / "apps/client/src/render", ROOT / "apps/client/src/game"]

# Design-system colors for the contact sheet (hollow-deep panel, hollow-light ink, hollow-dusk labels).
PANEL = (0x2A, 0x25, 0x40, 255)
INK = (0xF4, 0xEF, 0xE6, 255)
MUTED = (0xA9, 0x9F, 0xC4, 255)
RIM = (0x1C, 0x21, 0x47, 255)


def data_strings(value) -> set[str]:
    out: set[str] = set()
    if isinstance(value, str):
        out.update(value)
    elif isinstance(value, dict):
        for v in value.values():
            out |= data_strings(v)
    elif isinstance(value, list):
        for v in value:
            out |= data_strings(v)
    return out


STRING_LITERAL = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", re.S)
TEMPLATE_HOLE = re.compile(r"\$\{[^}]*\}")
COMMENT = re.compile(r"/\*.*?\*/|//[^\n]*", re.S)


def source_strings(path: Path) -> set[str]:
    text = COMMENT.sub("", path.read_text(encoding="utf-8"))
    out: set[str] = set()
    for m in STRING_LITERAL.finditer(text):
        lit = next(g for g in m.groups() if g is not None)
        lit = TEMPLATE_HOLE.sub("", lit)
        out.update(c for c in lit if c not in "\\")
    return out


def charset() -> list[str]:
    chars = {chr(c) for c in range(0x20, 0x7F)}
    for f in DATA_FILES:
        chars |= data_strings(json.loads(f.read_text(encoding="utf-8")))
    for d in SOURCE_DIRS:
        for f in sorted(d.rglob("*.ts")):
            if f.name.endswith(".test.ts"):
                continue
            chars |= source_strings(f)
    # Control characters never get a glyph (newlines break lines, tabs are not drawn).
    return sorted(c for c in chars if ord(c) >= 0x20 and not (0x7F <= ord(c) < 0xA0))


@dataclass
class Glyph:
    ch: str
    mask: Image.Image  # mode "1", the glyph's tight box
    xo: int  # left bearing: box x from the pen position
    yo: int  # box top from the top of the 8 px line box
    adv: int  # pen advance


def render(font: ImageFont.FreeTypeFont, ch: str, size: int) -> Image.Image:
    """The glyph, monochrome, with the pen at (size, size*2) so bearings of either sign fit."""
    im = Image.new("1", (size * 6, size * 6), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = "1"
    d.text((size, size * 2), ch, font=font, fill=1, anchor="ls")
    return im


def tight(im: Image.Image, pen_x: int, baseline: int) -> tuple[Image.Image, int, int] | None:
    """Crop to the ink. Returns (box, left from the pen, top from the baseline) or None for an empty glyph."""
    bbox = im.getbbox()
    if bbox is None:
        return None
    x0, y0, x1, y1 = bbox
    return im.crop(bbox), x0 - pen_x, y0 - baseline


def unhinted(tt: TTFont, out: Path) -> None:
    """The face as a TTF without its hinting instructions (every glyph kept), for FreeType to render the raw outlines."""
    opts = subset.Options()
    opts.hinting = False
    opts.notdef_outline = True
    opts.layout_features = ["*"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=list(tt.getBestCmap().keys()))
    sub.subset(tt)
    tt.flavor = None
    tt.save(str(out))


def rasterize(family: str, path: Path, chars: list[str], tmp: Path) -> tuple[list[Glyph], int]:
    tt = TTFont(path)
    cmap = tt.getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    if missing:
        sys.exit(f"{family}: no glyph for {', '.join(f'U+{ord(c):04X} {c!r}' for c in missing)}")
    upem = tt["head"].unitsPerEm
    # The baseline row in the 8 px line box is the face's ascent (its own em box: 8 for Silkscreen, 7 for Tiny5).
    ascent = round(tt["hhea"].ascent * SIZE / upem)
    raw = tmp / f"{path.stem}-unhinted.ttf"
    unhinted(tt, raw)
    f8 = ImageFont.truetype(str(raw), SIZE)
    f16 = ImageFont.truetype(str(raw), SIZE * 2)
    glyphs: list[Glyph] = []
    for ch in chars:
        adv = f8.getlength(ch)
        if adv != int(adv):
            sys.exit(f"{family} {ch!r}: advance {adv} is not a whole pixel at {SIZE} px")
        im8 = render(f8, ch, SIZE)
        im16 = render(f16, ch, SIZE * 2)
        # 16 px halved must equal 8 px: every 2x2 block uniform and equal to the 8 px pixel.
        for y in range(im8.height):
            for x in range(im8.width):
                block = {im16.getpixel((2 * x + dx, 2 * y + dy)) for dx in (0, 1) for dy in (0, 1)}
                if len(block) != 1 or block.pop() != im8.getpixel((x, y)):
                    sys.exit(f"{family} {ch!r}: the 16 px rasterization halved differs from 8 px at ({x}, {y})")
        t = tight(im8, SIZE, SIZE * 2)
        if t is None:
            glyphs.append(Glyph(ch, Image.new("1", (0, 0)), 0, 0, int(adv)))
            continue
        box, left, top = t
        glyphs.append(Glyph(ch, box, left, ascent + top, int(adv)))
    return glyphs, ascent


def pack(glyphs: list[Glyph]) -> tuple[Image.Image, list[dict]]:
    """Rows of glyph boxes with a 1 px gutter, 16 per row; white on transparent."""
    per_row = 16
    rows = [glyphs[i : i + per_row] for i in range(0, len(glyphs), per_row)]
    row_h = [max((g.mask.height for g in r), default=0) for r in rows]
    width = max(sum(g.mask.width + 1 for g in r) + 1 for r in rows)
    height = sum(h + 1 for h in row_h) + 1
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    entries = []
    y = 1
    for r, h in zip(rows, row_h):
        x = 1
        for g in r:
            w, gh = g.mask.size
            if w and gh:
                ink = Image.new("RGBA", (w, gh), (255, 255, 255, 255))
                atlas.paste(ink, (x, y), g.mask)
            entries.append({"ch": g.ch, "x": x, "y": y, "w": w, "h": gh, "xo": g.xo, "yo": g.yo, "adv": g.adv})
            x += w + 1
        y += h + 1
    data = atlas.tobytes()
    for i in range(0, len(data), 4):
        r, g, b, a = data[i : i + 4]
        assert a in (0, 255) and (a == 0 or (r, g, b) == (255, 255, 255)), "partial alpha in the atlas"
    return atlas, entries


def draw_text(canvas: Image.Image, glyphs: dict[str, Glyph], text: str, x: int, y: int, scale: int, color) -> int:
    """Stamp `text` with its line box's top-left at (x, y), each glyph pixel a scale x scale block; returns the end x."""
    for ch in text:
        g = glyphs.get(ch)
        if g is None:
            continue
        for gy in range(g.mask.height):
            for gx in range(g.mask.width):
                if g.mask.getpixel((gx, gy)):
                    px = x + (g.xo + gx) * scale
                    py = y + (g.yo + gy) * scale
                    canvas.paste(color, (px, py, px + scale, py + scale))
        x += g.adv * scale
    return x


def contact_sheet(faces: list[tuple[str, list[Glyph], int]]) -> Image.Image:
    """Every glyph at 4x in its 8 px line box (baseline marked), the character at 1x and its code point under it; one block per face."""
    scale = 4
    cell_w, cell_h = 44, 64
    per_row = 16
    blocks = []
    tiny = ImageFont.load_default(size=10)
    for family, glyphs, ascent in faces:
        by_ch = {g.ch: g for g in glyphs}
        rows = (len(glyphs) + per_row - 1) // per_row
        block = Image.new("RGBA", (per_row * cell_w + 8, rows * cell_h + 28), PANEL)
        d = ImageDraw.Draw(block)
        draw_text(block, by_ch, f"{family} {SIZE}px, {len(glyphs)} glyphs, baseline row {ascent}", 6, 6, 2, INK)
        for i, g in enumerate(glyphs):
            cx = 4 + (i % per_row) * cell_w
            cy = 28 + (i // per_row) * cell_h
            # The 8 px line box, with its baseline, so the bearings read.
            d.rectangle((cx + 2, cy + 2, cx + 2 + 8 * scale - 1, cy + 2 + SIZE * scale - 1), fill=RIM)
            d.line((cx + 2, cy + 2 + ascent * scale, cx + 2 + 8 * scale - 1, cy + 2 + ascent * scale), fill=MUTED)
            draw_text(block, {g.ch: g}, g.ch, cx + 2, cy + 2, scale, INK)
            # The character itself (the face at 1x, or "sp" for the space) and its code point.
            if g.ch == " ":
                draw_text(block, by_ch, "sp", cx + 2, cy + 2 + SIZE * scale + 3, 1, INK)
            else:
                draw_text(block, by_ch, g.ch, cx + 2, cy + 2 + SIZE * scale + 3, 1, INK)
            d.text((cx + 2, cy + 2 + SIZE * scale + 14), f"{ord(g.ch):04X}", font=tiny, fill=MUTED)
        blocks.append(block)
    w = max(b.width for b in blocks)
    h = sum(b.height for b in blocks) + 8 * (len(blocks) - 1)
    sheet = Image.new("RGBA", (w, h), RIM)
    y = 0
    for b in blocks:
        sheet.paste(b, (0, y))
        y += b.height + 8
    return sheet


def main() -> None:
    check = "--check" in sys.argv
    chars = charset()
    faces = []
    outputs: dict[Path, bytes] = {}
    tmp = Path(tempfile.mkdtemp(prefix="bitmap-fonts-"))
    for family, src, ofl, stem in FACES:
        path = SRC_FONTS / src
        glyphs, ascent = rasterize(family, path, chars, tmp)
        atlas, entries = pack(glyphs)
        contract = {
            "$comment": f"Generated by tools/bitmap-fonts.py from {src} ({family}, SIL OFL 1.1): do not edit. "
            "The 8 px face, white on transparent; the client scales it by whole numbers. "
            "x/y/w/h: the glyph's box in the PNG; xo: box left from the pen; yo: box top from the top "
            "of the 8 px line box; adv: pen advance. No kerning.",
            "family": family,
            "source": f"apps/client/public/fonts/{src}",
            "image": f"{stem}.png",
            "size": SIZE,
            "lineHeight": SIZE,
            "baseline": ascent,
            "chars": entries,
        }
        buf = BytesIO()
        atlas.save(buf, "PNG", optimize=True)
        outputs[OUT / f"{stem}.png"] = buf.getvalue()
        outputs[OUT / f"{stem}.json"] = (json.dumps(contract, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        outputs[OUT / ofl] = (SRC_FONTS / ofl).read_bytes()
        faces.append((family, glyphs, ascent))
        print(f"{family}: {len(glyphs)} glyphs, atlas {atlas.width}x{atlas.height}, baseline row {ascent}")
    sheet = contact_sheet(faces)
    buf = BytesIO()
    sheet.save(buf, "PNG", optimize=True)
    outputs[SHEET] = buf.getvalue()

    if check:
        stale = [p for p, data in outputs.items() if not p.exists() or p.read_bytes() != data]
        if stale:
            sys.exit("stale: " + ", ".join(str(p.relative_to(ROOT)) for p in stale) + " (run tools/bitmap-fonts.py)")
        print("up to date")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    for p, data in outputs.items():
        p.write_bytes(data)
        print("wrote", p.relative_to(ROOT))


if __name__ == "__main__":
    main()
