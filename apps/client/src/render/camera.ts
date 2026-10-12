/**
 * Camera scroll along one axis, with the HUD's safe margins
 * (docs/design/readability.md §3). `near` and `far` are how far the corner
 * panels reach in from the near (left/top) and far (right/bottom) screen
 * edges. The camera may scroll past the room's edges by those margins, so a
 * player at a wall is drawn inside the clear area; a room small enough to fit
 * the free area is centered in it instead of scrolling.
 */
export function clampScroll(
  target: number,
  roomSize: number,
  view: number,
  near: number,
  far: number,
): number {
  const lo = -near;
  const hi = roomSize - view + far;
  if (lo >= hi) {
    // Fits the free area: center the room between the panels.
    return -(near + (view - near - far - roomSize) / 2);
  }
  return Math.max(lo, Math.min(hi, target));
}
