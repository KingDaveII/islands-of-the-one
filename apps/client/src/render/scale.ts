import type Phaser from 'phaser';
import { WORLD_PX_PER_UNIT } from '@iot/shared';

/**
 * The render boundary between the sim and the world (G1.5): one sim pixel
 * is `WORLD_PX_PER_UNIT` (2) world px, so every sim number the client draws
 * (positions, radii, lengths, the `*Px` tuning values, TILE_PX) is converted
 * once, here.
 *
 * One density in the world (G1.5g): every sheet (the sprites, the chest, the
 * room tiles, hookblade-fx) and every drawing of the engine's own (decals,
 * grounding shadows, pickups, the slash arc and thrust line, particles and
 * rings, the trail's rim, poise bars, the charge meter, the pad reticle, the
 * Haul guide) is at 1 world px per pixel: sim numbers ×2 (`worldPx`), pixel
 * sizes as written. The one exception is the F3 debug overlay, M1's hitbox
 * figures drawn in sim px into a `simGraphics`, whose scale is the conversion.
 */

/** A sim-pixel coordinate or length in world px. */
export const worldPx = (simPx: number): number => simPx * WORLD_PX_PER_UNIT;

/** A world-px coordinate or length in sim px (the pointer, read through the world camera). */
export const simPx = (worldPxValue: number): number => worldPxValue / WORLD_PX_PER_UNIT;

/** Where a sprite stands, in whole world px: the sim position on the world's pixel grid. */
export const snapToArt = (simPxValue: number): number => Math.round(worldPx(simPxValue));

/** A Graphics drawn in sim px and shown in world px (the F3 debug shapes: hitboxes are sim lengths). */
export function simGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setScale(WORLD_PX_PER_UNIT);
}
