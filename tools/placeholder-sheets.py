#!/usr/bin/env python3
"""
Placeholder sprite sheets for docs/design/sprites.md.

Writes `packages/shared/assets/sprites/<name>.png` + `.json` for kindled-ash,
husk-peeling and husk-nutshell: the frame grid, facings, animation lists and
JSON contract of the spec, drawn as placeholders (a 16x24 body in the
Remembrance's outfit colour, a Husk's shape in the Husk palette, a 1 px facing
tick and the frame name in tiny text where it fits). Telegraph frames are
pre-tinted. Every pixel is a palette token (packages/shared/data/palette.json).

Re-run after changing this file or the palette:

    python3 tools/placeholder-sheets.py

Needs Pillow (PIL). The sheets are committed; the engine never runs this.
A hand-drawn sheet replaces the PNG + JSON pair without any engine change.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
PALETTE = json.loads((ROOT / "packages/shared/data/palette.json").read_text())
OUT = ROOT / "packages/shared/assets/sprites"
VERSION = "1"

TOK = PALETTE["tokens"]


def rgb(hex_: str) -> tuple[int, int, int, int]:
    h = hex_.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


C = {name: rgb(v) for name, v in TOK.items()}
TRANSPARENT = (0, 0, 0, 0)

FACINGS8 = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]
FACINGS4 = ["S", "E", "N", "W"]
FACINGS2 = ["S", "E"]
# Unit step of a facing, screen y down.
STEP = {
    "S": (0, 1), "SE": (1, 1), "E": (1, 0), "NE": (1, -1),
    "N": (0, -1), "NW": (-1, -1), "W": (-1, 0), "SW": (-1, 1),
}

# sprites.md §4, Kindled: name, frames, fps, loop (-1 loop, 0 once), hold, facings.
KINDLED_ANIMS = [
    ("idle", 2, 2, -1, False, FACINGS8),
    ("walk", 6, 10, -1, False, FACINGS8),
    ("dodge", 4, 16, 0, False, FACINGS8),
    ("light_1", 3, 15, 0, False, FACINGS8),
    ("light_2", 3, 15, 0, False, FACINGS8),
    ("light_3", 3, 15, 0, False, FACINGS8),
    ("heavy_charge", 3, 12, 0, True, FACINGS8),
    ("heavy_thrust", 2, 20, 0, False, FACINGS8),
    ("heavy_hold", 1, 0, 0, True, FACINGS8),
    ("heavy_recover", 2, 12, 0, False, FACINGS8),
    ("haul_throw", 2, 15, 0, True, FACINGS8),
    ("haul_pull", 2, 12, -1, False, FACINGS8),
    ("haul_slide", 2, 12, -1, False, FACINGS8),
    ("hit", 1, 0, 0, True, FACINGS4),
    ("death", 6, 8, 0, True, FACINGS4),
    ("carry_idle", 2, 2, -1, False, FACINGS4),
    ("carry_walk", 6, 10, -1, False, FACINGS4),
    ("sit", 1, 0, 0, True, FACINGS2),
]

# sprites.md §4, Peeling and Nutshell: name, frames, fps, loop, hold.
PEELING_ANIMS = [
    ("idle", 2, 3, -1, False),
    ("telegraph", 2, 8, 0, True),
    ("lunge", 3, 15, 0, False),
    ("hit", 1, 0, 0, True),
    ("chipped", 1, 0, 0, True),
    ("death", 4, 10, 0, True),
    ("drop", 1, 0, 0, True),
]
NUTSHELL_ANIMS = [
    ("idle", 2, 2, -1, False),
    ("telegraph", 2, 8, 0, True),
    ("roll", 4, 12, -1, False),
    ("hit", 1, 0, 0, True),
    ("chipped_outer", 1, 0, 0, True),
    ("chipped_inner", 1, 0, 0, True),
    ("regrow", 3, 6, 0, True),
    ("death", 4, 10, 0, True),
    ("drop", 1, 0, 0, True),
]

# A 3x5 pixel font for the frame names (letters are one case).
FONT = {
    "a": ["010", "101", "111", "101", "101"],
    "b": ["110", "101", "110", "101", "110"],
    "c": ["011", "100", "100", "100", "011"],
    "d": ["110", "101", "101", "101", "110"],
    "e": ["111", "100", "110", "100", "111"],
    "f": ["111", "100", "110", "100", "100"],
    "g": ["011", "100", "101", "101", "011"],
    "h": ["101", "101", "111", "101", "101"],
    "i": ["111", "010", "010", "010", "111"],
    "j": ["001", "001", "001", "101", "010"],
    "k": ["101", "101", "110", "101", "101"],
    "l": ["100", "100", "100", "100", "111"],
    "m": ["101", "111", "111", "101", "101"],
    "n": ["110", "101", "101", "101", "101"],
    "o": ["010", "101", "101", "101", "010"],
    "p": ["110", "101", "110", "100", "100"],
    "q": ["010", "101", "101", "110", "011"],
    "r": ["110", "101", "110", "101", "101"],
    "s": ["011", "100", "010", "001", "110"],
    "t": ["111", "010", "010", "010", "010"],
    "u": ["101", "101", "101", "101", "111"],
    "v": ["101", "101", "101", "101", "010"],
    "w": ["101", "101", "111", "111", "101"],
    "x": ["101", "101", "010", "101", "101"],
    "y": ["101", "101", "010", "010", "010"],
    "z": ["111", "001", "010", "100", "111"],
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "011", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    "_": ["000", "000", "000", "000", "111"],
}
CHAR_W = 4  # 3 px glyph + 1 px gap


class Canvas:
    """One cell being drawn: pixel writes clipped to the cell."""

    def __init__(self, img: Image.Image, ox: int, oy: int, w: int, h: int):
        self.img, self.ox, self.oy, self.w, self.h = img, ox, oy, w, h

    def px(self, x: int, y: int, color: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img.putpixel((self.ox + x, self.oy + y), color)

    def rect(self, x: int, y: int, w: int, h: int, color) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, color)

    def outlined_rect(self, x: int, y: int, w: int, h: int, fill, outline) -> None:
        self.rect(x, y, w, h, outline)
        self.rect(x + 1, y + 1, w - 2, h - 2, fill)

    def disc(self, cx: int, cy: int, r: int, color) -> None:
        for dy in range(-r, r + 1):
            s = span(r, dy)
            self.rect(cx - s, cy + dy, 2 * s + 1, 1, color)

    def ring(self, cx: int, cy: int, r: int, color, gaps: set[int] | None = None) -> None:
        """A 1 px circle; `gaps` lists octants (0-7) left out (chipped shells)."""
        for dy in range(-r, r + 1):
            ho = span(r, dy)
            hi = span(r - 1, dy) if abs(dy) <= r - 1 else -1
            for dx in range(-ho, ho + 1):
                if -hi <= dx <= hi:
                    continue
                if gaps and octant(dx, dy) in gaps:
                    continue
                self.px(cx + dx, cy + dy, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color) -> None:
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), color)

    def text(self, x: int, y: int, s: str, color) -> bool:
        """Draws `s` if it fits the cell width from x; returns whether it did."""
        if x + len(s) * CHAR_W - 1 > self.w:
            return False
        for i, ch in enumerate(s.lower()):
            glyph = FONT.get(ch)
            if not glyph:
                continue
            for row, bits in enumerate(glyph):
                for col, bit in enumerate(bits):
                    if bit == "1":
                        self.px(x + i * CHAR_W + col, y + row, color)
        return True


def span(r: int, dy: int) -> int:
    v = r * r - dy * dy
    if v < 0:
        return -1
    return int((v ** 0.5) + 0.35)


def octant(dx: int, dy: int) -> int:
    import math

    a = math.atan2(dy, dx)
    return int(((a + math.pi) / (2 * math.pi)) * 8) % 8


def abbreviate(name: str) -> str:
    return name.replace("heavy", "hvy").replace("chipped", "chip").replace("telegraph", "telegr")


# --- Kindled ----------------------------------------------------------------

OUTFIT = rgb(PALETTE["remembranceOutfit"]["ash"])
SKIN = rgb(PALETTE["clay"]["tones"][PALETTE["clay"]["drawn"]]["skin"])
SKIN_SHADE = rgb(PALETTE["clay"]["tones"][PALETTE["clay"]["drawn"]]["shade"])
OUTLINE = C["dream-night"]
INK = C["hollow-light"]  # the facing tick, labels, the blade
FRECKLE = C["spark-amber"]
SHELL, SHELL_SHADE, HUSK_OUTLINE, CORE = C["husk-shell"], C["hollow-lavender"], C["hollow-deep"], C["husk-core"]
CRACK = C["hollow-below"]
TELEGRAPH, TELEGRAPH_DARK = C["signal-telegraph"], C["signal-telegraph-dark"]
SPARK, SPARK_DEEP = C["spark-amber"], C["spark-ember"]

BODY_W, BODY_H = 16, 24


def kindled_body(c: Canvas, facing: str, cx: int, feet: int, w: int = BODY_W, h: int = BODY_H,
                 freckles: int = 3, head: bool = True) -> None:
    """A body rectangle `w`x`h` standing on `feet` (the origin), centred on cx, outlined."""
    x = cx - w // 2
    y = feet - h
    c.outlined_rect(x, y, w, h, OUTFIT, OUTLINE)
    if head and h >= 12:
        hh = max(3, min(7, h // 3))
        c.rect(x + 1, y + 1, w - 2, hh, SKIN)
        c.rect(x + 1, y + hh, w - 2, 1, SKIN_SHADE)
        c.rect(x + 1, y + 1, 1, hh, SKIN_SHADE)
        # Freckles never swap; the last death frames put them out one by one.
        for i in range(freckles):
            c.px(x + 3 + i * 3, y + 3 + (i % 2), FRECKLE)
    # The 1 px facing tick on the outline.
    sx, sy = STEP[facing]
    tx = x + (w // 2 if sx == 0 else (w - 1 if sx > 0 else 0))
    ty = y + (h // 2 if sy == 0 else (h - 1 if sy > 0 else 0))
    c.px(tx, ty, INK)


def blade(c: Canvas, facing: str, cx: int, feet: int, length: int) -> None:
    """A straight blade from the leading hand along the facing (the right hand: east of the body)."""
    sx, sy = STEP[facing]
    hx = cx + (5 if sx >= 0 else -5) + sx * 3
    hy = feet - 12 + sy * 2
    c.line(hx, hy, hx + sx * length, hy + sy * length, OUTLINE)
    c.line(hx, hy, hx + sx * max(0, length - 1), hy + sy * max(0, length - 1), INK)


def draw_kindled(c: Canvas, anim: str, facing: str, n: int, origin: tuple[int, int]) -> None:
    ox, oy = origin
    sx, sy = STEP[facing]
    if anim in ("idle", "carry_idle"):
        kindled_body(c, facing, ox, oy, h=BODY_H - (1 if n == 1 else 0))
    elif anim in ("walk", "carry_walk"):
        bob = -1 if n in (1, 4) else 0
        kindled_body(c, facing, ox, oy + bob)
        # Legs: alternate a 1 px gap under the body.
        c.px(ox - 2 + (n % 2) * 3, oy - 1, OUTLINE)
    elif anim == "dodge":
        if n == 0:
            kindled_body(c, facing, ox, oy, h=18)
        elif n in (1, 2):
            # The roll: the body is a 12x12 ball.
            c.outlined_rect(ox - 6, oy - 12, 12, 12, OUTFIT, OUTLINE)
            c.px(ox - 1 + sx * 4, oy - 7 + sy * 4, INK)
            c.rect(ox - 3 + (n - 1) * 2, oy - 9, 2, 2, SKIN)
        else:
            kindled_body(c, facing, ox, oy, h=22)
    elif anim.startswith("light_"):
        back = (-2, 2, 0)[n]
        kindled_body(c, facing, ox + sx * back, oy + sy * back)
        if n == 1:
            blade(c, facing, ox + sx * back, oy + sy * back, 8)
        elif n == 2 and anim == "light_3":
            kindled_body(c, facing, ox, oy + 1, h=22)
    elif anim == "heavy_charge":
        back = (1, 2, 2)[n]
        kindled_body(c, facing, ox - sx * back, oy - sy * back)
        blade(c, facing, ox - sx * back, oy - sy * back, 4)
    elif anim == "heavy_thrust":
        kindled_body(c, facing, ox + sx * (1 + n), oy + sy * (1 + n))
        blade(c, facing, ox + sx * (1 + n), oy + sy * (1 + n), 10 + 12 * n)
    elif anim == "heavy_hold":
        kindled_body(c, facing, ox + sx, oy + sy)
        blade(c, facing, ox + sx, oy + sy, 22)
    elif anim == "heavy_recover":
        kindled_body(c, facing, ox, oy)
        blade(c, facing, ox, oy, 12 - 6 * n)
    elif anim == "haul_throw":
        kindled_body(c, facing, ox, oy)
        # The arm out; the chain and hook come from hookblade-fx.
        c.line(ox + sx * 7, oy - 12 + sy * 2, ox + sx * (9 + 4 * n), oy - 12 + sy * (4 + 2 * n), SKIN)
    elif anim == "haul_pull":
        kindled_body(c, facing, ox - sx * n, oy - sy * n)
        c.rect(ox - 3 + sx * 6, oy - 12, 2, 2, SKIN)
    elif anim == "haul_slide":
        # Dragged along the chain: leaning into it, the cloak streaming back.
        kindled_body(c, facing, ox + sx * (2 + n), oy)
        c.line(ox - sx * 6, oy - 10, ox - sx * (10 + 2 * n), oy - 8 + n, OUTFIT)
    elif anim == "hit":
        kindled_body(c, facing, ox - sx, oy - sy)
    elif anim == "death":
        # The fall: the body tips over, then the freckles go out one by one.
        w = (16, 18, 22, 26, 28, 28)[n]
        h = (24, 20, 14, 8, 6, 6)[n]
        kindled_body(c, facing, ox, oy, w=w, h=h, freckles=max(0, 5 - n), head=n < 3)
    elif anim == "sit":
        kindled_body(c, facing, ox, oy, h=18)
    if anim.startswith("carry_"):
        # Both arms round the Glowing Shell (hour two): a shell in front of the chest.
        c.outlined_rect(ox - 3 + sx * 3, oy - 12 + max(0, sy) * 2, 6, 6, SHELL, HUSK_OUTLINE)
        c.px(ox + sx * 3, oy - 10 + max(0, sy) * 2, CORE)


# --- Husks ------------------------------------------------------------------


def peeling_shell(c: Canvas, cx: int, cy: int, rx: int, ry: int, fill, shade, outline) -> None:
    """A radial blob rx*2+1 by ry*2+1: fill, a dithered shade, the curl, the outline."""
    for dy in range(-ry - 1, ry + 2):
        for dx in range(-rx - 1, rx + 2):
            d = (dx * dx) / ((rx + 1) ** 2) + (dy * dy) / ((ry + 1) ** 2)
            inner = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
            if d > 1:
                continue
            if inner > 1:
                c.px(cx + dx, cy + dy, outline)
            elif (dx + dy) % 2 == 0 and inner > 0.5:
                c.px(cx + dx, cy + dy, shade)
            else:
                c.px(cx + dx, cy + dy, fill)
    # The curl.
    c.px(cx + 1, cy - 1, shade)
    c.px(cx + 2, cy, shade)
    c.px(cx + 1, cy + 1, shade)


def core_dot(c: Canvas, cx: int, cy: int, ring_color=HUSK_OUTLINE) -> None:
    c.rect(cx - 1, cy - 1, 3, 3, ring_color)
    c.px(cx, cy, CORE)


def draw_peeling(c: Canvas, anim: str, n: int, origin: tuple[int, int]) -> None:
    ox, oy = origin
    cx, cy = ox, oy - 4  # a 12x9 body standing on the origin
    if anim == "idle":
        peeling_shell(c, cx, cy - (1 if n == 1 else 0), 5, 3 + (1 if n == 1 else 0), SHELL, SHELL_SHADE, HUSK_OUTLINE)
    elif anim == "telegraph":
        # Pre-tinted: pulled back a pixel, in the telegraph colours.
        peeling_shell(c, cx - n, cy, 5, 3, TELEGRAPH, TELEGRAPH_DARK, TELEGRAPH_DARK)
        core_dot(c, cx - n, cy, TELEGRAPH_DARK)
    elif anim == "lunge":
        rx, ry, dx = ((7, 2, 2), (6, 3, 3), (5, 3, 1))[n]
        peeling_shell(c, cx + dx, cy, rx, ry, SHELL, SHELL_SHADE, HUSK_OUTLINE)
    elif anim == "hit":
        peeling_shell(c, cx, cy, 5, 3, SHELL, SHELL_SHADE, HUSK_OUTLINE)
    elif anim == "chipped":
        # The shell with pixels missing (chips are engine particles); the core shows.
        peeling_shell(c, cx, cy, 5, 3, SHELL, SHELL_SHADE, HUSK_OUTLINE)
        for dx, dy in ((-4, -2), (-3, -3), (2, -3), (4, 1), (5, 0), (-5, 1), (0, 3), (1, 3)):
            c.px(cx + dx, cy + dy, TRANSPARENT)
        core_dot(c, cx, cy)
    elif anim == "death":
        # The shell parts, the core flares as a ring.
        spread = (1, 3, 5, 7)[n]
        for i, (dx, dy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1))):
            c.outlined_rect(cx + dx * spread - 1, cy + dy * spread - 1 + (i % 2), 3, 2, SHELL, HUSK_OUTLINE)
        if n < 3:
            c.ring(cx, cy, 1 + n, CORE)
        else:
            c.ring(cx, cy, 4, HUSK_OUTLINE)
    elif anim == "drop":
        # The Sparkglass chip on the floor.
        c.outlined_rect(ox - 2, oy - 6, 5, 7, SPARK, HUSK_OUTLINE)
        c.px(ox, oy - 2, SPARK_DEEP)
        c.px(ox + 1, oy - 3, SPARK_DEEP)
        c.px(ox - 1, oy - 4, INK)


def nutshell_shell(c: Canvas, cx: int, cy: int, r: int, fill, shade, outline, inner, gaps=None) -> None:
    c.disc(cx, cy, r, outline)
    c.disc(cx, cy, r - 1, fill)
    for dy in range(-r + 1, r):
        for dx in range(-r + 1, r):
            if dx * dx + dy * dy > (r - 3) ** 2 and dx * dx + dy * dy < (r - 1) ** 2 and (dx + dy) % 2 == 0:
                c.px(cx + dx, cy + dy, shade)
    if inner > 0:
        c.ring(cx, cy, inner, outline, gaps)
    if gaps:
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                d2 = dx * dx + dy * dy
                if inner * inner < d2 <= r * r and octant(dx, dy) in gaps:
                    c.px(cx + dx, cy + dy, TRANSPARENT)


def draw_nutshell(c: Canvas, anim: str, n: int, origin: tuple[int, int]) -> None:
    ox, oy = origin
    cx, cy = ox, oy - 12  # a 24x24 shell standing on the origin
    R, INNER = 11, 6
    if anim == "idle":
        nutshell_shell(c, cx, cy - (1 if n == 1 else 0), R, SHELL, SHELL_SHADE, HUSK_OUTLINE, INNER)
        core_dot(c, cx, cy - (1 if n == 1 else 0))
    elif anim == "telegraph":
        nutshell_shell(c, cx, cy + n, R, TELEGRAPH, TELEGRAPH_DARK, TELEGRAPH_DARK, INNER)
        core_dot(c, cx, cy + n, TELEGRAPH_DARK)
    elif anim == "roll":
        squash = 1 if n % 2 == 1 else 0
        nutshell_shell(c, cx, cy + squash, R - squash, SHELL, SHELL_SHADE, HUSK_OUTLINE, INNER)
        core_dot(c, cx, cy + squash)
        # A mark that turns with the roll.
        mx, my = ((0, -8), (8, 0), (0, 8), (-8, 0))[n]
        c.rect(cx + mx - 1, cy + squash + my - 1, 3, 3, CRACK)
    elif anim == "hit":
        nutshell_shell(c, cx, cy, R, SHELL, SHELL_SHADE, HUSK_OUTLINE, INNER)
        core_dot(c, cx, cy)
    elif anim == "chipped_outer":
        # First poise bar broken: the outer shell is gone, the inner one holds.
        c.disc(cx, cy, INNER + 1, HUSK_OUTLINE)
        c.disc(cx, cy, INNER, SHELL)
        c.ring(cx, cy, INNER - 2, SHELL_SHADE)
        core_dot(c, cx, cy)
        for a in range(0, 8):
            dx, dy = ((R, 0), (8, 8), (0, R), (-8, 8), (-R, 0), (-8, -8), (0, -R), (8, -8))[a]
            c.outlined_rect(cx + dx - 1, cy + dy - 1, 3, 2, SHELL, HUSK_OUTLINE)
    elif anim == "chipped_inner":
        # Second bar broken: the core exposed, ringed.
        c.disc(cx, cy, 4, HUSK_OUTLINE)
        c.disc(cx, cy, 3, CORE)
        c.px(cx, cy, INK)
        for a in range(0, 8):
            dx, dy = ((R, 0), (8, 8), (0, R), (-8, 8), (-R, 0), (-8, -8), (0, -R), (8, -8))[a]
            c.outlined_rect(cx + dx - 1, cy + dy - 1, 3, 2, SHELL, HUSK_OUTLINE)
    elif anim == "regrow":
        # The inner shell closing back over the core.
        c.disc(cx, cy, 4, HUSK_OUTLINE)
        c.disc(cx, cy, 3, CORE)
        gaps = ({0, 1, 2, 3, 4, 5}, {0, 1, 2}, set())[n]
        c.ring(cx, cy, INNER, HUSK_OUTLINE, gaps)
        c.ring(cx, cy, INNER - 1, SHELL, gaps)
    elif anim == "death":
        spread = (2, 5, 8, 11)[n]
        for i, (dx, dy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1), (-1, 0), (1, 0))):
            c.outlined_rect(cx + dx * spread - 1, cy + dy * spread - 1 + (i % 2), 4, 3, SHELL, HUSK_OUTLINE)
        if n < 3:
            c.ring(cx, cy, 2 + 2 * n, CORE)
        else:
            c.ring(cx, cy, 8, HUSK_OUTLINE)
    elif anim == "drop":
        c.outlined_rect(ox - 3, oy - 8, 7, 9, SPARK, HUSK_OUTLINE)
        c.rect(ox, oy - 3, 2, 2, SPARK_DEEP)
        c.px(ox + 2, oy - 5, SPARK_DEEP)
        c.px(ox - 1, oy - 6, INK)


# --- Sheets -----------------------------------------------------------------


def frame_entry(x: int, y: int, w: int, h: int, origin: tuple[int, int]) -> dict:
    return {
        "frame": {"x": x, "y": y, "w": w, "h": h},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
        "sourceSize": {"w": w, "h": h},
        "anchor": {"x": origin[0] / w, "y": origin[1] / h},
    }


def build(name: str, cell: tuple[int, int], origin: tuple[int, int], columns: int, frames: list[tuple[str, str]],
          anims: dict, draw, facings: list[str] | None, palette: dict | None) -> None:
    """`frames`: (frame name, anim name) in sheet order; `draw(canvas, frame)` draws one cell."""
    cw, ch = cell
    rows = (len(frames) + columns - 1) // columns
    img = Image.new("RGBA", (columns * cw, rows * ch), TRANSPARENT)
    json_frames = {}
    for i, (frame, anim) in enumerate(frames):
        col, row = i % columns, i // columns
        c = Canvas(img, col * cw, row * ch, cw, ch)
        draw(c, frame, anim)
        json_frames[frame] = frame_entry(col * cw, row * ch, cw, ch, origin)
    meta = {
        "image": f"{name}.png",
        "size": {"w": img.width, "h": img.height},
        "scale": "1",
        "format": "RGBA8888",
        "app": "placeholder",
        "version": VERSION,
        "cell": {"w": cw, "h": ch},
        "origin": {"x": origin[0], "y": origin[1]},
    }
    if facings:
        meta["facings"] = facings
    data = {"frames": json_frames, "meta": meta, "anims": anims}
    if palette:
        data["palette"] = palette
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png", optimize=True)
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=1) + "\n")
    print(f"{name}: {img.width}x{img.height}, {len(frames)} frames, {len(anims)} anims")


def anim_def(frames: list[str], fps: int, loop: int, hold: bool) -> dict:
    d = {"frames": frames, "frameRate": fps, "repeat": loop}
    if hold:
        d["hold"] = True
    return d


def build_kindled(remembrance: str) -> None:
    cell, origin = (48, 40), (24, 36)
    frames: list[tuple[str, str]] = []
    anims: dict = {}
    for anim, count, fps, loop, hold, facings in KINDLED_ANIMS:
        for facing in facings:
            names = [f"{anim}_{facing}_{i}" for i in range(count)]
            anims[f"{anim}_{facing}"] = anim_def(names, fps, loop, hold)
            frames.extend((fr, anim) for fr in names)

    def draw(c: Canvas, frame: str, anim: str) -> None:
        rest = frame[len(anim) + 1:]
        facing, n = rest.rsplit("_", 1)
        c.text(1, 1, abbreviate(anim), INK)
        c.text(1, 7, f"{facing}_{n}", INK)
        draw_kindled(c, anim, facing, int(n), origin)

    clay = PALETTE["clay"]
    drawn = clay["tones"][clay["drawn"]]
    swaps = {
        tone: {drawn["skin"]: t["skin"], drawn["shade"]: t["shade"]}
        for tone, t in clay["tones"].items()
        if tone != clay["drawn"]
    }
    build(f"kindled-{remembrance}", cell, origin, 16, frames, anims, draw, FACINGS8,
          {"drawn": clay["drawn"], "swaps": swaps})


def build_husk(name: str, cell: tuple[int, int], origin: tuple[int, int], table: list, draw_one) -> None:
    frames: list[tuple[str, str]] = []
    anims: dict = {}
    for anim, count, fps, loop, hold in table:
        names = [f"{anim}_{i}" for i in range(count)]
        anims[anim] = anim_def(names, fps, loop, hold)
        frames.extend((fr, anim) for fr in names)

    def draw(c: Canvas, frame: str, anim: str) -> None:
        n = int(frame[len(anim) + 1:])
        c.text(1, 1, abbreviate(anim), INK)
        c.text(1, cell[1] - 5, str(n), INK)
        draw_one(c, anim, n, origin)

    build(name, cell, origin, 8, frames, anims, draw, None, None)


def main() -> None:
    build_kindled("ash")
    build_husk("husk-peeling", (24, 24), (12, 18), PEELING_ANIMS, draw_peeling)
    build_husk("husk-nutshell", (40, 40), (20, 34), NUTSHELL_ANIMS, draw_nutshell)


if __name__ == "__main__":
    main()
