import type { AtlasRect, SpriteSheet } from '@iot/shared';

/**
 * A prop's grounding shadow (ART 2026-10-17): as wide as the lowest opaque
 * row of its frame plus `PROP_SHADOW_PAD`, `PROP_SHADOW_H` high, computed
 * once per sheet frame at load from the sheet's pixels (the chest's comes out
 * about 32 × 6). The Kindled keeps its 20 × 6 and the Husks their scaled
 * shadows (world.ts). Pure: the client reads the texture's pixels once
 * (`texturePixels` in spriteSheets.ts) and the test decodes the fixture PNG.
 */
export const PROP_SHADOW_H = 6;
export const PROP_SHADOW_PAD = 4;

/** RGBA pixels, row-major, 4 bytes a pixel (an ImageData, or a decoded PNG). */
export interface Rgba {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** The width of a frame's lowest row with an opaque pixel, from its first to its last; 0 for an empty frame. */
export function lowestRowWidth(img: Rgba, frame: AtlasRect): number {
  for (let y = Math.min(img.height, frame.y + frame.h) - 1; y >= frame.y; y--) {
    let first = -1;
    let last = -1;
    for (let x = frame.x; x < Math.min(img.width, frame.x + frame.w); x++) {
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) === 0) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first >= 0) return last - first + 1;
  }
  return 0;
}

/** A frame's shadow width: its lowest opaque row plus the pad; 0 for an empty frame (no shadow). */
export function propShadowWidth(img: Rgba, frame: AtlasRect): number {
  const w = lowestRowWidth(img, frame);
  return w === 0 ? 0 : w + PROP_SHADOW_PAD;
}

/** Every frame's shadow width, by frame name, once per sheet. */
export function propShadowWidths(sheet: SpriteSheet, img: Rgba): Map<string, number> {
  return new Map(
    Object.entries(sheet.frames).map(([name, f]) => [name, propShadowWidth(img, f.frame)]),
  );
}
