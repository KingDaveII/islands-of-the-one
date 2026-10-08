import { idiv, length } from './fixed.js';
import { collideWalls } from './rooms.js';
import type { RoomState } from './state.js';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Move velocity toward (tx, ty) by at most `rate` units/tick². */
export function accelerate(b: Body, tx: number, ty: number, rate: number): void {
  const dx = tx - b.vx;
  const dy = ty - b.vy;
  const d = length(dx, dy);
  if (d <= rate) {
    b.vx = tx;
    b.vy = ty;
  } else {
    b.vx += idiv(dx * rate, d);
    b.vy += idiv(dy * rate, d);
  }
}

export function brake(b: Body, rate: number): void {
  accelerate(b, 0, 0, rate);
}

/** Integrate one tick of velocity and resolve walls. */
export function moveBody(room: RoomState, b: Body, radius: number): void {
  b.x += b.vx;
  b.y += b.vy;
  collideWalls(room, b, radius);
}
