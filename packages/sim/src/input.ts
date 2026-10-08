import { TURN } from './fixed.js';

/**
 * One tick of player input, quantized and packed into a uint32 so the run's
 * input log is just a number[]:
 *
 *   bits  0-11  aim angle (1/4096 turn)
 *   bits 12-19  move direction (1/256 turn)
 *   bits 20-22  move magnitude (0..7)
 *   bits 23-28  buttons
 *
 * Light, Dodge and Ability* are "pressed this tick" edges; Heavy is "held".
 */
export const Button = {
  Light: 1,
  Heavy: 2,
  Dodge: 4,
  Ability1: 8,
  Ability2: 16,
  Ability3: 32,
} as const;

export const MOVE_DIRS = 256;
export const MOVE_MAG_MAX = 7;

export interface TickInput {
  /** Aim angle, 0..4095. */
  aim: number;
  /** Movement direction, 0..255 (1/256 turn). */
  moveDir: number;
  /** Movement magnitude, 0..7 (0 = no movement). */
  moveMag: number;
  /** Bitmask of `Button`. */
  buttons: number;
}

export function encodeInput(input: TickInput): number {
  return (
    ((input.aim & 0xfff) |
      ((input.moveDir & 0xff) << 12) |
      ((input.moveMag & 0x7) << 20) |
      ((input.buttons & 0x3f) << 23)) >>>
    0
  );
}

export function decodeInput(packed: number): TickInput {
  return {
    aim: packed & 0xfff,
    moveDir: (packed >>> 12) & 0xff,
    moveMag: (packed >>> 20) & 0x7,
    buttons: (packed >>> 23) & 0x3f,
  };
}

/** Move direction (1/256 turn) as a sim angle (1/4096 turn). */
export function moveDirToAngle(moveDir: number): number {
  return (moveDir * (TURN / MOVE_DIRS)) & (TURN - 1);
}

export const NO_INPUT = 0;
