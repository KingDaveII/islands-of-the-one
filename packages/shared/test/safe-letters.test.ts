import { describe, expect, it } from 'vitest';
import {
  choirHandPositions,
  isSafe,
  isSafePositions,
  lettersFromPositions,
  LETTER_COUNT,
  NAME_REFUSED,
} from '../src/index.js';

/**
 * Fixtures. The banned words never appear spelled out, here or anywhere in
 * the repo (packages/shared/test/names.test.ts checks): they are built from
 * alphabet positions at test time.
 */
const latin = (positions: number[]): string =>
  positions.map((p) => String.fromCharCode(97 + p)).join('');

/** Transliterations and look-alikes (a = 0 .. z = 25). */
const LATIN_BANNED = [
  [24, 0, 7, 22, 4, 7],
  [24, 0, 7, 21, 4],
  [24, 0, 7, 21, 4, 7],
  [9, 0, 7, 21, 4],
  [9, 0, 7, 22, 4, 7],
  [9, 4, 7, 14, 21, 0, 7],
  [9, 4, 7, 14, 21, 0],
  [9, 4, 7, 14, 22, 0, 7],
  [24, 4, 7, 14, 21, 0, 7],
  [8, 4, 7, 14, 21, 0],
  [24, 7, 22, 7],
  [9, 7, 21, 7],
  [24, 7, 21, 7],
  [24, 0, 7, 20, 0, 7],
  [24, 0, 7, 14, 22, 0, 7],
  [0, 3, 14, 13, 0, 8],
  [0, 3, 14, 13, 0, 24],
  [0, 3, 14, 13, 14, 24],
].map(latin);

/** The four-letter name and the title read in its place, as Old Letters positions. */
const HEBREW_BANNED = [
  [9, 4, 5, 4],
  [0, 3, 13, 9],
].map(lettersFromPositions);

const reverse = (s: string): string => Array.from(s).reverse().join('');
const NIQQUD = ['ָ', 'ֹ', 'ְ', 'ִ', 'ּ'];
const withMarks = (s: string): string =>
  Array.from(s)
    .map((c, i) => c + (NIQQUD[i % NIQQUD.length] ?? ''))
    .join('');
const spaced = (s: string, sep = ' '): string => Array.from(s).join(sep);

const GOOD_HEBREW = [
  'אמת', // emet
  'מת',
  'גבעה',
  'נחל',
  'אבן',
  'כוכב',
  // Watcher names
  'עזאזל',
  'שמיחזה',
  'חרמני',
  'כוכבאל',
  'פנמוא',
  // The route letters, alef to tav.
  ...Array.from({ length: LETTER_COUNT }, (_, i) => lettersFromPositions([i])),
];

const GOOD_LATIN = [
  'the One',
  'Hollow',
  'Sparkglass',
  'Kindled',
  'Azazel',
  'hookblade',
  'player-ab12',
  'tester',
  'Yahoo',
  'wave',
  'hey you',
  '',
];

describe('isSafe: the Hebrew name of God', () => {
  it('rejects it in Old Letters, written and reversed', () => {
    for (const word of HEBREW_BANNED) {
      expect(isSafe(word)).toEqual({ ok: false, reason: 'name-hebrew' });
      expect(isSafe(reverse(word))).toEqual({ ok: false, reason: 'name-hebrew' });
    }
  });

  it('rejects it with final forms, niqqud, spaces and line breaks, and inside other text', () => {
    for (const word of HEBREW_BANNED) {
      expect(isSafe(withMarks(word)).ok).toBe(false);
      expect(isSafe(spaced(word)).ok).toBe(false);
      expect(isSafe(spaced(word, '\n')).ok).toBe(false);
      expect(isSafe(spaced(withMarks(reverse(word)), ' \n ')).ok).toBe(false);
      expect(isSafe(`${GOOD_HEBREW[0]} ${word} ${GOOD_HEBREW[1]}`).ok).toBe(false);
      expect(isSafe(`${GOOD_HEBREW[2]}${word}`).ok).toBe(false);
    }
    // The title with a final nun typed mid-word.
    expect(isSafe(lettersFromPositions([0, 3]) + 'ן' + lettersFromPositions([9])).ok).toBe(false);
    // Presentation forms (precomposed letter + mark) are folded too.
    expect(isSafe('יּ' + lettersFromPositions([4, 5, 4])).ok).toBe(false);
  });

  it('rejects Latin transliterations and look-alikes in any case, written and reversed, across spaces', () => {
    for (const word of LATIN_BANNED) {
      expect(isSafe(word), word).toEqual({ ok: false, reason: 'name-latin' });
      expect(isSafe(word.toUpperCase()).ok).toBe(false);
      expect(isSafe((word[0] ?? '').toUpperCase() + word.slice(1)).ok).toBe(false);
      expect(isSafe(reverse(word)).ok).toBe(false);
      expect(isSafe(spaced(word)).ok).toBe(false);
      expect(isSafe(spaced(word, '-')).ok).toBe(false);
      expect(isSafe(`hail ${word}!`).ok).toBe(false);
      expect(isSafe(`item_${word}Blade`).ok).toBe(false);
    }
  });

  it('applies the Choir hand (j/y -> i, v/w -> u, k -> c, no accents)', () => {
    expect(choirHandPositions('Jay Vow Kick 7!')).toEqual(choirHandPositions('iai uou cicc'));
    expect(choirHandPositions('éü')).toEqual(choirHandPositions('eu'));
    const word = LATIN_BANNED[0] as string;
    const accented = word.slice(0, 4) + '́' + word.slice(4);
    expect(isSafe(accented).ok).toBe(false);
    const choir = latin(choirHandPositions(word));
    expect(isSafe(choir).ok).toBe(false);
  });

  it('passes known-good Names and text', () => {
    for (const name of GOOD_HEBREW)
      expect(isSafe(name, { strict: true }), name).toEqual({ ok: true });
    for (const text of GOOD_LATIN) expect(isSafe(text), text).toEqual({ ok: true });
    expect(isSafe('אמת the One')).toEqual({ ok: true });
  });
});

describe('isSafe strict mode (generated Names)', () => {
  it('rejects the yod-he pair anywhere, in either order', () => {
    const yodHe = lettersFromPositions([9, 4]);
    expect(isSafe(yodHe, { strict: true })).toEqual({ ok: false, reason: 'yod-he' });
    expect(isSafe(reverse(yodHe), { strict: true })).toEqual({ ok: false, reason: 'yod-he' });
    expect(isSafe(`${GOOD_HEBREW[0]}${yodHe}`, { strict: true }).ok).toBe(false);
    expect(isSafePositions([2, 9, 4, 21], { strict: true })).toEqual({
      ok: false,
      reason: 'yod-he',
    });
    // Not strict: the pair alone is fine.
    expect(isSafe(yodHe)).toEqual({ ok: true });
    expect(isSafePositions([9, 4])).toEqual({ ok: true });
  });

  it('the name itself is reported as the name, not the pair', () => {
    expect(isSafePositions([9, 4, 5, 4], { strict: true })).toEqual({
      ok: false,
      reason: 'name-hebrew',
    });
  });

  it('property: 20,000 random 2-5 letter Names without yod-he produce zero rejections', () => {
    let seed = 0x1234_5678;
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed % n;
    };
    const isYodHe = (a: number, b: number): boolean => (a === 9 && b === 4) || (a === 4 && b === 9);
    const rejected: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const len = 2 + next(4);
      const name: number[] = [];
      while (name.length < len) {
        const p = next(LETTER_COUNT);
        const prev = name[name.length - 1];
        if (prev !== undefined && isYodHe(prev, p)) continue;
        name.push(p);
      }
      const r = isSafe(lettersFromPositions(name), { strict: true });
      if (!r.ok) rejected.push(`${name.join(',')}: ${r.reason ?? '?'}`);
    }
    expect(rejected).toEqual([]);
  });
});

describe('offensive-word hook', () => {
  it('is wired behind the same function (empty list for now)', () => {
    expect(isSafe('anything goes')).toEqual({ ok: true });
    expect(isSafePositions([1, 2, 3])).toEqual({ ok: true });
  });
});

it('the refusal line is in-world', () => {
  expect(NAME_REFUSED).toBe("The Writ won't take that name. Try another.");
});
