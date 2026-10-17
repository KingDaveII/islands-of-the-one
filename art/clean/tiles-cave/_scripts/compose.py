"""ART: compose every tiles-cave piece (G1.5e's names) into art/clean/tiles-cave/.

Sources: the floor is the tile job's all-upper Wang tile after reduce_colors (art/raw/tiles-cave/floor/
tiles-reduced/wang_15.png); everything else is drawn here from the stone ramp, because the generated wall
and door came back as stripes and a tilted gate (PR #56's review), and the pieces must join exactly.

The look (art/jobs/tiles-cave.md, readability.md "Room"), light from the top left:
- floor: hollow-lavender with hollow-dusk grit and hollow-light flecks, quiet;
- wall top: hollow-deep with hollow-below pits; an open N or W side gets a hollow-deep outline and a lit
  hollow-dusk rim, an open E side an outline and a hollow-below rim;
- wall face (a wall cell above floor): the cap (rows 0-6, top texture), the lit lip (row 7, hollow-dusk),
  the face (rows 8-30): rough stones in hollow-below with hollow-dusk light on their top-left and
  hollow-deep joints, and the foot (row 31, hollow-deep);
- shades: hollow-dusk dither on the floor at the foot of a face (N), east of a wall (W), a 1 px line
  west of a wall (E), and the two diagonal tapers;
- corners: the four pixels that turn a top's outline and rim round an inner corner;
- doors: shell-stone leaves (hollow-dusk, hollow-lavender light, hollow-below shade) held by bronze
  posts and a bronze band, sliding into the posts over 6 frames; the open frame shows the passage.
Every piece joins its neighbours: the stone layout repeats every 32 px, the dithers use the world's
checker parity, and no detail sits within 2 px of a joint except the edges themselves.

    python3 art/clean/tiles-cave/_scripts/compose.py
"""
import json
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "art/clean/tiles-cave"
T = {k: v for k, v in json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"].items()}


def rgb(name):
    h = T[name]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


LIGHT, LAV, DUSK, BELOW, DEEP = (rgb(k) for k in ("hollow-light", "hollow-lavender", "hollow-dusk", "hollow-below", "hollow-deep"))
BRONZE, BRASS, BRASS_DARK, GOLD = (rgb(k) for k in ("watcher-bronze", "wheel-brass", "wheel-brass-dark", "choir-gold"))
CLEAR = (0, 0, 0, 0)
S = 32


def new(w=S, h=S, fill=CLEAR):
    return Image.new("RGBA", (w, h), fill)


def checker(x, y, phase=0):
    return (x + y + phase) % 2 == 0


# ---------------------------------------------------------------- floor

def floor_base():
    src = Image.open(ROOT / "art/raw/tiles-cave/floor/tiles-reduced/wang_15.png").convert("RGBA")
    px = src.load()
    for y in range(S):
        for x in range(S):
            if px[x, y][:3] == rgb("choir-paper")[:3]:
                px[x, y] = LIGHT                       # the job's 2 paper px join the hollow-light flecks
    return src


def floors():
    """floor_0 is the job's tile; the others turn it (a grit texture joins any turn of itself) so the
    generator's faint diagonal scratches don't repeat on a 32 px grid, plus one small mark each."""
    f0 = floor_base()
    f1 = f0.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    for x, y in [(11, 9), (21, 22)]:
        f1.putpixel((x, y), LIGHT)
    f2 = f0.transpose(Image.Transpose.ROTATE_180)      # a short hairline crack, lit on its lower right
    for x, y in [(11, 13), (12, 13), (13, 14), (14, 14), (15, 15), (16, 15), (17, 16)]:
        f2.putpixel((x, y), DUSK)
    for x, y in [(12, 14), (14, 15), (16, 16)]:
        f2.putpixel((x, y), LIGHT)
    f3 = f0.transpose(Image.Transpose.FLIP_TOP_BOTTOM)  # one pebble: lit top left, dusk body, below foot
    cx, cy = 18, 14
    for dy in range(2):
        for dx in range(3):
            f3.putpixel((cx + dx, cy + dy), DUSK)
    f3.putpixel((cx, cy), LIGHT)
    for dx in range(1, 3):
        f3.putpixel((cx + dx, cy + 2), BELOW)
    return {"floor_0": f0, "floor_1": f1, "floor_2": f2, "floor_3": f3}


# ---------------------------------------------------------------- shades (transparent overlays)

def shade_rows(y, x):
    """The N shade's pattern at depth y below the wall foot."""
    if y <= 1:
        return True
    if y <= 3:
        return checker(x, y)
    if y == 4:
        return (x + 2 * y) % 4 == 0
    return False


def shades():
    n, w, e, nw, ne = (new() for _ in range(5))
    for y in range(S):
        for x in range(S):
            if shade_rows(y, x):
                n.putpixel((x, y), DUSK)
            if shade_rows(x, y):                       # the W shade is the N shade turned: depth is x
                w.putpixel((x, y), DUSK)
            if x == S - 1 and checker(x, y):
                e.putpixel((x, y), DUSK)
            if x + y < 5 and (shade_rows(y, x) or shade_rows(x, y)):
                nw.putpixel((x, y), DUSK)
            if (S - 1 - x) + y < 3 and shade_rows(y, x):
                ne.putpixel((x, y), DUSK)
            if x == S - 1 and y < 2 and checker(x, y):
                ne.putpixel((x, y), DUSK)
    return {"shade_n": n, "shade_w": w, "shade_e": e, "shade_nw": nw, "shade_ne": ne}


# ---------------------------------------------------------------- wall top texture

def top_texture(variant, h=S):
    img = new(S, h, DEEP)
    rnd = random.Random(1234 + variant)
    px = img.load()
    pits = 10 if h == S else 3
    for _ in range(pits):                              # pits: a hollow-below pixel, sometimes a pair
        x, y = rnd.randrange(2, S - 2), rnd.randrange(2, h - 2)
        px[x, y] = BELOW
        if rnd.random() < 0.4:
            px[x + 1, y] = BELOW
    if h == S:
        for x, y in [(8, 7), (9, 7), (23, 22), (24, 22), (24, 23)]:
            px[x, y] = BELOW
    if variant == 1 and h == S:                        # the spare top: a longer crack
        for x, y in [(10, 13), (11, 13), (12, 14), (13, 14), (14, 14), (15, 15), (16, 16), (17, 16), (18, 16), (19, 17), (20, 18)]:
            px[x, y] = BELOW
    return img


def edge_n(img, top=0):
    px = img.load()
    for x in range(img.width):
        px[x, top] = DEEP
        px[x, top + 1] = DUSK


def edge_w(img, y0=0, y1=None, face=False):
    px = img.load()
    for y in range(y0, img.height if y1 is None else y1):
        px[0, y] = DEEP
        if px[1, y] != DEEP or not face:
            px[1, y] = DUSK


def edge_e(img, y0=0, y1=None, face=False):
    px = img.load()
    for y in range(y0, img.height if y1 is None else y1):
        px[S - 1, y] = DEEP
        px[S - 2, y] = DEEP if face else BELOW


def corner_fix(img, sides):
    """Where an open N meets an open W or E, the outline and rim turn the corner."""
    px = img.load()
    if "n" in sides and "w" in sides:
        px[0, 0], px[1, 0], px[0, 1], px[1, 1] = DEEP, DEEP, DEEP, DUSK
    if "n" in sides and "e" in sides:
        px[S - 1, 0], px[S - 2, 0], px[S - 1, 1], px[S - 2, 1] = DEEP, DEEP, DEEP, DUSK


SIDE_SETS = ["n", "w", "e", "nw", "ne", "we", "nwe"]


def tops():
    out = {"top_mid_0": top_texture(0), "top_mid_1": top_texture(1)}
    for sides in SIDE_SETS:
        img = top_texture(0)
        if "w" in sides:
            edge_w(img)
        if "e" in sides:
            edge_e(img)
        if "n" in sides:
            edge_n(img)
        corner_fix(img, sides)
        out[f"top_{sides}"] = img
    return out


def corners():
    nw, ne = new(), new()
    nw.putpixel((0, 0), DEEP)
    for p in [(1, 0), (0, 1), (1, 1)]:
        nw.putpixel(p, DUSK)
    ne.putpixel((S - 1, 0), DEEP)
    ne.putpixel((S - 2, 0), BELOW)
    for p in [(S - 1, 1), (S - 2, 1)]:
        ne.putpixel(p, DUSK)
    return {"corner_nw": nw, "corner_ne": ne}


# ---------------------------------------------------------------- wall face

# Rough stones in the face band (rows 8-30), x0, y0, w, h, in a 32 px strip that wraps.
STONES = [
    (0, 8, 11, 7), (11, 8, 9, 6), (20, 8, 12, 7),
    (27, 15, 10, 8), (5, 15, 9, 7), (14, 14, 13, 8),
    (0, 22, 7, 9), (7, 23, 12, 8), (19, 22, 9, 9), (28, 23, 9, 8),
]
CAP = 7          # rows 0-6 are the cap (top texture), row 7 the lit lip, rows 8-30 the face, row 31 the foot


def stone_face(variant):
    img = new(S, S, DEEP)
    px = img.load()
    cap = top_texture(variant, h=CAP)
    img.paste(cap, (0, 0))
    for x in range(S):
        px[x, CAP] = DUSK
    for (sx, sy, w, h) in STONES:
        for dy in range(h - 1):                        # leave a 1 px joint below and right of each stone
            for dx in range(w - 1):
                x, y = (sx + dx) % S, sy + dy
                if y > 30:
                    continue
                corner = (dx in (0, w - 2)) and (dy in (0, h - 2))
                if corner:
                    continue                           # rounded corners show the joint
                if dy == 0 or (dx == 0 and dy < h - 3):
                    px[x, y] = DUSK                    # light on the top and left
                elif dy == h - 2 and dx > 1:
                    px[x, y] = DEEP if (dx % 3 == 0) else BELOW
                else:
                    px[x, y] = BELOW
    for x in range(S):
        px[x, CAP + 1] = BELOW if px[x, CAP + 1] == DEEP else px[x, CAP + 1]
        px[x, 31] = DEEP
    if variant == 1:                                   # the spare face: a crack through one stone, a pit
        for x, y in [(16, 16), (17, 17), (17, 18), (18, 19), (19, 20)]:
            px[x, y] = DEEP
        px[10, 26] = DEEP
        px[11, 26] = DEEP
    return img


def faces():
    out = {"face_mid_0": stone_face(0), "face_mid_1": stone_face(1)}
    for sides in SIDE_SETS:
        img = stone_face(0)
        if "w" in sides:
            edge_w(img, face=True)
        if "e" in sides:
            edge_e(img, face=True)
        if "n" in sides:
            edge_n(img)
        corner_fix(img, sides)
        out[f"face_{sides}"] = img
    return out


# ---------------------------------------------------------------- doors

def leaf(w, h):
    """A shell-stone leaf seen face on: lit top and left, shaded bottom and right, a few cracks."""
    img = new(w, h, DUSK)
    px = img.load()
    for y in range(h):
        for x in range(w):
            if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                px[x, y] = DEEP
            elif y == 1 or x == 1:
                px[x, y] = LAV
            elif y == h - 2 or x == w - 2:
                px[x, y] = BELOW
    rnd = random.Random(w * 100 + h)
    for _ in range(3):
        x, y = rnd.randrange(4, w - 5), rnd.randrange(4, h - 5)
        for k in range(3):
            px[x + k, y + (k // 2)] = BELOW
        px[x, y + 1] = LAV
    return img


def passage_n(w, h):
    """The tunnel behind the north door: dark at the back, the floor coming forward."""
    img = new(w, h, DEEP)
    px = img.load()
    for y in range(h):
        for x in range(w):
            d = h - 1 - y                              # distance from the threshold
            if d <= 2:
                c = LAV if not checker(x, y) else DUSK
            elif d <= 4:
                c = DUSK
            elif d <= 6:
                c = DUSK if checker(x, y) else BELOW
            elif d <= 9:
                c = BELOW
            elif d <= 12:
                c = BELOW if checker(x, y) else DEEP
            else:
                c = DEEP
            px[x, y] = c
    return img


def post_v(h):
    """A bronze post, 6 px wide: lit left, shaded right, outlined."""
    img = new(6, h, BRONZE)
    px = img.load()
    for y in range(h):
        px[0, y] = DEEP
        px[5, y] = DEEP
        px[1, y] = BRASS
        px[4, y] = BRASS_DARK
    for x in range(6):
        px[x, 0] = DEEP
        if 0 < x < 5:
            px[x, 1] = BRASS
    return img


def band(img, y, x0, x1):
    px = img.load()
    for x in range(x0, x1):
        if px[x, y][3] == 0:
            continue
        px[x, y] = BRASS
        px[x, y + 1] = BRONZE
        px[x, y + 2] = BRASS_DARK
    for x in range(x0 + 3, x1 - 2, 7):
        px[x, y + 1] = GOLD


SLIDE = [0, 3, 8, 13, 18, 23]                          # the leaves' travel per opening frame, in px; open = 26


def door_n(offset):
    W, H = 64, 32
    img = new(W, H, DEEP)
    cap = new(W, CAP)
    cap.paste(top_texture(0, h=CAP), (0, 0))
    cap.paste(top_texture(1, h=CAP), (32, 0))
    img.paste(cap, (0, 0))
    px = img.load()
    for x in range(W):
        px[x, CAP] = DUSK
    img.paste(passage_n(52, 24), (6, 8))
    lw, lh = 26, 23
    left, right = leaf(lw, lh), leaf(lw, lh)
    band(left, 9, 0, lw)
    band(right, 9, 0, lw)
    for (lf, x0, sign) in [(left, 6, -1), (right, 32, 1)]:
        x = x0 + sign * offset
        clip_l, clip_r = 6, 58
        part = lf.copy()
        for yy in range(lh):
            for xx in range(lw):
                X = x + xx
                if clip_l <= X < clip_r and (sign < 0 and X < 32 or sign > 0 and X >= 32):
                    img.putpixel((X, 8 + yy), part.getpixel((xx, yy)))
    img.paste(post_v(24), (0, 8))
    img.paste(post_v(24), (58, 8))
    for x in range(W):
        px[x, 31] = px[x, 31] if 6 <= x < 58 and offset >= 26 else DEEP
    return img


def door_side(side, offset):
    """door_w / door_e, 32x64: the gate seen from above in a passage through the side wall."""
    W, H = 32, 64
    img = new(W, H, DEEP)
    img.paste(top_texture(0), (0, 0))
    img.paste(top_texture(1), (0, 32))
    px = img.load()
    room_x = W - 1 if side == "w" else 0              # the side that meets the room
    f0 = floor_base()
    y0, y1 = 13, 55                                    # the passage floor rows
    for y in range(8, 56):
        for x in range(W):
            if y <= 8:
                c = DUSK                               # the lit lip of the top north of the passage
            elif y <= 11:
                c = BELOW                              # the small face on the passage's north side
            elif y == 12:
                c = DEEP
            elif y == 55:
                c = DEEP                               # the south side's back edge
            else:
                c = f0.getpixel((x, y % S))
                if y - y0 <= 1:
                    c = DUSK if (y - y0 == 0 or checker(x, y)) else c
            out = x if side == "w" else W - 1 - x      # distance from the outer end
            if 9 <= y <= 54 and out <= 5:
                if out <= 1:
                    c = DEEP
                elif out <= 3:
                    c = DEEP if checker(x, y) else BELOW
                else:
                    c = BELOW if checker(x, y) else c
            px[x, y] = c
    for x in range(W):                                 # the top south of the passage: its rim
        px[x, 56] = DUSK
    # the room-side edge of the wall column above and below the passage
    for y in list(range(0, 8)) + list(range(56, 64)):
        if side == "w":
            px[W - 1, y], px[W - 2, y] = DEEP, BELOW
        else:
            px[0, y], px[1, y] = DEEP, DUSK
    # the gate: two leaves seen from above, x 12-19, sliding north and south into the posts
    lx = 12
    for (ya, yb, sign) in [(y0, 34, -1), (34, y1, 1)]:
        for y in range(ya, yb):
            Y = y + sign * offset
            if not (y0 <= Y < y1) or (sign < 0 and Y >= 34) or (sign > 0 and Y < 34):
                continue
            for k in range(8):
                x = lx + k
                if k in (0, 7) or y in (ya, yb - 1):
                    c = DEEP
                elif k == 1:
                    c = LAV
                elif k == 6:
                    c = BELOW
                elif k in (3, 4):
                    c = BRONZE if k == 3 else BRASS_DARK
                else:
                    c = DUSK
                px[x, Y] = c
    for (py, h) in [(4, 9), (55, 7)]:                  # the posts' heads, from above
        for y in range(py, py + h):
            for k in range(12):
                x = 10 + k
                if k in (0, 11) or y in (py, py + h - 1):
                    c = DEEP
                elif k == 1 or y == py + 1:
                    c = BRASS
                elif k == 10 or y == py + h - 2:
                    c = BRASS_DARK
                else:
                    c = BRONZE
                px[x, y] = c
    return img


def doors():
    out = {}
    for name, make in [("door_n", door_n), ("door_w", lambda o: door_side("w", o)), ("door_e", lambda o: door_side("e", o))]:
        out[f"{name}_closed"] = [make(0)]
        travel = 26 if name == "door_n" else 21
        out[f"{name}_opening"] = [make(o * travel // 26) for o in SLIDE]
        out[f"{name}_open"] = [make(26 if name == "door_n" else 21)]
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    static = {**floors(), **shades(), **faces(), **tops(), **corners()}
    for name, img in static.items():
        img.save(OUT / f"{name}.png")
    for name, frames in doors().items():
        d = OUT / name
        d.mkdir(exist_ok=True)
        for i, img in enumerate(frames):
            img.save(d / f"frame-{i}.png")
    print(len(static), "static pieces,", sum(len(f) for f in doors().values()), "door frames")


if __name__ == "__main__":
    main()
