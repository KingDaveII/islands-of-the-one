"""ART: the Clay Remembrance's sheathed Kindled from art/raw/clay-sheathed (#116); the cleaning itself is
art/clean/_shared/sheathed.py (read it first).

- the wrap #BFB5A0 -> wheel-eye: undyed cloth, shaded in the fired-clay ramp (sleeper-soil, sleeper-flesh)
  where the generator shaded it in the skin colours. Not sleeper-soil alone, the holding's ground, where
  the wrap would keep only its outline (MAIN, #114). The wrapped feet take the same ramp.
- the dried clay on the apron #975D45 -> sleeper-ochre, Clay's outfit colour.
- the eye whites, pure #FFFFFF here, -> wheel-eye.
- idle: SE's breath frames all have their eyes shut under a fallen fringe, so SE breathes crouched.
- run: the job's report put N's contacts at 0 and 4 by the soles' row alone (they move 1 px there); by
  eye the left foot lands at 3 and the right at 7.

    python3 art/clean/kindled-clay-sheathed/_scripts/clean.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_shared"))
from sheathed import Config, run  # noqa: E402

CLAY = Config(
    rem="clay",
    raw={"#": "#21203b", "i": "#474c55", "w": "#bfb5a0", "s": "#8a7d6d", "t": "#64574a",
         "c": "#975d45", "W": "#ffffff"},
    tokens={"L": "#e9e4d4", "M": "#e3c29e", "F": "#c98f78", "P": "#e3c29e", "Q": "#c98f78",
            "c": "#9c5b4a"},
    idle_breath={"S": 4, "SE": None, "E": 4, "NE": 3, "N": 2, "NW": 4, "W": 4, "SW": 4},
    run_order={"S": 2, "SE": 6, "E": 0, "NE": 0, "N": 3, "NW": 4, "W": 1, "SW": 2},
)

if __name__ == "__main__":
    run(CLAY)
