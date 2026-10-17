import { controllerGlyphsSheet as sheet } from '@iot/shared';
import type { GlyphFamily } from '../game/gamepad.js';

/**
 * Binding names (controls.json) to cells of the controller glyph sheet
 * (packages/shared/assets/controller-glyphs.json). Pure, so it is tested in
 * node; hint.ts draws the cells. A binding with no cell falls back to its
 * text label.
 */
export const GLYPH_SIZE: number = sheet.cell;
const CELLS: ReadonlySet<string> = new Set(sheet.cells.map((c) => c.name));

/**
 * Pad glyph names (PlayStation-style in data) per family. D-pad and stick
 * cells serve both pads. The Touchpad is the DualSense's alone: an Xbox pad
 * has none, so its binding shows as its text label there.
 */
const DPAD_AND_STICKS: Record<string, string> = {
  Up: 'ps_dpad_up',
  Down: 'ps_dpad_down',
  Left: 'ps_dpad_left',
  Right: 'ps_dpad_right',
  L3: 'stick_left',
  R3: 'stick_right',
};
const PAD_CELLS: Record<'ps' | 'xb', Record<string, string>> = {
  ps: {
    ...DPAD_AND_STICKS,
    Cross: 'ps_cross',
    Circle: 'ps_circle',
    Square: 'ps_square',
    Triangle: 'ps_triangle',
    L1: 'ps_l1',
    R1: 'ps_r1',
    L2: 'ps_l2',
    R2: 'ps_r2',
    Start: 'ps_options',
    Touchpad: 'ps_touchpad',
  },
  xb: {
    ...DPAD_AND_STICKS,
    Cross: 'xb_a',
    Circle: 'xb_b',
    Square: 'xb_x',
    Triangle: 'xb_y',
    L1: 'xb_lb',
    R1: 'xb_rb',
    L2: 'xb_lt',
    R2: 'xb_rt',
    Start: 'xb_menu',
  },
};
const MOUSE_CELLS: Record<string, string> = { LMB: 'mouse_left', MMB: 'mouse_middle', RMB: 'mouse_right', Mouse: 'mouse' };

/** The sheet cell for a binding name in a family, or null when the sheet has none (show the text label). */
export function glyphCell(binding: string, family: GlyphFamily): string | null {
  const name =
    family === 'keyboard' ? (MOUSE_CELLS[binding] ?? `key_${binding.toLowerCase()}`) : PAD_CELLS[family][binding];
  return name !== undefined && CELLS.has(name) ? name : null;
}
