import type { Heavy } from '@iot/sim';

/**
 * Heavy charge as 0-3 stage pips: 0 while the hold is still a tap, then the
 * charge window split in three; 3 means fully charged (armored).
 */
export function chargeStage(charge: number, heavy: Heavy): number {
  if (charge < heavy.chargeMin) return 0;
  const span = Math.max(1, heavy.chargeMax - heavy.chargeMin);
  return Math.min(3, 1 + Math.floor(((charge - heavy.chargeMin) * 2) / span));
}
