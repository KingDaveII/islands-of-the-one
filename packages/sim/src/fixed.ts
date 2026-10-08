/**
 * Integer fixed-point helpers. All simulation state is integers:
 *
 * - positions/velocities in sub-pixel units (`SUB` per pixel, per tick),
 * - angles in 1/4096 of a turn (`TURN`),
 * - time in ticks at `TICK_HZ`.
 *
 * Plain JS numbers hold these integers exactly (all values stay far below
 * 2^53), and +, -, *, / and Math.round/trunc/floor are IEEE-754 exact or
 * correctly rounded, so results are bit-identical in every engine. Anything
 * transcendental (sin, cos, atan2, sqrt) goes through the helpers below.
 */

export const TICK_HZ = 60;
/** Sub-pixel units per pixel. */
export const SUB = 256;
export const TILE_PX = 16;
export const TILE = TILE_PX * SUB;
/** Angle units per full turn. */
export const TURN = 4096;
export const HALF_TURN = TURN / 2;
export const QUARTER_TURN = TURN / 4;
/** Fixed-point one for trig results. */
export const TRIG_ONE = 16384;

/** Integer division truncating toward zero. */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Exact integer square root (floor). Corrects any rounding of the float sqrt. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  // eslint-disable-next-line no-restricted-properties -- result is corrected to the exact floor below
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

export function length(dx: number, dy: number): number {
  return isqrt(dx * dx + dy * dy);
}

/** Wrap an angle into [0, TURN). */
export function wrapAngle(a: number): number {
  return ((a % TURN) + TURN) % TURN;
}

/** Signed smallest difference a - b in (-HALF_TURN, HALF_TURN]. */
export function angleDiff(a: number, b: number): number {
  const d = wrapAngle(a - b);
  return d > HALF_TURN ? d - TURN : d;
}

// --- Tuning unit conversions (deterministic: IEEE arithmetic + Math.round) ---

export function msToTicks(ms: number): number {
  return Math.max(0, Math.round((ms * TICK_HZ) / 1000));
}

export function pxToUnits(px: number): number {
  return Math.round(px * SUB);
}

/** px/s → units/tick */
export function speedToUnits(pxPerSec: number): number {
  return Math.round((pxPerSec * SUB) / TICK_HZ);
}

/** px/s² → units/tick² */
export function accelToUnits(pxPerSec2: number): number {
  return Math.round((pxPerSec2 * SUB) / (TICK_HZ * TICK_HZ));
}

export function degToAngle(deg: number): number {
  return Math.round((deg * TURN) / 360);
}

/** Fraction (e.g. 0.35) → permille integer (350). */
export function toPermille(f: number): number {
  return Math.round(f * 1000);
}
