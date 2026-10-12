import {
  isSafe,
  letterPosition,
  lettersFromPositions,
  NAME_REFUSED,
  nameRules,
  type UnsafeReason,
} from '@iot/shared';

/**
 * Validates a player-chosen Writ Name (untrusted input). A Name is 2-5 Old
 * Letters (data/names.json), nothing else, and passes the safe-letters filter
 * in strict mode. The accepted Name is canonical: final forms folded to base
 * letters (the renderer adds them back at word ends), marks dropped.
 */
export type NameRejection = 'not-text' | 'not-old-letters' | 'length' | UnsafeReason;

export type NameValidation =
  { ok: true; name: string } | { ok: false; reason: NameRejection; message: string };

const refuse = (reason: NameRejection): NameValidation => ({
  ok: false,
  reason,
  message: NAME_REFUSED,
});

export function validateName(input: unknown): NameValidation {
  if (typeof input !== 'string') return refuse('not-text');
  // Bound the work before normalizing anything.
  if (input.length > 64) return refuse('length');
  const positions: number[] = [];
  for (const char of input.trim().normalize('NFKD')) {
    if (/\p{M}/u.test(char)) continue;
    const p = letterPosition(char);
    if (p < 0) return refuse('not-old-letters');
    positions.push(p);
  }
  if (positions.length < nameRules.minLetters || positions.length > nameRules.maxLetters)
    return refuse('length');
  const name = lettersFromPositions(positions);
  const safe = isSafe(name, { strict: true });
  if (!safe.ok) return refuse(safe.reason ?? 'name-hebrew');
  return { ok: true, name };
}
