"""ART: eye whites for kindled-ash (style sheet: Kindled eyes are at most 2x2 with one eye-white pixel;
David's playtest, 2026-10-16: facing S without them he looks asleep).

Reads the BUILT sheet and art/review/kindled-ash/report.json, finds the eyes of every S, SE and SW frame
of the given animations that has no eye white yet (dark islands of at most 4 px in the rows just above
the freckles, mostly ringed by skin), and proposes one husk-shell pixel per eye: on a 2-wide eye its
outer top pixel, on a 1-wide eye the skin pixel beside it, outward. The proposals are recipe fixes in
source pixels (cell minus the report's dx, dy). Frames where no eye is found are listed for a look by
hand (a closed or turned face, a roll, a fall).

    pnpm art:build kindled-ash
    python3 art/clean/kindled-ash/_scripts/eyes.py run            # report only
    python3 art/clean/kindled-ash/_scripts/eyes.py run --apply    # add the fixes to the recipe
    node_modules/.bin/prettier --write art/sheets/kindled-ash.json && pnpm art:build kindled-ash
"""
import json, sys
from PIL import Image

SHEET = "packages/shared/assets/sprites/kindled-ash"
RECIPE = "art/sheets/kindled-ash.json"
REPORT = "art/review/kindled-ash/report.json"
h = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
FRECKLE, WHITE = h("#f2b65a"), h("#e8e2d6")
SKIN = {h("#8c7f6e"), h("#5e5448")}
DARK = {h("#1c2147"), h("#2a2540")}


def cell(meta, sheet, name):
    f = meta["frames"][name]["frame"]
    return sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


def has_white(im):
    px = im.load()
    fr = [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3] and px[x, y][:3] == FRECKLE]
    if not fr:
        return None
    fy = min(y for _, y in fr)
    x0, x1 = min(x for x, _ in fr) - 4, max(x for x, _ in fr) + 4
    return any(px[x, y][3] and px[x, y][:3] == WHITE for y in range(fy - 5, fy) for x in range(x0, x1 + 1))


def eyes(im):
    px = im.load()
    w, hgt = im.size
    fr = [(x, y) for y in range(hgt) for x in range(w) if px[x, y][3] and px[x, y][:3] == FRECKLE]
    if not fr:
        return None, []
    fy = min(y for _, y in fr)
    fx0, fx1 = min(x for x, _ in fr), max(x for x, _ in fr)
    dark = lambda q: 0 <= q[0] < w and 0 <= q[1] < hgt and px[q][3] and px[q][:3] in DARK
    seen, islands = set(), []
    for y in range(fy - 6, fy):
        for x in range(fx0 - 4, fx1 + 5):
            if (x, y) in seen or not dark((x, y)):
                continue
            st, c = [(x, y)], []
            seen.add((x, y))
            while st:
                q = st.pop()
                c.append(q)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        r = (q[0] + dx, q[1] + dy)
                        if r not in seen and dark(r) and fy - 6 <= r[1] < fy:
                            seen.add(r)
                            st.append(r)
            islands.append(c)
    keep = []
    for c in islands:
        xs, ys = [x for x, _ in c], [y for _, y in c]
        if len(c) > 4 or max(ys) < fy - 3 or min(ys) < fy - 5:
            continue
        if max(xs) - min(xs) > max(ys) - min(ys) and min(ys) < fy - 3:
            continue  # a brow: wider than tall, high up
        ring = [(q[0] + dx, q[1] + dy) for q in c for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (q[0] + dx, q[1] + dy) not in c]
        if sum(1 for r in ring if px[r][3] and px[r][:3] in SKIN) < len(ring) * 0.6:
            continue
        keep.append(c)
    keep.sort(key=lambda c: min(x for x, _ in c))
    return (fx0 + fx1) / 2, keep[:2]


def proposals(im):
    mid, found = eyes(im)
    if mid is None:
        return []
    px, out = im.load(), []
    for c in found:
        cx = sum(x for x, _ in c) / len(c)
        top = min(y for _, y in c)
        row = [x for x, y in c if y == top]
        side = -1 if cx < mid else 1
        x = min(row) if side < 0 else max(row)
        if len({x for x, _ in c}) >= 2:
            out.append((x, top))
        elif px[x + side, top][3] and px[x + side, top][:3] in SKIN:
            out.append((x + side, top))
    return out


def main(anims, apply):
    meta = json.load(open(SHEET + ".json"))
    sheet = Image.open(SHEET + ".png").convert("RGBA")
    place = {f["name"]: (f["dx"], f["dy"]) for f in json.load(open(REPORT))["frames"]}
    fixes, by_hand = {}, []
    for name in meta["frames"]:
        anim, facing = name.rsplit("_", 2)[0], name.rsplit("_", 2)[1]
        if anim not in anims or facing not in ("S", "SE", "SW"):
            continue
        im = cell(meta, sheet, name)
        if has_white(im) is not False:
            continue  # already has a white, or no face (no freckles)
        found = proposals(im)
        if not found:
            by_hand.append(name)
            continue
        dx, dy = place[name]
        fixes[name] = [[x - dx, y - dy, "#e8e2d6"] for x, y in found]
    for name, px in fixes.items():
        print(name, px)
    print("look by hand:", by_hand)
    if apply and fixes:
        recipe = json.load(open(RECIPE))
        by = {f["frame"]: f for f in recipe["fixes"]}
        for name, px in fixes.items():
            if name in by:
                by[name]["pixels"].extend(px)
            else:
                recipe["fixes"].append({"frame": name, "pixels": px})
        json.dump(recipe, open(RECIPE, "w"), indent=2)
        print(f"added fixes to {len(fixes)} frames; run prettier and rebuild")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(set(args), "--apply" in sys.argv)
