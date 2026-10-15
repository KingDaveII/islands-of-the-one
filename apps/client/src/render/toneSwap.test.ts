import { readFileSync } from 'node:fs';
import { hexOf, paletteData, type SpriteSheet } from '@iot/shared';
import { describe, expect, it } from 'vitest';
// The v2 fixture sheet and its skin mask (never shipped), and the shared test's PNG decoder.
import fixture from '../../../../packages/shared/test/fixtures/kindled-fixture.json' with { type: 'json' };
import { decodePng } from '../../../../packages/shared/test/png.js';
import { swapTone } from './toneSwap.js';

const FIXTURES = new URL('../../../../packages/shared/test/fixtures/', import.meta.url);
const sheet: SpriteSheet = fixture;
const png = decodePng(readFileSync(new URL(sheet.meta.image, FIXTURES)));
const mask = decodePng(readFileSync(new URL(sheet.palette?.mask ?? '', FIXTURES)));

const { skin, shade } = paletteData.clay.tones['clay-grey-ochre'];
const red = paletteData.clay.tones['clay-red'];
const swaps = sheet.palette?.swaps['clay-red'] ?? {};

/** Colour counts of the opaque pixels, split by whether the mask covers them. */
function census(rgba: Uint8Array): { masked: Map<string, number>; bare: Map<string, number> } {
  const masked = new Map<string, number>();
  const bare = new Map<string, number>();
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) === 0) continue;
    const hex = hexOf(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
    const into = (mask.rgba[i + 3] ?? 0) > 0 ? masked : bare;
    into.set(hex, (into.get(hex) ?? 0) + 1);
  }
  return { masked, bare };
}

describe('the clay-tone swap', () => {
  it('swaps only under the skin mask: the belt and boots keep unwritten-tar', () => {
    const before = census(png.rgba);
    const out = png.rgba.slice();
    const changed = swapTone(out, swaps, mask.rgba);
    const after = census(out);
    // Under the mask: the skin and its shade became clay-red's.
    expect(after.masked.get(skin)).toBeUndefined();
    expect(after.masked.get(shade)).toBeUndefined();
    expect(after.masked.get(red.skin)).toBe(before.masked.get(skin));
    expect(after.masked.get(red.shade)).toBe(before.masked.get(shade));
    expect(changed).toBe((before.masked.get(skin) ?? 0) + (before.masked.get(shade) ?? 0));
    // Outside it nothing changed: the belt and the boots are still the skin ramp's shade.
    expect(before.bare.get(shade)).toBeGreaterThan(0);
    expect(after.bare).toEqual(before.bare);
    // The freckles (spark-amber) never swap.
    const freckle = paletteData.tokens['spark-amber'];
    expect(after.masked.get(freckle)).toBe(before.masked.get(freckle));
  });

  it('maps every pixel from the drawn colours at once (no chain through a swapped value)', () => {
    // clay-pale maps the shade to the drawn skin colour and the skin to husk-shell.
    const pale = sheet.palette?.swaps['clay-pale'] ?? {};
    const out = png.rgba.slice();
    swapTone(out, pale, mask.rgba);
    const after = census(out);
    expect(after.masked.get(paletteData.clay.tones['clay-pale'].skin)).toBe(census(png.rgba).masked.get(skin));
    expect(after.masked.get(skin)).toBe(census(png.rgba).masked.get(shade));
  });

  it('swaps the whole sheet without a mask (a v1 sheet)', () => {
    const out = png.rgba.slice();
    swapTone(out, swaps);
    const after = census(out);
    expect(after.bare.get(shade)).toBeUndefined();
    expect(after.masked.get(shade)).toBeUndefined();
  });

  it('leaves transparent pixels alone and refuses a mask of another size', () => {
    const px = new Uint8Array([0x8c, 0x7f, 0x6e, 0, 0x8c, 0x7f, 0x6e, 255]);
    expect(swapTone(px, swaps)).toBe(1);
    expect([...px.subarray(0, 4)]).toEqual([0x8c, 0x7f, 0x6e, 0]);
    expect(() => swapTone(px, swaps, new Uint8Array(4))).toThrow();
  });
});
