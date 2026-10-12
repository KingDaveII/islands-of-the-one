import {
  bindingKeys,
  bindingKeysAll,
  controlsData,
  type BindingContext,
  type ControlAction,
  type ControlBinding,
} from '@iot/shared';

/**
 * Keyboard and mouse bindings are data: the `keyboard` block of
 * packages/shared/data/controls.json names one key (or mouse button) per
 * action, per input context where it matters (E interacts in Calm only),
 * and this module turns those names into the key codes the Controls
 * sampler listens to. It has no Phaser dependency so the table is testable
 * in node; Phaser's KeyCodes are the DOM `keyCode` values used here.
 */
export const KEYBOARD: Readonly<Record<ControlAction, ControlBinding>> = controlsData.keyboard;
export const KEYBOARD_ACTIONS: readonly ControlAction[] = Object.keys(KEYBOARD) as ControlAction[];

/** Mouse buttons, by their binding name. */
export type MouseSide = 'left' | 'middle' | 'right';
export const MOUSE_BUTTONS: Readonly<Record<string, MouseSide>> = { LMB: 'left', MMB: 'middle', RMB: 'right' };

/** The binding name of a DOM `MouseEvent.button` (0 left, 1 middle, 2 right), or null for any other button. */
export function mouseBindingFor(button: number): string | null {
  return button === 0 ? 'LMB' : button === 1 ? 'MMB' : button === 2 ? 'RMB' : null;
}

const NAMED_KEYS: Record<string, number> = {
  Tab: 9,
  Enter: 13,
  Shift: 16,
  Ctrl: 17,
  Alt: 18,
  Esc: 27,
  Space: 32,
  Up: 38,
  Down: 40,
  Left: 37,
  Right: 39,
};

/** DOM keyCode per binding name: letters, digits, F-keys and the named keys above. */
export function keyCodeFor(binding: string): number | undefined {
  if (/^[A-Z]$/.test(binding)) return binding.charCodeAt(0);
  if (/^[0-9]$/.test(binding)) return 48 + Number(binding);
  const fn = /^F([1-9]|1[0-2])$/.exec(binding);
  if (fn) return 111 + Number(fn[1]);
  return NAMED_KEYS[binding];
}

/** The keys or mouse buttons that fire an action in a context ("LMB", "Space", "1"), or in any context when none is given. */
export function keyboardKeys(action: ControlAction, context?: BindingContext): string[] {
  const b = KEYBOARD[action];
  return context === undefined ? bindingKeysAll(b) : bindingKeys(b, context);
}

/** The first key bound to an action in any context (for labels of context-free actions: menu, tuning). */
export function keyboardBinding(action: ControlAction): string {
  return keyboardKeys(action)[0] ?? '';
}

/** The DOM `KeyboardEvent.key` value a binding name corresponds to (for window-level listeners; compare case-insensitively, Shift and CapsLock change the case of letters). */
export function eventKeyFor(binding: string): string {
  switch (binding) {
    case 'Esc':
      return 'Escape';
    case 'Space':
      return ' ';
    case 'Up':
    case 'Down':
    case 'Left':
    case 'Right':
      return `Arrow${binding}`;
    default:
      return binding.length === 1 ? binding.toLowerCase() : binding;
  }
}
