"""ART: every husk-peeling frame, drawn by hand from ART's exemplar art/anchors/husk-peeling-64.png
(22 x 18, the curl round its core), because the generated animations in husks-m1 (#55) lost the curl
and the core. Frames are the exemplar moved, stretched by repeating whole columns, squashed by removing
whole rows, cut and re-outlined, or recoloured; nothing is scaled.

- spawn: the core alone in its ring, flakes circling it, the curl half closed, closed (= idle 0);
- idle: rest, then breathing out a row;
- telegraph: pulled back from the target (it faces east, so west) 1 then 2 px and squashed, pre-tinted:
  shell signal-telegraph, shade and outline signal-telegraph-dark; the core and its ring stay;
- lunge: stretch (+4 columns through the side coils, 2 rows lower), hit (+8, 3 rows lower, 5 px forward),
  settle;
- hit: a flinch back, a row lower; chipped: the curl's top and a bite of its outer coil gone;
- death: the curl parts as the core flares into a growing ring that breaks up, the halves crumbling;
- drop: the Sparkglass chip.

    python3 art/clean/husks/peeling.py
"""
from husk_lib import (CLEAR, CORE, DUSK, LIGHT, OUTLINE, PINK, PINK_DARK, ROOT, SHELL, at, copy, crumbs,
                      drop_cols, drop_rows, dup_cols, dup_rows, erase, load, on_canvas, paste, recolour,
                      reoutline, ring, save, size, sparkglass)

OUT = ROOT / "art/clean/husk-peeling"
E = reoutline(load(ROOT / "art/anchors/husk-peeling-64.png"))  # 22 x 18 at (20, 36); closes its 4 open edge px
X0, Y0 = 20, 36
FOOT = 53
CORE_C = (X0 + 8, Y0 + 10)                               # the core's top-left pixel on the canvas
CX = X0 + 11                                             # the exemplar's centre column


def near_core(x, y, gx=8, gy=10):
    """Pixels of the core and its ring, in exemplar coordinates."""
    return gx - 1 <= x <= gx + 2 and gy - 1 <= y <= gy + 2


def spawn():
    core = [[OUTLINE] * 4, [OUTLINE, CORE, CORE, OUTLINE], [OUTLINE, CORE, CORE, OUTLINE], [OUTLINE] * 4]
    f0 = at(core, CORE_C[0] - 1, CORE_C[1] - 1)
    flake = [
        [CLEAR, OUTLINE, OUTLINE, CLEAR],
        [OUTLINE, LIGHT, SHELL, OUTLINE],
        [OUTLINE, SHELL, DUSK, OUTLINE],
        [CLEAR, OUTLINE, OUTLINE, CLEAR],
    ]
    small = [[OUTLINE, OUTLINE, OUTLINE], [OUTLINE, SHELL, OUTLINE], [OUTLINE, OUTLINE, OUTLINE]]
    f1 = f0.copy()
    for g, (dx, dy) in [(flake, (-9, -6)), (flake, (7, -8)), (small, (9, 3)), (flake, (-6, 4)), (small, (1, -11))]:
        img = at(g, CORE_C[0] + dx, CORE_C[1] + dy)
        f1.alpha_composite(img)
    half = erase(E, lambda x, y: not (x > 10 and y < 10))          # the curl's top right not yet closed
    half = crumbs(reoutline(half), 4)
    half = paste(half, [[OUTLINE] * 4, [OUTLINE, CORE, CORE, OUTLINE], [OUTLINE, CORE, CORE, OUTLINE], [OUTLINE] * 4], 7, 9)
    f2 = at(half, X0, Y0)
    f3 = at(E, X0, Y0)
    return [f0, f1, f2, f3]


def idle():
    return [at(E, X0, Y0), on_canvas(dup_cols(dup_rows(E, 9, 1), 3, 1), CX, FOOT)]


def tint(g, core_at=(8, 10)):
    gx, gy = core_at
    return recolour(g, {SHELL: PINK, DUSK: PINK_DARK, OUTLINE: PINK_DARK},
                    keep=lambda x, y: near_core(x, y, gx, gy))


def telegraph():
    f0 = tint(E)
    g1 = drop_cols(drop_rows(E, [7]), [12])                 # squashed, the core stays at (8, 9)
    f1 = tint(g1, core_at=(8, 9))
    return [at(f0, X0 - 1, Y0), on_canvas(f1, CX - 2, FOOT)]


def lunge():
    # stretched through the two side coils (columns 18 and 3), never through the dark middle
    stretch = drop_rows(dup_cols(dup_cols(E, 18, 2), 3, 2), [5, 13])
    hit = drop_rows(dup_cols(dup_cols(E, 18, 5), 3, 3), [4, 6, 13])
    settle = drop_rows(dup_cols(E, 18, 1), [7])
    stretch, hit, settle = (reoutline(g) for g in (stretch, hit, settle))
    return [on_canvas(stretch, CX + 2, FOOT), on_canvas(hit, CX + 5, FOOT), on_canvas(settle, CX + 1, FOOT)]


def hit():
    return [on_canvas(reoutline(dup_cols(drop_rows(E, [7]), 11, 1)), CX - 1, FOOT)]


def chipped():
    g = erase(E, lambda x, y: not ((y <= 2 and 6 <= x <= 13) or (8 <= y <= 11 and x >= 19)))
    g = crumbs(reoutline(g), 4)
    return [at(g, X0, Y0)]


def death():
    left = crumbs(reoutline(erase(E, lambda x, y: x <= 10 and not near_core(x, y))), 3)
    right = crumbs(reoutline(erase(E, lambda x, y: x >= 11 and not near_core(x, y))), 3)
    frames = []
    for k, (spread, r, keep_every) in enumerate([(2, 2, 0), (4, 4, 0), (6, 6, 2), (8, 8, 3)]):
        img = at(left, X0 - spread, Y0)
        img.alpha_composite(at(right, X0 + spread, Y0))
        if keep_every:                                       # the halves crumble: every other 3x3 block goes
            px = img.load()
            for y in range(64):
                for x in range(64):
                    if px[x, y][3] and ((x // 3) + (y // 3) * (keep_every - 1)) % keep_every == 0:
                        px[x, y] = CLEAR
            g = [[px[x, y] for x in range(64)] for y in range(64)]
            g = crumbs(reoutline(g), 3)
            img = at(g, 0, 0)
        gaps = None
        if k == 2:
            gaps = lambda dx, dy: (dx + dy) % 3 == 0
        if k == 3:
            gaps = lambda dx, dy: (dx * 3 + dy) % 4 != 0
        rg = ring(r, gaps=gaps)
        n = size(rg)[0]
        img.alpha_composite(at(rg, CORE_C[0] + 1 - n // 2, CORE_C[1] + 1 - n // 2))
        frames.append(img)
    return frames


def drop():
    return [on_canvas(sparkglass(), 32, FOOT)]


def main():
    for name, frames in [("spawn", spawn()), ("idle", idle()), ("telegraph", telegraph()), ("lunge", lunge()),
                         ("hit", hit()), ("chipped", chipped()), ("death", death()), ("drop", drop())]:
        save(OUT, name, frames)


if __name__ == "__main__":
    main()
