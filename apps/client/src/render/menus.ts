import type Phaser from 'phaser';
import { deviceStore, type Device } from '../game/activeDevice.js';
import {
  connectedPad,
  GLYPH_BUTTON,
  MENU_BUTTONS,
  padFamily,
  type PadFamily,
} from '../game/gamepad.js';
import { glyphs, word, type HintItem } from './hint.js';

/**
 * What the menus share about the active device (docs/design/controls.md §5):
 * the OS cursor shows in mouse mode and hides in pad mode (in a run it is
 * always hidden; the reticle is the cursor there), and the navigation hints
 * name the device's own buttons. The pad glyphs follow the connected pad's
 * family.
 */

/** The glyph family of the connected pad (DualSense when none is). */
export function padFamilyNow(): PadFamily {
  const pad = connectedPad();
  return pad ? padFamily(pad.id) : 'ps';
}

/** Show the OS cursor on a menu scene in mouse mode, hide it in pad mode. */
export function menuCursor(scene: Phaser.Scene): void {
  scene.input.setDefaultCursor(deviceStore.get() === 'gamepad' ? 'none' : 'default');
}

/** The glyph name of a menu button, for hints (standard-mapping index → PlayStation-style name). */
export function menuGlyph(index: number): string {
  return Object.entries(GLYPH_BUTTON).find(([, i]) => i === index)?.[0] ?? '';
}

/** "Enter or click to continue" on the keyboard, "Cross continue" on the pad. */
export function continueHint(device: Device, family: PadFamily): HintItem[] {
  if (device === 'gamepad')
    return [...glyphs([menuGlyph(MENU_BUTTONS.confirm[0])], family), word('continue')];
  return [...glyphs(['Enter'], 'keyboard'), word('or click to continue')];
}
