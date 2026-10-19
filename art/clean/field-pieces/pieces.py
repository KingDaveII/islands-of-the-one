"""ART: the field's three upgrade pieces (M2 Task 6; Lore §16.8; MAIN #105's contract), from the field-pieces job's
picks (art/raw/field-pieces/, PR #103) and by hand. Whole-pixel edits only, no scaling.

Every frame is written at its cell's size with the piece already where the cell wants it: the footprint's bottom
edge on the soles row (origin row - 1), centred on the origin's column. The recipes ground each animation on its
frame 0 ({ "ref": 0 }), whose lowest pixel is that row, so the build moves nothing (checked against the built
sheets, not these files).

- prop-seed-jars (80 x 104, origin (40, 96)):
  - idle (plank across, 2 x 1): the pick of step 1, its outline hollow-deep, the skin-ramp shades mapped to the
    plank (wheel-brass-dark) and the wax (sleeper-ochre shade, sleeper-flesh light), a thumbprint pressed into each
    seal (one sleeper-ochre pixel);
  - idle_turned (plank along, 1 x 2): drawn here, the generator's diagonal not fitting: the same jar, cut from the
    pick, three times one behind another on a plank running up the picture.
- prop-clay-channel (136 x 136, origin (68, 132)): drawn here in the pick's colours (the generator's trough lay on
  the diagonal): a shallow trough of four fired-clay sections laid end to end and sunk in the ground, its rims lit sleeper-flesh, its walls sleeper-ochre
  (the faces turned from the top-left light in hollow-below), the damp inside watcher-iron with a watcher-rain
  streak and a few hollow-dusk glints of dew. idle runs north-south (1 x 4), idle_turned east-west (4 x 1).
- prop-threshing-floor (112 x 128, origin (56, 120)): the pick of step 3, 12 columns taken out at its stone joints so
  it lies inside its 3 x 3 footprint (96 px), the edge stones (unwritten-tar) to hollow-below, the joints
  (unwritten-sail) to watcher-iron, the 2 px of husk-core straw to sleeper-soil; idle is 8 frames of chaff
  (wheel-brass slivers with a darker tail) lifting off it in a slow spiral and thinning out as it rises.

    python3 art/clean/field-pieces/pieces.py
"""
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "art/raw/field-pieces"
CLEAN = ROOT / "art/clean"
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]


def rgb(k):
    h = T[k]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


CLEAR = (0, 0, 0, 0)
DEEP = rgb("hollow-deep")


def save(piece, anim, frames):
    d = CLEAN / f"prop-{piece}" / anim
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("frame-*.png"):
        old.unlink()
    for i, im in enumerate(frames):
        im.save(d / f"frame-{i}.png")


def pixels(im):
    return {(x, y): im.getpixel((x, y)) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}


def place(px, size, left, bottom):
    """A pixel dict onto a new image, its bounding box's left column at `left` and its lowest row at `bottom`."""
    x0 = min(x for x, _ in px)
    y1 = max(y for _, y in px)
    out = Image.new("RGBA", size, CLEAR)
    for (x, y), c in px.items():
        out.putpixel((x - x0 + left, y - y1 + bottom), c)
    return out


# ---------------------------------------------------------------------------------------------------- seed jars

JARS_CELL, JARS_SOLE = (80, 104), 95


def jars_across():
    """The pick, recoloured by part: the plank's tar shade to wheel-brass-dark, the wax's tar shade and sail light
    to sleeper-ochre and sleeper-flesh, the outline to hollow-deep; a thumbprint in each seal."""
    px = pixels(Image.open(RAW / "seed-jars/across/pick.png").convert("RGBA"))
    top = min(y for _, y in px)
    out = {}
    for (x, y), c in px.items():
        if c == rgb("dream-night"):
            c = DEEP
        elif c == rgb("unwritten-tar"):
            c = rgb("sleeper-ochre") if y - top < 8 else rgb("wheel-brass-dark")
        elif c == rgb("unwritten-sail"):
            c = rgb("sleeper-flesh")
        out[(x, y)] = c
    wax = [p for p, c in out.items() if c == rgb("choir-flame-deep") and p[1] - top <= 2]
    for g in groups(wax):
        cx = round(sum(x for x, _ in g) / len(g))
        out[(cx, top + 2)] = rgb("sleeper-ochre")          # the thumbprint, pressed into the top of the seal
    return out


def groups(cells, gap=1):
    cells, out = set(cells), []
    while cells:
        stack = [cells.pop()]
        g = set(stack)
        while stack:
            x, y = stack.pop()
            for q in [(x + dx, y + dy) for dx in range(-gap, gap + 1) for dy in range(-gap, gap + 1)]:
                if q in cells:
                    cells.remove(q)
                    g.add(q)
                    stack.append(q)
        out.append(g)
    return out


def one_jar(across):
    """The leftmost jar, cut out of the plank: the jar's own colours reached from its middle, and the outline
    round them."""
    top = min(y for _, y in across)
    left = min(x for x, _ in across)
    plank = {rgb("watcher-bronze"), rgb("wheel-brass-dark"), DEEP}
    seed = next(p for p, c in sorted(across.items()) if c == rgb("watcher-stone") and p[0] < left + 12)
    jar, stack = {seed}, [seed]
    while stack:
        x, y = stack.pop()
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if q in across and q not in jar and across[q] not in plank and q[0] < left + 16:
                jar.add(q)
                stack.append(q)
    rim = {(x + dx, y + dy) for x, y in jar for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - jar
    out = {p: across[p] for p in jar}
    for p in rim:
        if p[1] >= top:
            out[p] = DEEP
    return out


def jars_along(across):
    """Three jars one behind another on a plank running up the picture (1 x 2: 32 x 64 px)."""
    jar = one_jar(across)
    jx0 = min(x for x, _ in jar)
    jy1 = max(y for _, y in jar)
    jw = max(x for x, _ in jar) - jx0 + 1
    img = Image.new("RGBA", JARS_CELL, CLEAR)
    put = img.putpixel
    x0, x1 = 28, 51                                   # the plank, 24 wide, centred on column 40
    y0, y1 = 36, 91                                   # its top surface; the front edge and feet below
    for y in range(y0, JARS_SOLE + 1):
        for x in range(x0, x1 + 1):
            if y == y0 or x in (x0, x1):
                c = DEEP
            elif y <= y1:
                c = rgb("sleeper-flesh") if x == x0 + 1 else rgb("watcher-bronze")
                if x in (x0 + 8, x0 + 15) and (y - y0) % 11 not in (0, 5):
                    c = rgb("wheel-brass-dark")                  # two grain lines along the plank
                if x == x1 - 1:
                    c = rgb("wheel-brass-dark")                  # the right edge, turned from the light
            elif y <= y1 + 2:
                c = rgb("wheel-brass-dark")                      # the front edge's thickness
            elif y == y1 + 3:
                c = DEEP
            else:
                c = DEEP if (x <= x0 + 3 or x >= x1 - 3) else None   # two feet under the front edge
            if c is not None:
                put((x, y), c)
    for x in range(x0 + 4, x1 - 3):
        put((x, JARS_SOLE), CLEAR)
    for base in (52, 69, 86):                          # back to front: each jar hides the foot of the one behind
        left = 40 - jw // 2
        for (x, y), c in jar.items():
            put((x - jx0 + left, y - jy1 + base), c)
    return img


# ----------------------------------------------------------------------------------------------------- channel

CH_CELL, CH_SOLE = (136, 136), 131
WIDTH, LENGTH = 24, 124


def trough_across(u):
    """The trough's cross-section, u = 0 .. WIDTH-1 from its left (or far) side: outline, lit rim, the far wall's
    inner face turned from the light, the damp bottom, the near wall's inner face in the light, rim, outline."""
    if u in (0, WIDTH - 1):
        return DEEP
    if u in (1, 2, WIDTH - 3, WIDTH - 2):
        return rgb("sleeper-flesh")
    if u == 3:
        return rgb("sleeper-ochre")
    if u in (4, 5):
        return rgb("hollow-below")
    if u in (WIDTH - 5, WIDTH - 4):
        return rgb("sleeper-ochre")
    return rgb("watcher-iron")


GLINTS = [(9, 17), (14, 40), (8, 66), (12, 95), (16, 112)]       # (u, v): dew on the damp bottom


def channel(turned):
    """idle: lengthwise, running north-south, 24 x 124 in the 32 x 128 footprint; idle_turned: across."""
    img = Image.new("RGBA", CH_CELL, CLEAR)
    if not turned:
        left, top = 68 - WIDTH // 2, CH_SOLE - LENGTH + 1
        at = lambda u, v: (left + u, top + v)
    else:
        left, top = 68 - LENGTH // 2, CH_SOLE - WIDTH + 1
        at = lambda u, v: (left + v, top + u)
    for v in range(LENGTH):
        for u in range(WIDTH):
            if v in (0, LENGTH - 1):
                c = DEEP if 0 < u < WIDTH - 1 else CLEAR                  # the ends' outline, corners cut
            elif v in (1, 2, LENGTH - 3, LENGTH - 2):
                c = DEEP if u in (0, WIDTH - 1) else rgb("sleeper-flesh")  # the ends' rims
            elif v == 3 and 3 <= u <= WIDTH - 4:
                c = rgb("sleeper-ochre")
            elif v in (4, 5) and 3 <= u <= WIDTH - 4:
                c = rgb("hollow-below")                                    # the far end's face, in shade
            elif v == LENGTH - 4 and 3 <= u <= WIDTH - 4:
                c = rgb("sleeper-ochre")                                   # the near end's face, lit
            else:
                c = trough_across(u)
                if c == rgb("watcher-iron") and u == WIDTH // 2 + 2 and v % 9 < 6:
                    c = rgb("watcher-rain")                                # a damp streak
            if c != CLEAR:
                img.putpixel(at(u, v), c)
    for v in range(31, LENGTH - 6, 31):                                 # the joints between the fired sections
        for u in (1, 2, WIDTH - 3, WIDTH - 2):
            img.putpixel(at(u, v), rgb("sleeper-ochre"))
        img.putpixel(at(3, v), rgb("hollow-below"))
    for u, v in GLINTS:
        img.putpixel(at(u, v), rgb("hollow-dusk"))
    return img


# ------------------------------------------------------------------------------------------------- threshing floor

FL_CELL, FL_SOLE = (112, 128), 119
FL_TRIM = 12
CHAFF = 12


def floor_base():
    im = Image.open(RAW / "threshing-floor/pick.png").convert("RGBA")
    px = pixels(im)
    remap = {rgb("unwritten-tar"): rgb("hollow-below"), rgb("unwritten-sail"): rgb("watcher-iron"),
             rgb("husk-core"): rgb("sleeper-soil"), rgb("dream-night"): DEEP}
    px = {p: remap.get(c, c) for p, c in px.items()}
    x0, x1 = min(x for x, _ in px), max(x for x, _ in px)
    # the columns to take out: the 12 in the middle band with the most joint pixels, so the cut runs along joints
    band = range(x0 + 24, x1 - 23)
    joints = lambda x: sum(1 for (px_, _), c in px.items() if px_ == x and c in (rgb("watcher-iron"), rgb("hollow-below")))
    cut = set(sorted(band, key=lambda x: (-joints(x), abs(x - (x0 + x1) / 2)))[:FL_TRIM])
    keep = [x for x in range(x0, x1 + 1) if x not in cut]
    out = {}
    for i, x in enumerate(keep):
        for y in range(im.height):
            if (x, y) in px:
                out[(i, y)] = px[(x, y)]
    width = len(keep)
    return place(out, FL_CELL, 56 - width // 2, FL_SOLE), width


def chaff(base, frame):
    """CHAFF specks on a slow rising spiral from the floor's middle, each a phase ahead of the last: it lifts off
    wide and low, turns and narrows as it rises above the floor, and thins out at the top (only every other speck
    past 70 %). A speck is a straw sliver: wheel-brass with a wheel-brass-dark tail, so it reads on the grey
    stones and on the pale earth alike."""
    img = base.copy()
    cx, cy = 56, 76
    for i in range(CHAFF):
        s = ((i / CHAFF) + frame / 8) % 1.0
        if s > 0.92 or (s > 0.7 and i % 2):
            continue
        a = 2 * math.pi * (s * 1.25 + i * 0.37)
        r = 32 * (1 - 0.55 * s)
        x = round(cx + r * math.cos(a))
        y = round(cy + 0.5 * r * math.sin(a) - 66 * s)
        tail = -1 if math.sin(a) > 0 else 1              # the tail trails the way it came round
        img.putpixel((x, y), rgb("wheel-brass"))
        img.putpixel((x + tail, y), rgb("wheel-brass-dark"))
    return img


def main():
    across = jars_across()
    save("seed-jars", "idle", [place(across, JARS_CELL, 40 - (max(x for x, _ in across) - min(x for x, _ in across) + 1) // 2, JARS_SOLE)])
    save("seed-jars", "idle_turned", [jars_along(across)])
    save("clay-channel", "idle", [channel(False)])
    save("clay-channel", "idle_turned", [channel(True)])
    base, width = floor_base()
    save("threshing-floor", "idle", [chaff(base, f) for f in range(8)])
    print("floor width", width)


if __name__ == "__main__":
    main()
