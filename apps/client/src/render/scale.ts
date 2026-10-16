import type Phaser from 'phaser';
import { LEGACY_PIXEL_SCALE, WORLD_PX_PER_UNIT } from '@iot/shared';

/**
 * The render boundary between the sim and the world (G1.5): one sim pixel
 * is `WORLD_PX_PER_UNIT` (2) world px, so every sim number the client draws
 * (positions, radii, lengths, the `*Px` tuning values, TILE_PX) is converted
 * once, here or by a legacy Graphics' scale.
 *
 * Two densities in the world:
 * - M1's assets draw at `LEGACY_PIXEL_SCALE` (2) world px per pixel until ART
 *   replaces them: the three v1 sheets and hookblade-fx (sprites at scale 2
 *   at world positions; hookblade-fx at its `meta.pixelScale`, 2 today) and the procedural room (tiles, doors, chests), drawn
 *   in M1 pixels, which are sim pixels, into a `legacyGraphics`, whose scale
 *   of 2 is both conversions at once. The F3 debug shapes, M1's placeholder
 *   figures over the v1 sprites, draw that way too.
 * - Everything else the engine draws (decals, grounding shadows, pickups,
 *   the slash arc and thrust line, particles and rings, the trail's rim,
 *   poise bars, the charge meter, the pad reticle, the Haul guide) is at the
 *   new density, 1 world px per pixel: sim numbers ×2 (`worldPx`), pixel
 *   sizes as written. A v2 sheet draws at 1 too.
 */

/** A sim-pixel coordinate or length in world px. */
export const worldPx = (simPx: number): number => simPx * WORLD_PX_PER_UNIT;

/** A world-px coordinate or length in sim px (the pointer, read through the world camera). */
export const simPx = (worldPxValue: number): number => worldPxValue / WORLD_PX_PER_UNIT;

/**
 * Where a sprite drawn at `artScale` world px per art px stands, in world px:
 * the sim position snapped to the sprite's own art-pixel grid, so a v1 sheet
 * keeps M1's whole-pixel placement and a v2 sheet moves in world px.
 */
export const snapToArt = (simPxValue: number, artScale: number): number =>
  Math.round(worldPx(simPxValue) / artScale) * artScale;

/** A Graphics for M1 art: drawn in sim px (= M1 art px), shown at the legacy scale in world px. */
export function legacyGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setScale(LEGACY_PIXEL_SCALE);
}
