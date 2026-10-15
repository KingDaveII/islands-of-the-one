import { describe, expect, it } from 'vitest';
import { FIELD_TEXT_INSET, inputBox } from './formFields.js';

describe('inputBox', () => {
  const field = { x: 124, y: 80, w: 232, h: 16 };

  it('puts the 8 px text line inside the panel, in CSS px from the zoom', () => {
    expect(inputBox({ left: 0, top: 0 }, { zoom: 1, x: 0, y: 0 }, field)).toEqual({
      left: 124 + FIELD_TEXT_INSET.x,
      top: 80 + FIELD_TEXT_INSET.y,
      width: 232 - 2 * FIELD_TEXT_INSET.x,
      height: 8,
      fontSize: 8,
    });
  });

  it('follows the canvas and scales by the zoom (fractional CSS px on scaled displays)', () => {
    // 4 device px per UI px at DPR 1.25 is a 3.2 CSS px zoom.
    const box = inputBox({ left: 10, top: 20 }, { zoom: 3.2, x: 0, y: 0 }, field);
    expect(box.left).toBeCloseTo(10 + 130 * 3.2);
    expect(box.top).toBeCloseTo(20 + 84 * 3.2);
    expect(box.fontSize).toBeCloseTo(8 * 3.2);
    // 8 UI px of text are 32 whole device px at DPR 1.25.
    expect(box.fontSize * 1.25).toBeCloseTo(32);
  });

  it("adds the centred layout's offset (G1.5: the canvas is the window, the layout sits in it)", () => {
    // 1920 × 912 at DPR 1: zU 3, a 640 × 304 UI area, the 480 × 270 layout at (80, 17).
    const box = inputBox({ left: 0, top: 0 }, { zoom: 3, x: 80, y: 17 }, field);
    expect(box.left).toBe((80 + 124 + FIELD_TEXT_INSET.x) * 3);
    expect(box.top).toBe((17 + 80 + FIELD_TEXT_INSET.y) * 3);
    expect(box.fontSize).toBe(24);
  });
});
