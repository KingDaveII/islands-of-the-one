import { FINAL_FORMS, OLD_LETTERS } from './letters.js';
import { writData } from './writ-data.js';

/**
 * Hearing a Name (docs/design/letters.md "Hearing a Name"; LORE's reference
 * script, docs/design/reference/old-letters-transliteration.py): a typed Name
 * cut into the Old Letters as it sounds. Same input, same letters, every
 * time. Pure, no dependencies; the server computes the letters, the Name
 * screen shows them live as the player types.
 *
 * The rules, in order: fold the Latin (lowercase, ß → ss and the rest of
 * LATIN_FOLD, then accents stripped); split into words at spaces and hyphens,
 * dropping every other non-letter; inside a word a doubled consonant counts
 * once and a final h after a vowel is silent; read each word longest match
 * first into consonants (CONSONANTS) and vowel units (VOWEL_UNITS); write
 * each vowel by where it stands in its word (INITIAL, MEDIAL, FINAL); merge
 * identical neighbours when either came from a vowel; close the doors (yod
 * never touches he or yod); the lean hand drops inside vowels when the Name is
 * longer than a Writ line; a single letter gets an aleph in front. Old Letters
 * typed into the Name are kept as typed. The tables are the script's; where
 * the script and the written rules disagree, the script wins (it produced the
 * book's examples). Every result passes the safe-letters filter, strict: the
 * doors see to the pair, the typed text's own check (validateTypedName) to
 * the banned runs, and the property test in test/hear-name.test.ts to both.
 */

/** The alphabet, base letters only, as one string (positions as OLD_LETTERS). */
const ALEPHBET = OLD_LETTERS.join('');
/** Final form -> base letter (the sheet's table, letters.ts). */
const FINAL_TO_BASE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FINAL_FORMS).map(([base, final]) => [final, base]),
);

/** Letters by name, so the tables below read as the script's do. */
const L = {
  alef: ALEPHBET[0] as string,
  bet: ALEPHBET[1] as string,
  gimel: ALEPHBET[2] as string,
  dalet: ALEPHBET[3] as string,
  he: ALEPHBET[4] as string,
  vav: ALEPHBET[5] as string,
  zayin: ALEPHBET[6] as string,
  het: ALEPHBET[7] as string,
  tet: ALEPHBET[8] as string,
  yod: ALEPHBET[9] as string,
  kaf: ALEPHBET[10] as string,
  lamed: ALEPHBET[11] as string,
  mem: ALEPHBET[12] as string,
  nun: ALEPHBET[13] as string,
  samekh: ALEPHBET[14] as string,
  pe: ALEPHBET[16] as string,
  tsadi: ALEPHBET[17] as string,
  qof: ALEPHBET[18] as string,
  resh: ALEPHBET[19] as string,
  shin: ALEPHBET[20] as string,
  tav: ALEPHBET[21] as string,
} as const;

/** Step 2: the Latin folds before the accents are stripped. */
export const LATIN_FOLD: Readonly<Record<string, string>> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  å: 'o',
  ð: 'th',
  þ: 'th',
  ñ: 'ny',
  ç: 's',
  ý: 'y',
  ÿ: 'y',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** A vowel's class: open (unwritten inside a word), front (yod) or round (vav). */
export type VowelClass = 'a' | 'i' | 'o';

/** Table B's units, longest first: a Latin spelling and its class. */
export const VOWEL_UNITS: readonly (readonly [string, VowelClass])[] = [
  ['ee', 'i'],
  ['ea', 'i'],
  ['ie', 'i'],
  ['ei', 'i'],
  ['ey', 'i'],
  ['ay', 'i'],
  ['ai', 'i'],
  ['oo', 'o'],
  ['ou', 'o'],
  ['au', 'o'],
  ['aw', 'o'],
  ['ow', 'o'],
  ['oa', 'o'],
  ['a', 'a'],
  ['e', 'a'],
  ['i', 'i'],
  ['o', 'o'],
  ['u', 'o'],
];

/** Table A, longest first: a Latin spelling and the letters it is cut as. */
export const CONSONANTS: readonly (readonly [string, string])[] = [
  ['tsch', L.tsadi],
  ['tch', L.tsadi],
  ['sch', L.shin],
  ['sh', L.shin],
  ['ch', L.het],
  ['kh', L.kaf],
  ['ph', L.pe],
  ['th', L.tav],
  ['gh', L.gimel],
  ['ck', L.qof],
  ['qu', L.qof + L.vav],
  ['ts', L.tsadi],
  ['tz', L.tsadi],
  ['cz', L.tsadi],
  ['zh', L.zayin],
  ['b', L.bet],
  ['d', L.dalet],
  ['f', L.pe],
  ['g', L.gimel],
  ['h', L.he],
  ['j', L.gimel],
  ['k', L.qof],
  ['l', L.lamed],
  ['m', L.mem],
  ['n', L.nun],
  ['p', L.pe],
  ['q', L.qof],
  ['r', L.resh],
  ['s', L.samekh],
  ['t', L.tet],
  ['v', L.bet],
  ['w', L.vav],
  ['x', L.qof + L.samekh],
  ['y', L.yod],
  ['z', L.zayin],
];

/** Table B's columns: how a vowel class is written first, inside and last in its word. */
export const INITIAL: Readonly<Record<VowelClass, string>> = { a: L.alef, i: L.alef + L.yod, o: L.alef + L.vav };
export const MEDIAL: Readonly<Record<VowelClass, string>> = { a: '', i: L.yod, o: L.vav };
export const FINAL: Readonly<Record<VowelClass, string>> = { a: L.he, i: L.yod, o: L.vav };

/** One cut letter and whether it came from a vowel (what the doors and the lean hand look at). */
interface Cut {
  letter: string;
  fromVowel: boolean;
}

const isLatin = (ch: string): boolean => ch >= 'a' && ch <= 'z';
const isOldLetter = (ch: string): boolean => ALEPHBET.includes(ch);

/** Step 2: lowercase, the Latin folds, then the accents stripped. */
export function foldName(name: string): string {
  let out = '';
  for (const raw of name.toLowerCase()) {
    const folded = LATIN_FOLD[raw] ?? raw;
    for (const ch of folded.normalize('NFKD')) if (!/\p{M}/u.test(ch)) out += ch;
  }
  return out;
}

/** Step 3: the words, of Latin letters or Old Letters (final forms folded); spaces and hyphens split, the rest is dropped. */
export function wordsOf(name: string): string[] {
  const words: string[] = [];
  let cur = '';
  for (const ch of foldName(name)) {
    if (ch === ' ' || ch === '-' || ch === '\t') {
      if (cur) words.push(cur);
      cur = '';
    } else if (isLatin(ch) || isOldLetter(ch)) cur += ch;
    else if (FINAL_TO_BASE[ch] !== undefined) cur += FINAL_TO_BASE[ch];
  }
  if (cur) words.push(cur);
  return words;
}

/** y and w are vowels when no vowel follows them; w only right after a vowel. */
function isVowelAt(w: string, i: number): boolean {
  const c = w[i] as string;
  if (VOWELS.has(c)) return true;
  if (c === 'y' || c === 'w') {
    const next = w[i + 1] ?? '';
    if (c === 'w' && (i === 0 || !VOWELS.has(w[i - 1] as string))) return false;
    return !VOWELS.has(next);
  }
  return false;
}

/** Steps 3 to 6 on one word. */
function wordLetters(word: string): Cut[] {
  // Typed in the Old Letters: kept as typed.
  if (Array.from(word).some(isOldLetter))
    return Array.from(word)
      .filter(isOldLetter)
      .map((letter) => ({ letter, fromVowel: false }));
  // A doubled consonant counts once (vowel pairs are units).
  let s = '';
  for (const c of word) {
    if (s !== '' && c === s[s.length - 1] && !VOWELS.has(c)) continue;
    s += c;
  }
  let w = s;
  // A word-final h after a vowel is silent.
  if (w.length >= 2 && w[w.length - 1] === 'h' && VOWELS.has(w[w.length - 2] as string)) w = w.slice(0, -1);
  const units: { kind: 'C' | 'V'; value: string }[] = [];
  let i = 0;
  while (i < w.length) {
    if (isVowelAt(w, i)) {
      let matched = false;
      for (const [lat, cls] of VOWEL_UNITS) {
        if (!w.startsWith(lat, i)) continue;
        // A y or w closing a vowel pair stays a consonant before a vowel.
        if (lat.length === 2 && (lat[1] === 'y' || lat[1] === 'w') && i + 2 < w.length && VOWELS.has(w[i + 2] as string))
          continue;
        units.push({ kind: 'V', value: cls });
        i += lat.length;
        matched = true;
        break;
      }
      // A vocalic y or w on its own.
      if (!matched) {
        units.push({ kind: 'V', value: w[i] === 'y' ? 'i' : 'o' });
        i += 1;
      }
      continue;
    }
    if (w[i] === 'c' && !w.startsWith('ch', i) && !w.startsWith('ck', i) && !w.startsWith('cz', i)) {
      // c is samekh before e, i or y, and qof otherwise (rule 4; the script drops a hard c and reads a
      // word-final c as samekh, both by accident: see the PR and docs/design/letters.md).
      const next = w[i + 1] ?? '';
      units.push({ kind: 'C', value: next === 'e' || next === 'i' || next === 'y' ? L.samekh : L.qof });
      i += 1;
      continue;
    }
    let matched = false;
    for (const [lat, letters] of CONSONANTS) {
      if (!w.startsWith(lat, i)) continue;
      units.push({ kind: 'C', value: letters });
      i += lat.length;
      matched = true;
      break;
    }
    if (!matched) i += 1;
  }
  const out: Cut[] = [];
  units.forEach((u, k) => {
    if (u.kind === 'C') {
      for (const letter of u.value) out.push({ letter, fromVowel: false });
      return;
    }
    const cls = u.value as VowelClass;
    const written = k === 0 ? INITIAL[cls] : k === units.length - 1 ? FINAL[cls] : MEDIAL[cls];
    for (const letter of written) out.push({ letter, fromVowel: true });
  });
  // Identical neighbours merge when either came from a vowel.
  const res: Cut[] = [];
  for (const cut of out) {
    const last = res[res.length - 1];
    if (last && last.letter === cut.letter && (cut.fromVowel || last.fromVowel)) {
      last.fromVowel = last.fromVowel && cut.fromVowel;
      continue;
    }
    res.push({ ...cut });
  }
  return res;
}

/** Step 7: across the whole Name, ignoring spaces, yod never touches he or yod. */
function closeDoors(words: Cut[][]): void {
  for (;;) {
    const flat: [number, number][] = [];
    words.forEach((w, wi) => w.forEach((_, j) => flat.push([wi, j])));
    let changed = false;
    for (let n = 0; n + 1 < flat.length && !changed; n++) {
      const [a, b] = flat[n] as [number, number];
      const [c, d] = flat[n + 1] as [number, number];
      const x = (words[a] as Cut[])[b] as Cut;
      const y = (words[c] as Cut[])[d] as Cut;
      if (x.letter === L.yod && y.letter === L.yod) {
        // Two yods never touch: the one from a vowel goes (the first, when neither is).
        const [ki, kj] = y.fromVowel ? [c, d] : [a, b];
        (words[ki] as Cut[]).splice(kj, 1);
        changed = true;
      } else if ((x.letter === L.yod && y.letter === L.he) || (x.letter === L.he && y.letter === L.yod)) {
        const yod = x.letter === L.yod ? x : y;
        const he = x.letter === L.yod ? y : x;
        const [yi, yj] = x.letter === L.yod ? [a, b] : [c, d];
        if (yod.fromVowel) (words[yi] as Cut[]).splice(yj, 1); // a vowel yod is left unwritten
        else if (he.fromVowel) {
          he.letter = L.alef; // a vowel he becomes aleph
          he.fromVowel = true;
        } else {
          he.letter = L.het; // a breathed h becomes het
          he.fromVowel = false;
        }
        changed = true;
      }
    }
    if (!changed) return;
  }
}

const countLetters = (words: readonly Cut[][]): number => words.reduce((n, w) => n + w.length, 0);

/**
 * The Old Letters a typed Name is cut as: base letters, words separated by
 * spaces (`shapeLetters` adds the final forms when drawing). `lineLetters` is
 * how many letters a Writ line holds (data/writ.json): past it the lean hand
 * drops the letters that came from inside vowels, last word first; pass
 * Infinity for the full hand. Empty when the Name has nothing to hear.
 */
export function hearName(typed: string, lineLetters: number = writData.lineLetters): string {
  let words = wordsOf(typed)
    .map(wordLetters)
    .filter((w) => w.length > 0);
  closeDoors(words);
  // Step 8, the lean hand: over the line, drop inside vowel letters from the end backwards, never a word's first or last.
  for (let wi = words.length - 1; wi >= 0; wi--) {
    const w = words[wi] as Cut[];
    let j = w.length - 2;
    while (countLetters(words) > lineLetters && j >= 1) {
      const cut = w[j] as Cut;
      if (cut.fromVowel && (cut.letter === L.yod || cut.letter === L.vav)) w.splice(j, 1);
      j -= 1;
    }
  }
  closeDoors(words);
  words = words.filter((w) => w.length > 0);
  // Step 9: a Name left with one letter gets an aleph in front of it.
  if (countLetters(words) === 1) (words[0] as Cut[]).unshift({ letter: L.alef, fromVowel: true });
  return words.map((w) => w.map((c) => c.letter).join('')).join(' ');
}

/** How many letters a hearing has (spaces not counted). */
export function heardLetterCount(letters: string): number {
  return Array.from(letters).filter(isOldLetter).length;
}
