/**
 * Whole-pixel shapes for the engine's own effects (ART's answers to #61, M1
 * polish 2026-10-17): pixel circles, arcs, checkers, dashes, dithers and the
 * 5 px plus, as sets of pixel offsets. Pure: no Phaser, no alpha, no
 * anti-aliasing; `plot` in pixels.ts draws a set in one palette token. Every
 * set is built from whole pixels around (0, 0) and is deterministic, so the
 * tests check the pixels themselves.
 */

/** A pixel offset, x then y. */
export type Px = readonly [number, number];

/**
 * Half-width of a disc of radius r at row offset dy, rounded like the
 * midpoint circle: a circle of radius 3 is 3 px wide at its top, not pointed.
 */
function span(r: number, dy: number): number {
  return Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy + r)));
}

const TAU = Math.PI * 2;

/** An angle in [0, 2π). */
const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;

/** The angle of a pixel from the centre, in [0, 2π), clockwise from east on the screen (y down). */
export const pixelAngle = (p: Px): number => wrap(Math.atan2(p[1], p[0]));

/** The pixels of a filled disc of radius r. */
export function discPixels(r: number): Px[] {
  const out: Px[] = [];
  for (let dy = -r; dy <= r; dy++) {
    const h = span(r, dy);
    for (let dx = -h; dx <= h; dx++) out.push([dx + 0, dy + 0]);
  }
  return out;
}

/** The pixels of a 1 px circle of radius r: the disc's outermost pixel on every row and column (no gaps on the diagonals). */
function ringPixels(r: number): Px[] {
  if (r <= 0) return [[0, 0]];
  const out: Px[] = [];
  for (let dy = -r; dy <= r; dy++) {
    const ho = span(r, dy);
    const hi = Math.abs(dy) <= r - 1 ? span(r - 1, dy) : -1;
    for (let dx = -ho; dx <= -hi - 1; dx++) out.push([dx + 0, dy + 0]);
    for (let dx = hi + 1; dx <= ho; dx++) if (dx > -hi - 1 || hi < 0) out.push([dx + 0, dy + 0]);
  }
  // Each pixel once (the rows where the inner span is -1 would list the middle twice).
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = `${p[0]},${p[1]}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * A pixel circle of radius r, `width` px thick (inwards: the rings r, r − 1,
 * …), in angle order clockwise from east so a dash pattern can run round it.
 */
export function circlePixels(r: number, width = 1): Px[] {
  const out: Px[] = [];
  for (let i = 0; i < width && r - i >= 0; i++) out.push(...ringPixels(r - i));
  return out.sort((a, b) => pixelAngle(a) - pixelAngle(b));
}

/**
 * A pixel arc: the part of a circle of radius r, `thick` px thick (inwards),
 * between the angles `from` and `to` (radians, clockwise from east, y down;
 * the arc runs the short way from `from` to `to` when `to` ≥ `from`, so pass
 * the sweep's ends in order). A sweep of 0 draws nothing.
 */
export function arcPixels(r: number, thick: number, from: number, to: number): Px[] {
  const sweep = to - from;
  if (sweep <= 0) return [];
  const start = wrap(from);
  return circlePixels(r, thick).filter((p) => wrap(pixelAngle(p) - start) <= sweep + 1e-9);
}

/**
 * The pixels within `width` (Chebyshev) of a set that are not in it: a
 * `width` px outline round the set.
 */
export function outlinePixels(set: readonly Px[], width = 1): Px[] {
  const inSet = new Set(set.map((p) => `${p[0]},${p[1]}`));
  const out = new Map<string, Px>();
  for (const [x, y] of set) {
    for (let dy = -width; dy <= width; dy++) {
      for (let dx = -width; dx <= width; dx++) {
        const k = `${x + dx},${y + dy}`;
        if (!inSet.has(k) && !out.has(k)) out.set(k, [x + dx, y + dy]);
      }
    }
  }
  return [...out.values()];
}

/** The pixels of a set on the checkerboard: every other pixel, `phase` 0 or 1 picking which half. */
export function checker(set: readonly Px[], phase = 0): Px[] {
  return set.filter(([x, y]) => ((x + y + phase) & 1) === 0);
}

/** Dashes round a circle: the pattern divides it into this many arcs, each kept from its start. */
export const DASH_COUNT = 8;

/**
 * A circle breaking into dashes as it fades (never by alpha): the circle's
 * pixels are split into `DASH_COUNT` equal arcs and each keeps the first
 * `share` (0..1) of its angle, so a share of 1 is the whole circle, 0.5
 * eight dashes with gaps as long, 0 nothing. The pattern is fixed: a
 * pixel's fate depends on its angle alone, so a ring never flickers as it
 * fades.
 */
export function dashed(circle: readonly Px[], share: number): Px[] {
  const s = Math.max(0, Math.min(1, share));
  if (s >= 1) return [...circle];
  if (s <= 0) return [];
  const arc = TAU / DASH_COUNT;
  return circle.filter((p) => (pixelAngle(p) % arc) / arc < s);
}

/** The 5 px plus: the centre and two pixels out along each axis. */
export function plusPixels(size = 5): Px[] {
  const arm = Math.floor(size / 2);
  const out: Px[] = [[0, 0]];
  for (let i = 1; i <= arm; i++) out.push([i, 0], [-i, 0], [0, i], [0, -i]);
  return out;
}

/** The 4 × 4 Bayer matrix: an ordered dither's thresholds, 0..15. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** The ordered-dither threshold of a pixel, 0..15 (the 4 × 4 Bayer matrix tiled). */
export function bayerLevel(x: number, y: number): number {
  return BAYER4[((y % 4) + 4) % 4]?.[((x % 4) + 4) % 4] ?? 0;
}

/**
 * An ordered dither of a set: the pixels whose Bayer threshold is under
 * `level` (0..16), so 16 is every pixel, 8 every other pixel (the
 * checkerboard), 4 every 4th pixel (one per 2 × 2), 0 none. Fixed in the
 * world: the pattern is tiled from the given origin.
 */
export function dithered(set: readonly Px[], level: number, originX = 0, originY = 0): Px[] {
  return set.filter(([x, y]) => bayerLevel(x + originX, y + originY) < level);
}
