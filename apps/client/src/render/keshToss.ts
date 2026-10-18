import { KESH_TOSS_RELEASE_FRAME, type SpriteSheet } from '@iot/shared';
import { pointInWorld } from './hookbladePoints.js';

/**
 * Kesh's toss (docs/design/holding.md "Kesh", sprites.md §4 "Old Kesh"):
 * the thrown thing leaves his hand on `toss_<KESH_TOSS_RELEASE_FRAME>` and
 * flies in a whole-pixel arc from that frame's `hand` point (mapped like the
 * Hookblade's points: the anchor the sprite is drawn at plus the point less
 * the cell origin) to the Kindled's feet, over `kesh.tossMs` with the arc's
 * height `kesh.tossArcPx` from tuning. The flight is cosmetic: the count
 * comes from the server's answer, never from the animation. World px.
 */
type Point = { x: number; y: number };

/** The frame of `toss` on which the thrown thing leaves his hand. */
export const tossReleaseFrame = (): string => `toss_${KESH_TOSS_RELEASE_FRAME}`;

/** Where the thrown thing starts: the release frame's `hand` in world px, from the anchor Kesh is drawn at; null on a sheet without it. */
export function tossReleasePoint(sheet: SpriteSheet, anchor: Point): Point | null {
  return pointInWorld(sheet, tossReleaseFrame(), 'hand', anchor);
}

/** Whether a frame of `toss` is at or past the release (the thing is in the air, not in the hand). */
export function tossReleased(frameIndex: number): boolean {
  return frameIndex >= KESH_TOSS_RELEASE_FRAME;
}

/**
 * The thrown thing's place `t` (0..1) of the way from `from` to `to`: a
 * straight line lifted by a parabola `arcPx` high at its middle, in whole
 * world px.
 */
export function tossPoint(from: Point, to: Point, t: number, arcPx: number): Point {
  const k = Math.max(0, Math.min(1, t));
  const lift = 4 * arcPx * k * (1 - k);
  return { x: Math.round(from.x + (to.x - from.x) * k), y: Math.round(from.y + (to.y - from.y) * k - lift) };
}
