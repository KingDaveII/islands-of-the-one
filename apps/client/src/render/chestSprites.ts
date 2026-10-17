import type Phaser from 'phaser';
import { CHEST_SHEET, PROP_TABLES, propFrameName, spriteSheets, type SpriteSheet } from '@iot/shared';
import { SUB, type ChestState } from '@iot/sim';
import { DEPTH } from './depth.js';
import { loopFrameAt, nextOpenView, openingStateAt, type OpenView } from './opening.js';
import { snapToArt } from './scale.js';

/**
 * The chest drawn from ART's `prop-chest` sheet (docs/design/sprites.md §4
 * "Props", G1.5f): each chest of the sim state as an image at its sim
 * position through the same render boundary as the other sprites (its origin,
 * the line under the soles, on the position, in whole world px; y-sorted with
 * the bodies), its frame from `ChestState.opened` on the client clock like
 * the tile doors (opening.ts): `closed` looping at the sheet's rate (still
 * with one frame), `opening` once when `opened` turns true, then `open`,
 * held; a chest already open when the client first sees it shows `open`. The
 * engine draws nothing of its own over it: the glint, if any, is ART's, in
 * `closed`; the grounding shadow under it stays the engine's (world.ts).
 *
 * The sheet is one of the client's sprite sheets (`SPRITE_SHEET_NAMES`), so
 * it loads with them and a missing PNG is the same error as the Kindled's.
 * There is no other chest: M1's procedural chest went in G1.5g.
 */

/**
 * The chest's frame at `timeMs`: `closed_<k>`, looping at the sheet's rate
 * (`closed_0` alone with one frame); `opening_<n>`, played once at the sheet's
 * rate from when it turned open; then `open_0`, held (also for a chest open
 * when first seen). A sheet without `opening` (a draft) goes straight to open.
 */
export function chestFrameAt(sheet: SpriteSheet, view: OpenView, timeMs: number): string {
  const closed = sheet.anims.closed;
  const opening = sheet.anims.opening;
  const row = PROP_TABLES.chest.find((r) => r.name === 'opening');
  const state = openingStateAt(
    view,
    { frames: opening?.frames.length ?? 0, fps: opening?.frameRate || (row?.fps ?? 1) },
    timeMs,
  );
  if (state.state === 'closed') return propFrameName('closed', loopFrameAt(closed?.frames.length ?? 1, closed?.frameRate ?? 0, timeMs));
  if (state.state === 'opening') return propFrameName('opening', state.n);
  return propFrameName('open', 0);
}

/** The chests in the scene: an image per chest of the state, its frame set every render frame from `opened`. */
export class ChestSprites {
  private readonly chests = new Map<number, { image: Phaser.GameObjects.Image; view: OpenView | null }>();
  /** The sheet the chests draw from (`prop-chest`). */
  readonly sheet: SpriteSheet = spriteSheets[CHEST_SHEET];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
  ) {}

  /** Poses every chest of the state: its position in sim px becomes world px here, its frame comes from `opened`. */
  draw(chests: readonly ChestState[], timeMs: number): void {
    const seen = new Set<number>();
    for (const c of chests) {
      seen.add(c.id);
      let entry = this.chests.get(c.id);
      if (!entry) {
        const image = this.scene.add.image(0, 0, CHEST_SHEET, propFrameName('closed', 0));
        this.layer.add(image);
        entry = { image, view: null };
        this.chests.set(c.id, entry);
      }
      entry.view = nextOpenView(entry.view, c.opened, timeMs);
      const frame = chestFrameAt(this.sheet, entry.view, timeMs);
      if (entry.image.frame.name !== frame) entry.image.setFrame(frame);
      const x = c.x / SUB;
      const y = c.y / SUB;
      entry.image.setPosition(snapToArt(x), snapToArt(y)).setDepth(DEPTH.bodies + y * DEPTH.perPixel);
    }
    for (const [id, entry] of this.chests) {
      if (seen.has(id)) continue;
      // Gone (a room change): drop the image.
      entry.image.destroy();
      this.chests.delete(id);
    }
  }

  /** Each chest's frame this render frame, in sim order (playtests). */
  frames(): string[] {
    return [...this.chests.values()].map((e) => e.image.frame.name);
  }
}
