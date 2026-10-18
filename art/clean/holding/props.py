"""ART: the holding's five props, cleaned from the holding job's picks (art/raw/holding/, PR #82) into the
sources the prop recipes read (art/clean/prop-<name>/idle/frame-<n>.png). Whole-pixel edits only:

- every prop: the generator's dream-night outline and inner lines become hollow-deep (dream-night is the
  player's alone); the skin-ramp colours become the material's own ramp (unwritten-tar wood shade to
  wheel-brass-dark or sleeper-ochre, unwritten-sail cloth shade to sleeper-flesh, stone specks to iron);
- writ-post: 9 whole rows taken out of the stone (above and below the tablet), so it stands about the
  player's height; idle frame 1 dims the tablet's amber marks to choir-gold (a slow pulse, 2 fps);
- twisted-tree: kept at its generated size on the tall 96 x 128 cell, its trunk base centred on x 48;
- kesh-rock: 7 whole rows taken out of the shaft; its dark side lifted to hollow-below so it reads on the
  Hollow; its foot dithered out into the void over 8 rows, so it rises from nothing;
- stone-outcrop, holding-store: the placed picks, recoloured.

    python3 art/clean/holding/props.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "art/raw/holding"
T = json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"]


def rgb(k):
    h = T[k]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


DN, DEEP, BELOW = rgb("dream-night"), rgb("hollow-deep"), rgb("hollow-below")
TAR, SAIL = rgb("unwritten-tar"), rgb("unwritten-sail")


def recolour(im, mapping):
    im = im.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[3] and c in mapping:
                px[x, y] = mapping[c]
    return im


def drop_rows(im, rows):
    """Remove whole rows; everything above each removed row moves down, so the foot stays put."""
    rows = sorted(set(rows))
    keep = [y for y in range(im.height) if y not in rows]
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for i, y in enumerate(keep):
        out.paste(im.crop((0, y, im.width, y + 1)), (0, i + len(rows)))
    return out


def save(name, frames):
    d = ROOT / "art/clean" / f"prop-{name}" / "idle"
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("frame-*.png"):
        old.unlink()
    for i, im in enumerate(frames):
        im.save(d / f"frame-{i}.png")


def writ_post():
    im = Image.open(RAW / "writ-post/pick.png").convert("RGBA")
    im = recolour(im, {DN: DEEP, TAR: rgb("watcher-iron")})
    im = drop_rows(im, list(range(15, 18)) + list(range(45, 51)))
    dim = recolour(im, {rgb("spark-amber"): rgb("choir-gold")})
    return [im, dim]


def twisted_tree():
    im = Image.open(RAW / "twisted-tree/pick.png").convert("RGBA")
    im = recolour(im, {DN: DEEP, TAR: rgb("sleeper-ochre")})
    out = Image.new("RGBA", (96, 128), (0, 0, 0, 0))
    out.alpha_composite(im, (-18, 0))                  # the trunk's base (x 66 in the pick) on x 48
    return [out]


def stone_outcrop():
    im = Image.open(RAW / "stone-outcrop/placed.png").convert("RGBA")
    return [recolour(im, {DN: DEEP, TAR: rgb("watcher-iron"), SAIL: rgb("watcher-stone"),
                          rgb("sleeper-soil"): rgb("hollow-dusk")})]


def holding_store():
    im = Image.open(RAW / "holding-store/placed.png").convert("RGBA")
    return [recolour(im, {DN: DEEP, TAR: rgb("wheel-brass-dark"), SAIL: rgb("sleeper-flesh")})]


def kesh_rock():
    im = Image.open(RAW / "kesh-rock/pick.png").convert("RGBA")
    im = drop_rows(im, range(18, 25))
    px = im.load()
    w, h = im.size
    opaque = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0
    edge = {(x, y) for y in range(h) for x in range(w) if opaque(x, y)
            and any(not opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    out = im.copy()
    po = out.load()
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if not c[3]:
                continue
            if (x, y) in edge:
                po[x, y] = DEEP
            elif c in (DN, DEEP):
                po[x, y] = BELOW                        # the dark side, lifted so it reads on the Hollow
    box = out.getbbox()
    foot = box[3] - 1
    for y in range(foot - 7, foot + 1):                # the foot dissolves into the void
        k = y - (foot - 7)                             # 0 .. 7
        for x in range(w):
            if po[x, y][3] and (k >= 6 or (k >= 3 and (x + y) % 2) or (k >= 1 and (x + 2 * y) % 4 == 0)):
                po[x, y] = (0, 0, 0, 0)
    return [out]


def main():
    for name, frames in [("writ-post", writ_post()), ("twisted-tree", twisted_tree()),
                         ("stone-outcrop", stone_outcrop()), ("holding-store", holding_store()),
                         ("kesh-rock", kesh_rock())]:
        save(name, frames)


if __name__ == "__main__":
    main()
