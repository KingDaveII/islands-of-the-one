"""ART: kindled-ash-sheathed, the Kindled outside combat with the Hookblade put away (David's holding
playtest, 2026-10-18: no blade in hand outside combat; MAIN #86's KINDLED_SHEATHED_ANIMS).

The blade is not drawn: it is put away under the cloak. Every frame is cut from the finished kindled-ash
sheet (packages/shared/assets/sprites/kindled-ash.*), so it is already clean and sits in the 96 x 80 cell
exactly as the combat sheet has it, and the two sheets match when the holding and an encounter swap.

- W, SW, NW and N: the blade is found by find_blade() (its light, which on the finished sheet only the
  blade, the eye whites and the belt buckle carry, plus the steel and outline right round it) and erased
  with the Haul's empty-hand method (art/clean/kindled-ash/_scripts/haul_hand.py: empty() erases it and
  refills what the figure had behind it), then close() shuts the notches it left in the figure's edge,
  smooth() takes the blade's outline off the tunic where the grip lay across it, prune() peels 1 px dark
  lines the blade's back edge left hanging, and FIXES clears by hand what survives in a few frames.
  NW and N show no blade, so they come out as they are.
- E, SE and NE: the recipe mirrors W, SW and NW (flipX). Their blade crossed the legs; with no blade the
  figure has no handedness, so the mirror is the cleaner figure.
- S: half_mirror(): below the chin, the left half (where the blade hung) is the right half of the frame
  half a cycle on, mirrored.
- run_start and run_stop: made from the sheathed idle and run as the combat sheet's are
  (run_transitions.py: the crouch, run frame 7; run frame 0, the crouch).

For each animation and each of the five facings it writes
art/clean/kindled-ash-sheathed/<anim>/<direction>/frame-<n>.png, plus frame-<count>.png: a combat frame
untouched (the animation's frame 0, idle's for the transitions), the recipe's ground reference, so
nothing the erasing does moves the figure.

    python3 art/clean/kindled-ash-sheathed/_scripts/sheathe.py
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "art/clean/kindled-ash/_scripts"))
from haul_hand import empty  # noqa: E402
from blade_ew import DARKS, OUT as LINE, groups, near  # noqa: E402
from run_transitions import crouch  # noqa: E402


def close(px, gs):
    """Where the blade crossed the figure's edge (a leg, a hip), empty() leaves a notch open to the outside.
    Near where the blade was, fill a transparent pixel with 3 or 4 opaque 4-neighbours from its non-dark
    neighbours (the outline where it has none), repeating until the notch is shut, then give the new edge
    its outline: a filled pixel touching the outside becomes the line."""
    zone = {(x + dx, y + dy) for x, y in gs for dx in range(-1, 2) for dy in range(-1, 2)}
    four = lambda x, y: ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
    filled = set()
    for _ in range(6):
        add = {}
        for p in zone - set(px):
            nb = [px[q] for q in four(*p) if q in px]
            if len(nb) >= 3:
                body = [c for c in nb if not near(c, DARKS, 30)]
                add[p] = max(set(body), key=body.count) if body else LINE
        if not add:
            break
        px.update(add)
        filled |= set(add)
    for p in sorted(filled):
        if any(q not in px for q in four(*p)):
            px[p] = LINE
    parts = groups(set(px))
    main_part = max(parts, key=len)
    for g in parts:                                      # bits of steel cut off from the figure
        if g is not main_part and len(g) <= 24 and set(g) & zone:
            for q in g:
                del px[q]


def smooth(px, gs):
    """empty() refills a hole from its neighbours' majority, which can be the blade's own outline where the
    grip lay across the tunic, leaving a dark patch. Where the blade was, a dark pixel inside the figure
    (all 8 neighbours opaque) with two or more non-dark 4-neighbours takes its non-dark neighbours' colour."""
    four = lambda x, y: ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
    for _ in range(4):
        add = {}
        for p in gs:
            if p not in px or not near(px[p], DARKS, 30):
                continue
            x, y = p
            if not all((x + dx, y + dy) in px for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                continue
            if sum(not near(px[q], DARKS, 30) for q in four(x, y)) >= 2:
                body = [px[(x + dx, y + dy)] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                        if not near(px[(x + dx, y + dy)], DARKS, 30)]
                add[p] = max(set(body), key=body.count)
        if not add:
            break
        px.update(add)


def prune(px, gs):
    """The blade's dark back edge can outlive empty() as a 1 px line hanging off the figure. Near where the
    blade was, peel dark line ends (a dark pixel with at most one opaque 4-neighbour) until none is left;
    the figure's own outline always has two or more."""
    zone = {(x + dx, y + dy) for x, y in gs for dx in range(-3, 4) for dy in range(-3, 4)}
    changed = True
    while changed:
        changed = False
        for p in [p for p in px if p in zone and near(px[p], DARKS, 30)]:
            x, y = p
            if sum((q in px) for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))) <= 1:
                del px[p]
                changed = True


HEX = lambda h: (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
LIGHTS = {HEX("#e8e2d6"), HEX("#f4efe6"), HEX("#e3c29e"), HEX("#d9d2e9")}  # + hollow-lavender
STEEL = LIGHTS | {HEX("#7d8794"), HEX("#4a4e57")}               # + watcher-stone, watcher-iron
SKINS = {HEX("#8c7f6e"), HEX("#5e5448")}


def find_blade(px):
    """On the finished sheet the steel's light (husk-shell, hollow-light, and sleeper-soil where the snap
    put a few run frames' edge there) is the blade's alone, but for the eye whites (a light pixel
    touching skin in the head, above cell row 36) and the belt buckle (up to 3 lit pixels inside the
    figure on the belt, rows 46 to 52). The blade is that light, the steel within
    2 px of it (the tunic shares watcher-stone, so the reach stays short), and the dark outline round
    it that outlines nothing else."""
    seeds = {p for p, c in px.items() if c in LIGHTS
             and not (p[1] < 36 and any((p[0] + dx, p[1] + dy) in px and px[(p[0] + dx, p[1] + dy)] in SKINS
                                        for dx in (-1, 0, 1) for dy in (-1, 0, 1)))}
    for g in groups(seeds):                      # the belt buckle: a lit pixel or three inside the belt
        g = set(g)
        if len(g) <= 3 and all(46 <= y <= 52 for _, y in g) and all(
                (x + dx, y + dy) in px for x, y in g for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            seeds -= g
    if len(seeds) < 3:
        return set()
    core = {p for p, c in px.items() if c in STEEL
            and any(max(abs(p[0] - q[0]), abs(p[1] - q[1])) <= 2 for q in seeds)}
    four = lambda x, y: ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
    rim = {p for p, c in px.items() if near(c, DARKS, 30) and p not in core
           and any((p[0] + dx, p[1] + dy) in core for dx in (-1, 0, 1) for dy in (-1, 0, 1))
           and all(q not in px or q in core or near(px[q], DARKS, 30) for q in four(*p))}
    return core | rim


def clear(px, frame):
    """FIXES: rectangles (cell px, corners included) cleared by hand where the blade's remains survive; a
    figure pixel left bordering a cleared one becomes the outline, so the new edge is drawn."""
    gone = set()
    for x0, y0, x1, y1 in FIXES.get(frame, []):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if px.pop((x, y), None) is not None:
                    gone.add((x, y))
    for x, y in gone:
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if q in px and not near(px[q], DARKS, 30):
                px[q] = LINE


def half_mirror(cell, anim, count, n):
    """S: the blade hangs from the hand on the figure's left. Below the chin, the left half is the right
    half of the frame half a cycle on, mirrored about the figure's middle (a frontal walk or run is its own
    mirror half a cycle later, so the legs and the swinging arm keep their phase); the face stays its own.
    Idle mirrors its own right half."""
    y0, axis = HALF[anim]
    own = cell(f"{anim}_S_{n}")
    other = cell(f"{anim}_S_{(n + count // 2) % count if count > 2 else n}")
    out = own.copy()
    po, pt = out.load(), other.load()
    for y in range(y0, own.height):
        for x in range(axis - own.width + 1, axis // 2 + 1):
            po[x, y] = pt[axis - x, y]
    return out


SHEET = ROOT / "packages/shared/assets/sprites/kindled-ash"
OUT = ROOT / "art/clean/kindled-ash-sheathed"
ANIMS = {"idle": 2, "walk": 6, "run": 8}
# Without the blade the figure has no hand to keep, so E, SE and NE are W, SW and NW mirrored (the recipe's
# flipX): the west facings' blade is in the far hand, mostly clear of the figure, while the east facings'
# crossed the legs. Only these five are written.
DIRS = {"S": "south", "SW": "south-west", "W": "west", "NW": "north-west", "N": "north"}
# S, per animation: (the first row mirrored, the mirror's axis: x -> axis - x). The run leans 1 px east.
HALF = {"idle": (50, 95), "walk": (50, 95), "run": (42, 97)}
# what survives the script, cleared by hand: frame -> [(x0, y0, x1, y1)] in cell px
FIXES = {
    "idle_SW_1": [(34, 58, 36, 59)],                      # the grip's end, a spur off the hem
    "walk_W_1": [(37, 50, 38, 51), (38, 53, 43, 55)],     # the grip's end and the fist's lower edge
    "run_SW_3": [(37, 47, 39, 48)],                       # the grip's stub below the fist
    "run_SW_4": [(31, 43, 39, 46)],                       # the blade drawn as a grey smear, no light edge
}
# run_start and run_stop are made from the sheathed idle and run (art/clean/kindled-ash/_scripts/
# run_transitions.py, the same recipe as the combat sheet's)
LEAN = {"S": 0, "SW": -1, "W": -1, "NW": -1, "N": 0}


def frame(cell, anim, facing, count, n):
    if facing == "S":
        return half_mirror(cell, anim, count, n), 0
    im = cell(f"{anim}_{facing}_{n}")
    px = {(x, y): im.getpixel((x, y)) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}
    gs = find_blade(px)
    if gs:
        empty(px, gs, im.size)
        close(px, gs)
        smooth(px, gs)
        prune(px, gs)
    clear(px, f"{anim}_{facing}_{n}")
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for p, c in px.items():
        out.putpixel(p, c)
    return out, len(gs)


def save(anim, direction, frames, ref):
    d = OUT / anim / direction
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("frame-*.png"):
        old.unlink()
    for n, im in enumerate(frames):
        im.save(d / f"frame-{n}.png")
    ref.save(d / f"frame-{len(frames)}.png")         # the ground reference: a combat frame, untouched


def main():
    meta = json.loads(SHEET.with_suffix(".json").read_text())
    img = Image.open(SHEET.with_suffix(".png")).convert("RGBA")

    def cell(name):
        f = meta["frames"][name]["frame"]
        return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))

    for stale in ("south-east", "east", "north-east"):
        for anim in list(ANIMS) + ["run_start", "run_stop"]:
            d = OUT / anim / stale
            if d.exists():
                for old in d.glob("*.png"):
                    old.unlink()
                d.rmdir()
    for facing, direction in DIRS.items():
        made = {}
        for anim, count in ANIMS.items():
            made[anim] = []
            for n in range(count):
                im, k = frame(cell, anim, facing, count, n)
                made[anim].append(im)
                print(f"{anim}_{facing}_{n}: {k} px erased")
            save(anim, direction, made[anim], cell(f"{anim}_{facing}_0"))
        idle, run = made["idle"][0], made["run"]
        save("run_start", direction, [crouch(idle, LEAN[facing]), run[7]], cell(f"idle_{facing}_0"))
        save("run_stop", direction, [run[0], crouch(idle, 0)], cell(f"idle_{facing}_0"))


if __name__ == "__main__":
    main()
