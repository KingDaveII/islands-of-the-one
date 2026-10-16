import { isV2Sheet, type SpriteSheet } from '@iot/shared';
import type { StrikePhase } from '@iot/sim';

/** Ticks into the recovery that the slash arc stays up, faded: the tail of the hitbox flash. */
export const ARC_TAIL_TICKS = 3;

/**
 * What the engine draws for a light strike this tick, given the player's
 * sheet: the wind-up stroke in the startup, the slash arc (the hitbox flash,
 * readability.md) over the active ticks and the first `ARC_TAIL_TICKS` of the
 * recovery, else nothing. The wind-up stroke was M1's stand-in for the blade
 * the v1 placeholder figure lacks: a v2 sheet draws its own blade in the
 * wind-up, so the stroke would show as a second one. The arc is for both.
 */
export function lightSlashMark(
  sheet: SpriteSheet,
  phase: StrikePhase | null,
  recoveryTick: number,
): 'windup' | 'arc' | null {
  if (phase === 'startup') return isV2Sheet(sheet) ? null : 'windup';
  if (phase === 'active' || (phase === 'recovery' && recoveryTick <= ARC_TAIL_TICKS)) return 'arc';
  return null;
}
