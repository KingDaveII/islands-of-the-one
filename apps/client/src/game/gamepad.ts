import { controlsData, type ControlAction, type ControlPreset } from '@iot/shared';
import { TURN } from '@iot/sim';

/**
 * Gamepad presets are data (packages/shared/data/controls.json): which glyph
 * fires which action, and whether aim comes from the right stick or follows
 * the left. This module maps glyph names to standard-mapping button indexes,
 * and holds the soft lock. Keyboard/mouse bindings are fixed and unchanged.
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
export const KEYBOARD_HINTS: Record<ControlAction, string> = controlsData.keyboard;

export function presetById(id: string): ControlPreset {
  return (
    PRESETS.find((p) => p.id === id) ??
    PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ??
    (PRESETS[0] as ControlPreset)
  );
}

/** The glyph names bound to an action in a preset (a binding may list alternates). */
export function glyphsFor(preset: ControlPreset, action: ControlAction): string[] {
  const b: string | string[] = preset.bindings[action];
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

/** Hints for every action, from the gamepad preset or the keyboard. */
export function hints(source: 'keyboard' | ControlPreset): Record<ControlAction, string> {
  if (source === 'keyboard') return { ...KEYBOARD_HINTS };
  const out = {} as Record<ControlAction, string>;
  for (const action of Object.keys(KEYBOARD_HINTS) as ControlAction[])
    out[action] = hintFor(source, action);
  return out;
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
