import { SPRITE_SHEET_NAMES, spriteSheets } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { spritePngUrl, spriteScale } from './spriteSheets.js';

describe('the sprite sheets the client loads', () => {
  it('finds every sheet PNG, and the skin mask of every sheet that names one', () => {
    for (const name of SPRITE_SHEET_NAMES) {
      const sheet = spriteSheets[name];
      expect(spritePngUrl(sheet.meta.image), name).toBeTypeOf('string');
      if (sheet.palette?.mask) expect(spritePngUrl(sheet.palette.mask), sheet.palette.mask).toBeTypeOf('string');
    }
  });

  it('draws the v1 sheets at the legacy 2× until their B versions arrive', () => {
    for (const name of SPRITE_SHEET_NAMES) {
      expect(spriteScale(name), name).toBe(spriteSheets[name].meta.version === '2' ? 1 : 2);
    }
  });
});
