import { describe, expect, it } from 'vitest';
import {
  CLAY_TONES,
  CREATION_CLAY_TONES,
  creationData,
  DEFAULT_CLAY_TONE,
  DRAWABLE_CHARS,
  graphemes,
  isApiErrorBody,
  isCreateKindledRequest,
  isCredentialsRequest,
  isMeResponse,
  lettersFromPositions,
  NAME_NOT_DRAWABLE,
  NAME_REFUSED,
  normalizeKindledName,
  paletteData,
  REMEMBRANCES,
  validateKindledName,
  validatePassword,
  validateUsername,
} from '../src/index.js';

/**
 * Banned words are never spelled out here (names.test.ts scans every file):
 * they are built from alphabet positions, like safe-letters.test.ts does.
 */
const latin = (positions: number[]): string =>
  positions.map((p) => String.fromCharCode(97 + p)).join('');
const LATIN_BANNED = latin([24, 0, 7, 22, 4, 7]);
const HEBREW_BANNED = lettersFromPositions([9, 4, 5, 4]);
const TITLE_BANNED = lettersFromPositions([0, 3, 13, 9]);

describe('creation data', () => {
  it('lists the four Remembrances in glossary order, each with a name and an outfit', () => {
    expect(REMEMBRANCES).toEqual(['clay', 'ash', 'tide', 'wing']);
    for (const id of REMEMBRANCES) {
      const r = creationData.remembrances[id];
      expect(r.name.toLowerCase()).toBe(id);
      expect(r.outfit.length).toBeGreaterThan(0);
    }
    expect(Object.keys(paletteData.remembranceOutfit).sort()).toEqual([...REMEMBRANCES].sort());
    // The client draws the outfit colours: they must be palette tokens.
    const tokens = new Set(Object.values(paletteData.tokens));
    for (const hex of Object.values(paletteData.remembranceOutfit)) expect(tokens).toContain(hex);
  });

  it("lists exactly palette.json's clay tones, defaulting to grey-ochre", () => {
    expect([...CREATION_CLAY_TONES].sort()).toEqual([...CLAY_TONES].sort());
    expect(DEFAULT_CLAY_TONE).toBe('clay-grey-ochre');
    expect(CREATION_CLAY_TONES).toContain(DEFAULT_CLAY_TONE);
  });
});

describe('validateUsername', () => {
  it('accepts 3-20 of [a-z0-9_-] in any case and stores it lowercase', () => {
    expect(validateUsername('abc')).toEqual({ ok: true, value: 'abc' });
    expect(validateUsername('Kindled_01-x')).toEqual({ ok: true, value: 'kindled_01-x' });
    expect(validateUsername('  Ash  ')).toEqual({ ok: true, value: 'ash' });
    expect(validateUsername('a'.repeat(20))).toEqual({ ok: true, value: 'a'.repeat(20) });
  });

  it('refuses other lengths, characters and types', () => {
    for (const bad of [
      'ab',
      'a'.repeat(21),
      'has space',
      'dot.ted',
      '\u00e9-acute',
      'ash!',
      '',
      42,
      null,
    ])
      expect(validateUsername(bad).ok, String(bad)).toBe(false);
    // The Kelvin sign lowercases to "k": refused before lowercasing.
    expect(validateUsername('\u212aindled').ok).toBe(false);
    expect(validateUsername('x'.repeat(10_000)).ok).toBe(false);
  });

  it('runs the safe-letters filter', () => {
    expect(validateUsername(LATIN_BANNED).ok).toBe(false);
    expect(validateUsername(LATIN_BANNED.toUpperCase()).ok).toBe(false);
    expect(validateUsername(`x_${LATIN_BANNED}_1`).ok).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts 8-128 code points, NFC-normalized', () => {
    expect(validatePassword('12345678')).toEqual({ ok: true, value: '12345678' });
    expect(validatePassword('p'.repeat(128)).ok).toBe(true);
    expect(validatePassword('with spaces ok')).toEqual({ ok: true, value: 'with spaces ok' });
    // e + combining acute becomes é.
    expect(validatePassword('cafe\u0301-latte')).toEqual({ ok: true, value: 'caf\u00e9-latte' });
    // Astral characters count once each.
    expect(validatePassword('\ud83d\udd25'.repeat(8)).ok).toBe(true);
  });

  it('refuses short, long and non-string passwords', () => {
    for (const bad of ['1234567', 'p'.repeat(129), '', 12345678, undefined])
      expect(validatePassword(bad).ok, String(bad)).toBe(false);
    expect(validatePassword('\ud83d\udd25'.repeat(7)).ok).toBe(false);
  });
});

describe('validateKindledName', () => {
  const ok = (input: string, name: string): void => {
    expect(validateKindledName(input), JSON.stringify(input)).toEqual({ ok: true, name });
  };
  const refused = (input: unknown, reason: string): void => {
    expect(validateKindledName(input), JSON.stringify(input)).toEqual({
      ok: false,
      reason,
      message: reason === 'not-drawable' ? NAME_NOT_DRAWABLE : NAME_REFUSED,
    });
  };

  it('normalizes: NFC, trimmed, inner whitespace collapsed', () => {
    ok('  Mira   of\tthe\nShore  ', 'Mira of the Shore');
    // e + combining acute composes to é.
    ok('Zoe\u0301', 'Zo\u00e9');
    expect(normalizeKindledName('a\u00a0\u3000b')).toBe('a b');
  });

  it('counts grapheme clusters, 2 to 24', () => {
    ok('Al', 'Al');
    ok('x'.repeat(24), 'x'.repeat(24));
    refused('A', 'length');
    refused('   A   ', 'length');
    refused('', 'length');
    refused('x'.repeat(25), 'length');
    refused('x'.repeat(10_000), 'length');
    // Decomposed accents compose: 24 accented letters fit.
    const accented = 'e\u0301'.repeat(24);
    expect(graphemes(accented)).toHaveLength(24);
    ok(accented, '\u00e9'.repeat(24));
  });

  it('accepts A-Z and accented Latin letters (the Latin-1 the fonts draw)', () => {
    ok('Zo\u00eb \u00c5ngstr\u00f6m', 'Zo\u00eb \u00c5ngstr\u00f6m');
    ok('J\u00fcrgen \u00d1\u00fa\u00f1ez', 'J\u00fcrgen \u00d1\u00fa\u00f1ez');
    ok("Ma\u00ebl O'Bri\u00e9n-Fa\u00df", "Ma\u00ebl O'Bri\u00e9n-Fa\u00df");
    ok('\u00c6sa \u00d8rn \u00de\u00f3ra', '\u00c6sa \u00d8rn \u00de\u00f3ra');
    for (const ch of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
      expect(DRAWABLE_CHARS.has(ch), ch).toBe(true);
  });

  it('refuses what the pixel fonts cannot draw yet, with its own line', () => {
    expect(NAME_NOT_DRAWABLE).toBe(
      'Use letters the game can draw for now: A\u2013Z and accented Latin letters.',
    );
    // Other scripts, right-to-left ones included (the book's "any language" waits for glyphs).
    refused('\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd', 'not-drawable'); // Hebrew with niqqud
    refused('\u0645\u0631\u064a\u0645', 'not-drawable'); // Arabic
    refused('Mira \u05de\u05d9\u05e8\u05d4', 'not-drawable'); // mixed
    refused('\u1f08\u03c7\u03b9\u03bb\u03bb\u03b5\u03cd\u03c2', 'not-drawable'); // Greek
    refused('\u041e\u043b\u044c\u0433\u0430', 'not-drawable'); // Cyrillic
    refused('\u30ca\u30aa\u30df', 'not-drawable'); // Katakana
    // Latin outside Latin-1 (Vietnamese, Polish), and a mark with no precomposed letter.
    refused('Nguy\u1ec5n', 'not-drawable');
    refused('\u0141ucja', 'not-drawable');
    refused('q\u0301r', 'not-drawable');
    refused('Z\u0301\u0300\u0302\u0303\u0304algo', 'not-drawable');
    refused('\ud83d\udd25\ud83d\udd25', 'not-drawable');
  });

  it('refuses control, bidi and other invisible format characters', () => {
    refused('Mi\u0000ra', 'characters');
    refused('Mi\u0007ra', 'characters');
    refused('Mi\u007fra', 'characters');
    refused('Mira\u202e', 'characters'); // right-to-left override
    refused('\u2067Mira\u2069', 'characters'); // isolates
    refused('Mi\u200bra', 'characters'); // zero-width space
    refused('Mi\u200fra', 'characters'); // right-to-left mark
    refused('Mi\u00adra', 'characters'); // soft hyphen
    refused('Mi\ue000ra', 'characters'); // private use
    refused('Mi\ud800ra', 'characters'); // lone surrogate
  });

  it('needs at least one letter', () => {
    refused('12', 'no-letter');
    refused('!!', 'no-letter');
    ok('R2', 'R2');
  });

  it('runs the safe-letters filter on the normalized name, in any script', () => {
    refused(LATIN_BANNED, 'unsafe');
    refused(`Sir ${LATIN_BANNED.toUpperCase()}`, 'unsafe');
    refused(Array.from(LATIN_BANNED).join(' '), 'unsafe');
    refused(HEBREW_BANNED, 'unsafe');
    refused(`Mira ${TITLE_BANNED}`, 'unsafe');
    // Niqqud between the letters does not hide it.
    refused(Array.from(HEBREW_BANNED).join('\u05b8'), 'unsafe');
  });

  it('refuses non-text', () => {
    refused(42, 'not-text');
    refused(null, 'not-text');
    refused({ name: 'Mira' }, 'not-text');
  });
});

describe('API guards', () => {
  it('credentials: two strings, nothing else', () => {
    expect(isCredentialsRequest({ username: 'a', password: 'b' })).toBe(true);
    expect(isCredentialsRequest({ username: 'a' })).toBe(false);
    expect(isCredentialsRequest({ username: 'a', password: 1 })).toBe(false);
    expect(isCredentialsRequest({ username: 'a', password: 'b', admin: true })).toBe(false);
    expect(isCredentialsRequest(['a', 'b'])).toBe(false);
    expect(isCredentialsRequest('a:b')).toBe(false);
  });

  it('create Kindled: a name, a known Remembrance, an optional known tone', () => {
    expect(isCreateKindledRequest({ name: 'Mira', remembrance: 'ash' })).toBe(true);
    expect(
      isCreateKindledRequest({ name: 'Mira', remembrance: 'tide', clayTone: 'clay-red' }),
    ).toBe(true);
    expect(isCreateKindledRequest({ name: 'Mira', remembrance: 'stone' })).toBe(false);
    expect(isCreateKindledRequest({ name: 'Mira', remembrance: 'ash', clayTone: 'blue' })).toBe(
      false,
    );
    expect(isCreateKindledRequest({ name: 'Mira', remembrance: 'toString' })).toBe(false);
    expect(isCreateKindledRequest({ name: 7, remembrance: 'ash' })).toBe(false);
    expect(isCreateKindledRequest({ name: 'Mira', remembrance: 'ash', level: 99 })).toBe(false);
  });

  it('responses', () => {
    const account = { username: 'ash', createdAt: new Date(0).toISOString() };
    expect(isMeResponse({ account, kindled: null })).toBe(true);
    expect(
      isMeResponse({
        account,
        kindled: {
          name: 'Mira',
          remembrance: 'wing',
          clayTone: 'clay-pale',
          createdAt: account.createdAt,
        },
      }),
    ).toBe(true);
    expect(isMeResponse({ account })).toBe(false);
    expect(isMeResponse({ account: { username: 'ash' }, kindled: null })).toBe(false);
    expect(isApiErrorBody({ error: 'not-signed-in', message: '' })).toBe(true);
    expect(isApiErrorBody({ error: 'teapot', message: '' })).toBe(false);
  });
});
