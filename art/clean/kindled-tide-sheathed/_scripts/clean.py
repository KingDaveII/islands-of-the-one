"""ART: the Tide Remembrance's sheathed Kindled from art/raw/tide-sheathed (#118); the cleaning itself is
art/clean/_shared/sheathed.py (read it first).

- the sailcloth tunic #CFC9B2 -> hollow-dusk, Tide's outfit colour, shaded hollow-below where the
  generator shaded it in the skin colours (the folds, the V of the collar, the shoulders on the back).
  The generator's own off-white sat on the holding's earth in hue and value, so only the outline held it.
- the rope belt between its two iron lines, drawn in the skin colours with a pale knot, -> the rope ramp:
  watcher-bronze, wheel-brass-dark, the knot wheel-brass (the job asked for a bronze buckle; the state
  dropped bronze).
- the eye whites, drawn in the tunic's colour 2 or 3 px tall, -> one wheel-eye pixel each.
- walk E 4: the far arm's outline thickens into a dark hook over the tunic (rows 43-44); its inner dark
  pixels there become tunic, as the far arm is drawn in walk E 3 and 5.

    python3 art/clean/kindled-tide-sheathed/_scripts/clean.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_shared"))
from sheathed import Config, run  # noqa: E402

def fix(anim, facing, n, m):
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
