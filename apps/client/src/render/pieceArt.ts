import { PIECE_SHEETS, type AtlasRect } from '@iot/shared';
import type { Rgba } from './propShadow.js';

/**
 * The upgrade pieces drawn from their sheets (`PIECE_SHEETS`, ART's #107):
 * the pixel work behind the ghost, the faded dim, the selection outline and
 * the building moment's rise, pure so the tests run it on the committed
 * PNGs. Each mask is a frame-sized (or, for the outline, padded) array of
 * 0/1, one entry a pixel, row-major; the client paints it once per sheet
 * frame onto a canvas texture (render/pieces.ts).
 */

/** A frame-sized 0/1 mask, row-major. */
export interface Mask {
  w: number;
  h: number;
  bits: Uint8Array;
}

/** The selection outline's width in world px: the focus token, 2 px round the silhouette (ART on #106). */
export const OUTLINE_PX = 2;

/** How tall a step of the building moment's rise is, world px: a tile's height, so the art rises in whole tiles. */
export const RISE_STEP_PX = 32;

/** The sheet a piece draws from, or undefined for a piece without one (its placeholder box draws). */
export function pieceSheetName(pieceId: string): string | undefined {
  return Object.hasOwn(PIECE_SHEETS, pieceId) ? PIECE_SHEETS[pieceId as keyof typeof PIECE_SHEETS] : undefined;
}

/** The opaque pixels of one frame of a sheet image. */
export function opaqueMask(img: Rgba, frame: AtlasRect): Mask {
  const bits = new Uint8Array(frame.w * frame.h);
  for (let y = 0; y < frame.h; y++)
    for (let x = 0; x < frame.w; x++) {
      const sx = frame.x + x;
      const sy = frame.y + y;
      if (sx >= img.width || sy >= img.height) continue;
      if ((img.data[(sy * img.width + sx) * 4 + 3] ?? 0) > 0) bits[y * frame.w + x] = 1;
    }
  return { w: frame.w, h: frame.h, bits };
}

/** The pixels opaque in any of the masks (all the same size): an animated piece's outline holds still over its frames. */
export function unionMask(masks: readonly Mask[]): Mask {
  const first = masks[0];
  if (!first) return { w: 0, h: 0, bits: new Uint8Array(0) };
  const bits = new Uint8Array(first.w * first.h);
  for (const m of masks) for (let i = 0; i < bits.length; i++) if (m.bits[i]) bits[i] = 1;
  return { w: first.w, h: first.h, bits };
}

/**
 * Every other opaque pixel, on the checkerboard where x + y is even (frame
 * coordinates): the ghost's 50 % tint and the faded dim. A piece's frame
 * always starts on an even world pixel (its footprint's bottom centre is a
 * whole number of half tiles, the sheet origins are even), so the pattern
 * holds still in the world as the ghost moves.
 */
export function checkerMask(mask: Mask): Mask {
  const bits = new Uint8Array(mask.bits.length);
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++) if ((x + y) % 2 === 0 && mask.bits[y * mask.w + x]) bits[y * mask.w + x] = 1;
  return { w: mask.w, h: mask.h, bits };
}

/**
 * The silhouette's outline: the clear pixels within `width` (square
 * distance) of an opaque one, on a mask padded by `width` on every side
 * (its pixel (width, width) is the frame's (0, 0)). It never covers the
 * piece's own pixels.
 */
export function outlineMask(mask: Mask, width = OUTLINE_PX): Mask {
  const w = mask.w + 2 * width;
  const h = mask.h + 2 * width;
  const bits = new Uint8Array(w * h);
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < mask.w && y < mask.h && mask.bits[y * mask.w + x] === 1;
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++) {
      if (!opaque(x, y)) continue;
      for (let dy = -width; dy <= width; dy++)
        for (let dx = -width; dx <= width; dx++) {
          if (opaque(x + dx, y + dy)) continue;
          bits[(y + dy + width) * w + (x + dx + width)] = 1;
        }
    }
  return { w, h, bits };
}

/** A frame's art as the rise reads it: its base line and height in the cell, and its top opaque row. */
export interface RiseArt {
  originY: number;
  cellH: number;
  /** The frame's first opaque row (`maskTop`). */
  top: number;
}

/** The first row of a mask with an opaque pixel; the mask's height when it has none. */
export function maskTop(mask: Mask): number {
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (mask.bits[y * mask.w + x]) return y;
  return mask.h;
}

/** How many tile-high steps the building moment's rise takes: the art above the base line, a step a tile (at least one). */
export function riseSteps(art: RiseArt): number {
  return Math.max(1, Math.ceil((art.originY - art.top) / RISE_STEP_PX));
}

/**
 * The rows of a frame shown `risen` steps into the rise, as a crop in frame
 * coordinates: from `risen` tiles above the base line to the frame's bottom
 * (the few rows under the base line come with the first step); the whole
 * frame once every step has risen, nothing at 0.
 */
export function riseCrop(art: RiseArt, risen: number): { y: number; h: number } {
  if (risen <= 0) return { y: art.cellH, h: 0 };
  if (risen >= riseSteps(art)) return { y: 0, h: art.cellH };
  const y = Math.max(0, art.originY - risen * RISE_STEP_PX);
  return { y, h: art.cellH - y };
}
