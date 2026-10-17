import { existsSync } from 'node:fs';
import {
  OPTIONAL_SPRITE_SHEETS,
  SPARKGLASS_SHEET,
  spriteSheetSpec,
  type SpriteSheet,
} from '@iot/shared';
import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../../packages/shared/test/fixtures/prop-sparkglass.json' with { type: 'json' };
import { pickupFrameAt, pickupRenderer } from './pickupSprites.js';
import { optionalSheet } from './spriteSheets.js';

const fixture: SpriteSheet = fixtureJson;
const onDisk = existsSync(
  new URL(`../../../../packages/shared/assets/sprites/${SPARKGLASS_SHEET}.json`, import.meta.url),
);

describe('the Sparkglass pickup from prop-sparkglass, or the fallback (M1 polish, ART 2026-10-17)', () => {
  it("draws from the sheet when it is there: idle looping at the sheet's rate (2 frames at 2 fps on the fixture, the glint)", () => {
    expect(pickupRenderer(fixture)).toBe('sheet');
    expect([0, 499, 500, 999, 1000, 1700].map((t) => pickupFrameAt(fixture, t))).toEqual([
      'idle_0',
      'idle_0',
      'idle_1',
      'idle_1',
      'idle_0',
      'idle_1',
    ]);
    // A still chip: one frame, or no rate.
    const still: SpriteSheet = {
      ...fixture,
      anims: { idle: { frames: ['idle_0'], frameRate: 0, repeat: 0, hold: true } },
    };
    expect([0, 5000].map((t) => pickupFrameAt(still, t))).toEqual(['idle_0', 'idle_0']);
    expect(spriteSheetSpec(SPARKGLASS_SHEET).kind).toBe('prop');
  });

  it("falls back to the engine's drawing without a sheet, or with one that has no idle", () => {
    expect(pickupRenderer(undefined)).toBe('fallback');
    expect(pickupRenderer({ ...fixture, anims: {} })).toBe('fallback');
  });

  it('finds the sheet on disk through the optional loader, and only then: today the fallback, the sheet once ART delivers it', () => {
    expect(OPTIONAL_SPRITE_SHEETS).toContain(SPARKGLASS_SHEET);
    const sheet = optionalSheet(SPARKGLASS_SHEET);
    expect(sheet !== undefined, `${SPARKGLASS_SHEET} ${onDisk ? 'is' : 'is not'} on disk`).toBe(
      onDisk,
    );
    expect(pickupRenderer(sheet)).toBe(onDisk ? 'sheet' : 'fallback');
    if (sheet) {
      expect(sheet.meta.image).toBe(`${SPARKGLASS_SHEET}.png`);
      expect(sheet.anims.idle?.frames.length).toBeGreaterThan(0);
    }
    // Only the optional sheets come this way: the chest is a required sheet, loaded with the characters.
    expect(optionalSheet('prop-chest')).toBeUndefined();
    expect(optionalSheet('prop-nothing')).toBeUndefined();
  });
});
