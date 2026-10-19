import { describe, expect, it } from 'vitest';
import {
  letterRoot,
  OLD_LETTERS,
  paletteData,
  plotSentence,
  rootCell,
  SIGIL_STYLE_BY_ELEMENT,
  sigilData,
  sigilPath,
  sigilStyle,
  validateSigilData,
  wordDef,
  WORD_ELEMENTS,
} from '../src/index.js';
import sigilJson from '../data/sigil.json' with { type: 'json' };

/**
 * Sigils (docs/design/letters.md "Sigils", LORE §4.5): the square's data,
 * the roots 1–9 of every letter, אדמה's cells and marks (ד and מ share
 * chamber 4: a hook), a repeated letter's loop, and אדמה then ישן as one
 * line.
 */
const SATURN = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

describe('sigil.json', () => {
  it("holds Saturn's square (Agrippa, LORE's reference) and validates", () => {
    expect(validateSigilData(sigilJson)).toEqual({ ok: true, data: { square: SATURN } });
    expect(sigilData.square).toEqual(SATURN);
  });

  it('refuses a square that is not 3 × 3 of the roots 1–9 once each', () => {
    const problems = (data: unknown): string[] => {
      const r = validateSigilData(data);
      return r.ok ? [] : r.problems;
    };
    expect(problems({ square: [[1, 2, 3], [4, 5, 6]] })).toEqual(['square must be 3 rows of 3']);
    expect(problems({ square: [[1, 2, 3], [4, 5, 6], [7, 8, 8]] })).toEqual(['square: root 8 appears twice']);
    expect(problems({ square: [[0, 2, 3], [4, 5, 6], [7, 8, 10]] })).toEqual(['square: 0 is not a root 1-9', 'square: 10 is not a root 1-9']);
    expect(problems({ square: SATURN, extra: 1 })).toEqual(['unknown field(s) extra']);
    expect(problems(null)).toEqual(['expected an object']);
  });
});

describe('letterRoot', () => {
  it('reduces every letter to its chamber: aleph 1 … tet 9, yod 10 → 1 … qof 100 → 1, resh 2, shin 3, tav 4; final forms as their base', () => {
    expect(OLD_LETTERS.map(letterRoot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4]);
    expect(letterRoot('ן')).toBe(letterRoot('נ'));
    expect(letterRoot('ם')).toBe(4);
    expect(letterRoot('a')).toBeNull();
    expect(letterRoot(' ')).toBeNull();
  });

  it('finds every root on the square', () => {
    expect(rootCell(5)).toEqual({ row: 1, col: 1 });
    expect(rootCell(4)).toEqual({ row: 0, col: 0 });
    expect(rootCell(1)).toEqual({ row: 2, col: 1 });
    expect(() => rootCell(10)).toThrow(RangeError);
  });
});

describe('sigilPath', () => {
  const adamah = wordDef('adamah');
  const yashan = wordDef('yashan');
  if (!adamah || !yashan) throw new Error('words.json lacks M2\'s words');

  it("אדמה: alef 1, dalet 4, mem 4 (a hook: a different letter in dalet's chamber), he 5; a circle at the start, a bar at the end", () => {
    const path = sigilPath(adamah.letters);
    expect(path.steps).toEqual([
      { letter: 'א', root: 1, row: 2, col: 1 },
      { letter: 'ד', root: 4, row: 0, col: 0 },
      { letter: 'מ', root: 4, row: 0, col: 0 },
      { letter: 'ה', root: 5, row: 1, col: 1 },
    ]);
    expect(path.marks).toEqual([
      { kind: 'start', step: 0 },
      { kind: 'hook', step: 2 },
      { kind: 'end', step: 3 },
    ]);
  });

  it('a repeated letter makes a loop; a final form counts as its base letter', () => {
    expect(sigilPath('ממ').marks).toEqual([
      { kind: 'start', step: 0 },
      { kind: 'loop', step: 1 },
      { kind: 'end', step: 1 },
    ]);
    expect(sigilPath('מם').marks.map((m) => m.kind)).toEqual(['start', 'loop', 'end']);
    expect(sigilPath('ם').steps[0]?.letter).toBe('מ');
  });

  it('אדמה then ישן is one line: the Ground\'s letters, then the Virtue\'s, the space skipped', () => {
    const path = sigilPath(plotSentence(adamah, yashan));
    expect(path.steps.map((s) => s.letter)).toEqual(['א', 'ד', 'מ', 'ה', 'י', 'ש', 'ן'].map((l) => (l === 'ן' ? 'נ' : l)));
    expect(path.steps.map((s) => s.root)).toEqual([1, 4, 4, 5, 1, 3, 5]);
    expect(path.steps.map((s) => [s.row, s.col])).toEqual([
      [2, 1],
      [0, 0],
      [0, 0],
      [1, 1],
      [2, 1],
      [1, 0],
      [1, 1],
    ]);
    expect(path.marks).toEqual([
      { kind: 'start', step: 0 },
      { kind: 'hook', step: 2 },
      { kind: 'end', step: 6 },
    ]);
    // Empty: nothing.
    expect(sigilPath('')).toEqual({ steps: [], marks: [] });
    expect(sigilPath('abc')).toEqual({ steps: [], marks: [] });
    // Another square moves the cells, not the roots.
    const flipped = sigilPath('א', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(flipped.steps).toEqual([{ letter: 'א', root: 1, row: 0, col: 0 }]);
  });

  it('the line style follows the element: earth heavy and straight, water a wave, fire jagged, air thin and broken', () => {
    expect(SIGIL_STYLE_BY_ELEMENT).toEqual({ earth: 'heavy-straight', water: 'wave', fire: 'jagged', air: 'thin-broken' });
    expect(sigilStyle(adamah.element)).toBe('heavy-straight');
  });
});

describe("the elements' seal colours and lines (ART's seal kit, #125)", () => {
  it('gives every element a palette token and a line style', () => {
    expect(Object.keys(paletteData.elements).sort()).toEqual([...WORD_ELEMENTS].sort());
    const tokens = new Set(Object.values(paletteData.tokens));
    for (const hex of Object.values(paletteData.elements)) expect(tokens).toContain(hex);
    expect(WORD_ELEMENTS.map((e) => sigilStyle(e))).toEqual(['heavy-straight', 'wave', 'jagged', 'thin-broken']);
  });
});
