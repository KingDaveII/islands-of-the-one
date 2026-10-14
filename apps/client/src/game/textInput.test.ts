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
    expect(key('\u05e9')).toBe('\u05e9');
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
    expect(typeInto('username', '', 'Mira_01-x!\u00e9 ')).toBe('mira_01-x');
    expect(typeInto('username', 'a'.repeat(19), 'bcd')).toBe(`${'a'.repeat(19)}b`);
  });

  it('passwords and names take anything printable, up to their maximum', () => {
    expect(typeInto('password', '', 'pa ss\u0000w\u00f6rd')).toBe('pa ssw\u00f6rd');
    expect(typeInto('password', '', 'x'.repeat(200))).toHaveLength(128);
    expect(typeInto('name', '', 'Mira\nof Ash')).toBe('Mira of Ash');
    expect(typeInto('name', '', '\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd')).toBe('\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd');
    expect(typeInto('name', '', 'x'.repeat(30))).toHaveLength(24);
  });

  it('backspace removes a whole character', () => {
    expect(backspace('Zoe\u0301')).toBe('Zo');
    expect(backspace('ab\ud83d\udd25')).toBe('ab');
    expect(backspace('')).toBe('');
  });

  it('masks passwords and shows glyphless characters as ?', () => {
    expect(masked('pa\ud83d\udd25s')).toBe('****');
    expect(displayable('Mira', tiny5Font)).toBe('Mira');
    expect(displayable('Mira \u05de\u05d9\u05e8\u05d4', tiny5Font)).toBe('Mira ????');
    expect(displayable('Zoe\u0301', tiny5Font)).toBe('Zo?');
  });
});
