import type { PlayerState } from './state.js';
import type { Ability, Params, Strike, Timing } from './tuning.js';

export type StrikePhase = 'startup' | 'active' | 'recovery' | 'done';

/** Phase of a move `t` ticks after it started (t = 1 on the first tick after starting). */
export function strikePhase(t: number, startup: number, active: number, recovery: number): StrikePhase {
  if (t <= startup) return 'startup';
  if (t <= startup + active) return 'active';
  if (t <= startup + active + recovery) return 'recovery';
  return 'done';
}

export function lightStrike(P: Params, step: number): Strike {
  const strikes = P.weapon.light;
  return strikes[Math.min(step, strikes.length - 1)] as Strike;
}

export function abilityAt(P: Params, slot: number): Ability | undefined {
  return P.weapon.abilities[slot];
}

/** Timing of the attack or ability the player is performing, or null (dodge has its own rules). */
export function playerMove(p: PlayerState, P: Params): Timing | null {
  switch (p.action) {
    case 'light':
      return lightStrike(P, p.comboStep);
    case 'heavy':
      return P.weapon.heavy;
    case 'ability':
      return abilityAt(P, p.abilitySlot) ?? null;
    default:
      return null;
  }
}

/** Current phase of the player's attack or ability, or null when not in one. */
export function playerAttackPhase(p: PlayerState, P: Params): StrikePhase | null {
  const m = playerMove(p, P);
  return m ? strikePhase(p.t, m.startup, m.active, m.recovery) : null;
}

/** Armor frames: hits still deal damage but don't interrupt the move. */
export function isArmored(p: PlayerState, P: Params): boolean {
  const m = playerMove(p, P);
  return m !== null && p.t > m.armorStart && p.t <= m.armorEnd;
}
