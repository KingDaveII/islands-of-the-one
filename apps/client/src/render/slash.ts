import type { StrikePhase } from '@iot/sim';

/** Ticks into the recovery that the slash arc stays up, faded: the tail of the hitbox flash. */
export const ARC_TAIL_TICKS = 3;

/**
 * What the engine draws for a light strike this tick: the slash arc (the
 * hitbox flash, readability.md) over the active ticks and the first
 * `ARC_TAIL_TICKS` of the recovery, else nothing. The sheet draws its own
 * blade in the wind-up (M1's wind-up stroke, the stand-in for the blade its
 * placeholder figure lacked, went with the v1 sheets in G1.5g).
 */
export function lightSlashMark(phase: StrikePhase | null, recoveryTick: number): 'arc' | null {
  if (phase === 'active' || (phase === 'recovery' && recoveryTick <= ARC_TAIL_TICKS)) return 'arc';
  return null;
}
