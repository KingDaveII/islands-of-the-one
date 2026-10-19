"""ART: the Wing Remembrance's sheathed Kindled from art/raw/wing-sheathed (#120); the cleaning itself is
art/clean/_shared/sheathed.py (read it first).

- the mantle #EBD38D -> wheel-brass, its shade #C4A46E -> wheel-brass-dark, the down at its collar and
  lit edge #FAECC9 -> sleeper-soil. The generated mantle was the holding's earth itself (sleeper-soil, a
  straight snap), so on the holding the figure kept only its outline; in brass it stands off the ground and
  the down keeps the pale. The down's own colour sits nearest husk-core, the Husks' colour, so it is
  mapped on purpose.
- the chest and arms are bare clay under a harness of dark straps (the outline and watcher-iron), as
  generated: they stay skin. No wrapped feet (boots), so the feet rule is off.
- the eye whites, drawn in the down's colour 2 or 3 px tall, -> one wheel-eye pixel each.
- strays: a column of skin under the foot in run SE 0 (it set that run's ground 3 px low), specks over the
  hair in run SE 1, a pixel under the sole in walk E 4.
- run: the job's report put N's contacts at 1 and 4 by the soles' row; by eye the feet land at 0 and 4.

    python3 art/clean/kindled-wing-sheathed/_scripts/clean.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_shared"))
from sheathed import Config, run  # noqa: E402

# Pixels the generator left hanging off the figure (raw frame coordinates), by (animation, facing, raw frame).
STRAYS = {
    ("run", "SE", 0): [(38, 63), (38, 64), (38, 65)],          # a column of skin under the near foot
    ("run", "SE", 1): [(43, 18), (44, 18), (46, 18), (56, 24)],  # specks above and right of the hair
    ("walk", "E", 4): [(33, 62)],                                # one pixel under the sole
}


def fix(anim, facing, n, m):
    for p in STRAYS.get((anim, facing, n), []):
        m.pop(p, None)
    return m


WING = Config(
    rem="wing",
    raw={"#": "#20203b", "i": "#494c56", "w": "#ebd38d", "h": "#c4a46e", "d": "#faecc9",
         "s": "#8a8176", "t": "#65574d"},
    pale={"w": "L", "h": "H", "d": "D"},
    tokens={"L": "#c79a3e", "H": "#8a6420", "D": "#e3c29e", "M": "#8a6420", "F": "#8a6420",
            "P": "#4a4e57", "Q": "#4a4e57", "R": "#a8743a", "U": "#8a6420", "K": "#c79a3e"},
    idle_breath={"S": 1, "SE": 1, "E": 1, "NE": 2, "N": 1, "NW": 2, "W": 4, "SW": 2},
    feet=False,
    fix=fix,
    run_order={"S": 5, "SE": 5, "E": 5, "NE": 0, "N": 0, "NW": 4, "W": 1, "SW": 2},
)

if __name__ == "__main__":
    run(WING)
