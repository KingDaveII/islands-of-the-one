/**
 * Seeded PRNG (mulberry32). Deterministic across platforms because it only
 * uses 32-bit integer math. Never use Math.random() inside the sim.
 *
 * The functional API mutates `holder.rng`, so run state stays plain data.
 */
export interface RngHolder {
  rng: number;
}

export function nextU32(holder: RngHolder): number {
  holder.rng = (holder.rng + 0x6d2b79f5) >>> 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Integer in [min, max] (inclusive). */
export function randInt(holder: RngHolder, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`invalid range [${min}, ${max}]`);
  }
  return min + (nextU32(holder) % (max - min + 1));
}

/** Fisher-Yates shuffle in place. */
export function shuffle<T>(holder: RngHolder, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randInt(holder, 0, i);
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
  return items;
}

export class Rng implements RngHolder {
  rng: number;

  constructor(seed: number) {
    this.rng = seed >>> 0;
  }

  /** Next unsigned 32-bit integer. */
  nextU32(): number {
    return nextU32(this);
  }

  /** Float in [0, 1). Presentation only; the sim uses integers. */
  nextFloat(): number {
    return this.nextU32() / 0x1_0000_0000;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return randInt(this, min, max);
  }

  /** Snapshot of the internal state, for save/restore. */
  getState(): number {
    return this.rng;
  }

  static fromState(state: number): Rng {
    return new Rng(state);
  }
}
