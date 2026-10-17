import { CHEST_SHEET, SPRITE_SHEET_NAMES, spriteSheets } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { spritePngUrl } from './spriteSheets.js';

describe('the sprite sheets the client loads', () => {
  it('finds every sheet PNG, and the skin mask of every sheet that names one', () => {
    for (const name of SPRITE_SHEET_NAMES) {
      const sheet = spriteSheets[name];
      expect(spritePngUrl(sheet.meta.image), name).toBeTypeOf('string');
      if (sheet.palette) expect(spritePngUrl(sheet.palette.mask), sheet.palette.mask).toBeTypeOf('string');
    }
  });

  it('loads the chest with the characters, every sheet at 1 world px per sheet px', () => {
    expect(SPRITE_SHEET_NAMES).toContain(CHEST_SHEET);
    for (const name of SPRITE_SHEET_NAMES) expect(spriteSheets[name].meta.pixelScale, name).toBe(1);
  });
});
