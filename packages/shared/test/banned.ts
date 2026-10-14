/**
 * The matcher for the banned names in docs/design/glossary.md, shared by the
 * tests that check them (names.test.ts scans every file; items.test.ts checks
 * item ids and names directly).
 *
 * The names are stored here ROT13-encoded (Latin forms) and as code points
 * (Hebrew letters), so this file doesn't contain them either.
 */

const rot13 = (s: string): string =>
  s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

/** Consonant forms, the stems of the vocalized forms, and the title read in its place. */
export const LATIN = 'luju luiu wuju wuiu vuiu vuju lnuj lnui wnuj wnui lrubi wrubi vrubi nqbanv nqbanl'
  .split(' ')
  .map(rot13);

/** The same in Hebrew letters, allowing vowel points and cantillation marks between them. */
export const HEBREW = [
  [0x5d9, 0x5d4, 0x5d5, 0x5d4],
  [0x5d0, 0x5d3, 0x5e0, 0x5d9],
].map((word) => word.map((cp) => String.fromCodePoint(cp)).join('[\\u0591-\\u05c7]*'));

export const BANNED = new RegExp([...LATIN, ...HEBREW].join('|'), 'iu');
