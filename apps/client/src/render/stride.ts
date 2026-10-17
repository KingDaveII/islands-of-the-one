import { worldPx } from './scale.js';

/**
 * Sums how far a body has moved in world px, from the interpolated render
 * positions (sim px) the renderer already has, for the walk and run cycles
 * (animState.ts, `Stride`). It never resets, so a stop and restart carries on
 * the cycle instead of popping to frame 0. It also keeps the direction of
 * the last step that moved, for the backpedal (G1.5h). Presentation only:
 * the sim moves the body, this only picks a frame.
 */
export class StrideMeter {
  /** World px moved so far. */
  distancePx = 0;
  /** Direction of the last step that moved, degrees clockwise from east (screen y down); null before the body has moved. */
  headingDeg: number | null = null;
  private last: { x: number; y: number } | null = null;

  /** Add the step from the last position to this one (sim px); returns the distance so far. */
  step(x: number, y: number): number {
    if (this.last) {
      const dx = x - this.last.x;
      const dy = y - this.last.y;
      if (dx !== 0 || dy !== 0) {
        this.distancePx += worldPx(Math.hypot(dx, dy));
        this.headingDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
    }
    this.last = { x, y };
    return this.distancePx;
  }
}
