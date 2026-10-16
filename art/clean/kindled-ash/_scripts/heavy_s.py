"""ART: heavy thrust S for kindled-ash (MAIN, 2026-10-16: the generated S thrust, hold and the first
recover frame point the Hookblade to the viewer's right, held in the left hand; the engine puts the
charge spark on the hook, so the hook has to stay in the right hand, the viewer's left).

Writes art/clean/kindled-ash/heavy/south/ in the v3 layout:
- frame-0..10: SS-01's heavy S output as it is (frame-0 is the rotation, the ground reference;
  frames 2-4 are the charge, frame 1 the last recover frame);
- frame-11: the thrust going out, drawn on frame 4 (the charge's end: the right fist in front of the
  belly, the blade drawn back to the left): the blade turns from the left towards the viewer;
- frame-12: the full thrust and the hold: the fist a row lower and the blade pointing at the viewer,
  straight down under the fist, the hook at its tip turning out to the left.
The recover uses frame-11 (coming back), then frame 1. Steel ramp, leather grip, dream-night outline.

    python3 art/clean/kindled-ash/_scripts/heavy_s.py art/raw/ss01-kindled-ash art/clean/kindled-ash
"""
import os, shutil, sys
from PIL import Image

OUT = (0x1C, 0x21, 0x47, 255)
SHELL = (0xE8, 0xE2, 0xD6, 255)
STONE = (0x7D, 0x87, 0x94, 255)
SAIL = (0x8C, 0x7F, 0x6E, 255)
TAR = (0x5E, 0x54, 0x48, 255)
LEATHER = (0x8A, 0x64, 0x20, 255)


def load(p):
    im = Image.open(p).convert("RGBA")
    return {(x, y): im.getpixel((x, y)) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}, im.size


def save(px, size, path):
    im = Image.new("RGBA", size)
    for (x, y), c in px.items():
        assert 0 <= x < size[0] and 0 <= y < size[1], (x, y)
        im.putpixel((x, y), c)
    im.save(path)


def unsheathe(base):
    """Frame 4 without its blade: the part left of the body goes, the part across the body is
    painted over with what is above and below it, and the body gets its left edge back."""
    px = dict(base)
    for p in [p for p in px if p[0] <= 20 and 40 <= p[1] <= 46]:
        del px[p]
    for x in range(21, 29):
        for y, src in ((42, 41), (43, 46), (44, 45)):
            if (x, src) in base:
                px[(x, y)] = base[(x, src)]
            else:
                px.pop((x, y), None)
    for y in range(40, 47):
        xs = [x for x in range(15, 30) if (x, y) in px]
        if xs:
            px[(min(xs), y)] = OUT
    return px


def hook(px, fist, blade):
    """The fist (4 x 3, lit from the top left) and the Hookblade under it; blade = (dx, dy, colour)
    relative to the fist's bottom-left. Outlined wherever it meets the background or the body."""
    fx, fy = fist
    new = {}
    for y in range(fy, fy + 3):
        for x in range(fx, fx + 4):
            new[(x, y)] = TAR if y == fy + 2 or x == fx + 3 else SAIL
    for (dx, dy, c) in blade:
        new[(fx + dx, fy + 3 + dy)] = c
    for p, c in new.items():
        px[p] = c
    for (x, y) in list(new):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                q = (x + ox, y + oy)
                if q not in new and (q[1] > fy + 2 or q not in px):
                    px[q] = OUT


# turning out: grip, the blade down and to the left, the hook at its tip
TURNING = [(1, 0, LEATHER), (0, 1, SHELL), (1, 1, STONE), (-1, 2, SHELL), (0, 2, STONE),
           (-2, 3, SHELL), (-1, 3, STONE), (-3, 3, SHELL), (-3, 2, STONE)]
# at the viewer: grip, a 4 px blade straight down, the hook turning out to the left
AT_VIEWER = [(1, 0, LEATHER), (2, 0, LEATHER)] + [(1, k, SHELL) for k in range(1, 5)] + [
    (2, k, STONE) for k in range(1, 5)] + [(0, 5, SHELL), (1, 5, STONE), (-1, 4, SHELL), (-1, 3, STONE)]


def main(raw, clean):
    src, dst = os.path.join(raw, "heavy", "south"), os.path.join(clean, "heavy", "south")
    os.makedirs(dst, exist_ok=True)
    for i in range(11):
        shutil.copy(os.path.join(src, f"frame-{i}.png"), os.path.join(dst, f"frame-{i}.png"))
    base, size = load(os.path.join(src, "frame-4.png"))
    f11 = unsheathe(base)
    hook(f11, (29, 42), TURNING)
    save(f11, size, os.path.join(dst, "frame-11.png"))
    f12 = unsheathe(base)
    hook(f12, (29, 43), AT_VIEWER)
    save(f12, size, os.path.join(dst, "frame-12.png"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
