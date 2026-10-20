import { controllerGlyphsSheet } from '@iot/shared';
import type { Rect } from './view.js';

/**
 * The run HUD's four corner panels (render/hud.ts draws by these), pure so the
 * touch layout's tests (M2 Task 10) check its controls against the real
 * rectangles: on the UI grid at the edges of the world view, M1's 8 px inset.
 */
export const RUN_HUD_INSET = 8;
export const RUN_HUD_PAD = 4;
export const RUN_HUD_SLOT = 20;
export const RUN_HUD_SMALL = 14;
export const RUN_HUD_SLOT_GAP = 4;
/** The key-hint row under the slots: a 1× controller glyph. */
export const RUN_HUD_HINT_H: number = controllerGlyphsSheet.cell;

/** The measured widths (UI px) of the run HUD's texts, and the weapon's ability slots. */
export interface RunHudWidths {
  hp: number;
  room: number;
  spark: number;
  abilities: number;
}

/** The corner panels' rectangles for a view frame (UI px; the drop shadow's pixel below is `hud.ts`'s). */
export function runHudRects(frame: Rect, widths: RunHudWidths): { tl: Rect; tr: Rect; bl: Rect; br: Rect } {
  const PAD = RUN_HUD_PAD;
  const INSET = RUN_HUD_INSET;
  const L = frame.x;
  const T = frame.y;
  const R = frame.x + frame.w;
  const B = frame.y + frame.h;
  const tlW = PAD + 66 + 3 + Math.max(widths.hp, 18) + PAD;
  const tlH = PAD + 8 + 3 + RUN_HUD_SMALL + 1 + RUN_HUD_HINT_H + PAD;
  const trW = PAD + widths.room + PAD;
  const trH = PAD + 8 + PAD;
  const brW = PAD + 10 + 3 + Math.max(widths.spark, 8) + PAD;
  const brH = PAD + 10 + PAD;
  const n = widths.abilities;
  const blW = PAD + RUN_HUD_SLOT * 3 + RUN_HUD_SLOT_GAP * 2 + 6 + n * RUN_HUD_SLOT + Math.max(0, n - 1) * RUN_HUD_SLOT_GAP + PAD;
  const blH = PAD + 10 + RUN_HUD_SLOT + 1 + RUN_HUD_HINT_H + PAD;
  return {
    tl: { x: L + INSET, y: T + INSET, w: tlW, h: tlH },
    tr: { x: R - INSET - trW, y: T + INSET, w: trW, h: trH },
    br: { x: R - INSET - brW, y: B - INSET - brH, w: brW, h: brH },
    bl: { x: L + INSET, y: B - INSET - blH, w: blW, h: blH },
  };
}
