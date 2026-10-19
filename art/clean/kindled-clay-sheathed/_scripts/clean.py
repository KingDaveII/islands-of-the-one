"""ART: cleans art/raw/clay-sheathed (art job remembrance-sheathed, #116) into the frames of
art/sheets/kindled-clay-sheathed.json. No generations.

Every raw pixel is first sorted to the nearest of the generator's seven colours (the skeleton warp's
in-between shades go with them), then given its material:

- outline #21203B -> dream-night; hair and trousers #474C55 -> watcher-iron; the apron's clay #975D45 ->
  sleeper-ochre.
- the wrap #BFB5A0 -> wheel-eye: undyed cloth, shaded in the fired-clay ramp (below). Not sleeper-soil
  alone, the holding's ground, where the wrap would keep only its outline (MAIN, #114).
- the clay skin ramp (#8A7D6D / #64574A -> unwritten-sail / unwritten-tar) stays only on skin: the
  generator also shaded the wrap and drew the wrapped feet in the skin colours, and the clay-tone swap
  recolours every masked pixel. Skin is what the outline bounds: the skin-coloured pixels with no wrap
  pixel round them, in runs of 3 or more, and their edges. The rest of the skin colours, and the feet
  (under the trousers, or in the frame's last rows), become cloth: sail -> sleeper-soil, tar ->
  sleeper-flesh. A piece of skin with no light in it (an ear) gets one light pixel, so the mask takes it.
- the eye whites, pure #FFFFFF, -> wheel-eye; the freckles, drawn in the wrap's colour, -> spark-amber
  (one or two wrap pixels on the head with skin round them; of a pair, the left one).
- idle: the rest frame (the rotation) and the fullest breath. S's breath has its eyes shut: they are copied
  from the rest frame. SE's breath frames all do, under a fallen fringe: its breath is the rest frame crouched.

run_start and run_stop are made as the Ash sheets' are (run_transitions.crouch): run_start = idle crouched
and leaning into the facing, then the run's push; run_stop = the run's contact, then idle crouched. They
sit on the run's 80 x 80 canvas with the idle's soles on the run's ground row, so the recipe grounds them on
the crouch.

    python3 art/clean/kindled-clay-sheathed/_scripts/clean.py
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
RAW = ROOT / "art/raw/clay-sheathed"
OUT = ROOT / "art/clean/kindled-clay-sheathed"
sys.path.insert(0, str(ROOT / "art/clean/kindled-ash/_scripts"))
from run_transitions import crouch  # noqa: E402

DIRS = {"S": "south", "SE": "south-east", "E": "east", "NE": "north-east",
        "N": "north", "NW": "north-west", "W": "west", "SW": "south-west"}
LEAN = {"S": 0, "SE": 1, "E": 1, "NE": 1, "N": 0, "NW": -1, "W": -1, "SW": -1}


def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


RAWKEY = {"#": "#21203b", "i": "#474c55", "w": "#bfb5a0", "s": "#8a7d6d", "t": "#64574a",
          "c": "#975d45", "W": "#ffffff"}
TOKEN = {"#": "#1c2147", "i": "#4a4e57", "c": "#9c5b4a", "s": "#8c7f6e", "t": "#5e5448",
         "L": "#e9e4d4", "M": "#e3c29e", "F": "#c98f78", "E": "#e9e4d4", "A": "#f2b65a"}
KEYRGB = {k: hx(v) for k, v in RAWKEY.items()}
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))

# Which source frames each animation uses: idle the rest frame (the rotation, frame 0) and the fullest
# breath; walk all six; run all eight, listed from the first contact (checked by eye).
# SE's breath frames all have the eyes shut and the fringe fallen over them, so its breath is the rest frame
# crouched (a torso row out, the head 1 px lower), as run_start's crouch is made.
IDLE_BREATH = {"S": 4, "SE": None, "E": 4, "NE": 3, "N": 2, "NW": 4, "W": 4, "SW": 4}
# The job's report found N's contacts at 0 and 4 by the soles' row alone (they move 1 px there); by eye the
# left foot lands at 3 and the right at 7.
RUN_ORDER = {"S": 2, "SE": 6, "E": 0, "NE": 0, "N": 3, "NW": 4, "W": 1, "SW": 2}


def classify(im):
    w, h = im.size
    px = im.load()
    g = {}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0:
                continue
            g[x, y] = min(KEYRGB, key=lambda k: sum((a - b) ** 2 for a, b in zip(p[:3], KEYRGB[k])))
    return g


def components(cells):
    seen, out = set(), []
    for start in cells:
        if start in seen:
            continue
        stack, comp = [start], []
        seen.add(start)
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for dx, dy in N4:
                n = (x + dx, y + dy)
                if n in cells and n not in seen:
                    seen.add(n)
                    stack.append(n)
        out.append(comp)
    return out


N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
CLOTH = {"s": "M", "t": "F"}  # the skin colours where they are cloth: sleeper-soil, sleeper-flesh


def materials(g):
    """Give every pixel its material letter (see TOKEN)."""
    m = dict(g)
    ys = [y for _, y in g]
    top, bottom = min(ys), max(ys)
    lower = top + (bottom - top) * 2 // 3
    skin = {p for p, k in g.items() if k in "st"}
    # Freckles: one or two wrap-coloured pixels on the head with skin colours round them (at most one
    # outline pixel, on the cheek's edge); lower down, that is the wrap's shading.
    # The 3/4 views draw each as a pair of pixels: the first (left) one is the freckle, the other skin.
    head = top + (bottom - top) * 42 // 100
    freckles, cheek = set(), set()
    for comp in components({p for p, k in g.items() if k == "w" and p[1] <= head}):
        rim = {(x + dx, y + dy) for x, y in comp for dx, dy in N4} - set(comp)
        if len(comp) <= 2 and all(g.get(p) in ("s", "t", "#") for p in rim) \
                and sum(g.get(p) in ("s", "t") for p in rim) >= len(rim) - 1:
            first = min(comp)
            freckles.add(first)
            cheek.update(p for p in comp if p != first)

    # Feet: skin colours in the lower third with trousers above them in the same column, or reaching the
    # frame's last 3 rows (a foot kicked up behind, seen sole first).
    def under_trousers(x, y):
        return y >= lower and any(g.get((x, y - d)) == "i" for d in range(1, 8))
    feet = set()
    for comp in components(skin):
        if sum(under_trousers(x, y) for x, y in comp) * 2 >= len(comp) \
                or max(y for _, y in comp) >= bottom - 3:
            feet.update(comp)
    skin -= feet

    # Skin is bounded by the outline; the wrap's shading in the skin colours lies among wrap pixels. The
    # core of the skin is the skin-coloured pixels with no wrap pixel around them (8 neighbours); runs of
    # at least 3 are kept, with the skin-coloured pixels next to them (the face's and hands' edges).
    def wrap(p):
        return g.get(p) == "w" and p not in freckles and p not in cheek
    core = {p for p in skin if not any(wrap((p[0] + dx, p[1] + dy)) for dx, dy in N8)}
    core = {p for comp in components(core) if len(comp) >= 3 for p in comp}
    real = core | {p for p in skin if any((p[0] + dx, p[1] + dy) in core for dx, dy in N4)}

    for p in skin | feet:
        if p not in real:
            m[p] = CLOTH[g[p]]
    # A piece of skin with no skin light in it (an ear in the shade) gets one: its top-left pixel.
    for comp in components(real):
        if all(g[p] == "t" for p in comp):
            m[min(comp, key=lambda p: (p[1], p[0]))] = "s"

    for p, k in g.items():
        if k == "w":
            m[p] = "A" if p in freckles else "s" if p in cheek else "L"
        elif k == "W":
            m[p] = "E"
    return m


def render(m, size):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    px = im.load()
    for (x, y), k in m.items():
        px[x, y] = hx(TOKEN[k]) + (255,)
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


def clean(path):
    im = Image.open(path).convert("RGBA")
    return materials(classify(im)), im.size


def save(anim, direction, frames):
    d = OUT / anim / direction
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("frame-*.png"):
        old.unlink()
    for i, im in enumerate(frames):
        im.save(d / f"frame-{i}.png")


def lowest(im):
    return im.getbbox()[3] - 1


def onto(im, size, soles):
    """im centred on a canvas of `size`, moved so its lowest row is `soles`."""
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(im, ((size[0] - im.width) // 2, soles - lowest(im)))
    return out


def main():
    ground = {}
    for facing, d in DIRS.items():
        rest, size = clean(RAW / "idle" / d / "frame-0.png")
        if IDLE_BREATH[facing] is None:
            idle = [render(rest, size), crouch(render(rest, size), 0)]
        else:
            breath, _ = clean(RAW / "idle" / d / f"frame-{IDLE_BREATH[facing]}.png")
            idle = [render(rest, size), render(open_eyes(rest, breath), size)]
        save("idle", d, idle)

        walk = [render(*clean(RAW / "walk" / d / f"frame-{n}.png")) for n in range(6)]
        save("walk", d, walk)

        raw_run = [render(*clean(RAW / "run" / d / f"frame-{n}.png")) for n in range(8)]
        first = RUN_ORDER[facing]
        run = raw_run[first:] + raw_run[:first]
        ref = max(range(8), key=lambda n: lowest(run[n]))
        ground[facing] = ref
        save("run", d, run)

        soles = lowest(run[ref])
        crouched = onto(crouch(idle[0], 0), run[0].size, soles)
        leaning = onto(crouch(idle[0], LEAN[facing]), run[0].size, soles)
        save("run_start", d, [leaning, run[7]])
        save("run_stop", d, [run[0], crouched])
    (OUT / "run-ground.json").write_text(json.dumps(ground, indent=2) + "\n")


if __name__ == "__main__":
    main()
