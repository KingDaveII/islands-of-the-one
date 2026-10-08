import { clamp, idiv, QUARTER_TURN, TRIG_ONE, TURN } from './fixed.js';

/**
 * Lookup-table trig on 1/4096-turn angles. Math.sin/cos/atan2 are not
 * guaranteed to be bit-identical across browsers, so the sim never calls them.
 *
 * The quarter-wave table is built with a fixed-length Taylor series using only
 * + - * / (IEEE-exact, identical everywhere) and rounded to integers.
 */
const SIN_Q = buildQuarterTable();

function buildQuarterTable(): Int32Array {
  const table = new Int32Array(QUARTER_TURN + 1);
  const halfPi = 1.5707963267948966;
  for (let i = 0; i <= QUARTER_TURN; i++) {
    const x = (i * halfPi) / QUARTER_TURN;
    const x2 = x * x;
    // sin x = x - x^3/3! + x^5/5! - ... ; 10 terms is far below 1/16384 error on [0, π/2].
    let term = x;
    let sum = x;
    for (let k = 1; k < 10; k++) {
      term = (-term * x2) / ((2 * k) * (2 * k + 1));
      sum += term;
    }
    table[i] = Math.round(sum * TRIG_ONE);
  }
  return table;
}

function quarter(i: number): number {
  return SIN_Q[i] ?? 0;
}

/** sin(angle) scaled by TRIG_ONE. */
export function sin(angle: number): number {
  const a = angle & (TURN - 1);
  const q = a >> 10;
  const i = a & (QUARTER_TURN - 1);
  switch (q) {
    case 0:
      return quarter(i);
    case 1:
      return quarter(QUARTER_TURN - i);
    case 2:
      return 0 - quarter(i);
    default:
      return 0 - quarter(QUARTER_TURN - i);
  }
}

/** cos(angle) scaled by TRIG_ONE. */
export function cos(angle: number): number {
  return sin(angle + QUARTER_TURN);
}

/** Angle in [0, 512] whose tangent is closest to below num/den (0 <= num <= den). */
function atanOctant(num: number, den: number): number {
  let lo = 0;
  let hi = QUARTER_TURN / 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (quarter(mid) * den <= quarter(QUARTER_TURN - mid) * num) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** atan2(y, x) as an angle in [0, TURN). 0 = +x, TURN/4 = +y (screen down). */
export function atan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const base = ay <= ax ? atanOctant(ay, ax) : QUARTER_TURN - atanOctant(ax, ay);
  let a: number;
  if (x >= 0) a = y >= 0 ? base : TURN - base;
  else a = y >= 0 ? TURN / 2 - base : TURN / 2 + base;
  return a & (TURN - 1);
}

/** Component of a vector of length `len` along angle, truncated toward zero. */
export function dirX(angle: number, len: number): number {
  return idiv(cos(angle) * len, TRIG_ONE);
}

export function dirY(angle: number, len: number): number {
  return idiv(sin(angle) * len, TRIG_ONE);
}

/** Nearest of 8 facings (0 = east, 2 = south, 4 = west, 6 = north). */
export function facing8(angle: number): number {
  return clamp(((angle + TURN / 16) & (TURN - 1)) >> 9, 0, 7);
}
