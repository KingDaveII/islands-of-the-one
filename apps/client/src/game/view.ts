/**
 * The two pixel grids (docs/design/readability.md §2). The canvas backing
 * store runs at device resolution (CSS size = the window, backing = window ×
 * devicePixelRatio, nothing CSS-zoomed) and two cameras draw into it, each
 * with a whole number of device pixels per pixel:
 * - the **world camera** at `zW` device px per world px (one sim pixel is
 *   `WORLD_PX_PER_UNIT` world px, a tile 32): the visible world flexes with
 *   the window between the `view` tuning's limits, centred, the margin
 *   around it the Hollow;
 * - the **UI camera** at `zU` device px per UI px: M1's 480 × 270 design, so
 *   menus and text keep M1's sizes.
 *
 * Whole device pixels matter: on a display scaled 125 % a zoom of 3 CSS px
 * is 3.75 device px and 1 px strokes come out 3 or 4 wide at random (the
 * "weird" start-screen text of Playtest 2). So both zooms are chosen in
 * device pixels. Pure functions; the cameras are set up in render/cameras.ts.
 */

/** The UI's design size (UI px): M1's 480 × 270. */
export const UI_W = 480;
export const UI_H = 270;

/** The `view` block of tuning.json: how much world (world px) the window shows. */
export interface ViewTuning {
  /** The widest view. */
  widthPx: number;
  /** Below this width the world zoom drops a step (unless it is 1). */
  minWidthPx: number;
  /** Below this height the world zoom drops a step (unless it is 1). */
  minHeightPx: number;
  /** The tallest view; the world zoom is the smallest that keeps the view this tall or less. */
  maxHeightPx: number;
}

/** The world view: `zW` device px per world px, `w × h` world px, its top left at (x, y) device px. */
export interface WorldFit {
  zW: number;
  w: number;
  h: number;
  x: number;
  y: number;
}

/** The UI grid: `zU` device px per UI px, `w × h` UI px of canvas. */
export interface UiFit {
  zU: number;
  w: number;
  h: number;
}

/** A device size in whole pixels, never negative or non-finite. */
const whole = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * The world zoom and view for a window of `Wd × Hd` device px:
 * 1. `z` is the smallest whole number ≥ 1 with `Hd / z ≤ maxHeightPx`;
 * 2. if `floor(Hd / z) < minHeightPx` and `z > 1`, `z − 1`;
 * 3. while `floor(Wd / z) < minWidthPx` and `z > 1`, `z − 1` (until the width fits);
 * 4. the view is `min(floor(Wd / z), widthPx) × min(floor(Hd / z), maxHeightPx)`, centred.
 * Below the minimums at `z = 1` the view is what fits.
 */
export function fitWorldView(deviceW: number, deviceH: number, view: ViewTuning): WorldFit {
  const Wd = whole(deviceW);
  const Hd = whole(deviceH);
  let z = Math.max(1, Math.ceil(Hd / Math.max(1, view.maxHeightPx)));
  if (Math.floor(Hd / z) < view.minHeightPx && z > 1) z--;
  while (Math.floor(Wd / z) < view.minWidthPx && z > 1) z--;
  const w = Math.min(Math.floor(Wd / z), view.widthPx);
  const h = Math.min(Math.floor(Hd / z), view.maxHeightPx);
  return { zW: z, w, h, x: Math.floor((Wd - w * z) / 2), y: Math.floor((Hd - h * z) / 2) };
}

/**
 * The UI zoom for a window of `Wd × Hd` device px (M1's rule): the largest
 * whole number with `Wd / zU ≥ 480` and `Hd / zU ≥ 270`, never below 1; and
 * the canvas in UI px at that zoom.
 */
export function fitUi(deviceW: number, deviceH: number): UiFit {
  const Wd = whole(deviceW);
  const Hd = whole(deviceH);
  const zU = Math.max(1, Math.floor(Math.min(Wd / UI_W, Hd / UI_H)));
  return { zU, w: Math.floor(Wd / zU), h: Math.floor(Hd / zU) };
}

/** The window in device px: CSS size × devicePixelRatio, rounded down (the canvas backing store never overflows the window). */
export function deviceSize(
  innerWidth: number,
  innerHeight: number,
  devicePixelRatio: number,
): { w: number; h: number; dpr: number } {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    w: Math.max(1, Math.floor(innerWidth * dpr + 1e-6)),
    h: Math.max(1, Math.floor(innerHeight * dpr + 1e-6)),
    dpr,
  };
}

/** A rectangle in whole pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The world view's rectangle in UI px, rounded inwards (the in-run HUD
 * anchors to its edges): whatever lies inside it is over the world.
 */
export function viewInUi(world: WorldFit, zU: number): Rect {
  const left = Math.ceil(world.x / zU);
  const top = Math.ceil(world.y / zU);
  const right = Math.floor((world.x + world.w * world.zW) / zU);
  const bottom = Math.floor((world.y + world.h * world.zW) / zU);
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

/** Where the 480 × 270 menu layout's top left sits in the UI area (UI px): centred, whole pixels. */
export function menuOrigin(ui: UiFit): { x: number; y: number } {
  return { x: Math.floor((ui.w - UI_W) / 2), y: Math.floor((ui.h - UI_H) / 2) };
}
