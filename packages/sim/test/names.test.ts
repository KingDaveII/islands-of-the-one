import { isSafePositions, LETTER_COUNT, lettersFromPositions, nameRules } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { generateName, Rng, type NameRules } from '../src/index.js';

const rules: NameRules = {
  letters: LETTER_COUNT,
  minLetters: nameRules.minLetters,
  maxLetters: nameRules.maxLetters,
  safe: (p) => isSafePositions(p, { strict: true }).ok,
};

describe('generateName', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const names = Array.from({ length: 50 }, () => generateName(a, rules));
    expect(Array.from({ length: 50 }, () => generateName(b, rules))).toEqual(names);
    expect(Array.from({ length: 50 }, () => generateName(new Rng(43), rules))).not.toEqual(names);
    expect(lettersFromPositions(names[0] as number[])).toHaveLength((names[0] as number[]).length);
  });

  it('20,000 Names are 2-5 Old Letters, pass the strict filter and never contain yod-he', () => {
    const rng = new Rng(7);
    let rejected = 0;
    let yodHe = 0;
    const lengths = new Set<number>();
    for (let i = 0; i < 20_000; i++) {
      const name = generateName(rng, rules);
      lengths.add(name.length);
      if (!isSafePositions(name, { strict: true }).ok) rejected++;
      for (let j = 1; j < name.length; j++) {
        const [a, b] = [name[j - 1], name[j]];
        if ((a === 9 && b === 4) || (a === 4 && b === 9)) yodHe++;
      }
      for (const p of name) expect(p).toBeGreaterThanOrEqual(0);
      for (const p of name) expect(p).toBeLessThan(LETTER_COUNT);
    }
    expect(rejected).toBe(0);
    expect(yodHe).toBe(0);
    expect([...lengths].sort()).toEqual([2, 3, 4, 5]);
  });

  it('redraws rejected Names and gives up when nothing is safe', () => {
    let calls = 0;
    const picky: NameRules = { ...rules, safe: (p) => ++calls > 3 && p.length === 5 };
    const name = generateName(new Rng(1), picky);
    expect(name).toHaveLength(5);
    expect(calls).toBeGreaterThan(3);
    expect(() => generateName(new Rng(1), { ...rules, safe: () => false })).toThrow(/no safe Name/);
    expect(() => generateName(new Rng(1), { ...rules, maxLetters: 1 })).toThrow(RangeError);
  });
});
