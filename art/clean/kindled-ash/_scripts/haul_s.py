"""ART: haul S for kindled-ash (MAIN's G1.5b measurements, 2026-10-16: in the generated S haul the empty
left hand reaches east while the Hookblade stays in the other hand).

Writes art/clean/kindled-ash/haul/south/ in the v3 layout:
- frame-0..6: SS-01's haul S output as it is (frame-0 is the rotation, the ground reference; frame-1 is
  the rest frame the recipe already uses);
- frame-7: the wind-up, SS-01's light_2 S frame 3 (the right hand raises the hook over the shoulder);
- frame-8: the release, drawn on frame-7: the raised arm comes forward and down at the viewer, the
  sleeve across the tunic, the fist in front of the belt and the hook held out under it, tip turned out.
The recover uses frame-0 (the arm back at the side) and frame-1 (rest).
The right hand is on the viewer's left. Steel ramp, leather grip, dream-night outline; other colours
stay raw for the recipe's remap and snap.

    python3 art/clean/kindled-ash/_scripts/haul_s.py art/raw/ss01-kindled-ash art/clean/kindled-ash
"""
import os, shutil, sys
from PIL import Image

OUT = (0x1C, 0x21, 0x47, 255)
SHELL = (0xE8, 0xE2, 0xD6, 255)
STONE = (0x7D, 0x87, 0x94, 255)
SAIL = (0x8C, 0x7F, 0x6E, 255)
TAR = (0x5E, 0x54, 0x48, 255)
LEATHER = (0x8A, 0x64, 0x20, 255)
SLEEVE = (0x7D, 0x87, 0x94, 255)
SLEEVE_SHADE = (0x5B, 0x54, 0x78, 255)


def load(p):
    im = Image.open(p).convert("RGBA")
    return {(x, y): im.getpixel((x, y)) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}, im.size


def save(px, size, path):
    im = Image.new("RGBA", size)
    for (x, y), c in px.items():
        assert 0 <= x < size[0] and 0 <= y < size[1], (x, y)
        im.putpixel((x, y), c)
    im.save(path)


def outline(px, pts):
    """Dream-night round the given pixels wherever they touch the background."""
    for (x, y) in list(pts):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                q = (x + ox, y + oy)
                if q not in px:
                    px[q] = OUT


def arm(px, fist, blade):
    """The right arm thrown forward and down at the viewer: a 3 px sleeve from the shoulder across the
    tunic to the fist in front of the belt, then the Hookblade held out under the fist (blade = list of
    (x, y, colour) relative to the fist's bottom-left). Outlined all round, which parts it from the body."""
    new = {}
    (fx, fy), (sx, sy) = fist, (23, 35)
    n = max(abs(fx - sx), abs(fy - sy))
    for i in range(n + 1):
        cx, cy = round(sx + (fx + 1 - sx) * i / n), round(sy + (fy - sy) * i / n)
        for k in range(3):
            new[(cx + k, cy)] = SLEEVE_SHADE if k == 0 else SLEEVE
    for y in range(fy, fy + 3):                        # the fist, 4 px wide, lit from the top left
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
                if q not in new:
                    px[q] = OUT


def release(base):
    px = dict(base)
    # the raised arm and the hook over the shoulder go: everything left of the hood and the torso
    for p in [p for p in px if (p[0] <= 22 and p[1] <= 41) or (23 <= p[0] <= 25 and 35 <= p[1] <= 39)]:
        del px[p]
    for x in range(22, 26):                            # the cloak below gets its top edge back
        if (x, 40) in px:
            px[(x, 39)] = OUT
    for y in range(30, 35):                            # and the shoulder its side
        if (23, y) in px and (22, y) not in px:
            px[(22, y)] = OUT
    return px


# the hook held out under the fist: grip, a short blade pointing down at the viewer, the hook turning out
HOOK_OUT = [(1, 0, LEATHER), (2, 0, LEATHER),
            (1, 1, SHELL), (2, 1, STONE), (1, 2, SHELL), (2, 2, STONE), (1, 3, SHELL), (2, 3, STONE),
            (0, 4, SHELL), (1, 4, STONE), (-1, 3, SHELL), (-1, 2, STONE)]


def main(raw, clean):
    dst = os.path.join(clean, "haul", "south")
    os.makedirs(dst, exist_ok=True)
    for i in range(7):
        shutil.copy(os.path.join(raw, "haul", "south", f"frame-{i}.png"), os.path.join(dst, f"frame-{i}.png"))
    windup = os.path.join(raw, "light_2", "south", "frame-3.png")
    shutil.copy(windup, os.path.join(dst, "frame-7.png"))
    base, size = load(windup)
    f8 = release(base)
    arm(f8, (28, 40), HOOK_OUT)
    save(f8, size, os.path.join(dst, "frame-8.png"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
