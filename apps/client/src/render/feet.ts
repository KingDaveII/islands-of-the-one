import type { SpriteSheet } from '@iot/shared';

/**
 * Where a sprite stands: its origin is the point between the feet, while the
 * sim's position is the body center. The Kindled's feet are 5 px below the
 * center (the 16x24 body, docs/design/readability.md); a Husk's are its
 * radius below, where its grounding shadow sits.
 */
export const PLAYER_FEET = 5;

/** A Husk sheet's feet offset from the body center: half its body height (origin y minus the cell's body top). */
export function feetOffset(sheet: SpriteSheet): number {
  // Peeling: 12x9 body on a (12, 18) origin → 4; Nutshell: 24x24 on (20, 34) → 12.
  const { cell, origin } = sheet.meta;
  return Math.round((origin.y - (cell.h - origin.y)) / 4);
}
