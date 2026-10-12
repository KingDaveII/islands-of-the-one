import { controlsData, type ControlAction, type ControlPreset } from '@iot/shared';
import { TURN } from '@iot/sim';
import { KEYBOARD } from './keyboard.js';

/**
 * Gamepad presets are data (packages/shared/data/controls.json): which glyph
 * fires which action, and whether aim comes from the right stick or follows
 * the left. This module maps glyph names to standard-mapping button indexes,
 * and holds the soft lock. Keyboard/mouse bindings are data too, see keyboard.ts.
 */

/** Standard-mapping button index per glyph (PlayStation names; Xbox pads map the same positions). */
export const GLYPH_BUTTON: Record<string, number> = {
  Cross: 0,
  Circle: 1,
  Square: 2,
  Triangle: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  Select: 8,
  Start: 9,
  L3: 10,
  R3: 11,
  Up: 12,
  Down: 13,
  Left: 14,
  Right: 15,
};

/** Triggers report an analog value; count them as pressed past this. */
export const TRIGGER_THRESHOLD = 0.5;
export const TRIGGER_BUTTONS: ReadonlySet<number> = new Set([
  GLYPH_BUTTON.L2 ?? 6,
  GLYPH_BUTTON.R2 ?? 7,
]);

export const PRESETS: readonly ControlPreset[] = controlsData.presets;
export const DEFAULT_PRESET_ID: string = controlsData.defaultPreset;

/** The first connected pad (browser Gamepad API), or null. */
export function connectedPad(): Gamepad | null {
  return navigator.getGamepads().find((g): g is Gamepad => g !== null && g.connected) ?? null;
}

/** Which glyph family a hint is drawn in: keyboard caps and mouse buttons, DualSense (ps) or Xbox (xb). */
export type GlyphFamily = 'keyboard' | 'ps' | 'xb';
export type PadFamily = Exclude<GlyphFamily, 'keyboard'>;

/** The glyph family for a connected pad: Xbox when its id says so, DualSense otherwise. */
export function padFamily(id: string): PadFamily {
  return /xbox|xinput/i.test(id) ? 'xb' : 'ps';
}

/** Where the HUD's hints come from: the keyboard, or a pad preset drawn in the pad's family. */
export type HintSource = 'keyboard' | { preset: ControlPreset; family: PadFamily };

/** One action's hint: the binding names to show and the family to draw them in. */
export interface Hint {
  labels: string[];
  family: GlyphFamily;
}

export function presetById(id: string): ControlPreset {
  return (
    PRESETS.find((p) => p.id === id) ??
    PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ??
    (PRESETS[0] as ControlPreset)
  );
}

/** The glyph names bound to an action in a preset (a binding may list alternates; none for keyboard-only actions). */
export function glyphsFor(preset: ControlPreset, action: ControlAction): string[] {
  const table: Readonly<Record<string, string | string[]>> = preset.bindings;
  const b = table[action];
  if (b === undefined) return [];
  return Array.isArray(b) ? b : [b];
}

/** Standard-mapping button indexes bound to an action. Unknown glyphs are ignored. */
export function buttonsFor(preset: ControlPreset, action: ControlAction): number[] {
  return glyphsFor(preset, action)
    .map((g) => GLYPH_BUTTON[g])
    .filter((i): i is number => i !== undefined);
}

/** Text label for an action's binding ("R2", "L1/Cross"), shown until a glyph sheet exists. */
export function hintFor(preset: ControlPreset, action: ControlAction): string {
  return glyphsFor(preset, action).join('/');
}

/** Text hints for every action, from the gamepad preset or the keyboard. */
export function hints(source: 'keyboard' | ControlPreset): Record<ControlAction, string> {
  if (source === 'keyboard') return { ...KEYBOARD };
  const out = {} as Record<ControlAction, string>;
  for (const action of Object.keys(KEYBOARD) as ControlAction[])
    out[action] = hintFor(source, action);
  return out;
}

/** An action's hint (binding names + glyph family) for a hint source. */
export function hintFrom(source: HintSource, action: ControlAction): Hint {
  if (source === 'keyboard') return { labels: [KEYBOARD[action]], family: 'keyboard' };
  return { labels: glyphsFor(source.preset, action), family: source.family };
}

/** Signed smallest difference between two angles in radians. */
function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Soft lock: with no direct aim, aim where you walk, snapped to the nearest
 * enemy within `maxDeg` of that direction. `enemies` are offsets from the
 * player (world px). Returns the aim angle in radians.
 */
export function softLock(
  moveAngle: number,
  enemies: readonly { dx: number; dy: number }[],
  maxDeg: number,
): number {
  const max = (maxDeg * Math.PI) / 180;
  let best: { angle: number; dist: number } | null = null;
  for (const e of enemies) {
    const dist = Math.hypot(e.dx, e.dy);
    if (dist === 0) continue;
    const angle = Math.atan2(e.dy, e.dx);
    if (Math.abs(angleDelta(angle, moveAngle)) > max) continue;
    if (!best || dist < best.dist) best = { angle, dist };
  }
  return best ? best.angle : moveAngle;
}

/** Radians from a sim angle (1/4096 turn). */
export const simToRadians = (a: number): number => (a / TURN) * Math.PI * 2;
