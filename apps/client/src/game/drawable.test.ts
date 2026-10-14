import { describe, expect, it } from 'vitest';
import { displayable } from './drawable.js';

describe('displayable', () => {
  it('keeps what the fonts draw and shows the rest as ?', () => {
    expect(displayable('Mira')).toBe('Mira');
    expect(displayable('Zo\u00eb \u00c5ngstr\u00f6m')).toBe('Zo\u00eb \u00c5ngstr\u00f6m');
    expect(displayable('Mira \u05de\u05d9\u05e8\u05d4')).toBe('Mira ????');
    // A letter with a mark the fonts lack is one character, one ?.
    expect(displayable('q\u0301r')).toBe('?r');
  });
});
