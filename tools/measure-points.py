#!/usr/bin/env python3
"""
The first `points` for kindled-ash (G1.5d, docs/design/art-pipeline.md "points"): measured from the
finished sheet the way PR #40 measured the M1 offsets, and written into art/sheets/kindled-ash.json as
data. ART checks them in art/review/kindled-ash/points.png and corrects any point in a recipe pass;
this script is a one-off and never runs in the build.

- `tip` (heavy_charge): the blade is the largest 8-connected run of husk-shell pixels, grown by up to
  3 px into touching watcher-stone (the blade's dark edge; the shirt is watcher-stone too, so it never
  grows further). Its grip end is the blade pixel nearest the grip (wheel-brass-dark), else nearest a
  hand. The tip is the blade pixel furthest from the grip end along the blade (8-connected steps), so
  the hook's curve counts. Husk-shell runs touching the face (an eye's highlight) are not blades.
  Where the blade is hidden, the tip falls back to the nearest frame of the same facing that shows it.
- `hand` (haul_throw, haul_pull, haul_slide, haul_recover): the skin mask's regions below the head
  (top row 38 or lower) that touch no freckle are hands; the throwing hand is the one reaching
  furthest along the facing, and the point its furthest pixel that way. Where no hand shows (the
  back views, or a hand behind the cloak), the point falls back to the blade's base (its grip end);
  where no blade shows either (the N facings are all cloak), to M1's chain start, the body centre
  2 sim px up, cell (48, 50). The script lists every fallback.

Only unmirrored facings are measured: a `flipX` facing inherits its twin's points, mirrored, in the
pipeline. Points are written in each frame's source pixels: the cell position minus where the source's
(0, 0) landed (dx, dy in art/review/kindled-ash/report.json). Prints a table of what it wrote.

    python3 tools/measure-points.py            # writes the recipe, prints the table
    python3 tools/measure-points.py --dry-run  # prints only
    pnpm exec prettier --write art/sheets/kindled-ash.json
"""
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = "kindled-ash"
SPRITES = ROOT / "packages/shared/assets/sprites"
RECIPE = ROOT / "art/sheets" / f"{SHEET}.json"
REPORT = ROOT / "art/review" / SHEET / "report.json"
TOKENS = {k: v.lower() for k, v in json.loads((ROOT / "packages/shared/data/palette.json").read_text())["tokens"].items()}

FACINGS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]
FORWARD = {"S": (0, 1), "SE": (1, 1), "E": (1, 0), "NE": (1, -1), "N": (0, -1), "NW": (-1, -1), "W": (-1, 0), "SW": (-1, 1)}
POINT_ANIMS = {"tip": ["heavy_charge"], "hand": ["haul_throw", "haul_pull", "haul_slide", "haul_recover"]}
# The body centre in the cell: 5 sim px (10 sheet px at B) above the origin (48, 64).
BODY = (48, 54)
# Where M1 starts the chain, the body centre 2 sim px up (4 sheet px at B): the last fallback.
M1_CHAIN = (48, 50)
HEAD_BOTTOM = 38
GROW = 3

N8 = [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]


def rgb_hex(p):
    return "#%02x%02x%02x" % p[:3]


def components(pixels):
    """8-connected components of a set of (x, y), each a sorted list, in order of their first pixel."""
    seen, out = set(), []
    for p in sorted(pixels):
        if p in seen:
            continue
        seen.add(p)
        todo, comp = [p], []
        while todo:
            q = todo.pop()
            comp.append(q)
            for dx, dy in N8:
                r = (q[0] + dx, q[1] + dy)
                if r in pixels and r not in seen:
                    seen.add(r)
                    todo.append(r)
        out.append(sorted(comp))
    return out


class Frame:
    def __init__(self, img, mask, rect):
        x0, y0, w, h = rect["x"], rect["y"], rect["w"], rect["h"]
        self.colour = {}
        self.skin = set()
        for y in range(h):
            for x in range(w):
                p = img[x0 + x, y0 + y]
                if p[3]:
                    self.colour[(x, y)] = rgb_hex(p)
                if mask[x0 + x, y0 + y][3]:
                    self.skin.add((x, y))

    def of(self, *tokens):
        hexes = {TOKENS[t] for t in tokens}
        return {p for p, c in self.colour.items() if c in hexes}

    def hands(self):
        face = self.face()
        return [
            comp
            for comp in components(self.skin)
            if min(y for _, y in comp) >= HEAD_BOTTOM and comp[0] not in face
        ]

    def face(self):
        """The skin regions that touch a freckle: the face and neck."""
        freckles = self.of("spark-amber")
        return {
            p
            for comp in components(self.skin)
            if any((x + dx, y + dy) in freckles for x, y in comp for dx, dy in N8)
            for p in comp
        }

    def blade(self):
        face = self.face()
        stone = self.of("watcher-stone")
        best = None
        for comp in components(self.of("husk-shell")):
            # An eye's highlight is husk-shell too: skip runs that touch the face.
            if any((x + dx, y + dy) in face for x, y in comp for dx, dy in N8):
                continue
            grown, frontier = set(comp), set(comp)
            for _ in range(GROW):
                frontier = {(x + dx, y + dy) for x, y in frontier for dx, dy in N8} & stone - grown
                grown |= frontier
            # The longest husk-shell run is the blade (growing into the shirt must not make a belt buckle win).
            if best is None or (len(comp), len(grown)) > best[0]:
                best = ((len(comp), len(grown)), grown)
        return best[1] if best else None

    def grip_end(self, blade):
        """The blade pixel nearest the grip (wheel-brass-dark), else nearest a hand, else the body centre."""
        grip = self.of("wheel-brass-dark") or {p for comp in self.hands() for p in comp} or {BODY}
        return min(sorted(blade), key=lambda b: min((b[0] - g[0]) ** 2 + (b[1] - g[1]) ** 2 for g in grip))

    def tip(self):
        blade = self.blade()
        if not blade:
            return None
        start = self.grip_end(blade)
        dist = {start: 0}
        todo = deque([start])
        while todo:
            q = todo.popleft()
            for dx, dy in N8:
                r = (q[0] + dx, q[1] + dy)
                if r in blade and r not in dist:
                    dist[r] = dist[q] + 1
                    todo.append(r)
        far = lambda p: (dist[p], (p[0] - start[0]) ** 2 + (p[1] - start[1]) ** 2, -p[1], -p[0])
        return max(sorted(dist), key=far)

    def hand(self, facing):
        fx, fy = FORWARD[facing]
        ahead = lambda p: (p[0] - BODY[0]) * fx + (p[1] - BODY[1]) * fy
        best = None
        for comp in self.hands():
            p = max(comp, key=lambda q: (ahead(q), -q[1], -q[0]))
            if best is None or ahead(p) > ahead(best):
                best = p
        return best


def main():
    dry = "--dry-run" in sys.argv
    sheet = json.loads((SPRITES / f"{SHEET}.json").read_text())
    img = Image.open(SPRITES / f"{SHEET}.png").convert("RGBA").load()
    mask = Image.open(SPRITES / f"{SHEET}.skin.png").convert("RGBA").load()
    report = {f["name"]: f for f in json.loads(REPORT.read_text())["frames"]}
    recipe = json.loads(RECIPE.read_text())
    points = {}
    rows = []
    fallbacks = []
    for point, anims in POINT_ANIMS.items():
        points[point] = {}
        for anim in anims:
            for facing in FACINGS:
                source = recipe["anims"][anim]["facings"][facing]
                names = sheet["anims"][f"{anim}_{facing}"]["frames"]
                if source.get("flipX"):
                    rows.extend((name, point, None, None, "inherited from its twin, mirrored") for name in names)
                    continue
                found = []
                for name in names:
                    frame = Frame(img, mask, sheet["frames"][name]["frame"])
                    if point == "tip":
                        found.append((frame.tip(), "blade tip"))
                        continue
                    at = frame.hand(facing)
                    if at is not None:
                        found.append((at, "throwing hand"))
                        continue
                    blade = frame.blade()
                    if blade:
                        found.append((frame.grip_end(blade), "fallback: blade base (no hand in the skin mask)"))
                    else:
                        found.append((M1_CHAIN, "fallback: M1's chain start (no hand and no blade in the frame)"))
                    fallbacks.append(name)
                for i, name in enumerate(names):
                    at, how = found[i]
                    if at is None:
                        # The blade is hidden in this frame: the tip of the nearest frame of this facing that shows it.
                        near = sorted((j for j in range(len(names)) if found[j][0] is not None), key=lambda j: (abs(j - i), -j))
                        if not near:
                            sys.exit(f"{anim}_{facing}: no frame shows the blade, so no {point}")
                        at = found[near[0]][0]
                        how = f"fallback: the tip of {names[near[0]]} (the blade is hidden in this frame)"
                        fallbacks.append(name)
                    r = report[name]
                    src = [at[0] - r["dx"], at[1] - r["dy"]]
                    points[point][name] = src
                    rows.append((name, point, at, src, how))
    print("| Frame | Point | Cell | Source | How |")
    print("|---|---|---|---|---|")
    for name, point, at, src, how in rows:
        cell = f"{at[0]}, {at[1]}" if at else ""
        s = f"{src[0]}, {src[1]}" if src else ""
        print(f"| {name} | {point} | {cell} | {s} | {how} |")
    print(f"\nFallbacks: {', '.join(fallbacks) or 'none'}")
    if dry:
        return
    recipe["points"] = points
    RECIPE.write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
