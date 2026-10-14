import { tiny5Font } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { backspace, displayable, masked, typedText, typeInto } from './textInput.js';

const key = (
  k: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
) => typedText({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe('text entry', () => {
  it('types printable keys only', () => {
    expect(key('a')).toBe('a');
    expect(key('ש')).toBe('ש');
    expect(key(' ')).toBe(' ');
    expect(key('Enter')).toBeNull();
    expect(key('Backspace')).toBeNull();
    expect(key('F2')).toBeNull();
    expect(key('v', { ctrlKey: true })).toBeNull();
    expect(key('v', { metaKey: true })).toBeNull();
    // AltGr.
    expect(key('@', { ctrlKey: true, altKey: true })).toBe('@');
  });

  it('usernames take a-z, digits, _ and -, lowercased, up to 20', () => {
    expect(typeInto('username', '', 'Mira_01-x!é ')).toBe('mira_01-x');
    expect(typeInto('username', 'a'.repeat(19), 'bcd')).toBe(`${'a'.repeat(19)}b`);
  });

  it('passwords and names take anything printable, up to their maximum', () => {
    expect(typeInto('password', '', 'pa ss\u0000wörd')).toBe('pa sswörd');
    expect(typeInto('password', '', 'x'.repeat(200))).toHaveLength(128);
    expect(typeInto('name', '', 'Mira\nof Ash')).toBe('Mira of Ash');
    expect(typeInto('name', '', 'שָׁלוֹם')).toBe('שָׁלוֹם');
    expect(typeInto('name', '', 'x'.repeat(30))).toHaveLength(24);
  });

  it('backspace removes a whole character', () => {
    expect(backspace('Zoé')).toBe('Zo');
    expect(backspace('ab🔥')).toBe('ab');
    expect(backspace('')).toBe('');
  });

  it('masks passwords and shows glyphless characters as ?', () => {
    expect(masked('pa🔥s')).toBe('****');
    expect(displayable('Mira', tiny5Font)).toBe('Mira');
    expect(displayable('Mira מירה', tiny5Font)).toBe('Mira ????');
    expect(displayable('Zoé', tiny5Font)).toBe('Zo?');
  });
});
