import { readFileSync } from 'node:fs';
import { spriteSheets, type SpriteSheet } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../../packages/shared/test/fixtures/prop-chest.json' with { type: 'json' };
import { decodePng } from '../../../../packages/shared/test/png.js';
import {
  lowestRowWidth,
  PROP_SHADOW_H,
  PROP_SHADOW_PAD,
  propShadowWidth,
  propShadowWidths,
} from './propShadow.js';

const fixture: SpriteSheet = fixtureJson;
const here = new URL('.', import.meta.url).pathname;
const png = (path: string) => {
  const d = decodePng(readFileSync(new URL(path, import.meta.url)));
  return { width: d.width, height: d.height, data: d.rgba };
};

describe("a prop's grounding shadow from its frame's lowest opaque row (ART 2026-10-17)", () => {
  it('is 6 high and the lowest row plus 4 wide: 28 for the fixture chest (24 px at its base), the same in every state', () => {
    expect([PROP_SHADOW_H, PROP_SHADOW_PAD]).toEqual([6, 4]);
    const img = png('../../../../packages/shared/test/fixtures/prop-chest.png');
    const closed = fixture.frames.closed_0?.frame;
    if (!closed) throw new Error('no closed_0');
    expect(lowestRowWidth(img, closed)).toBe(24);
    expect(propShadowWidth(img, closed)).toBe(28);
    const widths = propShadowWidths(fixture, img);
    expect([...widths.keys()].sort()).toEqual(Object.keys(fixture.frames).sort());
    expect(new Set(widths.values())).toEqual(new Set([28]));
    expect(here).toContain('render');
  });

  it("gives ART's prop-chest about 32 × 6: 28 px at its base in every frame", () => {
    const sheet = spriteSheets['prop-chest'];
    const img = png('../../../../packages/shared/assets/sprites/prop-chest.png');
    const widths = propShadowWidths(sheet, img);
    expect(widths.size).toBe(Object.keys(sheet.frames).length);
    for (const [name, w] of widths) expect(w, name).toBe(32);
  });

  it('reads the lowest row only, within the frame, and gives an empty frame no shadow', () => {
    // A 4 × 4 image: a wide row near the top, a 2 px row at the bottom.
    const data = new Uint8Array(4 * 4 * 4);
    const set = (x: number, y: number) => (data[(y * 4 + x) * 4 + 3] = 255);
    set(0, 1);
    set(3, 1);
    set(1, 3);
    set(2, 3);
    const img = { width: 4, height: 4, data };
    expect(lowestRowWidth(img, { x: 0, y: 0, w: 4, h: 4 })).toBe(2);
    expect(propShadowWidth(img, { x: 0, y: 0, w: 4, h: 4 })).toBe(6);
    // The frame cut to its top half sees the wide row.
    expect(lowestRowWidth(img, { x: 0, y: 0, w: 4, h: 2 })).toBe(4);
    expect(lowestRowWidth(img, { x: 1, y: 0, w: 1, h: 2 })).toBe(0);
    expect(propShadowWidth(img, { x: 1, y: 0, w: 1, h: 2 })).toBe(0);
  });
});
