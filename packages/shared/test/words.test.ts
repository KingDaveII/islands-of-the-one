import { describe, expect, it } from 'vitest';
import {
  DRAWABLE_CHARS,
  isBaseLetters,
  isSafe,
  isWordId,
  PLOT_KINDS,
  shapeLetters,
  validateWordsData,
  wordDef,
  WORDS,
  wordsInSlot,
} from '../src/index.js';
import wordsJson from '../data/words.json' with { type: 'json' };
import { BANNED } from './banned.js';

/**
 * data/words.json (docs/design/holding.md "Plots", M2 Task 5): M2's two word
 * tiles, LORE's card texts word for word, every word's letters through the
 * safe-letters filter, every text drawable, and the validator's refusals.
 */
const kinds = PLOT_KINDS.map((p) => p.id);

describe('words.json', () => {
  it('holds אדמה (a Ground that builds the field) and ישן (a Virtue, +1% a day up to +20%), and validates', () => {
    expect(validateWordsData(wordsJson, kinds)).toEqual({ ok: true, words: WORDS });
    expect(WORDS.map((w) => w.id)).toEqual(['adamah', 'yashan']);
    expect(wordDef('adamah')).toEqual({
      id: 'adamah',
      letters: 'אדמה',
      say: 'adamah',
      meaning: 'tilled ground',
      slot: 'ground',
      element: 'earth',
      card: '"Tilled ground." Ground that\'s ready to be worked. Earth.',
      builds: 'field',
      effect: null,
    });
    expect(wordDef('yashan')).toEqual({
      id: 'yashan',
      letters: 'ישן',
      say: 'yashan',
      meaning: 'old',
      slot: 'virtue',
      element: 'earth',
      card: '"Old." A Virtue. Things that keep their name a long time grow richer. Earth.',
      builds: null,
      effect: { kind: 'yield-per-day', permillePerDay: 10, maxPermille: 200 },
    });
    expect(isWordId('adamah')).toBe(true);
    expect(isWordId('field')).toBe(false);
    expect(wordsInSlot('ground').map((w) => w.id)).toEqual(['adamah']);
    expect(wordsInSlot('virtue').map((w) => w.id)).toEqual(['yashan']);
  });

  it("every word's letters are base Old Letters that pass the filter (strict), and its final form is drawn at the word's end", () => {
    for (const w of WORDS) {
      expect(isBaseLetters(w.letters), w.id).toBe(true);
      expect(isSafe(w.letters, { strict: true }), w.id).toEqual({ ok: true });
      expect(isSafe(w.letters), w.id).toEqual({ ok: true });
    }
    // ישן ends in nun: shapeLetters draws the final nun (cell 24), the data keeps the base letter.
    const shaped = shapeLetters('ישן');
    expect(shaped.glyphs.map((g) => g.cell)).toEqual([9, 20, 24]);
    expect(isBaseLetters('ישן')).toBe(true);
    expect(isBaseLetters('יש ן')).toBe(false);
    expect(isBaseLetters('')).toBe(false);
    expect(isBaseLetters('abc')).toBe(false);
  });

  it('every text uses only characters the fonts can draw, and no banned name', () => {
    for (const w of WORDS)
      for (const text of [w.say, w.meaning, w.card]) {
        expect(Array.from(text).filter((ch) => !DRAWABLE_CHARS.has(ch)), text).toEqual([]);
        expect(BANNED.test(text), text).toBe(false);
      }
  });

  it('lists every problem', () => {
    const problems = (data: unknown): string[] => {
      const r = validateWordsData(data, kinds);
      return r.ok ? [] : r.problems;
    };
    const [adamah = {}, yashan = {}] = wordsJson.words as unknown as Record<string, unknown>[];
    expect(problems({ words: [adamah, yashan] })).toEqual([]);
    expect(problems({})).toEqual(['expected { words: [...] }']);
    expect(problems({ words: [], extra: 1 })).toEqual(['unknown field(s) extra']);
    expect(problems({ words: [{ ...adamah, id: 'Adamah' }] })).toEqual(['words[0]: id must be kebab-case (it is stored)']);
    expect(problems({ words: [adamah, adamah] })).toEqual(['words[1] (adamah): duplicate id']);
    expect(problems({ words: [{ ...adamah, letters: 'adamah' }] })).toEqual(['words[0] (adamah): letters must be base Old Letters, at least one']);
    expect(problems({ words: [{ ...adamah, letters: 'יה' }] })).toEqual(['words[0] (adamah): letters fail the safe-letters filter (yod-he)']);
    expect(problems({ words: [{ ...adamah, card: 'A ✦ star', say: '' }] })).toEqual([
      'words[0] (adamah): say must be non-empty text the game can draw',
      'words[0] (adamah): card must be non-empty text the game can draw',
    ]);
    expect(problems({ words: [{ ...adamah, slot: 'noun', element: 'wood' }] })).toEqual([
      'words[0] (adamah): slot must be one of ground, virtue',
      'words[0] (adamah): element must be one of earth, water, fire, air',
    ]);
    expect(problems({ words: [{ ...adamah, builds: 'mill' }] })).toEqual(['words[0] (adamah): a Ground builds a plot kind of stations.json (field)']);
    expect(problems({ words: [{ ...adamah, effect: yashan.effect }] })).toEqual(['words[0] (adamah): a Ground has no effect']);
    const noEffect = { ...yashan };
    delete noEffect.effect;
    expect(problems({ words: [noEffect] })).toEqual(['words[0] (yashan): a Virtue needs an effect']);
    expect(problems({ words: [{ ...yashan, builds: 'field' }] })).toEqual(['words[0] (yashan): a Virtue builds nothing']);
    expect(problems({ words: [{ ...yashan, effect: { kind: 'luck' } }] })).toEqual(['words[0] (yashan): effect.kind must be one of yield-per-day']);
    expect(problems({ words: [{ ...yashan, effect: { kind: 'yield-per-day', permillePerDay: 0, maxPermille: 1.5, more: 1 } }] })).toEqual([
      'words[0] (yashan): effect has unknown field(s) more',
      'words[0] (yashan): effect.permillePerDay must be a positive integer',
      'words[0] (yashan): effect.maxPermille must be a positive integer',
    ]);
    expect(problems({ words: [{ ...yashan, effect: { kind: 'yield-per-day', permillePerDay: 10, maxPermille: 5 } }] })).toEqual([
      "words[0] (yashan): effect.maxPermille must be at least one day's permillePerDay",
    ]);
    expect(problems({ words: [{ ...adamah, more: 1 }] })).toEqual(['words[0]: unknown field(s) more']);
    expect(problems({ words: [7] })).toEqual(['words[0]: not an object']);
  });
});
