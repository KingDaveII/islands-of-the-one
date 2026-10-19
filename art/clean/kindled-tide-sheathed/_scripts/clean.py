"""ART: the Tide Remembrance's sheathed Kindled from art/raw/tide-sheathed (#118); the cleaning itself is
art/clean/_shared/sheathed.py (read it first).

- the sailcloth tunic #CFC9B2 -> hollow-dusk, Tide's outfit colour, shaded hollow-below where the
  generator shaded it in the skin colours (the folds, the V of the collar, the shoulders on the back).
  The generator's own off-white sat on the holding's earth in hue and value, so only the outline held it.
- the rope belt between its two iron lines, drawn in the skin colours with a pale knot, -> the rope ramp:
  watcher-bronze, wheel-brass-dark, the knot wheel-brass (the job asked for a bronze buckle; the state
  dropped bronze).
- the eye whites, drawn in the tunic's colour 2 or 3 px tall, -> one wheel-eye pixel each.
- NE and NW: the far arm, drawn bare in the skin colours from shoulder to hand, becomes the sleeve down to
  the wrist as in every other facing; the hand stays skin (MAIN, after #121).
- walk E 4: the far arm's outline thickens into a dark hook over the tunic (rows 43-44); its inner dark
  pixels there become tunic, as the far arm is drawn in walk E 3 and 5.

    python3 art/clean/kindled-tide-sheathed/_scripts/clean.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_shared"))
from sheathed import Config, run  # noqa: E402

HAND = 4  # the bottom rows of an arm that are the hand


def components(cells):
    seen, out = set(), []
    for start in sorted(cells):
        if start in seen:
            continue
        stack, comp = [start], []
        seen.add(start)
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n in cells and n not in seen:
                    seen.add(n)
                    stack.append(n)
        out.append(comp)
    return out


def sleeve(m):
    """NE and NW: the generator drew the arm on the far side bare, shoulder to hand, in the skin colours; in
    every other facing it is the tunic's sleeve to the wrist (MAIN, after #121). A tall, narrow run of skin
    below the head is that arm: all but its last HAND rows become sleeve (hollow-dusk, its shade hollow-below);
    the hand stays skin. The nape and the near hand are too short to be taken."""
    hair = min(components({p for p, k in m.items() if k == "i"}), key=lambda c: min(y for _, y in c))
    hair_bottom = max(y for _, y in hair)
    for comp in components({p for p, k in m.items() if k in "st"}):
        xs, ys = [x for x, _ in comp], [y for _, y in comp]
        if max(ys) - min(ys) + 1 >= 7 and max(xs) - min(xs) + 1 <= 7 and min(ys) > hair_bottom:
            for x, y in comp:
                if y <= max(ys) - HAND:
                    m[x, y] = "L" if m[x, y] == "s" else "M"
    return m


def fix(anim, facing, n, m):
    if facing in ("NE", "NW"):
        m = sleeve(m)
    if (anim, facing, n) == ("walk", "E", 4):
        for x in range(35, 38):
            for y in range(43, 45):
                if m.get((x, y)) == "#" and all((x + dx, y + dy) in m for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    m[x, y] = "L"
    return m


TIDE = Config(
    rem="tide",
    raw={"#": "#1f203d", "i": "#484a51", "w": "#cfc9b2", "s": "#948477", "t": "#5c5448"},
    tokens={"L": "#a99fc4", "M": "#5b5478", "F": "#5b5478", "P": "#5b5478", "Q": "#5b5478",
            "R": "#a8743a", "U": "#8a6420", "K": "#c79a3e"},
    idle_breath={"S": 1, "SE": 4, "E": 1, "NE": 2, "N": 2, "NW": 1, "W": 1, "SW": 4},
    run_order={"S": 2, "SE": 5, "E": 5, "NE": 0, "N": 0, "NW": 5, "W": 1, "SW": 1},
    belt=True,
    fix=fix,
)

if __name__ == "__main__":
    run(TIDE)
