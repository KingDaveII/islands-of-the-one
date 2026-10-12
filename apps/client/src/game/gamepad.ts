import {
  bindingKeys,
  bindingKeysAll,
  controlsData,
  type BindingContext,
  type ControlAction,
  type ControlBinding,
  type ControlPreset,
} from '@iot/shared';
import { TURN } from '@iot/sim';
import { PAD_STICK_DEADZONE, type PadSnapshot } from './activeDevice.js';
import { KEYBOARD, keyboardKeys } from './keyboard.js';

/**
 * Gamepad presets are data (packages/shared/data/controls.json): which glyph
 * fires which action, and whether aim comes from the right stick or follows
 * the left. This module maps glyph names to standard-mapping button indexes,
 * and holds the soft lock. Keyboard/mouse bindings are data too, see keyboard.ts.
 * A binding can name keys per input context (Combat, Calm): pass the
 * context to resolve a press; leave it out to list every key for display.
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

/** Buttons down on a pad (triggers by value), by standard-mapping index. */
export function padButtonsDown(pad: Gamepad): boolean[] {
  return pad.buttons.map((b, i) => (TRIGGER_BUTTONS.has(i) ? b.value > TRIGGER_THRESHOLD : b.pressed));
}

/** What the active-device tracker reads from the pad this frame (activeDevice.ts), or null without a pad. */
export function padSnapshot(pad: Gamepad | null): PadSnapshot | null {
  if (!pad) return null;
  const out = (x: number, y: number): boolean => Math.hypot(x, y) > PAD_STICK_DEADZONE;
  return {
    buttons: padButtonsDown(pad),
    stick: out(pad.axes[0] ?? 0, pad.axes[1] ?? 0) || out(pad.axes[2] ?? 0, pad.axes[3] ?? 0),
  };
}

/**
 * Menu navigation on a pad, by standard-mapping index: Cross or Start
 * confirms, Circle goes back, Triangle opens the controls screen, the D-pad
 * steps through choices. Not bindings (controls.json is for the game's
 * actions): the menus read these directly.
 */
export const MENU_BUTTONS = {
  confirm: [GLYPH_BUTTON.Cross ?? 0, GLYPH_BUTTON.Start ?? 9],
  back: GLYPH_BUTTON.Circle ?? 1,
  controls: GLYPH_BUTTON.Triangle ?? 3,
  left: GLYPH_BUTTON.Left ?? 14,
  right: GLYPH_BUTTON.Right ?? 15,
} as const;

/** Pad buttons that went down since the last call (menus); `state.prev` is kept between frames. */
export function padEdges(state: { prev: boolean[] }): number[] {
  const pad = connectedPad();
  const now = pad ? pad.buttons.map((b) => b.pressed) : [];
  const edges = now.flatMap((down, i) => (down && !(state.prev[i] ?? false) ? [i] : []));
  state.prev = now;
  return edges;
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

/**
 * The glyph names bound to an action in a preset: those that fire in
 * `context`, or every one in any context when no context is given (a binding
 * may list alternates; none for keyboard-only actions).
 */
export function glyphsFor(preset: ControlPreset, action: ControlAction, context?: BindingContext): string[] {
  const table: Readonly<Record<string, ControlBinding>> = preset.bindings;
  const b = table[action];
  return context === undefined ? bindingKeysAll(b) : bindingKeys(b, context);
}

/** Standard-mapping button indexes that fire an action in a context. Unknown glyphs are ignored. */
export function buttonsFor(preset: ControlPreset, action: ControlAction, context: BindingContext): number[] {
  return glyphsFor(preset, action, context)
    .map((g) => GLYPH_BUTTON[g])
    .filter((i): i is number => i !== undefined);
}

/** Text label for an action's binding ("R2", "L1/Cross"), in a context or across both. */
export function hintFor(preset: ControlPreset, action: ControlAction, context?: BindingContext): string {
  return glyphsFor(preset, action, context).join('/');
}

/** Text hints for every action, from the gamepad preset or the keyboard. */
export function hints(source: 'keyboard' | ControlPreset, context?: BindingContext): Record<ControlAction, string> {
  const out = {} as Record<ControlAction, string>;
  for (const action of Object.keys(KEYBOARD) as ControlAction[])
    out[action] = source === 'keyboard' ? keyboardKeys(action, context).join('/') : hintFor(source, action, context);
  return out;
}

/** An action's hint (binding names + glyph family) for a hint source, in a context or across both. */
export function hintFrom(source: HintSource, action: ControlAction, context?: BindingContext): Hint {
  if (source === 'keyboard') return { labels: keyboardKeys(action, context), family: 'keyboard' };
  return { labels: glyphsFor(source.preset, action, context), family: source.family };
}

/** Signed smallest difference between two angles in radians. */
function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** An enemy the soft lock may snap to: its offset from the player (world px) and its sim id. */
export interface LockCandidate {
  dx: number;
  dy: number;
  id?: number;
}

/**
 * Soft lock: with no direct aim, aim where you walk, snapped to the nearest
 * enemy within `maxDeg` of that direction. `enemies` are offsets from the
 * player (world px). Returns the aim angle in radians and the enemy snapped
 * to (null when the aim is just the move direction).
 */
export function softLockPick<E extends LockCandidate>(
  moveAngle: number,
  enemies: readonly E[],
  maxDeg: number,
): { angle: number; target: E | null } {
  const max = (maxDeg * Math.PI) / 180;
  let best: { angle: number; dist: number; target: E } | null = null;
  for (const e of enemies) {
    const dist = Math.hypot(e.dx, e.dy);
    if (dist === 0) continue;
    const angle = Math.atan2(e.dy, e.dx);
    if (Math.abs(angleDelta(angle, moveAngle)) > max) continue;
    if (!best || dist < best.dist) best = { angle, dist, target: e };
  }
  return best ? { angle: best.angle, target: best.target } : { angle: moveAngle, target: null };
}

/** The soft-locked aim angle alone (see softLockPick). */
export function softLock(moveAngle: number, enemies: readonly LockCandidate[], maxDeg: number): number {
  return softLockPick(moveAngle, enemies, maxDeg).angle;
}

/** Radians from a sim angle (1/4096 turn). */
export const simToRadians = (a: number): number => (a / TURN) * Math.PI * 2;
