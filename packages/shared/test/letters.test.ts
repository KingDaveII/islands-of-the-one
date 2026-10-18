import { describe, expect, it } from 'vitest';
import {
  FINAL_FORMS,
  letterPosition,
  lettersFromPositions,
  oldLettersSheet as sheet,
  positionsFromText,
  DIVIDER_ROW,
  PLOT_DIVIDER,
  shapeLetters,
  sheetCell,
} from '../src/index.js';

const width = (char: string): number => sheet.widths[sheetCell(char)] as number;

describe('Old Letters positions', () => {
  it('maps letters and final forms to alphabet positions', () => {
    expect(letterPosition('א')).toBe(0);
    expect(letterPosition('ת')).toBe(21);
    for (const [base, final] of Object.entries(FINAL_FORMS)) {
      expect(letterPosition(final)).toBe(letterPosition(base));
      expect(sheetCell(final)).toBeGreaterThanOrEqual(22);
    }
    expect(letterPosition('a')).toBe(-1);
    expect(letterPosition('ָ')).toBe(-1);
  });

  it('positionsFromText keeps only letters, in order, across marks and spaces', () => {
    const text = `${lettersFromPositions([0, 12])}ֶ \n${lettersFromPositions([21])}!x`;
    expect(positionsFromText(text)).toEqual([0, 12, 21]);
    expect(lettersFromPositions(positionsFromText(text))).toBe(lettersFromPositions([0, 12, 21]));
    expect(() => lettersFromPositions([22])).toThrow(RangeError);
  });
});

describe('shapeLetters', () => {
  it('lays out right to left with a 1 px gap', () => {
    const text = lettersFromPositions([0, 12, 21]); // alef mem tav
    const s = shapeLetters(text);
    const [alef, mem, tav] = [width('א'), width('מ'), width('ת')];
    expect(s.height).toBe(8);
    expect(s.width).toBe(alef + mem + tav + 2 * sheet.gap);
    expect(s.glyphs.map((g) => g.index)).toEqual([0, 1, 2]);
    // The first letter sits at the right edge, the last at x = 0.
    expect(s.glyphs[0]).toMatchObject({ x: s.width - alef, width: alef, cell: sheetCell('א') });
    expect(s.glyphs[2]).toMatchObject({ x: 0, width: tav });
    expect(s.glyphs[1]?.x).toBe(tav + sheet.gap);
  });

  it('uses final forms at the end of words only, and folds typed finals', () => {
    for (const [base, final] of Object.entries(FINAL_FORMS)) {
      const atEnd = shapeLetters(`א${base}`);
      expect(atEnd.glyphs[1]?.cell).toBe(sheetCell(final));
      const inside = shapeLetters(`${base}א`);
      expect(inside.glyphs[0]?.cell).toBe(sheetCell(base));
      // A final form typed mid-word is drawn as the base letter.
      expect(shapeLetters(`${final}א`).glyphs[0]?.cell).toBe(sheetCell(base));
      // Before a space it is the end of a word too.
      expect(shapeLetters(`${base} א`).glyphs[0]?.cell).toBe(sheetCell(final));
    }
  });

  it('separates words by the space width and skips marks and unknown characters', () => {
    const a = lettersFromPositions([0]);
    const one = shapeLetters(a);
    const two = shapeLetters(`${a}ָ  ${a}\n`);
    expect(two.glyphs).toHaveLength(2);
    expect(two.width).toBe(one.width * 2 + sheet.space);
    expect(shapeLetters('abc ')).toEqual({ width: 0, height: 8, glyphs: [], dividers: [] });
    expect(shapeLetters('')).toEqual({ width: 0, height: 8, glyphs: [], dividers: [] });
    expect(two.dividers).toEqual([]);
  });

  it("places a plot sentence's divider as one pixel centred in the word space, on row 4 (LORE; drawn in code until ART's glyph)", () => {
    expect(PLOT_DIVIDER).toBe('·');
    expect(DIVIDER_ROW).toBe(4);
    const a = lettersFromPositions([0]);
    const plain = shapeLetters(`${a} ${a}`);
    const divided = shapeLetters(`${a} ${PLOT_DIVIDER} ${a}`);
    // The divider takes no room: the same width and glyphs as the plain two words.
    expect(divided.width).toBe(plain.width);
    expect(divided.glyphs).toEqual(plain.glyphs);
    // Its pixel sits in the space between the words: right of the second word's glyph, left of the first's.
    const [first, second] = divided.glyphs;
    if (!first || !second) throw new Error('two glyphs');
    expect(divided.dividers).toEqual([second.x + second.width + Math.floor(sheet.space / 2)]);
    expect(divided.dividers[0]).toBeLessThan(first.x);
    // Without spaces around it, the same; alone or at an end, nothing; two dividers, two pixels.
    expect(shapeLetters(`${a}${PLOT_DIVIDER}${a}`).dividers).toEqual(divided.dividers);
    expect(shapeLetters(`${PLOT_DIVIDER}${a}`).dividers).toEqual([]);
    expect(shapeLetters(`${a}${PLOT_DIVIDER}`).dividers).toEqual([]);
    expect(shapeLetters(PLOT_DIVIDER)).toEqual({ width: 0, height: 8, glyphs: [], dividers: [] });
    expect(shapeLetters(`${a}${PLOT_DIVIDER}${a}${PLOT_DIVIDER}${a}`).dividers).toHaveLength(2);
    // The filter never sees it.
    expect(positionsFromText(`${a} ${PLOT_DIVIDER} ${a}`)).toEqual([0, 0]);
  });
});
