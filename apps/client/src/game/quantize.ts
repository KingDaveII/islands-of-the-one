import { MOVE_DIRS, MOVE_MAG_MAX, TURN } from '@iot/sim';

/**
 * Float → sim input quantization. This runs in the client (where Math.atan2
 * is fine); the sim only ever sees the quantized integers.
 */
export function quantizeAngle(radians: number): number {
  const turns = radians / (2 * Math.PI);
  return Math.round(turns * TURN) & (TURN - 1);
}

export function quantizeMove(x: number, y: number, deadzone = 0): { moveDir: number; moveMag: number } {
  const len = Math.hypot(x, y);
  if (len <= deadzone || len === 0) return { moveDir: 0, moveMag: 0 };
  const live = Math.min(1, (len - deadzone) / (1 - deadzone));
  const moveMag = Math.max(1, Math.round(live * MOVE_MAG_MAX));
  const moveDir = Math.round((Math.atan2(y, x) / (2 * Math.PI)) * MOVE_DIRS) & (MOVE_DIRS - 1);
  return { moveDir, moveMag };
}

/** Keyboard: 8 directions at full magnitude. */
export function keyboardMove(left: boolean, right: boolean, up: boolean, down: boolean): { moveDir: number; moveMag: number } {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  if (x === 0 && y === 0) return { moveDir: 0, moveMag: 0 };
  return { moveDir: Math.round((Math.atan2(y, x) / (2 * Math.PI)) * MOVE_DIRS) & (MOVE_DIRS - 1), moveMag: MOVE_MAG_MAX };
}
