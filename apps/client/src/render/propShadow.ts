import type { AtlasRect, SpriteSheet } from '@iot/shared';

/**
 * A prop's grounding shadow (ART's answer on #69, 2026-10-17): as wide as the
 * widest of the frame's lowest `PROP_SHADOW_ROWS` (3) opaque rows plus
 * `PROP_SHADOW_PAD` (4), and `PROP_SHADOW_H` (6) high, or
 * `PROP_SHADOW_H_NARROW` (3) when the shadow is narrower than
 * `PROP_SHADOW_NARROW_PX` (16). Computed once per sheet frame at load from
 * the sheet's pixels: the chest comes out 32 × 6, the Sparkglass chip 9 × 3.
 * The Kindled keeps its 20 × 6 and the Husks their radius-scaled shadows
 * (world.ts): the rule is for props only. Pure: the client reads the
 * texture's pixels once (`texturePixels` in spriteSheets.ts) and the test
 * decodes the fixture PNGs.
 */
export const PROP_SHADOW_ROWS = 3;
export const PROP_SHADOW_PAD = 4;
export const PROP_SHADOW_H = 6;
export const PROP_SHADOW_H_NARROW = 3;
export const PROP_SHADOW_NARROW_PX = 16;

/** RGBA pixels, row-major, 4 bytes a pixel (an ImageData, or a decoded PNG). */
export interface Rgba {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** A shadow's size in world px. */
export interface ShadowSize {
  w: number;
  h: number;
}

/**
 * The widths (first to last opaque pixel) of a frame's lowest `rows` rows
 * that have an opaque pixel, lowest first; fewer when the frame has fewer
 * such rows, none for an empty frame.
 */
export function baseRowWidths(img: Rgba, frame: AtlasRect, rows = PROP_SHADOW_ROWS): number[] {
  const out: number[] = [];
  for (
    let y = Math.min(img.height, frame.y + frame.h) - 1;
    y >= frame.y && out.length < rows;
    y--
  ) {
    let first = -1;
    let last = -1;
    for (let x = frame.x; x < Math.min(img.width, frame.x + frame.w); x++) {
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) === 0) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first >= 0) out.push(last - first + 1);
  }
  return out;
}

/**
 * A frame's shadow: the widest of its lowest three opaque rows plus 4 wide,
 * 6 high, or 3 high when narrower than 16; 0 × 0 for an empty frame (no
 * shadow).
 */
export function propShadowSize(img: Rgba, frame: AtlasRect): ShadowSize {
  const widths = baseRowWidths(img, frame);
  if (widths.length === 0) return { w: 0, h: 0 };
  const w = Math.max(...widths) + PROP_SHADOW_PAD;
  return { w, h: w < PROP_SHADOW_NARROW_PX ? PROP_SHADOW_H_NARROW : PROP_SHADOW_H };
}

/** Every frame's shadow size, by frame name, once per sheet. */
export function propShadowSizes(sheet: SpriteSheet, img: Rgba): Map<string, ShadowSize> {
  return new Map(
    Object.entries(sheet.frames).map(([name, f]) => [name, propShadowSize(img, f.frame)]),
  );
}
