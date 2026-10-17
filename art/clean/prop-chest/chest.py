"""ART: prop-chest, drawn by hand from the tile job's chest (art/raw/tiles-cave/chest/, PR #56) as the
reference for its look: a squat bronze-wood coffer with brass bands and a gold clasp, seen from the front
and a little above, light from the top left. Drawn here rather than cut from the generated pick because
the pick is 35x30 (target about 24x18) and its open state turns the chest, so the frames would not match.

28 x 22 px closed, centred on x 32 of the 64x64 prop canvas, its foot on row 53 (sprites.md "The chest").
- closed: 2 frames looping at 2 fps: the plain chest, then a glint on the clasp (spark-amber with one
  choir-paper pixel, never a glow; MAIN 2026-10-17);
- opening: 4 frames: the lid lifts, tips back, stands, overshoots by a pixel;
- open: the lid standing behind, its inside showing, the dark empty box below it.
Colours: wood watcher-bronze / wheel-brass-dark, bands wheel-brass with choir-gold light, clasp
choir-gold, inside and outline hollow-deep. No husk colours, no skin ramp.

    python3 art/clean/prop-chest/chest.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "art/clean/prop-chest"
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]


def rgb(k):
    h = T[k]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


O = rgb("hollow-deep")          # outline, plank gaps, the inside
WL = rgb("watcher-bronze")      # wood, lit
WD = rgb("wheel-brass-dark")    # wood, shade
BB = rgb("wheel-brass")         # band
BG = rgb("choir-gold")          # band light, clasp
AM = rgb("spark-amber")         # the glint
PP = rgb("choir-paper")         # the glint's one bright pixel
IN = rgb("hollow-below")        # the inside's far wall, catching a little light

W = 28
X0 = 32 - W // 2                # left edge on the canvas
FOOT = 53                       # the bottom outline row
BAND_X = (4, 22)                # the two bands' left columns (2 px wide each)


class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))

    def px(self, x, y, c):
        self.img.putpixel((X0 + x, y), c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def round_top(self, y):
        """Rounds a block's two top corners: the corner pixels go, the outline steps in."""
        for x in (0, W - 1):
            self.img.putpixel((X0 + x, y), (0, 0, 0, 0))
        self.px(1, y + 1, O)
        self.px(W - 2, y + 1, O)

    def box(self, y0, y1, fill, light=None, shade=None, planks=False, bands=True):
        """A wood block between rows y0 and y1, outlined, lit on its top row and left column."""
        self.rect(0, y0, W - 1, y1, O)
        if y1 - y0 < 2:
            return
        self.rect(1, y0 + 1, W - 2, y1 - 1, fill)
        if light:
            self.rect(1, y0 + 1, W - 2, y0 + 1, light)
            self.rect(1, y0 + 1, 1, y1 - 1, light)
        if shade:
            self.rect(1, y1 - 1, W - 2, y1 - 1, shade)
            self.rect(W - 2, y0 + 1, W - 2, y1 - 1, shade)
        if planks:
            for y in range(y0 + 3, y1 - 1, 3):
                for x in range(2, W - 2):
                    if x % 9 != 4:
                        self.px(x, y, WD)
        if bands:
            for bx in BAND_X:
                self.rect(bx, y0 + 1, bx + 1, y1 - 1, BB)
                self.rect(bx, y0 + 1, bx, y1 - 1, BG)


def body(c, top):
    """The box front from row `top` to the foot: wood planks, two bands, a dark foot."""
    c.box(top, FOOT, WL, light=WL, shade=WD, planks=True)
    c.rect(1, top + 1, W - 2, top + 1, BG)                      # the brass rim along the box's top edge
    for x in range(2, W - 2, 6):
        c.px(x, top + 1, BB)


def lid_closed(c, top, lift=0):
    """The closed lid: its top seen from above (5 rows), then its front (4 rows)."""
    t = top - lift
    c.box(t, t + 5, WL, light=BG, shade=WD)                        # the lid's top surface
    for y in (t + 2, t + 4):                                       # its planks
        for x in range(2, W - 2):
            if x not in range(BAND_X[0], BAND_X[0] + 2) and x not in range(BAND_X[1], BAND_X[1] + 2):
                c.px(x, y, WD if x % 7 else WL)
    c.round_top(t)
    c.box(t + 5, t + 9, WL, light=WL, shade=WD)                    # the lid's front
    if lift:
        c.rect(1, t + 10, W - 2, top + 9, O)                       # the dark gap under the lifted lid
        c.rect(0, t + 10, 0, top + 9, O)
        c.rect(W - 1, t + 10, W - 1, top + 9, O)


def clasp(c, y, glint=False):
    """The gold clasp hanging over the seam: 4 wide, 5 tall, a dark keyhole."""
    x = W // 2 - 2
    c.rect(x - 1, y - 1, x + 4, y + 4, O)
    c.rect(x, y, x + 3, y + 3, BG)
    c.rect(x + 3, y + 1, x + 3, y + 3, BB)
    c.px(x + 1, y + 2, O)
    c.px(x + 1, y + 3, O)
    if glint:
        c.px(x, y, PP)
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            c.px(x + dx, y + dy, AM)


def inside(c, top, depth):
    """The open box seen from above: its rim, the dark inside, the far wall catching a little light."""
    c.box(top, top + depth, O, bands=False)
    c.rect(1, top + 1, W - 2, top + 1, IN)
    c.rect(1, top + 1, 1, top + depth - 1, WD)
    c.rect(W - 2, top + 1, W - 2, top + depth - 1, WD)


def lid_standing(c, bottom, height):
    """The lid tipped back and standing behind the box: its inside faces us, framed in wood and band."""
    top = bottom - height
    c.box(top, bottom, WD, light=WL, shade=WD, bands=False)
    if height >= 5:
        c.rect(3, top + 2, W - 4, bottom - 2, O)
        c.rect(3, top + 2, W - 4, top + 2, IN)
    for bx in BAND_X:
        c.rect(bx, top + 1, bx + 1, bottom - 1, BB)
        c.rect(bx, top + 1, bx, bottom - 1, BG)
    c.round_top(top)


BODY_TOP = FOOT - 12            # the body front: 11 rows of wood plus its outline
LID_TOP = BODY_TOP - 9          # the closed lid: top 5 + front 4


def closed(glint=False):
    c = Canvas()
    body(c, BODY_TOP)
    lid_closed(c, LID_TOP)
    clasp(c, BODY_TOP - 2, glint)
    return c.img


def opening(k):
    c = Canvas()
    body(c, BODY_TOP)
    if k == 0:                                                     # the lid lifts 2 px
        lid_closed(c, LID_TOP, lift=2)
        clasp(c, BODY_TOP - 4)
    elif k == 1:                                                   # tipping back: a thin edge over the inside
        inside(c, BODY_TOP - 5, 5)
        c.box(BODY_TOP - 9, BODY_TOP - 5, WL, light=BG, shade=WD)
        c.round_top(BODY_TOP - 9)
        clasp(c, BODY_TOP - 8)
    else:                                                          # standing; k 3 overshoots by a pixel
        inside(c, BODY_TOP - 5, 5)
        lid_standing(c, BODY_TOP - 5, 8 if k == 2 else 11)
    return c.img


def open_():
    c = Canvas()
    body(c, BODY_TOP)
    inside(c, BODY_TOP - 5, 5)
    lid_standing(c, BODY_TOP - 5, 10)
    return c.img


def save(name, frames):
    d = OUT / name
    d.mkdir(parents=True, exist_ok=True)
    for i, img in enumerate(frames):
        img.save(d / f"frame-{i}.png")


def main():
    save("closed", [closed(), closed(glint=True)])
    save("opening", [opening(k) for k in range(4)])
    save("open", [open_()])


if __name__ == "__main__":
    main()
