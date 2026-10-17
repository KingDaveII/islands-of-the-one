import { readFileSync } from 'node:fs';
import { spriteSheets, type SpriteSheet } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import chestJson from '../../../../packages/shared/test/fixtures/prop-chest.json' with { type: 'json' };
import sparkJson from '../../../../packages/shared/test/fixtures/prop-sparkglass.json' with { type: 'json' };
import { decodePng } from '../../../../packages/shared/test/png.js';
import {
  baseRowWidths,
  PROP_SHADOW_H,
  PROP_SHADOW_H_NARROW,
  PROP_SHADOW_NARROW_PX,
  PROP_SHADOW_PAD,
  PROP_SHADOW_ROWS,
  propShadowSize,
  propShadowSizes,
  type Rgba,
} from './propShadow.js';

const chestFixture: SpriteSheet = chestJson;
const sparkFixture: SpriteSheet = sparkJson;
const png = (path: string): Rgba => {
  const d = decodePng(readFileSync(new URL(path, import.meta.url)));
  return { width: d.width, height: d.height, data: d.rgba };
};

/** A w × h image with the given rows opaque over [from, to] (inclusive columns), the rest clear. */
function image(w: number, h: number, rows: Record<number, [number, number]>): Rgba {
  const data = new Uint8Array(w * h * 4);
  for (const [y, [from, to]] of Object.entries(rows))
    for (let x = from; x <= to; x++) data[(Number(y) * w + x) * 4 + 3] = 255;
  return { width: w, height: h, data };
}
const whole = (img: Rgba) => ({ x: 0, y: 0, w: img.width, h: img.height });

describe("a prop's grounding shadow from its lowest three opaque rows (ART's answer on #69)", () => {
  it("has the rule's numbers: 3 rows, plus 4, 6 high, 3 high under 16 px", () => {
    expect([
      PROP_SHADOW_ROWS,
      PROP_SHADOW_PAD,
      PROP_SHADOW_H,
      PROP_SHADOW_H_NARROW,
      PROP_SHADOW_NARROW_PX,
    ]).toEqual([3, 4, 6, 3, 16]);
  });

  it('a pointed base: the widest of the lowest three rows wins (1, 1, 3 px give 7 × 3)', () => {
    const img = image(8, 8, { 3: [0, 7], 5: [2, 4], 6: [3, 3], 7: [3, 3] });
    expect(baseRowWidths(img, whole(img))).toEqual([1, 1, 3]);
    expect(propShadowSize(img, whole(img))).toEqual({ w: 7, h: 3 });
    // The rows above the lowest three never count, however wide.
    expect(baseRowWidths(img, whole(img), 4)).toEqual([1, 1, 3, 8]);
  });

  it('a flat base: three rows of 20 give 24 × 6; the rows need not touch', () => {
    const flat = image(24, 6, { 3: [2, 21], 4: [2, 21], 5: [2, 21] });
    expect(propShadowSize(flat, whole(flat))).toEqual({ w: 24, h: 6 });
    const gapped = image(24, 8, { 1: [0, 23], 3: [2, 21], 5: [5, 6], 7: [10, 10] });
    expect(baseRowWidths(gapped, whole(gapped))).toEqual([1, 2, 20]);
    expect(propShadowSize(gapped, whole(gapped))).toEqual({ w: 24, h: 6 });
  });

  it('the 16 px edge: a 15 px shadow is 3 high, a 16 px one 6 high', () => {
    const narrow = image(16, 2, { 1: [0, 10] });
    expect(propShadowSize(narrow, whole(narrow))).toEqual({ w: 15, h: 3 });
    const wide = image(16, 2, { 1: [0, 11] });
    expect(propShadowSize(wide, whole(wide))).toEqual({ w: 16, h: 6 });
  });

  it('reads within the frame only, and gives an empty frame no shadow', () => {
    const img = image(4, 4, { 1: [0, 3], 3: [1, 2] });
    expect(propShadowSize(img, { x: 0, y: 0, w: 4, h: 4 })).toEqual({ w: 8, h: 3 });
    expect(baseRowWidths(img, { x: 0, y: 0, w: 4, h: 2 })).toEqual([4]);
    expect(baseRowWidths(img, { x: 1, y: 0, w: 1, h: 2 })).toEqual([1]);
    expect(baseRowWidths(img, { x: 0, y: 2, w: 4, h: 1 })).toEqual([]);
    expect(propShadowSize(img, { x: 0, y: 2, w: 4, h: 1 })).toEqual({ w: 0, h: 0 });
  });

  it("the chest fixture: 30 × 6 in every state (its outline widens the box to 26); ART's prop-chest: 32 × 6 in every frame", () => {
    const fixture = png('../../../../packages/shared/test/fixtures/prop-chest.png');
    expect(
      new Set([...propShadowSizes(chestFixture, fixture).values()].map((s) => `${s.w}x${s.h}`)),
    ).toEqual(new Set(['30x6']));
    const sheet = spriteSheets['prop-chest'];
    const sizes = propShadowSizes(
      sheet,
      png('../../../../packages/shared/assets/sprites/prop-chest.png'),
    );
    expect(sizes.size).toBe(Object.keys(sheet.frames).length);
    for (const [name, s] of sizes) expect(s, name).toEqual({ w: 32, h: 6 });
  });

  it('the Sparkglass chip fixture (9 × 11, a pointed base over a 5 px row): 9 × 3', () => {
    const sizes = propShadowSizes(
      sparkFixture,
      png('../../../../packages/shared/test/fixtures/prop-sparkglass.png'),
    );
    expect([...sizes.keys()].sort()).toEqual(['idle_0', 'idle_1']);
    for (const [name, s] of sizes) expect(s, name).toEqual({ w: 9, h: 3 });
  });
});
