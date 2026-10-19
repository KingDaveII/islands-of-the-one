import { readFileSync } from 'node:fs';
import {
  HOLDING_CAMERA_MARGIN_TILES,
  holdingLayout,
  KESH_ROCK_SHEET,
  KESH_SHEET,
  measureText,
  PACK_SLOTS,
  silkscreenFont,
  spriteSheets,
  TILE_SIZE_PX,
  tiny5Font,
  TOAST_TEXT,
  defaultTuning,
  type BitmapFont,
  type SpriteSheet,
} from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../../packages/shared/test/png.js';
import { hudRects, propBase, rectsOverlap, talkSpot, toastTextWidth, type UiRect } from '../game/holdingView.js';
import { fitUi, fitWorldView, viewInUi } from '../game/view.js';
import { clampScroll } from './camera.js';
import { worldPx } from './scale.js';

/**
 * The camera margin (docs/design/holding.md "Kesh", M2 Task 4b), as pure
 * layout math: with the Kindled standing on `kesh.talk`, the camera scrolls
 * `cameraMarginTiles` into the void past the layout's edge, so the drawn
 * rects of the rock and of Kesh (their frames' opaque bounds at the world
 * fit) don't meet the HUD's four panels (the Writ block, the purse, the
 * action chip and the PACK chip) at 1280 × 720, 1440 × 810 and 960 × 540.
 * Without the margin the PACK chip covered the rock at 1440 × 810 (ART).
 * The toast strip (M2 Task 7), sized for two lines at the widest M2 text,
 * overlaps neither the chip nor the PACK chip at the same three sizes.
 */
const WINDOWS = [
  [1280, 720],
  [1440, 810],
  [960, 540],
] as const;

/** The opaque bounds of a sheet frame, from its PNG. */
function opaqueBounds(name: string, sheet: SpriteSheet, frame: string): { x: number; y: number; w: number; h: number } {
  const png = decodePng(readFileSync(new URL(`../../../../packages/shared/assets/sprites/${sheet.meta.image}`, import.meta.url)));
  const f = sheet.frames[frame];
  if (!f) throw new Error(`${name}: no frame ${frame}`);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < f.frame.h; y++)
    for (let x = 0; x < f.frame.w; x++) {
      const a = png.rgba[((f.frame.y + y) * png.width + f.frame.x + x) * 4 + 3] ?? 0;
      if (a === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  if (x1 < 0) throw new Error(`${name}: ${frame} is empty`);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** A label's width (UI px) in the Silkscreen face: the glyph advances. */
function labelWidth(text: string, font: BitmapFont = silkscreenFont): number {
  let w = 0;
  for (const ch of text) w += font.chars.find((g) => g.ch === ch)?.adv ?? 0;
  return w;
}

describe('the camera margin keeps the HUD off Kesh and his rock', () => {
  const layout = holdingLayout();
  const rock = spriteSheets[KESH_ROCK_SHEET];
  const kesh = spriteSheets[KESH_SHEET];
  const rockBounds = opaqueBounds(KESH_ROCK_SHEET, rock, 'idle_0');
  const keshBounds = (kesh.anims.fish?.frames ?? []).map((f) => opaqueBounds(KESH_SHEET, kesh, f));
  const base = propBase({ rect: layout.kesh.rock });
  /** A sprite's drawn rect in world px: its frame's opaque bounds placed by the anchor (the cell origin on `base`). */
  const drawn = (sheet: SpriteSheet, b: { x: number; y: number; w: number; h: number }): UiRect => ({
    x: Math.round(worldPx(base.x)) - sheet.meta.origin.x + b.x,
    y: Math.round(worldPx(base.y)) - sheet.meta.origin.y + b.y,
    w: b.w,
    h: b.h,
  });
  const spot = talkSpot(layout);
  const roomW = worldPx(layout.tiles[0]?.length ?? 0) * TILE_SIZE_PX;
  const roomH = worldPx(layout.tiles.length) * TILE_SIZE_PX;
  const margin = worldPx(HOLDING_CAMERA_MARGIN_TILES * TILE_SIZE_PX);
  // The widest texts the HUD can carry: a 24-letter Name, five digits of gin, a full pack, the longest chip words.
  const widths = {
    gin: labelWidth('99999'),
    pack: labelWidth(`PACK ${PACK_SLOTS}/${PACK_SLOTS}`),
    name: labelWidth('W'.repeat(24)),
    letters: 12 * 8,
    chip: 80,
    toast: toastTextWidth(),
  };

  it('sizes the toast strip for the widest M2 toast', () => {
    expect(widths.toast).toBe(measureText(tiny5Font, TOAST_TEXT.WRIT_LOW));
  });

  it('has the margin in data', () => {
    expect(HOLDING_CAMERA_MARGIN_TILES).toBe(6);
    expect(layout.kesh.talk).toEqual({ col: 23, row: 19 });
  });

  for (const [W, H] of WINDOWS) {
    it(`at ${W} × ${H}`, () => {
      const world = fitWorldView(W, H, defaultTuning.view);
      const ui = fitUi(W, H);
      const frame = viewInUi(world, ui.zU);
      const tx = worldPx(spot.x) - world.w / 2;
      const ty = worldPx(spot.y) - world.h / 2;
      const scroll = {
        x: Math.round(clampScroll(tx, roomW, world.w, margin, margin)),
        y: Math.round(clampScroll(ty, roomH, world.h, margin, margin)),
      };
      // World px to UI px: through the view's device offset and the two zooms.
      const toUi = (r: UiRect): UiRect => ({
        x: (world.x + (r.x - scroll.x) * world.zW) / ui.zU,
        y: (world.y + (r.y - scroll.y) * world.zW) / ui.zU,
        w: (r.w * world.zW) / ui.zU,
        h: (r.h * world.zW) / ui.zU,
      });
      const hud = hudRects(frame, widths);
      // The toast strip's rectangle stays clear of the action chip and the PACK chip (M2 Task 7).
      expect(rectsOverlap(hud.toasts, hud.chip), `the toasts over the chip at ${W}×${H}`).toBe(false);
      expect(rectsOverlap(hud.toasts, hud.pack), `the toasts over the pack at ${W}×${H}`).toBe(false);
      expect(hud.toasts.x).toBe(frame.x + 8);
      // At the inset from the bottom where the frame has room beside the chip (1280 × 720 and 960 × 540); above the
      // chip's band in the 320 px frame of 1440 × 810.
      expect(hud.toasts.y + hud.toasts.h).toBe(W === 1440 ? frame.y + frame.h - 8 - 26 - 2 : frame.y + frame.h - 8);
      const sprites = [toUi(drawn(rock, rockBounds)), ...keshBounds.map((b) => toUi(drawn(kesh, b)))];
      for (const s of sprites) {
        // Inside the view at all (the camera reached far enough to show them).
        expect(s.x).toBeGreaterThanOrEqual(frame.x);
        expect(s.x + s.w).toBeLessThanOrEqual(frame.x + frame.w);
        expect(s.y + s.h).toBeLessThanOrEqual(frame.y + frame.h);
        for (const [name, panel] of Object.entries(hud)) expect(rectsOverlap(s, panel), `${name} over the sprite at ${W}×${H}`).toBe(false);
      }
      // Without the margin, the same frames at 1440 × 810 meet the PACK chip (what ART saw).
      if (W === 1440) {
        const flat = { x: Math.round(clampScroll(tx, roomW, world.w, 0, 0)), y: Math.round(clampScroll(ty, roomH, world.h, 0, 0)) };
        const r = drawn(rock, rockBounds);
        const flatRock: UiRect = { x: (world.x + (r.x - flat.x) * world.zW) / ui.zU, y: (world.y + (r.y - flat.y) * world.zW) / ui.zU, w: (r.w * world.zW) / ui.zU, h: (r.h * world.zW) / ui.zU };
        expect(rectsOverlap(flatRock, hud.pack)).toBe(true);
      }
    });
  }
});
