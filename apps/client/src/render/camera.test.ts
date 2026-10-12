import { describe, expect, it } from 'vitest';
import { clampScroll } from './camera.js';

describe('camera safe margins', () => {
  // The bottom-left weapon panel reaches 158 px in; the top panels 54 px.
  const VIEW = 480;
  it('scrolls past the room edges by the margins, so a player at a wall sits inside the clear area', () => {
    const room = 512;
    const left = 158;
    const right = 71;
    // Player at the left wall (x 16) wants the camera far left: clamped to -left, the player lands at 174.
    expect(clampScroll(16 - VIEW / 2, room, VIEW, left, right)).toBe(-left);
    expect(16 - clampScroll(16 - VIEW / 2, room, VIEW, left, right)).toBeGreaterThanOrEqual(left);
    // Player at the right wall: the room's right edge may come in by the right margin.
    const scroll = clampScroll(room - 16 - VIEW / 2, room, VIEW, left, right);
    expect(scroll).toBe(room - VIEW + right);
    expect(room - 16 - scroll).toBeLessThanOrEqual(VIEW - right);
    // In the middle nothing is clamped.
    expect(clampScroll(100, room, VIEW, left, right)).toBe(100);
  });

  it('centers a room that fits between the panels, and barely scrolls one that almost fits', () => {
    // Narrow Hollow is 160 px tall; the free height between the top (54) and bottom (59) panels is 157.
    expect(clampScroll(-1000, 160, 270, 54, 59)).toBe(-54);
    expect(clampScroll(1000, 160, 270, 54, 59)).toBe(-51);
    // A 120 px tall room sits centered in the free area: top at 54 + (157 - 120) / 2.
    expect(clampScroll(1000, 120, 270, 54, 59)).toBe(-(54 + 18.5));
    // Without margins the old rule holds: a room that fits is centered in the view.
    expect(clampScroll(0, 200, 270, 0, 0)).toBe(-35);
  });
});
