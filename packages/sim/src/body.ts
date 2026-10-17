import { idiv, isqrt, length, SUB } from './fixed.js';
import { collideWalls } from './rooms.js';
import type { ChestState, RoomState } from './state.js';

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

/**
 * Push a circle out of every chest (GAME DESIGN 2026-10-17): a chest is a
 * solid round pillar of `chestRadius` that blocks the Kindled and every Husk
 * alike, so it doubles as cover to circle around. The push-out is the one the
 * bodies use between themselves (`separate` in run.ts), the chest taking none
 * of it: the body moves the whole overlap along the line between the
 * centres, in integer sub-pixel units. Velocity is left alone, as between
 * bodies; the chest only ever corrects a position. Projectiles and the Haul's
 * hook never come here. Returns true when a chest pushed the body.
 */
export function collideChests(chests: readonly ChestState[], b: { x: number; y: number }, radius: number, chestRadius: number): boolean {
  let touched = false;
  const min = radius + chestRadius;
  for (const c of chests) {
    const dx = b.x - c.x;
    const dy = b.y - c.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    touched = true;
    const d = isqrt(d2);
    const overlap = min - d;
    // A body dead on the centre goes east, as two bodies on one point do.
    const nx = d === 0 ? SUB : idiv(dx * SUB, d);
    const ny = d === 0 ? 0 : idiv(dy * SUB, d);
    b.x += idiv(nx * overlap, SUB);
    b.y += idiv(ny * overlap, SUB);
  }
  return touched;
}
