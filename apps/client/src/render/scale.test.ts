import { WORLD_PX_PER_UNIT } from '@iot/shared';
import { TILE_PX } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import { simPx, snapToArt, worldPx } from './scale.js';

describe('the render scale', () => {
  it('draws the world at 2×: a tile is 32 world px', () => {
    expect(WORLD_PX_PER_UNIT).toBe(2);
    expect(worldPx(TILE_PX)).toBe(32);
    expect(simPx(worldPx(37.5))).toBe(37.5);
  });

  it('stands a sprite on a whole world px (a sheet px is a world px)', () => {
    expect(snapToArt(10.3)).toBe(21);
    expect(snapToArt(10.6)).toBe(21);
    expect(snapToArt(10.8)).toBe(22);
  });
});
