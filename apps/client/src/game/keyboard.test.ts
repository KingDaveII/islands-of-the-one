import { describe, expect, it } from 'vitest';
import { eventKeyFor, KEYBOARD, KEYBOARD_ACTIONS, keyboardBinding, keyboardKeys, keyCodeFor, MOUSE_BUTTONS, mouseBindingFor } from './keyboard.js';

describe('keyboard bindings (data-driven)', () => {
  it('every keyboard binding is a mouse button or a key with a code', () => {
    for (const action of KEYBOARD_ACTIONS) {
      const keys = keyboardKeys(action);
      expect(keys.length, action).toBeGreaterThan(0);
      for (const b of keys) {
        const ok = MOUSE_BUTTONS[b] !== undefined || keyCodeFor(b) !== undefined;
        expect(ok, `${action}: ${b}`).toBe(true);
      }
    }
  });

  it('E interacts in Calm only; Space dodges in both contexts', () => {
    expect(keyboardKeys('interact', 'calm')).toEqual(['E']);
    expect(keyboardKeys('interact', 'combat')).toEqual([]);
    expect(keyboardKeys('interact')).toEqual(['E']);
    expect(keyboardBinding('interact')).toBe('E');
    expect(keyboardKeys('dodge', 'calm')).toEqual(['Space']);
    expect(keyboardKeys('dodge', 'combat')).toEqual(['Space']);
    expect(keyboardBinding('tuning')).toBe('F2');
  });

  it('matches the design: LMB light, RMB heavy, Space dodge, MMB (or 1) Haul, 2-3 abilities, Q/F items, E interact', () => {
    expect(KEYBOARD).toMatchObject({
      light: 'LMB',
      heavy: 'RMB',
      dodge: 'Space',
      ability1: ['MMB', '1'],
      ability2: '2',
      ability3: '3',
      item1: 'Q',
      item2: 'F',
      interact: { calm: 'E' },
      chartPeek: 'Tab',
      journal: 'J',
      menu: 'Esc',
      tuning: 'F2',
    });
    // The old alternates are gone.
    expect(Object.values(KEYBOARD)).not.toContain('J/K');
    expect(Object.values(KEYBOARD).filter((k) => k === 'J')).toHaveLength(1);
    expect(Object.values(KEYBOARD)).not.toContain('Shift');
  });

  it('names the three mouse buttons, the middle one first for the Haul', () => {
    expect(MOUSE_BUTTONS).toEqual({ LMB: 'left', MMB: 'middle', RMB: 'right' });
    expect([0, 1, 2, 3, 4].map(mouseBindingFor)).toEqual(['LMB', 'MMB', 'RMB', null, null]);
    expect(keyboardBinding('ability1')).toBe('MMB');
    expect(keyboardKeys('ability1')).toEqual(['MMB', '1']);
  });

  it('maps binding names to DOM key codes', () => {
    expect(keyCodeFor('Space')).toBe(32);
    expect(keyCodeFor('Q')).toBe(81);
    expect(keyCodeFor('1')).toBe(49);
    expect(keyCodeFor('Tab')).toBe(9);
    expect(keyCodeFor('Esc')).toBe(27);
    expect(keyCodeFor('F2')).toBe(113);
    expect(keyCodeFor('F12')).toBe(123);
    expect(keyCodeFor('LMB')).toBeUndefined();
    expect(keyCodeFor('nope')).toBeUndefined();
  });

  it('maps binding names to KeyboardEvent.key values', () => {
    expect(eventKeyFor('F2')).toBe('F2');
    expect(eventKeyFor('Esc')).toBe('Escape');
    expect(eventKeyFor('Space')).toBe(' ');
    expect(eventKeyFor('J')).toBe('j');
    expect(eventKeyFor('Tab')).toBe('Tab');
  });
});
