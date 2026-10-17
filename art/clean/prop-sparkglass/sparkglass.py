"""ART: prop-sparkglass, the Sparkglass pickup the engine flies out of a dying Husk (#61's answer 3).
The same 9 x 11 chip as the Husks' drop frames (art/clean/husks/husk_lib.py), so the drop and the pickup
match: idle is 2 frames, the chip and then a paper glint on its lit facet. Its foot sits on row 53 of
the 64x64 prop canvas, centred on x 32.

    python3 art/clean/prop-sparkglass/sparkglass.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "husks"))
from husk_lib import ROOT, on_canvas, save, sparkglass  # noqa: E402

save(ROOT / "art/clean/prop-sparkglass", "idle", [on_canvas(sparkglass(), 32, 53), on_canvas(sparkglass(glint=True), 32, 53)])
