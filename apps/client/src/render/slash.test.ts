import { spriteSheets } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { PLAYER_SHEET } from './characters.js';
import { ARC_TAIL_TICKS, lightSlashMark } from './slash.js';

const v2 = spriteSheets[PLAYER_SHEET];
// Every shipped sheet is v2 since ART's Husks landed; a v1 sheet is the player's read as M1's.
const v1 = { ...v2, meta: { ...v2.meta, version: '1' } };

describe('the light strike marks', () => {
  it('uses one v2 and one v1 sheet', () => {
    expect(v2.meta.version).toBe('2');
    expect(v1.meta.version).not.toBe('2');
  });

  it('draws the wind-up stroke only over a v1 sheet, which has no blade of its own', () => {
    expect(lightSlashMark(v1, 'startup', 0)).toBe('windup');
    expect(lightSlashMark(v2, 'startup', 0)).toBeNull();
  });

  it('draws the slash arc over the active ticks and the start of the recovery for both', () => {
    for (const sheet of [v1, v2]) {
      expect(lightSlashMark(sheet, 'active', 0)).toBe('arc');
      expect(lightSlashMark(sheet, 'recovery', 1)).toBe('arc');
      expect(lightSlashMark(sheet, 'recovery', ARC_TAIL_TICKS)).toBe('arc');
      expect(lightSlashMark(sheet, 'recovery', ARC_TAIL_TICKS + 1)).toBeNull();
      expect(lightSlashMark(sheet, 'done', 0)).toBeNull();
      expect(lightSlashMark(sheet, null, 0)).toBeNull();
    }
  });
});
