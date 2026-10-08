/**
 * Seeded PRNG (mulberry32). Deterministic across platforms because it only
 * uses 32-bit integer math. Never use Math.random() inside the sim.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Next unsigned 32-bit integer. */
  nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Float in [0, 1). */
  nextFloat(): number {
    return this.nextU32() / 0x1_0000_0000;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`invalid range [${min}, ${max}]`);
    }
    return min + (this.nextU32() % (max - min + 1));
  }

  /** Snapshot of the internal state, for save/restore. */
  getState(): number {
    return this.state;
  }

  static fromState(state: number): Rng {
    return new Rng(state);
  }
}
