import { describe, expect, it } from 'vitest';
import { squareSweep } from './pixels.js';

describe('cooldown sweep polygon', () => {
  it('starts at 12 o clock and runs clockwise around the square', () => {
    expect(squareSweep(0, 0, 8, 0, 0.25)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -8 },
      { x: 8, y: -8 },
      { x: 8, y: 0 },
    ]);
  });

  it('covers every corner for a full sweep', () => {
    const pts = squareSweep(0, 0, 8, 0, 1);
    expect(pts).toContainEqual({ x: 8, y: 8 });
    expect(pts).toContainEqual({ x: -8, y: 8 });
    expect(pts).toContainEqual({ x: -8, y: -8 });
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: -8 });
  });
});
