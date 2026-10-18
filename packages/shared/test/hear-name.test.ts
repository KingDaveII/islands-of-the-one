import { describe, expect, it } from 'vitest';
import {
  CONSONANTS,
  FINAL_FORMS,
  foldName,
  hearName,
  heardLetterCount,
  isSafe,
  letterPosition,
  lettersFromPositions,
  NAME_NOT_DRAWABLE,
  NAME_REFUSED,
  positionsFromText,
  shapeLetters,
  validateIslandName,
  VOWEL_UNITS,
  wordsOf,
  writData,
} from '../src/index.js';

/**
 * Hearing a Name (docs/design/letters.md "Hearing a Name"): LORE's worked
 * examples, exactly; the doors (yod never beside he or yod) and the strict
 * filter over thousands of generated Latin names; the lean hand; the single
 * letter; typed Old Letters. The banned runs are built from alphabet
 * positions, never spelled out (names.test.ts checks the repo).
 */
const letters = lettersFromPositions;
const YOD = 9;
const HE = 4;

/** LORE's table (base letters; the finals are the drawing's). */
const EXAMPLES: [string, string][] = [
  ['Ash', 'אש'],
  ['Tide', 'טידה'],
  ['Eden', 'אדנ'],
  ['Avalon', 'אבלונ'],
  ['Shalom', 'שלומ'],
  ['Sarah', 'סרה'],
  ['Maria', 'מרה'],
  ['Maya', 'מיא'],
  ['Hyacinth', 'חיסינת'],
  ['Ohio', 'אוהו'],
  ['Lee', 'לי'],
  ['Quinn', 'קוינ'],
  ['Søren', 'סורנ'],
  ['Ñandú', 'נינדו'],
  ['Black Rock', 'בלק רוק'],
  ['Cherry-on-Top', 'חרי אונ טופ'],
  ['Kopenhagen', 'קופנהגנ'],
  ['Morningstar Rest', 'מורננגסטר רסט'],
  ['The Last Light of Evening', 'תה לסט לגט אפ אבננג'],
];

describe('hearName: LORE\'s worked examples', () => {
  it.each(EXAMPLES)('%s → %s', (typed, heard) => {
    expect(hearName(typed)).toBe(heard);
  });

  it('is the same every time, and the drawing adds the final forms', () => {
    for (const [typed, heard] of EXAMPLES) {
      expect(hearName(typed)).toBe(hearName(typed));
      expect(hearName(typed.toUpperCase())).toBe(heard);
      // Base letters only: the final form of the last letter of each word comes from shapeLetters.
      for (const final of Object.values(FINAL_FORMS)) expect(heard).not.toContain(final);
      const shaped = shapeLetters(heard);
      expect(shaped.glyphs).toHaveLength(heardLetterCount(heard));
    }
    expect(hearName('')).toBe('');
    expect(hearName('123 ...')).toBe('');
  });

  it('folds and splits as the rules say', () => {
    expect(foldName('Ñandú Søren Straße')).toBe('nyandu soren strasse');
    expect(wordsOf("Cherry-on-Top O'Hara 7")).toEqual(['cherry', 'on', 'top', 'ohara']);
    // c before e, i, y is samekh; before anything else qof.
    expect(hearName('Cera')).toBe(`${letters([14])}${letters([19, 4])}`);
    expect(hearName('Cora')).toBe(letters([18, 5, 19, 4]));
    expect(hearName('Marc')).toBe(letters([12, 19, 18]));
    expect(hearName('Chuck')).toBe(letters([7, 5, 18]));
    // The tables are data, longest match first.
    expect(VOWEL_UNITS[0]?.[0]).toBe('ee');
    expect(CONSONANTS[0]?.[0]).toBe('tsch');
    for (let i = 1; i < CONSONANTS.length; i++)
      expect((CONSONANTS[i - 1]?.[0].length ?? 0) >= (CONSONANTS[i]?.[0].length ?? 0)).toBe(true);
  });
});

describe('hearName: the doors and the filter (property)', () => {
  it('no result has yod beside he or yod beside yod, ignoring spaces, over thousands of generated Latin names', () => {
    let seed = 0x5eed_1234;
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed % n;
    };
    const alphabet = 'abcdefghijklmnopqrstuvwxyzaeiouyhwyhaeiouéüøñçßæœåðþ';
    const open: string[] = [];
    const unsafe: string[] = [];
    let heard = 0;
    for (let i = 0; i < 4000; i++) {
      const len = 1 + next(24);
      let typed = '';
      for (let j = 0; j < len; j++) {
        const r = next(100);
        typed += r < 8 && typed !== '' ? (r < 2 ? '-' : ' ') : (alphabet[next(alphabet.length)] ?? 'a');
      }
      const result = hearName(typed);
      const p = positionsFromText(result);
      if (p.length > 0) heard++;
      for (let k = 1; k < p.length; k++) {
        const a = p[k - 1];
        const b = p[k];
        if ((a === YOD && b === HE) || (a === HE && b === YOD) || (a === YOD && b === YOD)) open.push(`${typed} → ${result}`);
      }
      const safe = isSafe(result, { strict: true });
      // A Name that happens to sound like the banned title fails the filter and the validator refuses it (§2);
      // the pair itself never appears, so no result ever fails for yod-he.
      if (!safe.ok) {
        if (safe.reason !== 'name-hebrew') unsafe.push(`${typed} → ${result}: ${safe.reason ?? '?'}`);
        expect(validateIslandName(typed)).toMatchObject({ ok: false, message: NAME_REFUSED });
      }
      // Within the line, or the layout's problem: never more than the full hand.
      expect(p.length).toBeLessThanOrEqual(positionsFromText(hearName(typed, Infinity)).length);
    }
    expect(open).toEqual([]);
    expect(unsafe).toEqual([]);
    expect(heard).toBeGreaterThan(3500);
  });
});

describe('hearName: the lean hand', () => {
  it('drops inside vowels, last word first, until the Name fits the line', () => {
    expect(writData.lineLetters).toBe(12);
    expect(heardLetterCount(hearName('Morningstar Rest', Infinity))).toBe(13);
    expect(heardLetterCount(hearName('Morningstar Rest'))).toBe(12);
    // The inside vowels are gone, never a word's first or last letter.
    expect(hearName('Morningstar Rest', Infinity)).toBe('מורנינגסטר רסט');
    expect(hearName('Morningstar Rest')).toBe('מורננגסטר רסט');
    // A Name that still doesn't fit is the layout's problem.
    expect(heardLetterCount(hearName('The Last Light of Evening'))).toBe(15);
    expect(heardLetterCount(hearName('The Last Light of Evening', Infinity))).toBe(18);
  });

  it('a Name left with one letter gets an aleph in front of it', () => {
    expect(hearName('a')).toBe(letters([0, 0]));
    expect(hearName('B')).toBe(letters([0, 1]));
    expect(hearName('y')).toBe(letters([0, YOD]));
    expect(hearName(letters([12]))).toBe(letters([0, 12]));
  });
});

describe('hearName: typed Old Letters', () => {
  it('keeps them as typed (final forms folded, marks dropped, other characters gone)', () => {
    const emet = letters([0, 12, 21]);
    expect(hearName(emet)).toBe(emet);
    expect(hearName(`${emet} ${letters([2, 1, 15, 4])}`)).toBe(`${emet} ${letters([2, 1, 15, 4])}`);
    const finalMem = FINAL_FORMS[letters([12])] as string;
    expect(hearName(`${letters([0])}${finalMem}ָ!`)).toBe(letters([0, 12]));
    // A word of Latin beside a word of Old Letters: each as it is.
    expect(hearName(`${emet} Ash`)).toBe(`${emet} אש`);
  });

  it('a typed banned run is refused by the validator (the typed text\'s own check)', () => {
    for (const run of [
      [YOD, HE, 5, HE],
      [0, 3, 13, YOD],
    ]) {
      const typed = letters(run);
      expect(validateIslandName(typed)).toMatchObject({ ok: false, message: NAME_REFUSED });
      expect(validateIslandName(`Ash ${typed}`)).toMatchObject({ ok: false, message: NAME_REFUSED });
    }
    // Latin look-alikes are refused on the typed text too (the Choir hand).
    const latin = [24, 0, 7, 22, 4, 7].map((p) => String.fromCharCode(97 + p)).join('');
    expect(validateIslandName(latin)).toEqual({ ok: false, reason: 'unsafe', message: NAME_REFUSED });
  });
});

describe('validateIslandName', () => {
  it('accepts a typed Name and hears its letters', () => {
    expect(validateIslandName('Black Rock')).toEqual({ ok: true, name: 'Black Rock', letters: 'בלק רוק' });
    expect(validateIslandName('  black   rock ')).toEqual({ ok: true, name: 'black rock', letters: 'בלק רוק' });
  });

  it('refuses by the typed rules, by the letters, and keeps the not-drawable line', () => {
    expect(validateIslandName('A')).toEqual({ ok: false, reason: 'length', message: NAME_REFUSED });
    expect(validateIslandName('12')).toEqual({ ok: false, reason: 'no-letter', message: NAME_REFUSED });
    expect(validateIslandName(42)).toEqual({ ok: false, reason: 'not-text', message: NAME_REFUSED });
    // Typed Old Letters wait for the fonts: not drawable for now.
    expect(validateIslandName(letters([0, 12, 21]))).toEqual({ ok: false, reason: 'not-drawable', message: NAME_NOT_DRAWABLE });
    // Letters the typed text passes but the strict filter refuses: the title, heard from Latin.
    const title = letters([0, 3, 13, YOD]);
    const sounds = `${String.fromCharCode(97 + 0)}dn${String.fromCharCode(97 + 8)}`;
    expect(hearName(sounds)).toBe(title);
    expect(isSafe(sounds).ok).toBe(true);
    expect(validateIslandName(sounds)).toEqual({ ok: false, reason: 'letters', message: NAME_REFUSED });
    // A Name with nothing to hear (a letter outside the tables).
    expect(validateIslandName('µµ')).toEqual({ ok: false, reason: 'letters', message: NAME_REFUSED });
    expect(letterPosition('µ')).toBe(-1);
  });
});
