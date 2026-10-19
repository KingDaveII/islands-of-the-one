import sigilJson from '../data/sigil.json' with { type: 'json' };
import { letterPosition, OLD_LETTERS } from './letters.js';
import type { WordElement } from './words.js';

/**
 * Sigils (docs/design/letters.md "Sigils", LORE §4.5 "Drawing a sigil"): a
 * plot sentence drawn as one line on a 3 × 3 square. Each letter is reduced
 * to its root 1–9 (the nine chambers: aleph 1 … tet 9, yod 10 → 1 … qof
 * 100 → 1, so a letter's root is its alphabet position mod 9, plus one;
 * final forms count as their base letter, as the Writ stores them), each
 * root is found on the square, and one line runs through them in order,
 * with a small circle where the sentence begins and a bar where it ends. A
 * repeated letter makes a loop; two different letters in the same chamber
 * make a short hook. The square is data (data/sigil.json; today Saturn's,
 * Agrippa's, LORE's reference). Pure: cells and marks as data, not pixels;
 * the client draws them, in the Ground's element's line style.
 */

/** The nine chambers, rows top to bottom; each root 1–9 once. */
export type SigilSquare = readonly (readonly number[])[];

export const SIGIL_SIZE = 3;
export const SIGIL_ROOTS = SIGIL_SIZE * SIGIL_SIZE;

export interface SigilData {
  square: SigilSquare;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Check sigil.json-shaped data; every problem is listed. */
export function validateSigilData(data: unknown): { ok: true; data: SigilData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !['$comment', 'square'].includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  const square = data.square;
  if (!Array.isArray(square) || square.length !== SIGIL_SIZE || !square.every((row) => Array.isArray(row) && row.length === SIGIL_SIZE))
    problems.push(`square must be ${SIGIL_SIZE} rows of ${SIGIL_SIZE}`);
  else {
    const seen = new Set<number>();
    for (const row of square as unknown[][])
      for (const v of row) {
        if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1 || v > SIGIL_ROOTS) problems.push(`square: ${String(v)} is not a root 1-${SIGIL_ROOTS}`);
        else if (seen.has(v)) problems.push(`square: root ${v} appears twice`);
        else seen.add(v);
      }
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, data: { square: (square as number[][]).map((row) => [...row]) } };
}

function loadSigilData(): SigilData {
  const result = validateSigilData(sigilJson);
  if (!result.ok) throw new Error(`data/sigil.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const sigilData: SigilData = loadSigilData();

/** A letter's root, 1–9 (its alphabet position mod 9, plus one; a final form counts as its base letter), or null for anything else. */
export function letterRoot(letter: string): number | null {
  const p = letterPosition(letter);
  return p < 0 ? null : (p % SIGIL_ROOTS) + 1;
}

/** Where a root sits on the square: its row and column, 0-based. */
export function rootCell(root: number, square: SigilSquare = sigilData.square): { row: number; col: number } {
  for (const [row, cells] of square.entries()) {
    const col = cells.indexOf(root);
    if (col >= 0) return { row, col };
  }
  throw new RangeError(`root ${root} is not on the square`);
}

/** One letter of the sentence on the square. */
export interface SigilStep {
  /** The base letter. */
  letter: string;
  root: number;
  row: number;
  col: number;
}

export type SigilMarkKind = 'start' | 'end' | 'loop' | 'hook';

/** A mark on the line: the circle at the start, the bar at the end, a loop at a repeated letter, a hook at a different letter in the same chamber. */
export interface SigilMark {
  kind: SigilMarkKind;
  /** The step (an index into `steps`) the mark sits on. */
  step: number;
}

export interface SigilPath {
  steps: SigilStep[];
  marks: SigilMark[];
}

/**
 * The sigil of a sentence: its letters (the Ground's then the Virtue's, as
 * written; spaces and marks skipped, final forms folded) as steps on the
 * square, in order, and the marks. The line runs from step to step; where a
 * step repeats the previous cell the line doesn't move: a repeated letter
 * is a loop there, a different letter in the same chamber a hook. An empty
 * sentence has no steps and no marks.
 */
export function sigilPath(letters: string, square: SigilSquare = sigilData.square): SigilPath {
  const steps: SigilStep[] = [];
  for (const char of letters.normalize('NFKD')) {
    const p = letterPosition(char);
    if (p < 0) continue;
    const root = (p % SIGIL_ROOTS) + 1;
    const { row, col } = rootCell(root, square);
    steps.push({ letter: OLD_LETTERS[p] ?? char, root, row, col });
  }
  const marks: SigilMark[] = [];
  if (steps.length === 0) return { steps, marks };
  marks.push({ kind: 'start', step: 0 });
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const here = steps[i];
    if (!prev || !here || prev.root !== here.root) continue;
    marks.push({ kind: prev.letter === here.letter ? 'loop' : 'hook', step: i });
  }
  marks.push({ kind: 'end', step: steps.length - 1 });
  return { steps, marks };
}

/** How the line is drawn, by the Ground's element (LORE): earth heavy and straight, water a long wave, fire jagged, air thin and broken. ART's seal kit (#125) draws each: client plotView.ts `sigilStroke`. */
export const SIGIL_STYLES = ['heavy-straight', 'wave', 'jagged', 'thin-broken'] as const;
export type SigilStyle = (typeof SIGIL_STYLES)[number];

export const SIGIL_STYLE_BY_ELEMENT: Readonly<Record<WordElement, SigilStyle>> = {
  earth: 'heavy-straight',
  water: 'wave',
  fire: 'jagged',
  air: 'thin-broken',
};

export function sigilStyle(element: WordElement): SigilStyle {
  return SIGIL_STYLE_BY_ELEMENT[element];
}
