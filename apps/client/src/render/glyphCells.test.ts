import { controllerGlyphsSheet as sheet } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { glyphsFor, padFamily, PRESETS } from '../game/gamepad.js';
import { KEYBOARD, keyboardKeys } from '../game/keyboard.js';
import { glyphCell, GLYPH_SIZE } from './glyphCells.js';

describe('controller glyph cells', () => {
  it('every keyboard binding has a key or mouse cell', () => {
    for (const action of Object.keys(KEYBOARD) as (keyof typeof KEYBOARD)[]) {
      for (const binding of keyboardKeys(action)) {
        const cell = glyphCell(binding, 'keyboard');
        expect(cell, `${action}: ${binding}`).not.toBeNull();
        expect(sheet.cells.some((c) => c.name === cell)).toBe(true);
      }
    }
    expect(glyphCell('LMB', 'keyboard')).toBe('mouse_left');
    expect(glyphCell('MMB', 'keyboard')).toBe('mouse_middle');
    expect(glyphCell('RMB', 'keyboard')).toBe('mouse_right');
    expect(glyphCell('Space', 'keyboard')).toBe('key_space');
    expect(glyphCell('F2', 'keyboard')).toBe('key_f2');
    expect(GLYPH_SIZE).toBe(12);
  });

  it('every preset binding has a DualSense and an Xbox cell', () => {
    for (const preset of PRESETS) {
      for (const action of Object.keys(preset.bindings)) {
        for (const g of glyphsFor(preset, action as keyof typeof KEYBOARD)) {
          expect(glyphCell(g, 'ps'), `${preset.id} ${action} ${g} (ps)`).toMatch(/^(ps_|stick_)/);
          expect(glyphCell(g, 'xb'), `${preset.id} ${action} ${g} (xb)`).toMatch(/^(xb_|ps_dpad_|stick_)/);
        }
      }
    }
    expect(glyphCell('R2', 'ps')).toBe('ps_r2');
    expect(glyphCell('R2', 'xb')).toBe('xb_rt');
    expect(glyphCell('Cross', 'xb')).toBe('xb_a');
    expect(glyphCell('Down', 'xb')).toBe('ps_dpad_down');
  });

  it('falls back to null for bindings without a cell', () => {
    expect(glyphCell('Select', 'ps')).toBeNull();
    expect(glyphCell('Shift', 'keyboard')).toBeNull();
    expect(glyphCell('F3', 'keyboard')).toBeNull();
  });

  it('picks the Xbox family from the pad id', () => {
    expect(padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b12)')).toBe('xb');
    expect(padFamily('xinput')).toBe('xb');
    expect(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('ps');
    expect(padFamily('')).toBe('ps');
  });
});
