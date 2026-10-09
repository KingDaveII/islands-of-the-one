import { describe, expect, it } from 'vitest';
import { TURN } from '@iot/sim';
import { FACINGS, facingIndex, facingOf } from './facing.js';

const deg = (d: number): number => Math.round((d * TURN) / 360);

describe('8-way facing', () => {
  it('runs S, SE, E, NE, N, NW, W, SW', () => {
    expect(FACINGS).toEqual(['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']);
    // Screen y points down: 90° is south.
    const byAngle = [90, 45, 0, 315, 270, 225, 180, 135].map((d) => facingOf(deg(d)));
    expect(byAngle).toEqual([...FACINGS]);
  });

  it('snaps to the nearest facing', () => {
    expect(facingOf(deg(20))).toBe('E');
    expect(facingOf(deg(25))).toBe('SE');
    expect(facingOf(deg(-20))).toBe('E');
    expect(facingOf(deg(-25))).toBe('NE');
    expect(facingIndex(deg(359))).toBe(2);
  });
});
