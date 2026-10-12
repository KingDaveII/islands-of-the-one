import { randInt, type RngHolder } from './rng.js';

/**
 * Seeded Writ Name generator. A Name is a run of Old Letters, kept as alphabet
 * positions (0 = alef .. letters - 1) so the sim stays integer-only and
 * dependency-free; `@iot/shared` turns positions into letters.
 *
 * Every Name goes through `rules.safe` (the safe-letters filter in strict
 * mode, `isSafePositions(p, { strict: true }).ok`): the generator is not usable
 * without it, so no path produces an unchecked Name.
 */
export interface NameRules {
  /** Alphabet size (22 Old Letters). */
  letters: number;
  minLetters: number;
  maxLetters: number;
  /** The safe-letters filter; a rejected Name is redrawn. */
  safe: (positions: readonly number[]) => boolean;
}

/** Redraws before giving up; with the real filter a draw is rejected ~2% of the time. */
export const NAME_ATTEMPTS = 64;

export function generateName(rng: RngHolder, rules: NameRules): number[] {
  if (rules.letters < 1 || rules.minLetters < 1 || rules.maxLetters < rules.minLetters) {
    throw new RangeError('invalid Name rules');
  }
  for (let attempt = 0; attempt < NAME_ATTEMPTS; attempt++) {
    const length = randInt(rng, rules.minLetters, rules.maxLetters);
    const name: number[] = [];
    for (let i = 0; i < length; i++) name.push(randInt(rng, 0, rules.letters - 1));
    if (rules.safe(name)) return name;
  }
  throw new Error(`generateName: no safe Name in ${NAME_ATTEMPTS} draws`);
}
