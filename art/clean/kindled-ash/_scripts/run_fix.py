"""ART: the run's finishing pass for kindled-ash (review of PR #46, 2026-10-16). Run it after
blade_ew.py has done the E and W folders:

    python3 art/clean/kindled-ash/_scripts/blade_ew.py art/raw/run-kindled-ash art/clean/kindled-ash run
    python3 art/clean/kindled-ash/_scripts/run_fix.py art/raw/run-kindled-ash art/clean/kindled-ash

It writes art/clean/kindled-ash/run/<direction>/ for all 8 facings (the generator's numbering):
- the frames, raw or as blade_ew.py left them, with the edits below: the hook kept in its facing's
  hand in every frame (the engine follows the hook per facing), a stray hook cleared, a Hookblade
  drawn into the hand where the generator dropped it;
- frame-8.png: a copy of the facing's lowest-reaching frame, the `ground: { ref: 8 }` reference, so
  the whole cycle takes one vertical shift and the flight frames stay off the floor.
"""
import math, os, shutil, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from blade_ew import OUT, SKIN, LEATHER, STAMP, STAMP_SLOPED, snap, near, nbrs  # noqa: E402

DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
# per direction and generator frame:
#   raw: start from the raw frame, not blade_ew.py's (its redraw took a leg or a sleeve for the blade)
#   clear: boxes emptied (a hook drawn in the wrong hand)
#   add: (root, (dx, dy)): a Hookblade drawn from the fist, behind the hand
EDITS = {
    # S: the right hand (viewer's left) holds the hook; frames 0-3 drew it up by the left shoulder
    ("south", 0): {"add": ((26, 55), (-1, 0.5))},
    ("south", 1): {"clear": [(51, 29, 58, 36)], "add": ((25, 51), (-1, 0.5))},
    ("south", 2): {"clear": [(52, 28, 58, 35)], "add": ((26, 50), (-1, 0.5))},
    ("south", 3): {"clear": [(52, 30, 58, 39)], "add": ((25, 51), (-1, 0.5))},
    # SE: the hook dropped (5) or snapped away (6); held low, forward and down
    ("south-east", 5): {"add": ((28, 51), (1, 1))},
    ("south-east", 6): {"add": ((32, 49), (0.5, 1))},
    # E 4-6: the generated blade is already straight with a small hook; blade_ew.py took the leg
    ("east", 4): {"raw": True},
    ("east", 5): {"raw": True},
    ("east", 6): {"raw": True},
    # W: the near hand holds it (as in W's idle and walk); 4-6 dropped it, 7 got a sleeve for a blade
    ("west", 4): {"add": ((25, 47), (-1, 0))},
    ("west", 5): {"add": ((24, 45), (-1, 0))},
    ("west", 6): {"add": ((25, 47), (-1, 0))},
    ("west", 7): {"raw": True, "add": ((30, 52), (-1, 0.5))},
}


def load(p):
    im = Image.open(p).convert("RGBA")
    return {(x, y): im.getpixel((x, y)) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}, im.size


def save(px, size, path):
    im = Image.new("RGBA", size)
    for (x, y), c in px.items():
        if 0 <= x < size[0] and 0 <= y < size[1]:
            im.putpixel((x, y), c)
    im.save(path)


def add_blade(px, size, root, d):
    """The Hookblade from blade_ew.py's stamp, from `root` along `d`, the hook turned up (or, upright,
    to the right of the blade's way); the hand and grip stay in front; dream-night outline."""
    vx, vy = d
    if abs(vx) >= abs(vy):
        sg, slope = (1 if vx > 0 else -1), snap(vy / abs(vx))
        place = lambda u, v: (root[0] + sg * u, root[1] + int(u * slope) + v)
    else:
        sg, slope = (1 if vy > 0 else -1), snap(vx / abs(vy))
        place = lambda u, v: (root[0] + int(u * slope) - sg * v, root[1] + sg * u)
    stamp = STAMP_SLOPED if slope else STAMP
    new = {place(u, v): c for (u, v), c in stamp.items()}
    new = {p: c for p, c in new.items() if not (p in px and (near(px[p], SKIN, 12) or near(px[p], LEATHER, 30)))}
    px.update(new)
    for p in list(new):
        for q in nbrs(p):
            if q not in px and 0 <= q[0] < size[0] and 0 <= q[1] < size[1]:
                px[q] = OUT


def main(raw, clean):
    for d in DIRS:
        src, dst = os.path.join(raw, "run", d), os.path.join(clean, "run", d)
        os.makedirs(dst, exist_ok=True)
        bottoms = []
        for i in range(8):
            ed = EDITS.get((d, i), {})
            done = os.path.join(dst, f"frame-{i}.png")
            base = os.path.join(src, f"frame-{i}.png") if ed.get("raw") or d not in ("east", "west") else done
            px, size = load(base)
            for (x0, y0, x1, y1) in ed.get("clear", []):
                for p in [p for p in px if x0 <= p[0] <= x1 and y0 <= p[1] <= y1]:
                    del px[p]
            if "add" in ed:
                add_blade(px, size, *ed["add"])
            save(px, size, done)
            bottoms.append(max(y for _, y in px))
        ref = bottoms.index(max(bottoms))
        shutil.copy(os.path.join(dst, f"frame-{ref}.png"), os.path.join(dst, "frame-8.png"))
        print(d, "bottoms", bottoms, "ground ref = frame", ref)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
