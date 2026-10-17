import { describe, expect, it } from 'vitest';
import { ARC_TAIL_TICKS, lightSlashMark } from './slash.js';

describe('the light strike marks', () => {
  it('draws nothing in the wind-up: the sheet draws its own blade', () => {
    expect(lightSlashMark('startup', 0)).toBeNull();
  });

  it('draws the slash arc over the active ticks and the start of the recovery', () => {
    expect(lightSlashMark('active', 0)).toBe('arc');
    expect(lightSlashMark('recovery', 1)).toBe('arc');
    expect(lightSlashMark('recovery', ARC_TAIL_TICKS)).toBe('arc');
    expect(lightSlashMark('recovery', ARC_TAIL_TICKS + 1)).toBeNull();
    expect(lightSlashMark('done', 0)).toBeNull();
    expect(lightSlashMark(null, 0)).toBeNull();
  });
});
