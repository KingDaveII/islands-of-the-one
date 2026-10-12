/**
 * The game is 480×270 game pixels drawn through a CSS zoom. Text and sprites
 * only stay crisp when every game pixel covers a **whole number of device
 * pixels**: a whole CSS zoom is not enough on a display scaled 125 % or 150 %
 * (or a browser zoomed to 110 %), where 3 CSS px are 3.75 device px and
 * 1 px strokes come out 3 or 4 px wide at random (the "weird" start-screen
 * text of Playtest 2). So the zoom is chosen in device pixels and expressed
 * in CSS px, which may be fractional (4 device px at DPR 1.25 is 3.2 CSS px).
 */
export const VIEW_W = 480;
export const VIEW_H = 270;

/** Whole device pixels per game pixel that fit the window, never below 1. */
export function fitDevicePixels(
  innerWidth: number,
  innerHeight: number,
  devicePixelRatio: number,
): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(
    1,
    Math.floor(Math.min((innerWidth * dpr) / VIEW_W, (innerHeight * dpr) / VIEW_H)),
  );
}

/** The CSS zoom that gives `fitDevicePixels` device pixels per game pixel. */
export function fitZoom(innerWidth: number, innerHeight: number, devicePixelRatio: number): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return fitDevicePixels(innerWidth, innerHeight, dpr) / dpr;
}
