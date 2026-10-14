import { describe, expect, it } from 'vitest';
import { FIELD_TEXT_INSET, inputBox } from './formFields.js';

describe('inputBox', () => {
  const field = { x: 124, y: 80, w: 232, h: 16 };

  it('puts the 8 px text line inside the panel, in CSS px from the zoom', () => {
    expect(inputBox({ left: 0, top: 0 }, 1, field)).toEqual({
      left: 124 + FIELD_TEXT_INSET.x,
      top: 80 + FIELD_TEXT_INSET.y,
      width: 232 - 2 * FIELD_TEXT_INSET.x,
      height: 8,
      fontSize: 8,
    });
  });

  it('follows the canvas and scales by the zoom (fractional CSS px on scaled displays)', () => {
    // 4 device px per game px at DPR 1.25 is a 3.2 CSS px zoom.
    const box = inputBox({ left: 10, top: 20 }, 3.2, field);
    expect(box.left).toBeCloseTo(10 + 130 * 3.2);
    expect(box.top).toBeCloseTo(20 + 84 * 3.2);
    expect(box.fontSize).toBeCloseTo(8 * 3.2);
    // 8 game px of text are 32 whole device px at DPR 1.25.
    expect(box.fontSize * 1.25).toBeCloseTo(32);
  });
});
