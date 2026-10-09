import type Phaser from 'phaser';
import { Palette } from '../palette.js';

/**
 * Pixel-exact drawing on whole game pixels: discs and rings are built from
 * 1 px rows, dithers from single pixels. No anti-aliasing, no gradients.
 */
type G = Phaser.GameObjects.Graphics;

/** Half-width of a disc of radius r at row offset dy. */
function span(r: number, dy: number): number {
  return Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) + 0.35);
}

export function disc(g: G, cx: number, cy: number, r: number, color: number, alpha = 1): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  g.fillStyle(color, alpha);
  for (let dy = -r; dy <= r; dy++) {
    const h = span(r, dy);
    g.fillRect(x - h, y + dy, h * 2 + 1, 1);
  }
}

/** A 1 px circle outline. */
export function ring(g: G, cx: number, cy: number, r: number, color: number, alpha = 1): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  g.fillStyle(color, alpha);
  for (let dy = -r; dy <= r; dy++) {
    const ho = span(r, dy);
    const hi = Math.abs(dy) <= r - 1 ? span(r - 1, dy) : -1;
    const w = ho - hi;
    g.fillRect(x - ho, y + dy, w, 1);
    g.fillRect(x + hi + 1, y + dy, w, 1);
  }
}

/** Checkerboard pixels inside a disc (a dithered, see-through fill). */
export function ditherDisc(g: G, cx: number, cy: number, r: number, color: number, phase = 0, minR = -1): void {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  g.fillStyle(color, 1);
  for (let dy = -r; dy <= r; dy++) {
    const h = span(r, dy);
    const inner = Math.abs(dy) <= minR ? span(minR, dy) : -1;
    for (let dx = -h; dx <= h; dx++) {
      if (dx >= -inner && dx <= inner) continue;
      if (((x0 + dx + y0 + dy + phase) & 1) === 0) g.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
  }
}

/**
 * The grounding shadow: a small dithered hollow-deep ellipse directly under a
 * character, solid in the middle and checkered at the edge.
 */
export function groundShadow(g: G, cx: number, footY: number, rx: number, ry = 2): void {
  const x0 = Math.round(cx);
  const y0 = Math.round(footY);
  g.fillStyle(Palette.ground, 1);
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (d > 1) continue;
      if (d < 0.3 || ((x0 + dx + y0 + dy) & 1) === 0) g.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
  }
}

/** A rect with a 1 px outline around it. */
export function outlinedRect(g: G, x: number, y: number, w: number, h: number, fill: number, outline: number): void {
  g.fillStyle(outline, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(fill, 1).fillRect(x, y, w, h);
}

/** Pixels along a line (Bresenham), every `step`th one drawn: step 2 gives a dotted line. */
export function pixelLine(g: G, x0: number, y0: number, x1: number, y1: number, color: number, step = 1, size = 1): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  let i = 0;
  g.fillStyle(color, 1);
  for (;;) {
    if (i++ % step === 0) g.fillRect(x - (size >> 1), y - (size >> 1), size, size);
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Polygon covering the part of a square (center cx, cy; half-size h) swept
 * clockwise from 12 o'clock between fractions `from` and `to` (0..1).
 */
export function squareSweep(cx: number, cy: number, h: number, from: number, to: number): { x: number; y: number }[] {
  // Perimeter points clockwise from top-middle, parameterized 0..8 (each side half = 1 unit).
  const at = (u: number): { x: number; y: number } => {
    const v = ((u % 8) + 8) % 8;
    if (v < 1) return { x: cx + v * h, y: cy - h };
    if (v < 3) return { x: cx + h, y: cy - h + (v - 1) * h };
    if (v < 5) return { x: cx + h - (v - 3) * h, y: cy + h };
    if (v < 7) return { x: cx - h, y: cy + h - (v - 5) * h };
    return { x: cx - h + (v - 7) * h, y: cy - h };
  };
  // Map an angle fraction to perimeter units via the ray from the center.
  const unit = (f: number): number => {
    const a = f * Math.PI * 2;
    const sx = Math.sin(a);
    const sy = -Math.cos(a);
    const k = 1 / Math.max(Math.abs(sx), Math.abs(sy));
    const px = sx * k;
    const py = sy * k;
    if (py <= -1 + 1e-9 && px >= 0) return px;
    if (px >= 1 - 1e-9) return 2 + py;
    if (py >= 1 - 1e-9) return 4 - px;
    if (px <= -1 + 1e-9) return 6 - py;
    return 8 + px;
  };
  const u0 = unit(from);
  const u1 = to >= 1 ? 8 : unit(to);
  const pts = [{ x: cx, y: cy }, at(u0)];
  for (let c = 1; c < 8; c += 2) if (c > u0 && c < u1) pts.push(at(c));
  pts.push(at(u1));
  return pts;
}
