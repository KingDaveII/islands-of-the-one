"""ART: shorten the Hookblade in kindled-ash's E and W sources (David's playtest, 2026-10-16: in the side
views the generated blade is a long crescent and reads as a sickle).

For every frame of each source folder below, the script finds the blade (the biggest group of light
neutral steel pixels, with the mid-grey shade next to them), erases it and the outline that only
bordered it, fills where it crossed the figure, and draws the Hookblade as the style sheet's icon has
it: a straight 9 px blade from the hand, the way the generated blade left the hand (snapped to a flat,
1-in-2 or 1-in-1 slope), with a 2 px hook at the tip, turned up (or, for a blade held upright, the way
the generated one curved). Steel ramp, dream-night outline; the hand stays in front. Where the blade
crosses the legs, "trim" keeps the generator's first steps and only puts the hook on the cut.
Everything else is untouched; each folder keeps the v3 layout (frame-0 is the rotation, the ground
reference). OVERRIDES fixes the few frames the rules misread. Colours outside the blade stay raw; the
recipe's remap and snap handle them as before.

    python3 art/clean/kindled-ash/_scripts/blade_ew.py art/raw/ss01-kindled-ash art/clean/kindled-ash
"""
import math, os, sys
from PIL import Image

OUT = (0x1C, 0x21, 0x47, 255)
SHELL = (0xE8, 0xE2, 0xD6, 255)
STONE = (0x7D, 0x87, 0x94, 255)
DARKS = [(0x1C, 0x21, 0x47), (0x2A, 0x25, 0x40), (0x19, 0x1A, 0x31), (0x2E, 0x2D, 0x54), (0x24, 0x30, 0x5A), (0x36, 0x33, 0x47), (0x3D, 0x3C, 0x4C)]
# the figure's own colours: never taken as part of the blade
BODY = [(0x4A, 0x4E, 0x57), (0x5B, 0x54, 0x78), (0x62, 0x63, 0x83), (0x45, 0x40, 0x69), (0xF2, 0xB6, 0x5A), (0xF0, 0x7A, 0x3A), (0x9C, 0x5B, 0x4A), (0xAD, 0x64, 0x4C), (0xC7, 0x9A, 0x3E), (0xD8, 0xB2, 0x4A)]
SKIN = [(0x8C, 0x7F, 0x6E), (0x5E, 0x54, 0x48), (0x6F, 0x63, 0x56), (0x7E, 0x70, 0x63)]
LEATHER = [(0x8A, 0x64, 0x20), (0xAC, 0x81, 0x4A), (0x9E, 0x76, 0x42), (0x6E, 0x56, 0x39), (0xA8, 0x74, 0x3A)]

FOLDERS = ["idle", "walk", "light_1", "light_2", "light_3", "heavy", "haul", "haul_pull", "haul_slide", "hit", "death"]
DIRS = ["east", "west"]
MIN_BLADE = 8     # smaller steel groups are buckles, eyes or glints
MID_REACH = 2


def snap(k):
    """Pixel-art slopes only: flat, 1 in 2 or 1 in 1; a blade within ~17 degrees of flat is drawn flat."""
    a = abs(k)
    return 0 if a < 0.3 else math.copysign(0.5 if a < 0.75 else 1, k)

# the Hookblade in blade coordinates: u along the blade from the hand, v across it (negative = the
# hook's side). A 9 px edge with its shade row, and at the tip a 2 px hook that turns back over.
STAMP = {**{(u, 0): SHELL for u in range(9)}, **{(u, 1): STONE for u in range(7)},
         (8, -1): SHELL, (8, -2): SHELL, (7, -2): STONE}
# on a sloping blade the hook turned back over would read as an arrowhead, so it flicks up past the tip
STAMP_SLOPED = {**{(u, 0): SHELL for u in range(9)}, **{(u, 1): STONE for u in range(7)},
                (9, 0): STONE, (9, -1): SHELL, (9, -2): SHELL}
# per frame: "skip" leaves the frame as generated; otherwise root, dir, trim, mid_reach, erase (boxes taken
# as blade), clear (boxes emptied at the end)
OVERRIDES = {
    # walk W 1-2: the blade is held low across the far hip, under the near sleeve (same grey)
    "walk/west/frame-1.png": {"mid_reach": 1, "root": (35, 54), "dir": (-1, 0.3), "erase": [(23, 49, 26, 56)]},
    "walk/west/frame-2.png": {"mid_reach": 1, "root": (34, 54), "dir": (-1, 0.3), "erase": [(24, 48, 28, 54)]},
    # haul pull W 4: a second hook behind the cloak
    "haul_pull/west/frame-4.png": {"clear": [(50, 33, 63, 41)]},
    # death E 2 and 4: the blade flies loose in the fall; left as generated
    "death/east/frame-2.png": "skip",
    "death/east/frame-4.png": "skip",
    # heavy charge E: the blade crosses the legs, so it is trimmed rather than redrawn
    "heavy/east/frame-2.png": {"trim": 7},
    "heavy/east/frame-3.png": {"trim": 7},
    "heavy/east/frame-4.png": {"trim": 7},
    # idle W: a grey crescent with only a few light pixels on its edge
    "idle/west/frame-0.png": {"mid_reach": 8, "erase": [(17, 37, 31, 50)], "root": (31, 47), "dir": (-1, 0)},
    "idle/west/frame-1.png": {"mid_reach": 8},
    "idle/west/frame-2.png": {"mid_reach": 8},
    "idle/west/frame-3.png": {"mid_reach": 8},
}


def oklab(c):
    f = lambda u: u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4
    r, g, b = (f(v / 255) for v in c[:3])
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(A, B), B


def near(c, pal, d):
    return any(abs(c[0] - p[0]) + abs(c[1] - p[1]) + abs(c[2] - p[2]) <= d for p in pal)


def is_light(c):
    L, C, _ = oklab(c)
    return L >= 0.70 and C <= 0.035


def is_mid(c):
    L, C, B = oklab(c)
    return 0.53 <= L < 0.70 and C <= 0.035 and B < 0.005 and not near(c, SKIN, 12)


def nbrs(p):
    return [(p[0] + ox, p[1] + oy) for ox in (-1, 0, 1) for oy in (-1, 0, 1) if (ox, oy) != (0, 0)]


def groups(cells):
    seen, out = set(), []
    for p in sorted(cells):
        if p in seen:
            continue
        stack, g = [p], []
        seen.add(p)
        while stack:
            q = stack.pop()
            g.append(q)
            for r in nbrs(q):
                if r in cells and r not in seen:
                    seen.add(r)
                    stack.append(r)
        out.append(g)
    return out


def reshape(im, ov):
    w, h = im.size
    px = {(x, y): im.getpixel((x, y)) for y in range(h) for x in range(w) if im.getpixel((x, y))[3]}
    light = {p for p, c in px.items() if is_light(c)}
    # mid greys count as blade within MID_REACH steps of a light pixel (the tunic uses the same grey)
    mids, mid, edge = {p for p, c in px.items() if is_mid(c)}, set(), set(light)
    for _ in range(ov.get("mid_reach", MID_REACH)):
        edge = {q for p in edge for q in nbrs(p) if q in mids and q not in mid}
        mid |= edge
    hand = {p for p, c in px.items() if near(c, SKIN, 12) or near(c, LEATHER, 30)}
    cands = []
    for g in groups(light | mid):
        if len(g) < MIN_BLADE or sum(1 for p in g if p in light) < 3:
            continue
        athand = [p for p in g if any(math.dist(p, q) <= 2.3 for q in hand)]
        cands.append((len(athand) > 0, len(g), g, athand))
    if not cands:
        return im, None
    _, _, g, athand = max(cands)
    gs = set(g)
    # fragments of the same blade (a tip cut off by a darker pixel, a loose shade row)
    for g2 in groups(light | mid | {p for p, c in px.items() if is_mid(c)}):
        if not set(g2) & gs and any(math.dist(p, q) <= 3 for p in g2 for q in g) and len(g2) <= 12:
            gs |= set(g2)
    # the blade's stray edge pixels: anything next to it that is neither the figure nor outline
    for _ in range(3):
        gs |= {q for p in gs for q in nbrs(p) if q in px and q not in gs and not near(px[q], DARKS, 30)
               and not near(px[q], BODY, 30) and not near(px[q], SKIN, 12) and not near(px[q], LEATHER, 30)}
    for (x0, y0, x1, y1) in ov.get("erase", []):   # boxes that are all blade (and its outline)
        gs |= {p for p in px if x0 <= p[0] <= x1 and y0 <= p[1] <= y1}
    g = sorted(gs)
    # the root: at the hand; with the hand hidden, the end nearest the body
    body = [p for p in px if p not in gs]
    bx, by = sum(p[0] for p in body) / len(body), sum(p[1] for p in body) / len(body)
    far = max(g, key=lambda p: (p[0] - bx) ** 2 + (p[1] - by) ** 2)
    if "root" in ov:
        root = min(g, key=lambda p: math.dist(p, ov["root"]))
    elif athand:
        root = min(athand, key=lambda p: min(math.dist(p, q) for q in hand) * 10 - math.dist(p, far))
    else:
        root = max(g, key=lambda p: math.dist(p, far))
    # the blade's way out of the hand: the main axis of its first 8 px (both rows, so the slope is fair)
    nearp = [p for p in g if math.dist(p, root) <= 8]
    mx, my = sum(p[0] for p in nearp) / len(nearp), sum(p[1] for p in nearp) / len(nearp)
    sxx = sum((p[0] - mx) ** 2 for p in nearp); syy = sum((p[1] - my) ** 2 for p in nearp)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in nearp)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
    vx, vy = math.cos(ang), math.sin(ang)
    if vx * (mx - root[0]) + vy * (my - root[1]) < 0:
        vx, vy = -vx, -vy
    cross = vx * (far[1] - root[1]) - vy * (far[0] - root[0])
    vx, vy = ov.get("dir", (vx, vy))
    if "trim" in ov:
        # where the blade crosses the figure: keep its first steps from the hand, cut the sweep
        dist, todo = {root: 0}, [root]
        for p in todo:
            for q in nbrs(p):
                if q in gs and q not in dist:
                    dist[q] = dist[p] + 1
                    todo.append(q)
        kept = [p for p, d in dist.items() if d <= ov["trim"]]
        b = [p for p, d in dist.items() if ov["trim"] - 1 <= d <= ov["trim"]]
        a = [p for p, d in dist.items() if ov["trim"] - 5 <= d <= ov["trim"] - 3]
        if "dir" not in ov:
            vx = sum(p[0] for p in b) / len(b) - sum(p[0] for p in a) / len(a)
            vy = sum(p[1] for p in b) / len(b) - sum(p[1] for p in a) / len(a)
        gs = gs - set(kept)
        sg = 1 if vx > 0 else -1
        tip = max(kept, key=lambda p: (sg * p[0], -p[1]))
        root = (tip[0] - sg * 8, tip[1] - int(8 * snap(vy / abs(vx))))   # so the stamp's tip lands on it
        ov = {**ov, "tip_only": True}
    if "root" in ov:
        root = tuple(ov["root"])
    # erase the generated blade and the outline that only bordered it
    for p in gs:
        del px[p]
    changed = True
    while changed:
        changed = False
        for p in [p for p, c in px.items() if near(c, DARKS, 30)]:
            if not any(q in px and not near(px[q], DARKS, 30) for q in nbrs(p)) and any(q in gs for q in nbrs(p)):
                del px[p]
                changed = True
    # holes the blade left inside the figure take their neighbours' colour
    outside, stack = set(), [(0, 0)]
    while stack:
        x, y = stack.pop()
        if (x, y) in outside or (x, y) in px or not (0 <= x < w and 0 <= y < h):
            continue
        outside.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for p in sorted(gs):
        if p not in px and p not in outside:
            nb = [px[q] for q in [(p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)] if q in px]
            if nb:
                px[p] = max(set(nb), key=nb.count)
    # where the blade crossed the figure, the gap takes the figure's colours (2+ figure neighbours)
    for _ in range(4):
        fill = {}
        for p in gs:
            if p in px:
                continue
            nb = [px[q] for q in [(p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)]
                  if q in px and not near(px[q], DARKS, 30)]
            if len(nb) >= 2:
                fill[p] = max(set(nb), key=nb.count)
        px.update(fill)
    # the Hookblade, sheared to the blade's slope so every row stays a clean pixel line
    xmajor = abs(vx) >= abs(vy)
    if xmajor:
        sg, slope = (1 if vx > 0 else -1), snap(vy / abs(vx))
        hs = 1                                   # side views: the hook turns up (v < 0 is up)
        place = lambda u, v: (root[0] + sg * u, root[1] + int(u * slope) + hs * v)
    else:
        sg, slope = (1 if vy > 0 else -1), snap(vx / abs(vy))
        hs = -sg * (1 if cross >= 0 else -1)     # an upright blade's hook turns the way it curved
        place = lambda u, v: (root[0] + int(u * slope) + hs * v, root[1] + sg * u)
    stamp = STAMP_SLOPED if slope else STAMP
    new = {place(u, v): c for (u, v), c in stamp.items() if not ov.get("tip_only") or u >= 7}
    # the hand and grip stay in front of the blade
    new = {p: c for p, c in new.items() if not (p in px and (near(px[p], SKIN, 12) or near(px[p], LEATHER, 30)))}
    for p, c in new.items():
        px[p] = c
    for p in list(new):
        for q in nbrs(p):
            if q not in px and 0 <= q[0] < w and 0 <= q[1] < h:
                px[q] = OUT
    # leftovers of the old blade's edge: outline with no figure behind it, and odd colours near it
    mine = set(new) | {q for p in new for q in nbrs(p)}
    # warm-grey specks the generator left on the blade (not a hand: 3 px or fewer)
    loose = {p for g2 in groups({p for p, c in px.items() if near(c, SKIN, 12)}) if len(g2) <= 3 for p in g2
             if math.dist(p, root) > 4}
    zone = {q for p in gs for q in nbrs(p)} | {q for p in gs for q in nbrs(p) for q in nbrs(q)}
    changed = True
    while changed:
        changed = False
        for p in [p for p in px if p in zone and p not in mine]:
            c = px[p]
            figure = any(q in px and q not in mine and not near(px[q], DARKS, 30) for q in nbrs(p))
            odd = not (near(c, DARKS, 30) or near(c, BODY, 30) or near(c, SKIN, 12) or near(c, LEATHER, 30))
            odd = odd or (near(c, SKIN, 12) and p in loose)
            if (near(c, DARKS, 30) and not figure) or odd:
                del px[p]
                changed = True
    for p in list(new):
        for q in nbrs(p):
            if q not in px and 0 <= q[0] < w and 0 <= q[1] < h:
                px[q] = OUT
    tip = place(8, 0)
    cut = gs
    # bits of the old blade that only hang on by the new blade's outline
    n_ = math.hypot(vx, vy) or 1.0
    dx_, dy_ = vx / n_, vy / n_                  # the blade's way, for "beyond the new tip"
    ring = set(new) | {q for p in new for q in nbrs(p) if q in px and px[q] == OUT}
    rest = groups(set(px) - ring)
    big = max(rest, key=len)
    for g2 in rest:
        along = sum((p[0] - root[0]) * dx_ + (p[1] - root[1]) * dy_ for p in g2) / len(g2)
        if g2 is not big and len(g2) <= 10 and any(p in zone for p in g2) and along > 6 and not any(
                near(px[p], SKIN, 12) or near(px[p], LEATHER, 30) for p in g2):
            for p in g2:
                del px[p]
    # crumbs cut off from the figure by the erase
    gl = groups(set(px))
    main = max(gl, key=len)
    for g2 in gl:
        if g2 is not main and len(g2) <= 10:
            for p in g2:
                del px[p]
    # boxes cleared outright (a second, stray blade the generator drew)
    for (x0, y0, x1, y1) in ov.get("clear", []):
        for p in [p for p in px if x0 <= p[0] <= x1 and y0 <= p[1] <= y1]:
            del px[p]
    # last: any hole the erase left inside the figure takes its neighbours' colour
    outside, stack = set(), [(0, 0)]
    while stack:
        x, y = stack.pop()
        if (x, y) in outside or (x, y) in px or not (0 <= x < w and 0 <= y < h):
            continue
        outside.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for _ in range(3):
        for p in [(x, y) for y in range(h) for x in range(w) if (x, y) not in px and (x, y) not in outside]:
            nb = [px[q] for q in [(p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)] if q in px]
            if nb:
                px[p] = max(set(nb), key=nb.count)
    out = Image.new("RGBA", (w, h))
    for (x, y), c in px.items():
        if 0 <= x < w and 0 <= y < h:
            out.putpixel((x, y), c)
    return out, (root, tip, "x" if xmajor else "y", len(g), len(cut))


def main(raw, clean):
    for f in FOLDERS:
        for d in DIRS:
            src, dst = os.path.join(raw, f, d), os.path.join(clean, f, d)
            os.makedirs(dst, exist_ok=True)
            for name in sorted(os.listdir(src)):
                key = f"{f}/{d}/{name}"
                ov = OVERRIDES.get(key, {})
                im = Image.open(os.path.join(src, name)).convert("RGBA")
                info = "skipped" if ov == "skip" else None
                if ov != "skip":
                    im, info = reshape(im, ov)
                im.save(os.path.join(dst, name))
                print(key, info or "no blade found, copied")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
