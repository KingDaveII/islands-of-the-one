/**
 * Landscape only (M2 Task 10): when the portrait line covers the game, and how
 * large it is drawn. Pure; ui/portrait.ts draws it.
 */

/** GAME DESIGN's line (final, M2 Task 10). */
export const TURN_SIDEWAYS = 'Turn your phone sideways.';

/** Whether the game waits under the portrait line: a touch screen (a coarse pointer, or touch the active device) held taller than wide. */
export function portraitBlocked(w: number, h: number, touchScreen: boolean): boolean {
  return touchScreen && h > w;
}

/** The line's whole-pixel scale: as large as fits the width with a margin, 1 to 3. */
export function lineScale(uiW: number, lineW: number, margin = 16): number {
  return Math.max(1, Math.min(3, Math.floor((uiW - 2 * margin) / Math.max(1, lineW))));
}
