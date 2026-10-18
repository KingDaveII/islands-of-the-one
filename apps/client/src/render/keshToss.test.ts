import { framePoint, KESH_SHEET, KESH_TOSS_RELEASE_FRAME, spriteSheets } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { tossPoint, tossReleaseFrame, tossReleasePoint, tossReleased } from './keshToss.js';

/** The toss (docs/design/holding.md "Kesh"): the release frame, the arc's start at the `hand` point, whole-pixel flight. */
describe("Kesh's toss", () => {
  const sheet = spriteSheets[KESH_SHEET];

  it('releases on toss_2, from that frame\'s hand point mapped from the anchor like the Hookblade\'s points', () => {
    expect(KESH_TOSS_RELEASE_FRAME).toBe(2);
    expect(tossReleaseFrame()).toBe('toss_2');
    expect(tossReleased(1)).toBe(false);
    expect(tossReleased(2)).toBe(true);
    expect(tossReleased(3)).toBe(true);
    const hand = framePoint(sheet, 'toss_2', 'hand');
    expect(hand).not.toBeNull();
    if (!hand) return;
    // Kesh is drawn at the rock's world point (the cell origin, (48, 118)); the hand is origin + (point − origin).
    const anchor = { x: 1000, y: 700 };
    expect(tossReleasePoint(sheet, anchor)).toEqual({ x: anchor.x + hand.x - 48, y: anchor.y + hand.y - 118 });
    expect(tossReleasePoint(sheet, anchor)).toEqual({ x: 1000 + 16 - 48, y: 700 + 72 - 118 });
    // Every toss frame carries the hand (the sheet contract), so the release always has a start.
    for (const frame of sheet.anims.toss?.frames ?? []) expect(framePoint(sheet, frame, 'hand'), frame).not.toBeNull();
    const toss2 = sheet.frames.toss_2;
    if (!toss2) throw new Error('no toss_2');
    expect(tossReleasePoint({ ...sheet, frames: { ...sheet.frames, toss_2: { ...toss2, points: {} } } }, anchor)).toBeNull();
  });

  it('flies a whole-pixel arc from the hand to the feet, arcPx high at its middle', () => {
    const from = { x: 968, y: 661 };
    const to = { x: 900, y: 690 };
    expect(tossPoint(from, to, 0, 20)).toEqual(from);
    expect(tossPoint(from, to, 1, 20)).toEqual(to);
    expect(tossPoint(from, to, 0.5, 20)).toEqual({ x: 934, y: Math.round((661 + 690) / 2 - 20) });
    expect(tossPoint(from, to, -1, 20)).toEqual(from);
    expect(tossPoint(from, to, 2, 20)).toEqual(to);
    for (const t of [0.1, 0.25, 0.33, 0.6, 0.9]) {
      const p = tossPoint(from, to, t, 20);
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      expect(p.y).toBeLessThan(from.y + (to.y - from.y) * t);
    }
    // No arc: the straight line.
    expect(tossPoint(from, to, 0.5, 0)).toEqual({ x: 934, y: Math.round(675.5) });
  });
});
