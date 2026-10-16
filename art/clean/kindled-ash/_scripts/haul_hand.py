"""ART: the Haul with the hook thrown (MAIN, G1.5d, 2026-10-17: the last throw frame, held while the
hook flies, still showed the hook in the hand, so two hooks were visible).

The Haul throws the Hookblade's hook on its chain (hookblade-fx draws the chain and the flying hook),
so while the hook is out the hand holds only the grip and the chain: haul_throw's last frame, both
haul_pull and both haul_slide frames, and haul_recover's first frame lose the blade. haul_throw's
first frame and haul_recover's last keep it. The script also measures each frame's `hand` point:
the fist pixel next to where the blade left the hand (blade_ew.py's root), in source pixels.

For every facing it reads (a flipX facing, W and SW of the throw and recover, follows its twin), it writes
art/clean/kindled-ash/haul_hand/<anim>/<direction>/: frame-0.png (the source's frame 0, the ground
reference) and every picked frame, emptied where the table says, and prints the recipe's `hand`
points (source pixels). HANDS sets the point by hand where no fist shows (the N back views: the
sleeve's end).

    python3 art/clean/kindled-ash/_scripts/haul_hand.py
"""
import json, math, os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from blade_ew import (DARKS, BODY, SKIN, LEATHER, MIN_BLADE, MID_REACH, OUT,  # noqa: E402
                      is_light, is_mid, groups, near, nbrs)

RECIPE = "art/sheets/kindled-ash.json"
OUTDIR = "art/clean/kindled-ash/haul_hand"
EMPTY = {"haul_throw": [1], "haul_pull": [0, 1], "haul_slide": [0, 1], "haul_recover": [0]}
FACINGS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]   # a flipX facing (W, SW of throw and recover) follows its twin
DIRNAME = {"S": "south", "SE": "south-east", "E": "east", "NE": "north-east", "N": "north", "NW": "north-west",
           "W": "west", "SW": "south-west"}
# the generated (or blade_ew.py) frames each facing reads, before this pass
SOURCES = {
    "haul_throw/S": "art/clean/kindled-ash/haul/south",
    "haul_throw/SE": "art/raw/ss01-kindled-ash/haul/south-east",
    "haul_throw/E": "art/clean/kindled-ash/haul/east",
    "haul_throw/NE": "art/raw/ss01-kindled-ash/haul/north-east",
    "haul_throw/N": "art/raw/ss01-kindled-ash/haul/north",
    "haul_throw/NW": "art/raw/ss01-kindled-ash/haul/north-west",
    "haul_pull/S": "art/raw/ss01-kindled-ash/haul_pull/south",
    "haul_pull/SE": "art/raw/ss01-kindled-ash/haul_pull/south-east",
    "haul_pull/E": "art/clean/kindled-ash/haul_pull/east",
    "haul_pull/NE": "art/raw/ss01-kindled-ash/haul_pull/north-east",
    "haul_pull/N": "art/raw/ss01-kindled-ash/haul_pull/north",
    "haul_pull/NW": "art/raw/ss01-kindled-ash/haul_pull/north-west",
    "haul_pull/W": "art/clean/kindled-ash/haul_pull/west",
    "haul_pull/SW": "art/raw/ss01-kindled-ash/haul_pull/south-west",
    "haul_slide/S": "art/raw/ss01-kindled-ash/haul_slide/south",
    "haul_slide/SE": "art/raw/ss01-kindled-ash/haul_slide/south-east",
    "haul_slide/E": "art/clean/kindled-ash/haul_slide/east",
    "haul_slide/NE": "art/raw/ss01-kindled-ash/haul_slide/north-east",
    "haul_slide/N": "art/raw/ss01-kindled-ash/haul_slide/north",
    "haul_slide/NW": "art/raw/ss01-kindled-ash/haul_slide/north-west",
    "haul_slide/W": "art/clean/kindled-ash/haul_slide/west",
    "haul_slide/SW": "art/raw/ss01-kindled-ash/haul_slide/south-west",
    "haul_recover/S": "art/clean/kindled-ash/haul/south",
    "haul_recover/SE": "art/raw/ss01-kindled-ash/haul/south-east",
    "haul_recover/E": "art/clean/kindled-ash/haul/east",
    "haul_recover/NE": "art/raw/ss01-kindled-ash/haul/north-east",
    "haul_recover/N": "art/raw/ss01-kindled-ash/haul/north",
    "haul_recover/NW": "art/raw/ss01-kindled-ash/haul/north-west"
}
# where no fist shows, the hand point by eye (source pixels), per output frame: the N throw and its
# first recover frame reach out with a sleeve, so the hand is the sleeve's end; elsewhere in N and NW
# the hands are hidden in front of the body and the recipe keeps the body-centre point
HANDS = {"haul_throw_N_0": [15, 41], "haul_throw_N_1": [13, 40], "haul_recover_N_0": [18, 43]}


def load(p):
    im = Image.open(p).convert("RGBA")
    return {(x, y): im.getpixel((x, y)) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}, im.size


def save(px, size, path):
    im = Image.new("RGBA", size)
    for (x, y), c in px.items():
        if 0 <= x < size[0] and 0 <= y < size[1]:
            im.putpixel((x, y), c)
    im.save(path)


def blade(px):
    """The blade's pixels and the fist pixel next to its root, or (set(), None)."""
    light = {p for p, c in px.items() if is_light(c)}
    mids, mid, edge = {p for p, c in px.items() if is_mid(c)}, set(), set(light)
    for _ in range(MID_REACH):
        edge = {q for p in edge for q in nbrs(p) if q in mids and q not in mid}
        mid |= edge
    skin = {p for p, c in px.items() if near(c, SKIN, 12)}
    grip = {p for p, c in px.items() if near(c, LEATHER, 30)}
    cands = []
    for g in groups(light | mid):
        if len(g) < MIN_BLADE or sum(1 for p in g if p in light) < 3:
            continue
        near_hand = min((math.dist(p, q) for p in g for q in skin | grip), default=99)
        cands.append((near_hand <= 3, len(g), g))
    if not cands:
        return set(), None
    _, _, g = max(cands)
    gs = set(g)
    for _ in range(2):
        gs |= {q for p in gs for q in nbrs(p) if q in px and q not in gs and not near(px[q], DARKS, 30)
               and not near(px[q], BODY, 30) and q not in skin and q not in grip}
    fist = None
    if skin:
        root = min(gs, key=lambda p: min(math.dist(p, q) for q in skin | grip))
        fist = min(skin, key=lambda q: math.dist(q, root))
    return gs, fist


def empty(px, gs, size):
    w, h = size
    for p in gs:
        del px[p]
    changed = True
    while changed:
        changed = False
        for p in [p for p, c in px.items() if near(c, DARKS, 30)]:
            if not any(q in px and not near(px[q], DARKS, 30) for q in nbrs(p)) and any(q in gs for q in nbrs(p)):
                del px[p]
                changed = True
    outside, stack = set(), [(0, 0)]
    while stack:
        x, y = stack.pop()
        if (x, y) in outside or (x, y) in px or not (0 <= x < w and 0 <= y < h):
            continue
        outside.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for _ in range(3):
        for p in sorted(gs):
            if p not in px and p not in outside:
                nb = [px[q] for q in [(p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)] if q in px]
                if nb:
                    px[p] = max(set(nb), key=nb.count)
    # the figure's edge where the blade left it gets its outline back
    for p in sorted(gs):
        if p not in px and any(q in px and not near(px[q], DARKS, 30) for q in nbrs(p)):
            px[p] = OUT
    # crumbs left floating (a grip end, a hook's last pixel)
    parts = groups(set(px))
    main_part = max(parts, key=len)
    for g in parts:
        if g is not main_part and len(g) <= 10:
            for p in g:
                del px[p]


def main():
    r = json.load(open(RECIPE))
    points = {}
    for anim, gone in EMPTY.items():
        for F in FACINGS:
            fc = r["anims"][anim]["facings"][F]
            if fc.get("flipX"):
                continue
            src = SOURCES[f"{anim}/{F}"]
            dst = os.path.join(OUTDIR, anim, DIRNAME[F])
            os.makedirs(dst, exist_ok=True)
            ref, size = load(os.path.join(src, "frame-0.png"))
            save(ref, size, os.path.join(dst, "frame-0.png"))
            for k, n in enumerate(fc["frames"]):
                px, size = load(os.path.join(src, f"frame-{n}.png"))
                gs, fist = blade(px)
                if k in gone and gs:
                    empty(px, gs, size)
                save(px, size, os.path.join(dst, f"frame-{n}.png"))
                name = f"{anim}_{F}_{k}"
                pt = HANDS.get(name, list(fist) if fist else None)
                points[name] = pt
                print(name, "frame", n, "blade px", len(gs), "emptied" if k in gone and gs else "", "hand", pt)
    json.dump(points, open(os.path.join(OUTDIR, "hands.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
