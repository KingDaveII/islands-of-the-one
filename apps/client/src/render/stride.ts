import { worldPx } from './scale.js';

/**
 * Sums how far a body has moved in world px, from the interpolated render
 * positions (sim px) the renderer already has, for the walk and run cycles
 * (animState.ts, `Stride`). It never resets, so a stop and restart carries on
 * the cycle instead of popping to frame 0. Presentation only: the sim moves
 * the body, this only picks a frame.
 */
export class StrideMeter {
  /** World px moved so far. */
  distancePx = 0;
  private last: { x: number; y: number } | null = null;

  /** Add the step from the last position to this one (sim px); returns the distance so far. */
  step(x: number, y: number): number {
    if (this.last) this.distancePx += worldPx(Math.hypot(x - this.last.x, y - this.last.y));
    this.last = { x, y };
    return this.distancePx;
  }
}
