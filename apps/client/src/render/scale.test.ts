import { LEGACY_PIXEL_SCALE, WORLD_PX_PER_UNIT } from '@iot/shared';
import { TILE_PX } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import { simPx, snapToArt, worldPx } from './scale.js';

describe('the render scale', () => {
  it('draws the world at 2×: a tile is 32 world px', () => {
    expect(WORLD_PX_PER_UNIT).toBe(2);
    expect(worldPx(TILE_PX)).toBe(32);
    expect(simPx(worldPx(37.5))).toBe(37.5);
  });

  it("draws M1 art at the world scale, so a legacy Graphics' scale converts sim px once", () => {
    // legacyGraphics() draws in sim px at LEGACY_PIXEL_SCALE: only right while the two are equal.
    expect(LEGACY_PIXEL_SCALE).toBe(WORLD_PX_PER_UNIT);
  });

  it('snaps a sprite to its own art-pixel grid', () => {
    // A v1 sheet (2 world px per art px) keeps M1's whole sim pixels.
    expect(snapToArt(10.4, 2)).toBe(20);
    expect(snapToArt(10.6, 2)).toBe(22);
    // A v2 sheet (1 world px per art px) moves in world px.
    expect(snapToArt(10.3, 1)).toBe(21);
    expect(snapToArt(10.6, 1)).toBe(21);
    expect(snapToArt(10.8, 1)).toBe(22);
  });
});
