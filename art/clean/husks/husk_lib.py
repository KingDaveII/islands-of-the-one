"""ART: small pixel tools for drawing the Husks' frames by hand from one base drawing (peeling.py,
nutshell.py). A sprite is a list of rows of RGBA tuples; (0, 0, 0, 0) is transparent. Nothing here
scales or filters: frames are made by moving, repeating, removing and recolouring whole pixels.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]
CLEAR = (0, 0, 0, 0)


def rgb(k):
    h = T[k]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


OUTLINE = rgb("hollow-deep")
CORE = rgb("husk-core")
LIGHT = rgb("hollow-light")
SHELL = rgb("husk-shell")
DUSK = rgb("hollow-dusk")
LAV = rgb("hollow-lavender")
PINK = rgb("signal-telegraph")
PINK_DARK = rgb("signal-telegraph-dark")
AMBER = rgb("spark-amber")
EMBER = rgb("spark-ember")


def load(path, box=None):
    im = Image.open(path).convert("RGBA")
    if box is None:
        box = im.getbbox()
    im = im.crop(box)
    return [[im.getpixel((x, y)) for x in range(im.width)] for y in range(im.height)]


def size(g):
    return (len(g[0]) if g else 0), len(g)


def blank(w, h):
    return [[CLEAR] * w for _ in range(h)]


def copy(g):
    return [row[:] for row in g]


def opaque(c):
    return c[3] > 0


def dup_cols(g, at, n):
    """Repeat column `at` n more times (a horizontal stretch through that column)."""
    return [row[:at] + [row[at]] * n + row[at:] for row in g]


def drop_cols(g, cols):
    cols = set(cols)
    return [[c for x, c in enumerate(row) if x not in cols] for row in g]


def dup_rows(g, at, n):
    return g[:at] + [g[at][:] for _ in range(n)] + g[at:]


def drop_rows(g, rows):
    rows = set(rows)
    return [r[:] for y, r in enumerate(g) if y not in rows]


def recolour(g, mapping, keep=None):
    """Recolour by colour; `keep(x, y)` returning True leaves a pixel alone."""
    out = copy(g)
    for y, row in enumerate(out):
        for x, c in enumerate(row):
            if opaque(c) and c in mapping and not (keep and keep(x, y)):
                out[y][x] = mapping[c]
    return out


def erase(g, keep):
    """Keep only the pixels where keep(x, y) is True."""
    return [[c if keep(x, y) else CLEAR for x, c in enumerate(row)] for y, row in enumerate(g)]


def reoutline(g, outline=OUTLINE, outlines=(OUTLINE,)):
    """Every opaque pixel 4-adjacent to transparency (or the grid's edge) that is not an outline colour
    becomes the outline, so a cut edge is closed like the drawn ones."""
    w, h = size(g)
    out = copy(g)
    for y in range(h):
        for x in range(w):
            c = g[y][x]
            if not opaque(c) or c in outlines:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if not (0 <= X < w and 0 <= Y < h) or not opaque(g[Y][X]):
                    out[y][x] = outline
                    break
    return out


def crumbs(g, min_px=3):
    """Remove opaque islands smaller than min_px (4-connected)."""
    w, h = size(g)
    seen = set()
    out = copy(g)
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not opaque(g[y][x]):
                continue
            stack, comp = [(x, y)], []
            seen.add((x, y))
            while stack:
                a, b = stack.pop()
                comp.append((a, b))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = a + dx, b + dy
                    if 0 <= X < w and 0 <= Y < h and (X, Y) not in seen and opaque(g[Y][X]):
                        seen.add((X, Y))
                        stack.append((X, Y))
            if len(comp) < min_px:
                for a, b in comp:
                    out[b][a] = CLEAR
    return out


def paste(dst, src, x0, y0):
    """Draw src over dst at (x0, y0); transparent pixels of src leave dst alone."""
    dw, dh = size(dst)
    for y, row in enumerate(src):
        for x, c in enumerate(row):
            X, Y = x0 + x, y0 + y
            if opaque(c) and 0 <= X < dw and 0 <= Y < dh:
                dst[Y][X] = c
    return dst


def ring(r, colour=CORE, outline=OUTLINE, gaps=None):
    """A ring of light: a 1 px circle of `colour` of radius r, with the outline inside and outside it.
    `gaps(angle_index)` may drop some of its pixels (a breaking ring)."""
    n = 2 * r + 5
    g = blank(n, n)
    c = n // 2
    pts = []
    for y in range(n):
        for x in range(n):
            d2 = (x - c) ** 2 + (y - c) ** 2
            if (r - 0.5) ** 2 <= d2 < (r + 0.5) ** 2:
                pts.append((x, y))
    for k, (x, y) in enumerate(sorted(pts)):
        if gaps and gaps(x - c, y - c):
            continue
        g[y][x] = colour
    for y in range(n):
        for x in range(n):
            if g[y][x] == colour:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < n and 0 <= Y < n and not opaque(g[Y][X]):
                        g[Y][X] = outline
    return g


def on_canvas(g, cx, foot, canvas=64):
    """Place a sprite on a 64x64 canvas centred on column cx, its lowest opaque row on `foot`."""
    img = Image.new("RGBA", (canvas, canvas), CLEAR)
    w, h = size(g)
    low = max((y for y in range(h) for x in range(w) if opaque(g[y][x])), default=h - 1)
    x0 = cx - w // 2
    y0 = foot - low
    for y in range(h):
        for x in range(w):
            if opaque(g[y][x]):
                img.putpixel((x0 + x, y0 + y), g[y][x])
    return img


def at(g, x0, y0, canvas=64):
    img = Image.new("RGBA", (canvas, canvas), CLEAR)
    w, h = size(g)
    for y in range(h):
        for x in range(w):
            if opaque(g[y][x]) and 0 <= x0 + x < canvas and 0 <= y0 + y < canvas:
                img.putpixel((x0 + x, y0 + y), g[y][x])
    return img


def save(out_dir, anim, frames):
    d = Path(out_dir) / anim
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("frame-*.png"):
        old.unlink()
    for i, img in enumerate(frames):
        img.save(d / f"frame-{i}.png")


def sparkglass(glint=False):
    """A Sparkglass chip, 9 x 11: a standing six-sided amber crystal, its left facet lit, its right shaded.
    The Husks' drop frames and the pickup (prop-sparkglass) draw this same chip; `glint` puts a paper
    sparkle on its lit facet (the pickup's second frame)."""
    k = {".": CLEAR, "o": OUTLINE, "A": AMBER, "e": EMBER, "L": LIGHT, "P": rgb("choir-paper"), "G": rgb("choir-gold")}
    rows = [
        "....o....",
        "...oLo...",
        "..oLLGo..",
        ".oLLAGeo.",
        ".oLAAGeo.",
        ".oLAAGeo.",
        ".oLAAGeo.",
        ".oLAAGeo.",
        "..oAAeo..",
        "...oeo...",
        "....o....",
    ]
    if glint:
        rows[1] = "...oPo..."
        rows[2] = "..oPLGo.."
        rows[3] = ".oPLAGeo."
    return [[k[ch] for ch in r] for r in rows]
