import { creationData as creation, KINDLED_NAME_REFUSED } from './creation.js';
import { isDrawable } from './fonts.js';
import { isSafe, NAME_REFUSED } from './safe-letters.js';

/**
 * Accounts and Kindled creation rules (docs/design/accounts.md), shared by the
 * server (the authority) and the client (instant feedback). Pure functions,
 * no runtime dependencies: Intl.Segmenter is built into Node and browsers.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const USERNAME_RULES = '3-20 letters a-z, digits, _ or -.';
export const PASSWORD_RULES = '8-128 characters.';

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string };

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * A username: 3-20 of [a-z0-9_-] (typed in any case, stored lowercase), and
 * nothing the safe-letters filter rejects. Surrounding whitespace is ignored.
 */
export function validateUsername(input: unknown): Validation<string> {
  if (typeof input !== 'string' || input.length > 64) return { ok: false, message: USERNAME_RULES };
  const trimmed = input.trim();
  if (
    trimmed.length < USERNAME_MIN ||
    trimmed.length > USERNAME_MAX ||
    !USERNAME_PATTERN.test(trimmed)
  )
    return { ok: false, message: USERNAME_RULES };
  const username = trimmed.toLowerCase();
  if (!isSafe(username).ok) return { ok: false, message: 'That username is not allowed.' };
  return { ok: true, value: username };
}

/**
 * A password: 8-128 characters (code points) after NFC normalization, so the
 * same password typed on another device or keyboard still matches. Anything
 * else goes, spaces included.
 */
export function validatePassword(input: unknown): Validation<string> {
  // Bound the work before normalizing (128 code points are at most 256 UTF-16 units).
  if (typeof input !== 'string' || input.length > PASSWORD_MAX * 2)
    return { ok: false, message: PASSWORD_RULES };
  const password = input.normalize('NFC');
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) return { ok: false, message: PASSWORD_RULES };
  return { ok: true, value: password };
}

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

/** The grapheme clusters (user-perceived characters) of a string. */
export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** Zero-width non-joiner and joiner: format characters some scripts need (Persian, Indic). */
const JOINERS = new Set(['\u200c', '\u200d']);

/**
 * Control, format (bidi overrides and isolates, invisible marks), surrogate
 * and private-use characters. Whitespace is collapsed before this is checked.
 */
function hasForbiddenChar(text: string): boolean {
  for (const ch of text) {
    if (/\p{Cf}/u.test(ch) && !JOINERS.has(ch)) return true;
    if (/[\p{Cc}\p{Cs}\p{Co}]/u.test(ch)) return true;
  }
  return false;
}

/**
 * The canonical form of a typed Kindled name: NFC, trimmed, every run of
 * whitespace (tabs and line breaks too) collapsed to one space.
 */
export function normalizeKindledName(input: string): string {
  return input.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export { DRAWABLE_CHARS, isDrawable } from './fonts.js';

/** The refusal for a name the pixel fonts can't draw. */
export const NAME_NOT_DRAWABLE =
  'Use letters the game can draw for now: A–Z and accented Latin letters.';

/** Why a typed name was refused (NAME_NOT_DRAWABLE for 'not-drawable', else NAME_REFUSED, or KINDLED_NAME_REFUSED for a Kindled's). */
export type TypedNameRejection =
  'not-text' | 'length' | 'characters' | 'not-drawable' | 'no-letter' | 'unsafe';
export type KindledNameRejection = TypedNameRejection;

export type TypedNameValidation =
  { ok: true; name: string } | { ok: false; reason: TypedNameRejection; message: string };
export type KindledNameValidation = TypedNameValidation;

const refuse = (reason: TypedNameRejection): TypedNameValidation => ({
  ok: false,
  reason,
  message: NAME_REFUSED,
});

/**
 * A typed name, a Kindled's or the island's (M2 Task 4a): text normalized
 * (normalizeKindledName), no control or format characters, only characters
 * the game can draw (DRAWABLE_CHARS: A-Z and accented Latin letters for now;
 * the book's "any language" waits for more glyphs), 2-24 grapheme clusters,
 * at least one letter, at most a few combining marks per cluster, and
 * nothing the safe-letters filter rejects (not strict: the typed text may
 * contain yod-he; the island's letters are checked strict by validateIslandName).
 */
export function validateTypedName(input: unknown): TypedNameValidation {

  if (typeof input !== 'string') return refuse('not-text');
  const rules = creation.name;
  // Bound the work before normalizing anything.
  if (input.length > rules.maxGraphemes * 16) return refuse('length');
  const name = normalizeKindledName(input);
  if (hasForbiddenChar(name)) return refuse('characters');
  if (!isSafe(name).ok) return refuse('unsafe');
  if (!isDrawable(name)) return { ok: false, reason: 'not-drawable', message: NAME_NOT_DRAWABLE };
  const clusters = graphemes(name);
  if (clusters.length < rules.minGraphemes || clusters.length > rules.maxGraphemes)
    return refuse('length');
  for (const cluster of clusters) {
    const marks = cluster.normalize('NFD').match(/\p{M}/gu)?.length ?? 0;
    if (marks > rules.maxMarksPerGrapheme) return refuse('characters');
  }
  if (!/\p{L}/u.test(name)) return refuse('no-letter');
  return { ok: true, name };
}

/**
 * A Kindled name: the typed-name rules above, refused with LORE's line
 * (`KINDLED_NAME_REFUSED`, creation.json) instead of the Writ's; a name the
 * fonts can't draw keeps `NAME_NOT_DRAWABLE`.
 */
export function validateKindledName(input: unknown): KindledNameValidation {
  const typed = validateTypedName(input);
  if (typed.ok || typed.reason === 'not-drawable') return typed;
  return { ok: false, reason: typed.reason, message: KINDLED_NAME_REFUSED };
}
