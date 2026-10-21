import { describe, expect, it } from 'vitest';
import { LEAVE_RUN_AGAIN, TapAgain } from './tapAgain.js';
import { TOUCH } from './touchLayout.js';

describe("the gear in a run: tap again to leave (GAME DESIGN, 2026-10-21)", () => {
  it('leaves only on a second tap within the window, then resets', () => {
    expect(TOUCH.leaveConfirmMs).toBe(2000);
    expect(LEAVE_RUN_AGAIN).toBe('Tap again to leave the run.');
    const gear = new TapAgain(2000);
    expect(gear.armed(0)).toBe(false);
    expect(gear.tap(1000)).toBe(false);
    expect(gear.armed(2999)).toBe(true);
    expect(gear.tap(3000)).toBe(true);
    // Confirmed: the next tap arms again.
    expect(gear.armed(3001)).toBe(false);
    expect(gear.tap(3100)).toBe(false);
    // Too late: the second tap only arms it again.
    expect(gear.armed(5101)).toBe(false);
    expect(gear.tap(5200)).toBe(false);
    expect(gear.tap(5300)).toBe(true);
  });
});
