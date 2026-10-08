import { facing8 } from '@iot/sim';

/** Sprite facings in sprite-sheet order. */
export const FACINGS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'] as const;
export type Facing = (typeof FACINGS)[number];

/**
 * Index into FACINGS of the facing nearest to a sim angle (1/4096 turn, 0 =
 * east, screen y down). The aim reticle keeps the exact angle; sprites snap.
 */
export function facingIndex(angle: number): number {
  // facing8 counts clockwise from east (E, SE, S, ...); the sheet runs S, SE, E, NE, ...
  return (2 - facing8(angle) + 8) % 8;
}

export function facingOf(angle: number): Facing {
  return FACINGS[facingIndex(angle)] ?? 'S';
}

/** Unit step (x, y) of a facing, screen y down. */
export function facingStep(index: number): { x: number; y: number } {
  const steps = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: -1 },
    { x: -1, y: -1 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
  ];
  return steps[((index % 8) + 8) % 8] ?? { x: 0, y: 1 };
}
