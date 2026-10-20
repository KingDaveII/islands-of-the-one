import { measureText, tiny5Font } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { lineScale, portraitBlocked, TURN_SIDEWAYS } from './orientation.js';
import { isDrawable } from '@iot/shared';

describe('the portrait line', () => {
  it("covers the game on a touch screen held upright, never on a landscape one or a desktop's", () => {
    expect(portraitBlocked(390, 844, true)).toBe(true);
    expect(portraitBlocked(844, 390, true)).toBe(false);
    expect(portraitBlocked(390, 844, false)).toBe(false);
    expect(portraitBlocked(500, 500, true)).toBe(false);
  });

  it("is GAME DESIGN's line, drawable, scaled by a whole number to fit the width", () => {
    expect(TURN_SIDEWAYS).toBe('Turn your phone sideways.');
    expect(isDrawable(TURN_SIDEWAYS)).toBe(true);
    const w = measureText(tiny5Font, TURN_SIDEWAYS);
    // An iPhone held upright: 390 × 844 CSS @ 3 is 585 UI px wide at zU 2.
    expect(lineScale(585, w)).toBe(Math.min(3, Math.floor((585 - 32) / w)));
    expect(lineScale(w, w)).toBe(1);
    expect(lineScale(10000, w)).toBe(3);
  });
});
