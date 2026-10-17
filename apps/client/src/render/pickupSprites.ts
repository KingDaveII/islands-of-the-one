import type Phaser from 'phaser';
import { SPARKGLASS_SHEET, type SpriteSheet } from '@iot/shared';
import { SUB, type PickupState } from '@iot/sim';
import { DEPTH } from './depth.js';
import { loopFrameAt } from './opening.js';
import { propShadowSizes, type ShadowSize } from './propShadow.js';
import { snapToArt } from './scale.js';
import { optionalSheet, texturePixels } from './spriteSheets.js';

/**
 * The Sparkglass pickups from ART's `prop-sparkglass` sheet (sprites.md §4
 * "Props", M1 polish 2026-10-17): a 9 × 11 chip with a 2-frame glint, `idle`
 * at the recipe's fps. When the sheet is on disk (`optionalSheet`), each
 * pickup of the sim state is an image at its interpolated position (the
 * engine's fly-out and magnet motion are the sim's, kept as they are), its
 * origin, the line under the chip, on the position in whole world px, over
 * the floor decals and under the chain and the bodies (`DEPTH.pickups`),
 * looping `idle` on the client clock, with a grounding shadow by the prop
 * rule (propShadow.ts). Until the sheet lands, `pickupRenderer` says
 * `fallback` and the world keeps drawing M1's 7 × 9 chip (`drawPickup` in
 * world.ts), the same pattern as the chest before #61.
 */

/** What draws a pickup: the sheet when it is there, else the engine's own drawing. */
export type PickupRenderer = 'sheet' | 'fallback';

export function pickupRenderer(sheet: SpriteSheet | undefined): PickupRenderer {
  return sheet?.anims.idle ? 'sheet' : 'fallback';
}

/** The pickup's frame at `timeMs`: `idle_<k>` looping at the sheet's rate (`idle_0` alone with one frame or no rate). */
export function pickupFrameAt(sheet: SpriteSheet, timeMs: number): string {
  const idle = sheet.anims.idle;
  const n = idle?.frames.length ?? 1;
  return idle?.frames[loopFrameAt(n, idle.frameRate, timeMs)] ?? 'idle_0';
}

/** The pickups in the scene: an image per pickup of the state while the sheet is on disk. */
export class PickupSprites {
  private readonly images = new Map<number, Phaser.GameObjects.Image>();
  /** The sheet the pickups draw from, when it is on disk (`prop-sparkglass`); undefined means the fallback drawing. */
  readonly sheet: SpriteSheet | undefined = optionalSheet(SPARKGLASS_SHEET);
  private shadows: Map<string, ShadowSize> | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
  ) {}

  /** Which renderer the world uses this session. */
  get renderer(): PickupRenderer {
    return pickupRenderer(this.sheet);
  }

  /**
   * Poses every pickup at its interpolated position (sim px: `at`), the chip's
   * base on it in whole world px, its frame from the clock. Returns the shadow
   * width (world px) to draw under each, by pickup id: the shown frame's
   * lowest opaque row plus 4, or 0 before the sheet's pixels can be read.
   */
  draw(
    pickups: readonly PickupState[],
    at: (k: PickupState) => { x: number; y: number },
    timeMs: number,
  ): Map<number, ShadowSize> {
    const shadows = new Map<number, ShadowSize>();
    const sheet = this.sheet;
    if (!sheet) return shadows;
    if (!this.shadows) {
      const img = texturePixels(this.scene, SPARKGLASS_SHEET);
      if (img) this.shadows = propShadowSizes(sheet, img);
    }
    const seen = new Set<number>();
    const frame = pickupFrameAt(sheet, timeMs);
    for (const k of pickups) {
      seen.add(k.id);
      let image = this.images.get(k.id);
      if (!image) {
        image = this.scene.add.image(0, 0, SPARKGLASS_SHEET, frame).setDepth(DEPTH.pickups);
        this.layer.add(image);
        this.images.set(k.id, image);
      }
      if (image.frame.name !== frame) image.setFrame(frame);
      const p = at(k);
      image.setPosition(snapToArt(p.x), snapToArt(p.y));
      shadows.set(k.id, this.shadows?.get(frame) ?? { w: 0, h: 0 });
    }
    for (const [id, image] of this.images) {
      if (seen.has(id)) continue;
      // Collected, or gone with the room: drop the image.
      image.destroy();
      this.images.delete(id);
    }
    return shadows;
  }

  /** The pickups' frames this render frame, in sim order (playtests). */
  frames(): string[] {
    return [...this.images.values()].map((i) => i.frame.name);
  }
}

/** The sim position of a pickup in sim px (its state is in sub-pixel units). */
export const pickupSimPx = (k: PickupState): { x: number; y: number } => ({
  x: k.x / SUB,
  y: k.y / SUB,
});
