"""ART: the plot's seal kit (M2 Task 5's "Questions for ART": the seal ring and the letters on its band, the
sigil's line per element, the signpost, the faded plot). Hand-made in code, no generations.

Writes:
- art/clean/prop-signpost/idle/frame-0.png and art/clean/prop-signpost-faded/idle/frame-0.png: the signpost
  as a prop on the default 64 x 64 cell, origin (32, 54), its board exactly where the code puts it
  (plotView.ts: a 30 x 30 board, BOARD_SIZE, on an 18 px post, SIGNPOST_H), so the sigil drawn by the code
  lands on the board's face. The faded one is the same wood gone grey.
- docs/screenshots/seal-kit/seals.png: four plots, one per element, and a faded one, as the code would draw
  them with the look below (the ring, the letters, the divider, the signpost, the sigil's line). The
  reference for MAIN's wiring; `ring()`, `letters()` and `sigil()` below are the drawing spelled out.

The look (palette.json `elements` holds the colours):
- The ring: the 2 px band as today (inset 4) in the element's colour, with a knot at each corner: a 6 x 6
  square of the colour, its middle 2 x 2 left open, centred on the band's corner.
- The letters on the band and the dividers: dark ink (worldInk, hollow-deep) on the headland, as today; the
  divider is the letter sheet's glyph (cell 27). Faded: ring, knots, letters and divider in hollow-dusk.
- The sigil's line, in the element's colour, by its style (sigil.ts SIGIL_STYLE_BY_ELEMENT):
  earth heavy-straight, 2 px; water a wave, 1 px swinging 1 px either side over 8 px; fire jagged, 1 px
  stepping out and back every 3 px; air thin-broken, 1 px in dashes of 2 with gaps of 1. The marks (the start
  circle, loops, hooks, the end bar) are drawn as today, in the element's colour. The grid stays faint
  (hollow-dusk, dotted).

    python3 art/clean/seal-kit/kit.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]


def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


PALETTE = json.loads((ROOT / "packages/shared/data/palette.json").read_text())
TOK = {k: hx(v) for k, v in PALETTE["tokens"].items()}
ELEMENTS = {k: hx(v) for k, v in PALETTE["elements"].items()}
INK, DUSK = TOK["hollow-deep"], TOK["hollow-dusk"]

# --- the signpost ---------------------------------------------------------------------------------
CELL, ORIGIN = 64, (32, 54)
BOARD = (17, 6, 30)          # x, y, size: base (32, 54) less 15 across and 48 up, as signpostBoard()
POST_W, POST_H = 6, 18


def signpost(faded=False):
    if faded:
        lit, base, shade, face, face_lit, rope = (TOK["hollow-dusk"], TOK["watcher-stone"], TOK["hollow-below"],
                                                   TOK["hollow-lavender"], TOK["hollow-lavender"], TOK["watcher-stone"])
    else:
        lit, base, shade, face, face_lit, rope = (TOK["wheel-brass"], TOK["watcher-bronze"], TOK["wheel-brass-dark"],
                                                   TOK["sleeper-soil"], TOK["hollow-light"], TOK["sleeper-ochre"])
    im = Image.new("RGBA", (CELL, CELL))
    put = im.putpixel
    bx, by, bs = BOARD
    # the post: a twisted stake, lit on its left, its foot on the soles row (53)
    x0 = ORIGIN[0] - POST_W // 2
    for y in range(by + bs, ORIGIN[1]):
        for x in range(x0, x0 + POST_W):
            put((x, y), base)
        put((x0, y), lit)
        put((x0 + POST_W - 1, y), shade)
        if (y // 3) % 2 == 0:                       # the twist: a shade notch walking down
            put((x0 + 2 + (y // 3) % 3 % 2, y), shade)
    # the board: a frame of the post's wood round a pale face where the sigil goes
    for y in range(by, by + bs):
        for x in range(bx, bx + bs):
            edge = min(x - bx, y - by, bx + bs - 1 - x, by + bs - 1 - y)
            if edge >= 2:
                put((x, y), face)
            elif x - bx < 2 or y - by < 2:
                put((x, y), lit if edge == 0 else base)
            else:
                put((x, y), shade if edge == 0 else base)
    # the face's light on its top-left inner edge
    for i in range(2, bs - 2):
        put((bx + i, by + 2), face_lit)
        put((bx + 2, by + i), face_lit)
    # the lashing where the board sits on the post
    for y in range(by + bs - 2, by + bs + 2):
        for x in range(x0 - 1, x0 + POST_W + 1):
            put((x, y), rope if (x + y) % 2 == 0 else shade)
    # the outline (hollow-deep, every prop's), on transparency; none under the foot, which stands on the soles row
    px = im.load()
    out = []
    for y in range(CELL):
        for x in range(CELL):
            if y < ORIGIN[1] and px[x, y][3] == 0 and any(
                    0 <= x + dx < CELL and 0 <= y + dy < CELL and px[x + dx, y + dy][3]
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out.append((x, y))
    for p in out:
        put(p, INK)
    return im


# --- the drawing the code does, spelled out for the mock -------------------------------------------
def ring(px, x, y, w, h, color, width=2):
    for i in range(width):
        for xx in range(x + i, x + w - i):
            px[xx, y + i] = color
            px[xx, y + h - 1 - i] = color
        for yy in range(y + i, y + h - i):
            px[x + i, yy] = color
            px[x + w - 1 - i, yy] = color
    # the corner knots: 6 x 6 centred on the band's corner, the middle 2 x 2 open
    for cx, cy in ((x, y), (x + w - 2, y), (x, y + h - 2), (x + w - 2, y + h - 2)):
        for dy in range(-2, 4):
            for dx in range(-2, 4):
                if dx in (0, 1) and dy in (0, 1):
                    continue
                px[cx + dx, cy + dy] = color


def letters(px, shape, sheet, x, y, color, scale=2):
    meta = json.loads((ROOT / "packages/shared/assets/old-letters.json").read_text())
    cell = meta["cell"]
    items = [(g["cell"], g["x"]) for g in shape["glyphs"]] + [(d["cell"], d["x"]) for d in shape["dividers"]]
    for c, gx in items:
        for sy in range(meta["height"]):
            for sx in range(cell):
                if sheet.getpixel((c * cell + sx, sy))[3]:
                    for a in range(scale):
                        for b in range(scale):
                            px[x + (gx + sx) * scale + a, y + sy * scale + b] = color


def line_pixels(a, b):
    (x0, y0), (x1, y1) = a, b
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err, out = dx + dy, []
    while True:
        out.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return out
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


WAVE = [0, 0, 1, 1, 0, 0, -1, -1]
JAG = [0, 1, -1]


def stroke(px, a, b, style, color, t0=0):
    pts = line_pixels(a, b)
    vertical = abs(b[1] - a[1]) > abs(b[0] - a[0])
    for i, (x, y) in enumerate(pts):
        t = t0 + i
        off = WAVE[t % 8] if style == "wave" else JAG[t % 3] if style == "jagged" else 0
        if style == "thin-broken" and t % 3 == 2:
            continue
        p = (x + off, y) if vertical else (x, y + off)
        px[p] = color
        if style == "heavy-straight":
            px[(p[0] + 1, p[1]) if vertical else (p[0], p[1] + 1)] = color
    return t0 + len(pts)


def sigil(px, origin, sig, style, color, cell=8):
    pts = [(origin[0] + s["col"] * cell + cell // 2, origin[1] + s["row"] * cell + cell // 2) for s in sig["steps"]]
    # the faint dotted grid
    for i in range(4):
        for k in range(0, 3 * cell + 1, 2):
            px[origin[0] + k, origin[1] + i * cell] = DUSK
            px[origin[0] + i * cell, origin[1] + k] = DUSK
    t = 0
    for a, b in zip(pts, pts[1:]):
        if a != b:
            t = stroke(px, a, b, style, color, t)
    for m in sig["marks"]:
        x, y = pts[m["step"]]
        if m["kind"] in ("start", "loop"):
            for dx, dy in ((-2, -1), (-2, 0), (-2, 1), (2, -1), (2, 0), (2, 1), (-1, -2), (0, -2), (1, -2),
                           (-1, 2), (0, 2), (1, 2)):
                px[x + dx, y + dy] = color
        elif m["kind"] == "hook":
            for dx in (2, 3):
                for dy in (-4, -3, -2):
                    px[x + dx, y + dy] = color
    x, y = pts[-1]
    px_prev = pts[-2] if len(pts) > 1 else pts[-1]
    horizontal = abs(y - px_prev[1]) >= abs(x - px_prev[0])
    for i in range(-3, 3):
        for j in (-1, 0):
            px[(x + i, y + j) if horizontal else (x + j, y + i)] = color


def mock():
    S = json.loads(Path(__file__).with_name("sentence.json").read_text())
    sheet = Image.open(ROOT / "packages/shared/assets/old-letters-8px.png").convert("RGBA")
    ground = Image.open(ROOT / "packages/shared/assets/field-ground-64px.png").convert("RGBA")
    gmeta = json.loads((ROOT / "packages/shared/assets/field-ground.json").read_text())
    floor = Image.open(ROOT / "art/clean/tiles-holding/floor_0.png").convert("RGBA")
    posts = {False: signpost(False), True: signpost(True)}
    styles = {"earth": "heavy-straight", "water": "wave", "fire": "jagged", "air": "thin-broken"}
    plots = [(e, False) for e in styles] + [("earth", True)]
    P, gap = 192, 16
    W, H = len(plots) * (P + gap) + gap, P + 2 * gap
    im = Image.new("RGBA", (W, H))
    for y in range(0, H, 32):
        for x in range(0, W, 32):
            im.paste(floor, (x, y))
    px = im.load()
    for n, (element, faded) in enumerate(plots):
        ox, oy = gap + n * (P + gap), gap
        cell = next(c for c in gmeta["cells"] if c["name"] == ("faded" if faded else "sown"))
        tile = ground.crop((cell["x"], cell["y"], cell["x"] + 64, cell["y"] + 64))
        ins = gmeta["inset"]
        x0, y0, x1, y1 = ox + ins["left"], oy + ins["top"], ox + P - ins["right"], oy + P - ins["bottom"]
        for ty in range(y0, y1, 64):
            for tx in range(x0, x1, 64):
                im.paste(tile.crop((0, 0, min(64, x1 - tx), min(64, y1 - ty))), (tx, ty))
        color = DUSK if faded else ELEMENTS[element]
        ring(px, ox + 4, oy + 4, P - 8, P - 8, color)
        ink = DUSK if faded else INK
        lw = S["shape"]["width"] * 2
        letters(px, S["shape"], sheet, ox + 4 + (P - 8) // 2 - lw // 2, oy + 4 + 2 + 2, ink)
        # the divider at the ring's other join, under the bottom band
        dx, dy = ox + 4 + (P - 8) // 2, oy + 4 + (P - 8) - 2 - 2 - 4
        for a in (-1, 0):
            for b in (0, 1):
                px[dx + a, dy + b] = ink
        # the signpost at the layout's station (2.5, 3 tiles into the plot), the sigil on its board
        base = (ox + 80, oy + 96)
        post = posts[faded]
        im.alpha_composite(post, (base[0] - ORIGIN[0], base[1] - ORIGIN[1]))
        if not faded:
            origin = (base[0] - ORIGIN[0] + BOARD[0] + 3, base[1] - ORIGIN[1] + BOARD[1] + 3)
            sigil(px, origin, S["sigil"], styles[element], color)
    out = ROOT / "docs/screenshots/seal-kit"
    out.mkdir(parents=True, exist_ok=True)
    im.resize((W * 2, H * 2), Image.NEAREST).save(out / "seals.png")
    # the board close up, each style at 4x
    close = Image.new("RGBA", (4 * 40, 40), TOK["sleeper-soil"])
    cpx = close.load()
    for n, element in enumerate(styles):
        for y in range(30):
            for x in range(30):
                cpx[n * 40 + 5 + x, 5 + y] = posts[False].getpixel((BOARD[0] + x, BOARD[1] + y))
        sigil(cpx, (n * 40 + 5 + 3, 5 + 3), S["sigil"], styles[element], ELEMENTS[element])
    close.resize((close.width * 4, close.height * 4), Image.NEAREST).save(out / "sigils.png")


def main():
    for name, faded in (("prop-signpost", False), ("prop-signpost-faded", True)):
        d = ROOT / f"art/clean/{name}/idle"
        d.mkdir(parents=True, exist_ok=True)
        signpost(faded).save(d / "frame-0.png")
    mock()


if __name__ == "__main__":
    main()
