"""ART: run_start and run_stop (M1 polish: 2 frames each, 8 facings, 20 fps, played once, visual only),
made by hand from the finished sheet's own idle and run frames, no generations (David, 2026-10-17).

- run_start: the push-off. 0 = idle crouched (a torso row taken out, so the hood drops 1 px) and leaning
  1 px into the facing; 1 = the run frame just before its first contact (run frame 7: the push), so the
  run's cycle picks up from its contact.
- run_stop: the plant. 0 = the run's contact (run frame 0, the front foot braking), 1 = idle crouched
  (no lean), settling before idle.

Sources are cut from packages/shared/assets/sprites/kindled-ash.png, so they are already clean (remapped,
snapped, outlined) and sit in the 96 x 80 cell as built; the recipe grounds them on frame 0, which keeps
them where they are. Rerun this after idle or run change:

    python3 art/clean/kindled-ash/_scripts/run_transitions.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
SHEET = ROOT / "packages/shared/assets/sprites/kindled-ash"
OUT = ROOT / "art/clean/kindled-ash"
DIRS = {"S": "south", "SE": "south-east", "E": "east", "NE": "north-east",
        "N": "north", "NW": "north-west", "W": "west", "SW": "south-west"}
LEAN = {"S": 0, "SE": 1, "E": 1, "NE": 1, "N": 0, "NW": -1, "W": -1, "SW": -1}


def cells():
    meta = json.loads(SHEET.with_suffix(".json").read_text())
    img = Image.open(SHEET.with_suffix(".png")).convert("RGBA")

    def cell(name):
        f = meta["frames"][name]["frame"]
        return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    return cell


def crouch(im, lean):
    """Take one row out of the torso (the figure's middle row), dropping everything above it by 1 px,
    then lean the part above the hips `lean` px into the facing."""
    w, h = im.size
    box = im.getbbox()
    top, bottom = box[1], box[3]
    cut = top + (bottom - top) // 2                 # the torso's middle row
    hips = top + (bottom - top) * 2 // 3
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(im.crop((0, cut + 1, w, h)), (0, cut + 1))        # the legs stay where they are
    upper = im.crop((0, 0, w, cut))
    out.alpha_composite(upper, (0, 1))                          # everything above the cut drops 1 px
    if lean:
        moved = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        moved.paste(out.crop((0, hips, w, h)), (0, hips))
        shoulders = out.crop((0, 0, w, hips))
        moved.alpha_composite(shoulders, (lean, 0))
        out = moved
    return out


def save(anim, direction, frames):
    d = OUT / anim / direction
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("frame-*.png"):
        old.unlink()
    for i, im in enumerate(frames):
        im.save(d / f"frame-{i}.png")


def main():
    cell = cells()
    for facing, direction in DIRS.items():
        idle = cell(f"idle_{facing}_0")
        save("run_start", direction, [crouch(idle, LEAN[facing]), cell(f"run_{facing}_7")])
        save("run_stop", direction, [cell(f"run_{facing}_0"), crouch(idle, 0)])


if __name__ == "__main__":
    main()
