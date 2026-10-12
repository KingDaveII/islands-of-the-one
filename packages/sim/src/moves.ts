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

/** True once a heavy hold has reached the charge window (the release is the charged thrust, not the tap). */
export function isCharged(P: Params, charge: number): boolean {
  return charge >= P.weapon.heavy.chargeMin;
}

/** True when the hold has filled the whole charge window. */
export function isFullyCharged(P: Params, charge: number): boolean {
  return charge >= P.weapon.heavy.chargeMax;
}

/**
 * Timing of the thrust a heavy release performs for a given charge: the tap
 * below `chargeMin`, else the charged thrust. The charged thrust's armor
 * window only applies when the charge was full.
 */
export function heavyTiming(P: Params, charge: number): Timing & { step: number } {
  const h = P.weapon.heavy;
  if (!isCharged(P, charge)) return h.tap;
  if (isFullyCharged(P, charge)) return h.charged;
  return { ...h.charged, armorStart: 0, armorEnd: 0 };
}

/** Timing of the attack or ability the player is performing, or null (dodge has its own rules). */
export function playerMove(p: PlayerState, P: Params): Timing | null {
  switch (p.action) {
    case 'light':
      return lightStrike(P, p.comboStep);
    case 'heavy':
      return heavyTiming(P, p.charge);
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

/**
 * Armor frames: hits still deal damage but don't interrupt the move. A move's
 * own window, a fully charged heavy hold, or armor granted by an event (the
 * arrival of a Haul on a heavy target).
 */
export function isArmored(p: PlayerState, P: Params): boolean {
  if (p.armor > 0) return true;
  if (p.action === 'charge') return isFullyCharged(P, p.charge);
  const m = playerMove(p, P);
  return m !== null && p.t > m.armorStart && p.t <= m.armorEnd;
}
