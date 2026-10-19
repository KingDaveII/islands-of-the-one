"""ART: cleans one Remembrance's raw sheathed material (art job remembrance-sheathed) into the frames of
art/sheets/kindled-<rem>-sheathed.json. No generations. Each sheet's own script,
art/clean/kindled-<rem>-sheathed/_scripts/clean.py, holds its Config and calls run(); rerun that.

Every raw pixel is first sorted to the nearest of the generator's colours for that Remembrance (the
skeleton warp's and v3's in-between shades go with them), then given its material:

- outline -> dream-night; hair, trousers and boots -> watcher-iron.
- the cloth (the generator's one pale colour) -> the Remembrance's cloth ramp (Config.cloth).
- the clay skin ramp (sail / tar -> unwritten-sail / unwritten-tar) stays only on skin: the generator also
  shaded the cloth and drew wrapped feet and rope in the skin colours, and the clay-tone swap recolours
  every masked pixel. Skin is what the outline bounds: the skin-coloured pixels with no cloth pixel round
  them, in runs of 3 or more, and their edges. The rest of the skin colours become the cloth ramp's
  shades; feet (under the trousers, or in the frame's last rows) the feet ramp; with Config.belt, the
  rope between the belt's iron lines the rope ramp. A piece of skin with no light in it (an ear in the
  shade) gets one light pixel, so the mask takes it.
- eyes: the pale pixels on the head beside the dark pupil. The style sheet allows one eye-white per eye,
  and the generators drew 2 or 3 stacked: the top one of a pair (the middle one of three) -> wheel-eye,
  the rest skin.
- freckles, drawn in the cloth colour -> spark-amber (one or two pale pixels on the head with skin round
  them; of a pair, the left one, the other skin).
- a speck of fewer than 24 px standing apart from the figure (8-connected) is dropped: the warp's
  leftovers (tide's run SE 7 had an arc of skin over the head).
- idle: the rest frame (the rotation) and the fullest breath. A breath frame with its eyes shut gets the
  rest frame's eyes, moved with the head; a facing whose breath frames are past copying (Config:
  None) breathes as the rest frame crouched (a torso row out, the head 1 px lower).

run_start and run_stop are made as the Ash sheets' are (run_transitions.crouch): run_start = idle crouched
and leaning into the facing, then the run's push; run_stop = the run's contact, then idle crouched. They
sit on the run's 80 x 80 canvas with the idle's soles on the run's ground row, so the recipe grounds them on
the crouch. The run is listed from its first contact, checked by eye per facing (Config.run_order).
"""
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "art/clean/kindled-ash/_scripts"))
from run_transitions import crouch  # noqa: E402

DIRS = {"S": "south", "SE": "south-east", "E": "east", "NE": "north-east",
        "N": "north", "NW": "north-west", "W": "west", "SW": "south-west"}
LEAN = {"S": 0, "SE": 1, "E": 1, "NE": 1, "N": 0, "NW": -1, "W": -1, "SW": -1}
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
SPECK = 24

# Material letters every Remembrance shares. Config.tokens adds its own: "L" the cloth, "M" and "F" the
# cloth's shades where the generator used sail and tar, "P" and "Q" the feet's, "R", "U" and "K" the
# rope's (sail, tar, the pale knot), and any extra raw colour it keeps (Clay's clay "c").
BASE = {"#": "#1c2147", "i": "#4a4e57", "s": "#8c7f6e", "t": "#5e5448", "E": "#e9e4d4", "A": "#f2b65a"}


def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


@dataclass
class Config:
    rem: str
    raw: dict            # raw letter -> the generator's colour: "#", "i", "w" (cloth), "s", "t", and extras
    tokens: dict         # material letter -> whitelist hex (L, M, F, P, Q, extras; R, U, K with belt)
    idle_breath: dict    # facing -> raw idle frame for the breath, or None (the rest frame crouched)
    run_order: dict      # facing -> raw run frame of the first contact
    belt: bool = False
    feet: bool = True       # wrapped feet drawn in the skin colours (Clay); False where the feet are boots
    pale: dict = field(default_factory=lambda: {"w": "L", "W": "L"})  # raw pale letters -> material letter
    fix: Optional[Callable] = None   # fix(anim, facing, n, materials) -> materials, for one-off repairs
    notes: dict = field(default_factory=dict)

    @property
    def src(self):
        return ROOT / f"art/raw/{self.rem}-sheathed"

    @property
    def out(self):
        return ROOT / f"art/clean/kindled-{self.rem}-sheathed"


def components(cells, steps=N4):
    seen, out = set(), []
    for start in sorted(cells):
        if start in seen:
            continue
        stack, comp = [start], []
        seen.add(start)
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for dx, dy in steps:
                n = (x + dx, y + dy)
                if n in cells and n not in seen:
                    seen.add(n)
                    stack.append(n)
        out.append(comp)
    return out


def classify(cfg, im):
    keys = {k: hx(v) for k, v in cfg.raw.items()}
    w, h = im.size
    px = im.load()
    g = {}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3]:
                g[x, y] = min(keys, key=lambda k: sum((a - b) ** 2 for a, b in zip(p[:3], keys[k])))
    # drop specks standing apart from the figure
    parts = components(set(g), N8)
    biggest = max(len(c) for c in parts)
    for c in parts:
        if len(c) < SPECK and len(c) < biggest:
            for p in c:
                del g[p]
    return g


def materials(cfg, g):
    """Give every pixel its material letter (see BASE and Config.tokens)."""
    m = dict(g)
    pale = tuple(cfg.pale)
    ys = [y for _, y in g]
    top, bottom = min(ys), max(ys)
    tall = bottom - top
    lower = top + tall * 2 // 3
    head = top + tall * 42 // 100
    skin = {p for p, k in g.items() if k in "st"}
    near = lambda p, ds: [(p[0] + dx, p[1] + dy) for dx, dy in ds]  # noqa: E731

    # Eyes: pale pixels on the head beside the dark pupil; one eye-white each.
    eyes, lids = set(), set()
    # a pupil is dark inside the face: no transparency round it (the face's own outline has some)
    pupil = lambda q: g.get(q) == "#" and all(r in g for r in near(q, N8))  # noqa: E731
    candidates = {p for p, k in g.items() if k in pale and p[1] <= head and any(pupil(q) for q in near(p, N4))}
    for comp in components(candidates):
        for col in {x for x, _ in comp}:
            stack = sorted(p for p in comp if p[0] == col)
            keep = stack[(len(stack) - 1) // 2]
            eyes.add(keep)
            lids.update(p for p in stack if p != keep)

    # Freckles: one or two pale pixels on the head with skin colours round them (at most one outline pixel,
    # on the cheek's edge). The 3/4 views draw each as a pair: the left one is the freckle, the other skin.
    freckles, cheek = set(), set()
    for comp in components({p for p, k in g.items() if k in pale and p[1] <= head} - eyes - lids):
        rim = {q for p in comp for q in near(p, N4)} - set(comp)
        if len(comp) <= 2 and all(g.get(p) in ("s", "t", "#") for p in rim) \
                and sum(g.get(p) in ("s", "t") for p in rim) >= len(rim) - 1:
            first = min(comp)
            freckles.add(first)
            cheek.update(p for p in comp if p != first)

    # Rope: skin colours at the waist touching the belt's iron lines.
    rope, line = set(), set()
    if cfg.belt:
        waist = range(top + tall * 60 // 100, top + tall * 85 // 100 + 1)
        # a belt line is a run of at least 3 iron pixels across (a cuff or a hand's edge is shorter)
        line = {p for p, k in g.items() if k == "i" and p[1] in waist
                and any(all(g.get((p[0] + a + d, p[1])) == "i" for d in range(3)) for a in (-2, -1, 0))}
        rope = {p for p in skin if p[1] in waist and any(q in line for q in near(p, ((0, 1), (0, -1))))}
        skin -= rope

    # Feet: skin colours in the lower third with trousers above them in the same column, or reaching the
    # frame's last 3 rows (a foot kicked up behind, seen sole first).
    def under_trousers(x, y):
        return y >= lower and any(g.get((x, y - d)) == "i" for d in range(1, 8))
    feet = set()
    for comp in components(skin) if cfg.feet else []:
        if sum(under_trousers(x, y) for x, y in comp) * 2 >= len(comp) or max(y for _, y in comp) >= bottom - 3:
            feet.update(comp)
    skin -= feet

    # Skin is bounded by the outline; the cloth's shading in the skin colours lies among cloth pixels.
    def cloth(p):
        return g.get(p) in pale and p not in freckles and p not in cheek and p not in eyes and p not in lids
    core = {p for p in skin if not any(cloth(q) for q in near(p, N8))}
    core = {p for comp in components(core) if len(comp) >= 3 for p in comp}
    real = core | {p for p in skin if any(q in core for q in near(p, N4))}

    for p in skin:
        if p not in real:
            m[p] = {"s": "M", "t": "F"}[g[p]]
    for p in feet:
        m[p] = {"s": "P", "t": "Q"}[g[p]]
    for p in rope:
        m[p] = {"s": "R", "t": "U"}[g[p]]
    for comp in components(real):
        if all(g[p] == "t" for p in comp):
            m[min(comp, key=lambda p: (p[1], p[0]))] = "s"

    for p, k in g.items():
        if k in pale:
            if p in eyes:
                m[p] = "E"
            elif p in freckles:
                m[p] = "A"
            elif p in cheek or p in lids:
                m[p] = "s"
            elif rope and any(q in rope for q in near(p, N4)) and any(q in line for q in near(p, N4)):
                m[p] = "K"
            else:
                m[p] = cfg.pale[k]
    return m


def render(cfg, m, size):
    tokens = {**BASE, **cfg.tokens}
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    px = im.load()
    for (x, y), k in m.items():
        px[x, y] = hx(tokens[k]) + (255,)
    return im


def open_eyes(rest, breath):
    """Copy the rest frame's eyes onto a breath frame that has them shut: the box round each eye-white
    pixel (2 px each way), moved by the head's shift between the two frames (the offset that best lays
    the hair of one on the other)."""
    if any(k == "E" for k in breath.values()):
        return breath
    eyes = [p for p, k in rest.items() if k == "E"]
    if not eyes:
        return breath
    hair = {p for p, k in rest.items() if k == "i"}
    hair2 = {p for p, k in breath.items() if k == "i"}
    dx, dy = max(((dx, dy) for dx in range(-2, 3) for dy in range(-2, 3)),
                 key=lambda o: (len({(x + o[0], y + o[1]) for x, y in hair} & hair2), -abs(o[0]) - abs(o[1])))
    out = dict(breath)
    for ex, ey in eyes:
        for x in range(ex - 2, ex + 3):
            for y in range(ey - 2, ey + 3):
                k = rest.get((x, y))
                if k in (None, "i") or (x + dx, y + dy) not in breath or breath[x + dx, y + dy] == "i":
                    continue
                out[x + dx, y + dy] = k
    return out


def relight(im):
    """After a crouch's lean has cut a piece of skin off: a piece in the shade alone gets one light pixel
    (as in materials), so the mask still takes it."""
    px = im.load()
    sail, tar = hx(BASE["s"]), hx(BASE["t"])
    skin = {(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3] and px[x, y][:3] in (sail, tar)}
    for comp in components(skin):
        if all(px[p][:3] == tar for p in comp):
            px[min(comp, key=lambda p: (p[1], p[0]))] = sail + (255,)
    return im


def lowest(im):
    return im.getbbox()[3] - 1


def onto(im, size, soles):
    """im centred on a canvas of `size`, moved so its lowest row is `soles`."""
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(im, ((size[0] - im.width) // 2, soles - lowest(im)))
    return out


def run(cfg):
    def clean(anim, facing, n, path):
        im = Image.open(path).convert("RGBA")
        m = materials(cfg, classify(cfg, im))
        if cfg.fix:
            m = cfg.fix(anim, facing, n, m)
        return m, im.size

    def save(anim, d, frames):
        folder = cfg.out / anim / d
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("frame-*.png"):
            old.unlink()
        for i, im in enumerate(frames):
            im.save(folder / f"frame-{i}.png")

    ground = {}
    for facing, d in DIRS.items():
        rest, size = clean("idle", facing, 0, cfg.src / "idle" / d / "frame-0.png")
        b = cfg.idle_breath[facing]
        if b is None:
            idle = [render(cfg, rest, size), relight(crouch(render(cfg, rest, size), 0))]
        else:
            breath, _ = clean("idle", facing, b, cfg.src / "idle" / d / f"frame-{b}.png")
            idle = [render(cfg, rest, size), render(cfg, open_eyes(rest, breath), size)]
        save("idle", d, idle)

        walk = [render(cfg, *clean("walk", facing, n, cfg.src / "walk" / d / f"frame-{n}.png")) for n in range(6)]
        save("walk", d, walk)

        raw_run = [render(cfg, *clean("run", facing, n, cfg.src / "run" / d / f"frame-{n}.png")) for n in range(8)]
        first = cfg.run_order[facing]
        frames = raw_run[first:] + raw_run[:first]
        ref = max(range(8), key=lambda n: lowest(frames[n]))
        ground[facing] = ref
        save("run", d, frames)

        soles = lowest(frames[ref])
        crouched = onto(relight(crouch(idle[0], 0)), frames[0].size, soles)
        leaning = onto(relight(crouch(idle[0], LEAN[facing])), frames[0].size, soles)
        save("run_start", d, [leaning, frames[7]])
        save("run_stop", d, [frames[0], crouched])
    (cfg.out / "run-ground.json").write_text(json.dumps(ground, indent=2) + "\n")
