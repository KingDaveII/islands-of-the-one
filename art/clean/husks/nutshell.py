"""ART: every husk-nutshell frame. The base is drawn here, not taken from husks-m1 (#55): that base put
the core in a vertical dark slit in the middle of a round shell, so the whole Husk read as an eye, and
it was 47 px tall against 34. The look keeps what worked in it, the ridged pale shell.

The base, 40 x 33, light from the top left:
- a squat nut: a superellipse, fuller above than below so it sits low and heavy, no feet;
- the outer shell in the Husk ramp (hollow-light, husk-shell, hollow-dusk) with curved ridges;
- a jagged crack running down and left from the upper right, off-centre, where the shell's cut edge is
  lit and the smoother inner shell (hollow-lavender, hollow-dusk, shadowed hollow-below under the lip)
  shows; the core (husk-core, 3 x 3) peeks out at the crack's widest point inside its hollow-deep ring;
- outline hollow-deep.
Frames are this base moved, sheared by whole pixels per row (the rock and lean), stretched or squashed
by whole rows and columns, cut and re-outlined, or recoloured; nothing is scaled.

    python3 art/clean/husks/nutshell.py
"""
import math

from husk_lib import (AMBER, CLEAR, CORE, DUSK, LAV, LIGHT, OUTLINE, PINK, PINK_DARK, ROOT, SHELL, at, blank,
                      copy, crumbs, drop_cols, drop_rows, dup_cols, dup_rows, erase, on_canvas, opaque, paste,
                      recolour, reoutline, rgb, ring, save, size, sparkglass)

OUT = ROOT / "art/clean/husk-nutshell"
BELOW = rgb("hollow-below")
W, H = 40, 33
CX, FOOT = 32, 53
A, B_TOP, B_BOT, CY, P = 19.6, 18.0, 14.6, 18.0, 2.4
CRACK = [(31, 4), (28, 8), (29, 11), (25, 15), (23, 19), (19, 22), (16, 26), (13, 28)]
CORE_AT = (22, 16)                                   # the core's top-left pixel (3 x 3)


def inside(x, y):
    dx = (x + 0.5 - W / 2) / A
    dy = (y + 0.5 - CY) / (B_TOP if y + 0.5 < CY else B_BOT)
    return abs(dx) ** P + abs(dy) ** P <= 1.0


def half_width(y):
    dy = (y + 0.5 - CY) / (B_TOP if y + 0.5 < CY else B_BOT)
    v = 1 - abs(dy) ** P
    return A * v ** (1 / P) if v > 0 else 0


def seg_dist(px, py, a, b):
    (ax, ay), (bx, by) = a, b
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy)), t


def crack_width(i, t):
    """Half-width along the crack: thin at both ends, widest round the core."""
    s = (i + t) / (len(CRACK) - 1)
    return 0.6 + 2.4 * math.sin(math.pi * min(1.0, s * 1.15)) ** 1.5


def in_crack(x, y):
    best = None
    for i in range(len(CRACK) - 1):
        d, t = seg_dist(x + 0.5, y + 0.5, CRACK[i], CRACK[i + 1])
        if d <= crack_width(i, t):
            return True
        best = d if best is None else min(best, d)
    return False


def base():
    g = blank(W, H)
    for y in range(H):
        for x in range(W):
            if not inside(x, y):
                continue
            nx = (x + 0.5 - W / 2) / A
            ny = (y + 0.5 - CY) / (B_TOP if y + 0.5 < CY else B_BOT)
            lit = -(nx * 0.62 + ny * 0.78)
            g[y][x] = LIGHT if lit > 0.3 else SHELL if lit > -0.62 else DUSK      # dusk only on the lower right rim
    # ridges: meridians curving with the shell, one step darker
    for f in (-0.74, -0.46, -0.17, 0.13, 0.42, 0.7):
        for y in range(2, H - 2):
            x = round(W / 2 - 0.5 + f * half_width(y))
            if 0 <= x < W and opaque(g[y][x]):
                g[y][x] = {LIGHT: SHELL, SHELL: DUSK, DUSK: BELOW}[g[y][x]]
    # the crack: inner shell inside, shadowed under its upper lip
    for y in range(H):
        for x in range(W):
            if opaque(g[y][x]) and in_crack(x, y):
                g[y][x] = LAV if (x + y) % 5 else DUSK
    for y in range(H):
        for x in range(W):
            if g[y][x] in (LAV, DUSK) and in_crack(x, y):
                above = y > 0 and opaque(g[y - 1][x]) and not in_crack(x, y - 1)
                right = x < W - 1 and opaque(g[y][x + 1]) and not in_crack(x + 1, y)
                if above or right:
                    g[y][x] = BELOW                  # the thick outer shell's shadow on the inner one
    # the core and its ring, inside the crack
    cx, cy = CORE_AT
    for y in range(cy - 1, cy + 4):
        for x in range(cx - 1, cx + 4):
            if in_crack(x, y) or (cx <= x < cx + 3 and cy <= y < cy + 3):
                g[y][x] = CORE if (cx <= x < cx + 3 and cy <= y < cy + 3) else OUTLINE
    # the crack's edge on the outer shell: outlined, the lower lip lit (its cut face looks up-left)
    edge = copy(g)
    for y in range(H):
        for x in range(W):
            if not opaque(g[y][x]) or in_crack(x, y):
                continue
            n = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if any(0 <= a < W and 0 <= b < H and in_crack(a, b) and opaque(g[b][a]) for a, b in n):
                edge[y][x] = OUTLINE
    for y in range(H):
        for x in range(W):
            if edge[y][x] in (LIGHT, SHELL, DUSK) and y > 0 and edge[y - 1][x] == OUTLINE and in_crack(x, y - 2):
                edge[y][x] = LIGHT
    return reoutline(edge)


BASE = base()


def shear(g, top_shift):
    """Lean: each row moves by a whole number of px, top_shift at the top, 0 at the foot."""
    w, h = size(g)
    pad = abs(top_shift)
    out = blank(w + 2 * pad, h)
    for y in range(h):
        s = round(top_shift * (h - 1 - y) / (h - 1))
        for x in range(w):
            if opaque(g[y][x]):
                out[y][x + pad + s] = g[y][x]
    return out


def tint(g):
    """Telegraph: the shell turns pink, its shade and outline dark pink; the core and its ring stay."""
    w, h = size(g)
    core = {(x, y) for y in range(h) for x in range(w) if g[y][x] == CORE}
    ringpx = {(x + dx, y + dy) for x, y in core for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    return recolour(g, {SHELL: PINK, LAV: PINK, DUSK: PINK_DARK, BELOW: PINK_DARK, OUTLINE: PINK_DARK},
                    keep=lambda x, y: (x, y) in ringpx)


def place(g, dx=0, lift=0):
    return on_canvas(g, CX + dx, FOOT - lift)


def inner_shell(w=28, h=24, cracked=True):
    """The inner layer alone: a smoother, smaller nut, lavender, its core showing through a split."""
    g = blank(w, h)
    for y in range(h):
        for x in range(w):
            dx = (x + 0.5 - w / 2) / (w / 2 - 0.3)
            dy = (y + 0.5 - h * 0.55) / (h * 0.55 if y + 0.5 < h * 0.55 else h * 0.45)
            if dx * dx + dy * dy <= 1:
                lit = -(dx * 0.62 + dy * 0.78)
                g[y][x] = LIGHT if lit > 0.55 else LAV if lit > -0.25 else DUSK
    if cracked:
        cx, cy = w // 2 - 1, h // 2 - 2
        for y in range(cy - 4, cy + 7):
            for x in range(cx - 1, cx + 4):
                if opaque(g[y][x]) and abs((x - cx - 1) + (y - cy - 1) * 0.35) <= 1.6:
                    g[y][x] = BELOW
        for y in range(cy, cy + 3):
            for x in range(cx, cx + 3):
                g[y][x] = CORE
        for y in range(cy - 1, cy + 4):
            for x in range(cx - 1, cx + 4):
                if g[y][x] != CORE:
                    g[y][x] = OUTLINE
    return reoutline(g)


def exposed_core():
    """chipped_inner: the inner shell broken open, its lower half a cup holding the bare core."""
    cup = reoutline(erase(inner_shell(cracked=False), lambda x, y: y >= 13))
    w, h = size(cup)
    out = copy(cup)
    cx, cy = w // 2 - 4, 6                                    # the bare core: 8 x 8, rounded, in its ring
    for y in range(cy - 1, cy + 9):
        for x in range(cx - 1, cx + 9):
            corner = (x in (cx - 1, cx + 8)) and (y in (cy - 1, cy + 8))
            if corner:
                continue
            ring_px = x in (cx - 1, cx + 8) or y in (cy - 1, cy + 8) or ((x in (cx, cx + 7)) and (y in (cy, cy + 7)))
            if y < 14 or not opaque(out[y][x]):
                out[y][x] = OUTLINE if ring_px else CORE
    for x in range(1, w - 1):                                  # the cup's rim passes in front of the core
        if opaque(cup[13][x]):
            out[13][x] = cup[13][x]
    return out


def spawn():
    core = [[OUTLINE] * 5] + [[OUTLINE] + [CORE] * 3 + [OUTLINE] for _ in range(3)] + [[OUTLINE] * 5]
    gx, gy = CORE_AT
    cx0, cy0 = CX - W // 2, FOOT - (H - 1)
    f0 = at(core, cx0 + gx - 1, cy0 + gy - 1)
    f1 = f0.copy()
    flakes = [erase(BASE, lambda x, y, a=a: a[0] <= x and a[1] <= y and (x - a[0]) + 2 * (y - a[1]) < 10) for a in
              [(5, 5), (27, 21), (8, 22), (29, 9)]]
    for fl, (dx, dy) in zip(flakes, [(-5, -4), (5, 2), (-6, 3), (6, -6)]):
        f1.alpha_composite(at(crumbs(reoutline(fl), 4), cx0 + dx, cy0 + dy))
    half = crumbs(reoutline(erase(BASE, lambda x, y: y >= 15 or in_crack(x, y))), 4)
    f2 = place(half)
    f2.alpha_composite(at(core, cx0 + gx - 1, cy0 + gy - 1))
    return [f0, f1, f2, place(BASE)]


def idle():
    settle = reoutline(dup_cols(drop_rows(BASE, [17]), 20, 1))
    return [place(BASE), place(settle)]


def walk():
    """Rocking forward (east) on hidden feet: lean forward, level and up a pixel, lean back, level."""
    return [place(reoutline(shear(BASE, 3))), place(BASE, lift=1), place(reoutline(shear(BASE, -2))), place(BASE)]


def telegraph():
    rear1 = dup_rows(BASE, 12, 1)
    rear2 = dup_rows(dup_rows(BASE, 12, 1), 20, 1)
    return [place(tint(shear(rear1, -2)), dx=-1), place(tint(shear(rear2, -3)), dx=-2)]


def slam():
    high = dup_rows(dup_rows(BASE, 10, 1), 22, 1)
    impact = reoutline(dup_cols(dup_cols(drop_rows(BASE, [8, 14, 19, 25]), 30, 2), 9, 2))
    return [place(high, lift=4), place(impact)]


def hit():
    return [place(reoutline(shear(drop_rows(BASE, [18]), -2)), dx=-1)]


def chipped_outer():
    return [place(inner_shell())]


def chipped_inner():
    return [place(exposed_core())]


def regrow():
    """The outer shell growing back up over the inner one (poise regrown), bottom to top."""
    inner = inner_shell()
    frames = []
    for line in (22, 13, 5):
        g = blank(W, H)
        paste(g, inner, (W - size(inner)[0]) // 2, H - size(inner)[1])
        grown = crumbs(reoutline(erase(BASE, lambda x, y, l=line: y >= l)), 4)
        paste(g, grown, 0, 0)
        frames.append(place(g))
    return frames


def death():
    pieces = [
        (lambda x, y: x < 18 and y < 17, (-2, -2)),
        (lambda x, y: x >= 18 and y < 15, (2, -3)),
        (lambda x, y: x < 21 and y >= 17, (-2, 0)),
        (lambda x, y: x >= 21 and y >= 15, (2, 0)),
    ]
    chunks = [crumbs(reoutline(erase(BASE, lambda x, y, k=k: k(x, y) and not in_crack(x, y))), 4) for k, _ in pieces]
    cx0, cy0 = CX - W // 2, FOOT - (H - 1)
    gx, gy = CORE_AT
    frames = []
    for k, (spread, r, drop_px, keep) in enumerate([(1, 3, 0, 1.0), (2, 6, 1, 1.0), (3, 9, 3, 0.6), (4, 12, 5, 0.3)]):
        img = at(blank(1, 1), 0, 0)
        for chunk, (_, (dx, dy)) in zip(chunks, pieces):
            g = chunk
            if keep < 1:
                g = erase(g, lambda x, y, q=keep: ((x // 4) * 7 + (y // 4) * 3) % 10 < q * 10)
                g = crumbs(reoutline(g), 4)
            fall = drop_px if dy < 0 else 0
            img.alpha_composite(at(g, cx0 + dx * spread, cy0 + dy * spread // 2 + fall))
        gaps = None if k < 2 else (lambda a, b: (a + b) % 3 == 0) if k == 2 else (lambda a, b: (a * 3 + b) % 4 != 0)
        rg = ring(r, gaps=gaps)
        n = size(rg)[0]
        img.alpha_composite(at(rg, cx0 + gx + 1 - n // 2, cy0 + gy + 1 - n // 2))
        frames.append(img)
    return frames


def drop():
    g = blank(16, 7)
    paste(g, sparkglass(), 0, 1)
    paste(g, sparkglass(), 8, 0)
    return [on_canvas(g, CX, FOOT)]


def main():
    for name, frames in [("spawn", spawn()), ("idle", idle()), ("walk", walk()), ("telegraph", telegraph()),
                         ("slam", slam()), ("hit", hit()), ("chipped_outer", chipped_outer()),
                         ("chipped_inner", chipped_inner()), ("regrow", regrow()), ("death", death()),
                         ("drop", drop())]:
        save(OUT, name, frames)


if __name__ == "__main__":
    main()
