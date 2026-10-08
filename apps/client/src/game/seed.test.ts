import { describe, expect, it } from 'vitest';
import { formatTime, parseSeed } from './seed.js';

describe('seeds', () => {
  it('uses numeric seeds as-is and hashes text', () => {
    expect(parseSeed('12345')).toBe(12345);
    expect(parseSeed(' 42 ')).toBe(42);
    expect(parseSeed('hollow')).toBe(parseSeed('HOLLOW'));
    expect(parseSeed('hollow')).not.toBe(parseSeed('hollows'));
    expect(parseSeed('99999999999')).toBeLessThan(2 ** 32);
  });

  it('formats run time', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(60 * 75 + 30)).toBe('1:15.50');
  });
});
