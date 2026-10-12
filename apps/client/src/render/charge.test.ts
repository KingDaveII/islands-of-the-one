import { describe, expect, it } from 'vitest';
import { defaultTuning } from '@iot/shared';
import { compileTuning } from '@iot/sim';
import { chargeStage } from './charge.js';

describe('charge stages', () => {
  it('0 for a tap, 1-2 across the window, 3 at full charge', () => {
    const h = compileTuning(defaultTuning, 'hookblade').weapon.heavy;
    expect(chargeStage(0, h)).toBe(0);
    expect(chargeStage(h.chargeMin - 1, h)).toBe(0);
    expect(chargeStage(h.chargeMin, h)).toBe(1);
    expect(chargeStage((h.chargeMin + h.chargeMax) >> 1, h)).toBe(2);
    expect(chargeStage(h.chargeMax, h)).toBe(3);
  });
});
