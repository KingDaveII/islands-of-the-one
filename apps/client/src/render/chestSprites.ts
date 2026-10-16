import type Phaser from 'phaser';
import { CHEST_SHEET, PROP_TABLES, propFrameName, sheetPixelScale, type SpriteSheet } from '@iot/shared';
import { SUB, type ChestState } from '@iot/sim';
import { DEPTH } from './depth.js';
import { loopFrameAt, nextOpenView, openingStateAt, type OpenView } from './opening.js';
import { snapToArt } from './scale.js';
import { spritePngUrl } from './spriteSheets.js';

/**
 * The chest drawn from ART's `prop-chest` sheet (docs/design/sprites.md §4
 * "Props", G1.5f): each chest of the sim state as an image at its sim
 * position through the same render boundary as the other sprites (its origin,
 * the line under the soles, on the position; snapped to the sheet's art grid;
 * y-sorted with the bodies), its frame from `ChestState.opened` on the client
 * clock like the tile doors (opening.ts): `closed` looping at the sheet's
 * rate (still with one frame), `opening` once when `opened` turns true, then
 * `open`, held; a chest already open when the client first sees it shows
 * `open`. The engine draws nothing of its own over it: the glint, if any, is
 * ART's, in `closed`.
 *
 * Until the sheet lands, `activeChestSheet` is null and the world draws M1's
 * procedural chest, the fallback (`drawChest` in world.ts), unless a playtest
 * hands in a sheet (`setChestSheet`; the tests use the fixture in
 * packages/shared/test/fixtures/prop-chest.*).
 */

/** A chest sheet the client can draw from: its texture key, its JSON contract and its PNG's URL. */
export interface ActiveChestSheet {
  key: string;
  sheet: SpriteSheet;
  url: string;
}

/** Prop sheets on disk, by file name: without `prop-chest` until ART's lands. */
const PROP_JSON: Record<string, SpriteSheet> = Object.fromEntries(
  Object.entries(
    import.meta.glob<SpriteSheet>('../../../../packages/shared/assets/sprites/prop-*.json', {
      eager: true,
      import: 'default',
    }),
  ).map(([path, sheet]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), sheet]),
);

/** A sheet a playtest hands in (`setChestSheet`). */
let override: ActiveChestSheet | null = null;

/** The chest sheet the chests draw from: ART's prop-chest when it is on disk, else one a playtest set, else null (the procedural fallback). */
export function activeChestSheet(): ActiveChestSheet | null {
  const chest = PROP_JSON[CHEST_SHEET];
  const url = chest ? spritePngUrl(chest.meta.image) : undefined;
  if (chest && url) return { key: CHEST_SHEET, sheet: chest, url };
  return override;
}

/** Playtests: draw chests from this sheet while ART's prop-chest is not on disk (`window.__iot.useChestSheet`); null clears it. Takes effect from the next run. */
export function setChestSheet(sheet: ActiveChestSheet | null): void {
  override = sheet;
}

/** Which chest the world draws: from the sheet when one is loaded, else the procedural fallback. */
export function chestRenderer(texturesHave: (key: string) => boolean): 'sheet' | 'procedural' {
  const active = activeChestSheet();
  return active && texturesHave(active.key) ? 'sheet' : 'procedural';
}

/** Loads the active chest sheet as an atlas (its JSON is bundled with the code); nothing without one. */
export function preloadChestSheet(scene: Phaser.Scene): void {
  const active = activeChestSheet();
  if (active && !scene.textures.exists(active.key)) scene.load.atlas(active.key, active.url, active.sheet);
}

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
  /** World px per sheet px (1 for a v2 sheet). */
  readonly scale: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly active: ActiveChestSheet,
  ) {
    this.scale = sheetPixelScale(active.sheet);
  }

  /** Poses every chest of the state: its position in sim px becomes world px here, its frame comes from `opened`. */
  draw(chests: readonly ChestState[], timeMs: number): void {
    const seen = new Set<number>();
    for (const c of chests) {
      seen.add(c.id);
      let entry = this.chests.get(c.id);
      if (!entry) {
        const image = this.scene.add.image(0, 0, this.active.key, propFrameName('closed', 0)).setScale(this.scale);
        this.layer.add(image);
        entry = { image, view: null };
        this.chests.set(c.id, entry);
      }
      entry.view = nextOpenView(entry.view, c.opened, timeMs);
      const frame = chestFrameAt(this.active.sheet, entry.view, timeMs);
      if (entry.image.frame.name !== frame) entry.image.setFrame(frame);
      const x = c.x / SUB;
      const y = c.y / SUB;
      entry.image.setPosition(snapToArt(x, this.scale), snapToArt(y, this.scale)).setDepth(DEPTH.bodies + y * DEPTH.perPixel);
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
