import sheet from '../assets/old-letters.json' with { type: 'json' };
import names from '../data/names.json' with { type: 'json' };

/**
 * The Old Letters: the 22-letter alphabet used for Writ Names, route waymarks
 * and Veils, plus the five final forms. The sheet JSON (assets/old-letters.json)
 * fixes the order; everything else here (the safe-letters filter, the sim's
 * Name generator) works on alphabet positions, 0 = alef .. 21 = tav.
 */
export const oldLettersSheet = sheet;
export type OldLettersSheet = typeof sheet;

/** How many letters a Name has (data/names.json). */
export const nameRules = names;

export const LETTER_COUNT = 22;

/** The alphabet in order; `OLD_LETTERS[position]` is the letter. */
export const OLD_LETTERS: readonly string[] = sheet.chars.slice(0, LETTER_COUNT);

/** Base letter -> its final form (used at the end of a word). */
export const FINAL_FORMS: Readonly<Record<string, string>> = sheet.finals;

const BASE_OF_FINAL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FINAL_FORMS).map(([base, final]) => [final, base]),
);

/** Position of a letter (a final form counts as its base letter), or -1. */
export function letterPosition(char: string): number {
  return OLD_LETTERS.indexOf(BASE_OF_FINAL[char] ?? char);
}

/** Cell index of a character on the sheet (base or final form), or -1. */
export function sheetCell(char: string): number {
  return sheet.chars.indexOf(char);
}

/**
 * Every Old Letter in `text`, as positions, in writing order. Final forms fold
 * to their base letter; marks (niqqud, cantillation), spaces, line breaks and
 * any other character are dropped, so runs are found across them.
 */
export function positionsFromText(text: string): number[] {
  const out: number[] = [];
  for (const char of text.normalize('NFKD')) {
    const p = letterPosition(char);
    if (p >= 0) out.push(p);
  }
  return out;
}

/** The letters for a run of positions, as base letters (no final forms). */
export function lettersFromPositions(positions: readonly number[]): string {
  let out = '';
  for (const p of positions) {
    const letter = OLD_LETTERS[p];
    if (letter === undefined) throw new RangeError(`not an Old Letter position: ${p}`);
    out += letter;
  }
  return out;
}

/** A glyph placed on the baseline grid, in game pixels relative to the text's left edge. */
export interface PlacedLetter {
  /** Cell on the sheet. */
  cell: number;
  /** Index of the letter among the text's letters (spaces excluded): what per-letter states refer to. */
  index: number;
  /** Left edge of the glyph. */
  x: number;
  /** Ink width. */
  width: number;
}

export interface ShapedLetters {
  /** Total width in pixels (0 for no letters). */
  width: number;
  height: number;
  glyphs: PlacedLetter[];
}

/**
 * Lays out a string of Old Letters right to left: the first letter is at the
 * right edge. The last letter of a word (before a space or the end) takes its
 * final form. Letters are `gap` px apart, words `space` px apart; marks and
 * characters not on the sheet are skipped.
 */
export function shapeLetters(text: string): ShapedLetters {
  // Split into words of sheet cells, folding typed final forms to their base first
  // so the final form is applied only where the word actually ends.
  const words: number[][] = [[]];
  for (const char of text.normalize('NFKD')) {
    if (/\s/.test(char)) {
      if ((words[words.length - 1] as number[]).length > 0) words.push([]);
      continue;
    }
    const cell = sheetCell(BASE_OF_FINAL[char] ?? char);
    if (cell >= 0) (words[words.length - 1] as number[]).push(cell);
  }
  if ((words[words.length - 1] as number[]).length === 0) words.pop();

  const cells: number[] = [];
  const wordStart = new Set<number>();
  for (const word of words) {
    wordStart.add(cells.length);
    for (const [i, cell] of word.entries()) {
      const letter = sheet.chars[cell] as string;
      const final = i === word.length - 1 ? FINAL_FORMS[letter] : undefined;
      cells.push(final === undefined ? cell : sheetCell(final));
    }
  }

  let width = 0;
  for (const [i, cell] of cells.entries()) {
    if (i > 0) width += wordStart.has(i) ? sheet.space : sheet.gap;
    width += sheet.widths[cell] as number;
  }

  const glyphs: PlacedLetter[] = [];
  let right = width;
  for (const [i, cell] of cells.entries()) {
    if (i > 0) right -= wordStart.has(i) ? sheet.space : sheet.gap;
    const w = sheet.widths[cell] as number;
    right -= w;
    glyphs.push({ cell, index: i, x: right, width: w });
  }
  return { width, height: sheet.height, glyphs };
}
