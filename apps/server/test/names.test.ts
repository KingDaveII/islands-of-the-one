import { lettersFromPositions, NAME_REFUSED } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { validateName } from '../src/names.js';

const letters = lettersFromPositions;

describe('validateName', () => {
  it('accepts 2-5 Old Letters and returns the canonical Name', () => {
    expect(validateName(letters([0, 12, 21]))).toEqual({ ok: true, name: letters([0, 12, 21]) });
    expect(validateName(letters([12, 21]))).toEqual({ ok: true, name: letters([12, 21]) });
    expect(validateName(letters([2, 1, 15, 4, 0]))).toEqual({
      ok: true,
      name: letters([2, 1, 15, 4, 0]),
    });
    // Surrounding whitespace, niqqud and a typed final form are folded.
    expect(validateName(` ${letters([0, 1])}ָן `)).toEqual({ ok: true, name: letters([0, 1, 13]) });
  });

  it('refuses with the in-world line', () => {
    const cases: [unknown, string][] = [
      [42, 'not-text'],
      [undefined, 'not-text'],
      ['abc', 'not-old-letters'],
      [`${letters([0, 1])} ${letters([2])}`, 'not-old-letters'],
      [letters([0]), 'length'],
      [letters([0, 1, 2, 3, 4, 5]), 'length'],
      ['', 'length'],
      ['x'.repeat(65), 'length'],
      [letters([9, 4, 5, 4]), 'name-hebrew'],
      [letters([4, 5, 4, 9]), 'name-hebrew'],
      [letters([0, 3, 13, 9]), 'name-hebrew'],
      [letters([9, 4]), 'yod-he'],
      [letters([21, 4, 9]), 'yod-he'],
    ];
    for (const [input, reason] of cases) {
      expect(validateName(input), String(input)).toEqual({
        ok: false,
        reason,
        message: NAME_REFUSED,
      });
    }
  });
});
