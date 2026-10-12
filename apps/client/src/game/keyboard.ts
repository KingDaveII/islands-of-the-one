import { controlsData, type ControlAction } from '@iot/shared';

/**
 * Keyboard and mouse bindings are data: the `keyboard` block of
 * packages/shared/data/controls.json names one key (or mouse button) per
 * action, and this module turns those names into the key codes the Controls
 * sampler listens to. It has no Phaser dependency so the table is testable
 * in node; Phaser's KeyCodes are the DOM `keyCode` values used here.
 */
export const KEYBOARD: Readonly<Record<ControlAction, string>> = controlsData.keyboard;
export const KEYBOARD_ACTIONS: readonly ControlAction[] = Object.keys(KEYBOARD) as ControlAction[];

/** Mouse buttons, by their binding name. */
export const MOUSE_BUTTONS: Readonly<Record<string, 'left' | 'right'>> = { LMB: 'left', RMB: 'right' };

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

/** The key or mouse button bound to an action ("LMB", "Space", "1"). */
export function keyboardBinding(action: ControlAction): string {
  return KEYBOARD[action];
}

/** The DOM `KeyboardEvent.key` value a binding name corresponds to (for window-level listeners). */
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
