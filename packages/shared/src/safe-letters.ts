import banned from '../data/safe-letters.json' with { type: 'json' };
import { positionsFromText } from './letters.js';

/**
 * The safe-letters filter. A pure function for server and client: rejects
 * text that contains the Hebrew name of God (see docs/design/letters.md and
 * docs/design/glossary.md), in Old Letters or in Latin transliteration, and
 * (strict mode, for generated Names) the letter pair that opens it. The
 * banned runs live in data/safe-letters.json as alphabet positions, never
 * spelled out; so does the (currently empty) offensive-word list.
 */
export type UnsafeReason = 'name-hebrew' | 'name-latin' | 'yod-he' | 'offensive';

export interface SafeResult {
  ok: boolean;
  reason?: UnsafeReason;
}

export interface SafeOptions {
  /** Also reject the yod-he pair anywhere (generated Names). */
  strict?: boolean;
}

/** The in-world refusal when a Name fails the filter or the Name rules. */
export const NAME_REFUSED = "The Writ won't take that name. Try another.";

const OK: SafeResult = { ok: true };

function contains(haystack: readonly number[], needle: readonly number[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Forwards or reversed. */
function containsRun(positions: readonly number[], run: readonly number[]): boolean {
  return contains(positions, run) || contains(positions, [...run].reverse());
}

function containsAny(positions: readonly number[], runs: readonly (readonly number[])[]): boolean {
  return runs.some((run) => containsRun(positions, run));
}

/**
 * "Choir hand" Latin positions (a = 0 .. z = 25): lowercase without accents,
 * j/y -> i, v/w -> u, k -> c; everything that is not a letter is dropped.
 */
export function choirHandPositions(text: string): number[] {
  const out: number[] = [];
  for (const char of text.normalize('NFKD').toLowerCase()) {
    const c =
      char === 'j' || char === 'y'
        ? 'i'
        : char === 'v' || char === 'w'
          ? 'u'
          : char === 'k'
            ? 'c'
            : char;
    const code = c.charCodeAt(0) - 97;
    if (code >= 0 && code < 26 && c.length === 1) out.push(code);
  }
  return out;
}

/** The filter on a run of Old Letters positions (what the sim's Name generator produces). */
export function isSafePositions(
  positions: readonly number[],
  options: SafeOptions = {},
): SafeResult {
  if (containsAny(positions, banned.hebrew.runs)) return { ok: false, reason: 'name-hebrew' };
  if (options.strict && containsAny(positions, banned.hebrew.strictPairs))
    return { ok: false, reason: 'yod-he' };
  if (containsAny(positions, banned.offensive.hebrew)) return { ok: false, reason: 'offensive' };
  return OK;
}

/**
 * The filter on text in any script: Old Letters (with or without final forms,
 * niqqud, spaces and line breaks, written or reversed) and Latin
 * transliterations and look-alikes (case-insensitive, Choir hand, across
 * spaces, written or reversed).
 */
export function isSafe(text: string, options: SafeOptions = {}): SafeResult {
  const hebrew = isSafePositions(positionsFromText(text), options);
  if (!hebrew.ok) return hebrew;
  const latin = choirHandPositions(text);
  if (containsAny(latin, banned.latin.runs)) return { ok: false, reason: 'name-latin' };
  if (containsAny(latin, banned.offensive.latin)) return { ok: false, reason: 'offensive' };
  return OK;
}
