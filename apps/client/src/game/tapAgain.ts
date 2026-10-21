/**
 * A control that acts only on a second tap within a window (GAME DESIGN,
 * 2026-10-21): the gear in a run, which leaves the run, so a stray thumb
 * never ends one. The first tap arms it and shows `LEAVE_RUN_AGAIN`; a second
 * tap within `windowMs` confirms; after that the gear resets. Pure, so it is
 * tested in node.
 */

/** The line shown while the gear in a run is armed (GAME DESIGN's, final: it names the run, so nobody reads it as quitting the game). */
export const LEAVE_RUN_AGAIN = 'Tap again to leave the run.';

export class TapAgain {
  private armedAt = Number.NEGATIVE_INFINITY;

  constructor(readonly windowMs: number) {}

  /** A tap at `now` (ms): true when it confirms (a second tap within the window), else it arms. */
  tap(now: number): boolean {
    if (this.armed(now)) {
      this.reset();
      return true;
    }
    this.armedAt = now;
    return false;
  }

  /** Whether a first tap is waiting for its second at `now`. */
  armed(now: number): boolean {
    return now - this.armedAt <= this.windowMs;
  }

  reset(): void {
    this.armedAt = Number.NEGATIVE_INFINITY;
  }
}
