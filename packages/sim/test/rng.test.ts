import { describe, expect, it } from 'vitest';
import { Rng } from '../src/index.js';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('produces different sequences for different seeds', () => {
    expect(new Rng(1).nextU32()).not.toBe(new Rng(2).nextU32());
  });

  it('is pinned to known values (guards against accidental algorithm changes)', () => {
    const rng = new Rng(12345);
    expect([rng.nextU32(), rng.nextU32(), rng.nextU32()]).toMatchInlineSnapshot(`
      [
        4207900869,
        1317490944,
        2079646450,
      ]
    `);
  });

  it('keeps floats in [0, 1) and ints in range', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(-3, 3);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('can be restored from state', () => {
    const a = new Rng(99);
    a.nextU32();
    const b = Rng.fromState(a.getState());
    expect(b.nextU32()).toBe(a.nextU32());
  });
});
