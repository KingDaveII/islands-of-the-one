import { clamp, idiv, isqrt, TILE } from './fixed.js';
import type { RoomState } from './state.js';

/**
 * Hand-made room templates (packages/shared/data/rooms.json). Legend:
 *
 *   #  wall          o  pillar (wall)
 *   .  floor         P  player start
 *   S  spawn point   D  exit door (solid until the room is cleared)
 */
export interface RoomTemplate {
  name: string;
  tiles: string[];
}

export function roomFromTemplate(index: number, template: RoomTemplate): RoomState {
  const rows = template.tiles.length;
  const cols = template.tiles.reduce((m, r) => Math.max(m, r.length), 0);
  return {
    template: index,
    cols,
    rows,
    tiles: template.tiles.map((r) => r.padEnd(cols, '#')),
    doorOpen: false,
    phase: 'intro',
    wave: 0,
    timer: 0,
  };
}

export function tileAt(room: RoomState, col: number, row: number): string {
  if (row < 0 || row >= room.rows || col < 0 || col >= room.cols) return '#';
  return room.tiles[row]?.[col] ?? '#';
}

export function isSolid(room: RoomState, col: number, row: number): boolean {
  const t = tileAt(room, col, row);
  if (t === '#' || t === 'o') return true;
  if (t === 'D') return !room.doorOpen;
  return false;
}

/** Centers (in units) of every tile with the given character, row-major order. */
export function findTiles(room: RoomState, ch: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let row = 0; row < room.rows; row++) {
    for (let col = 0; col < room.cols; col++) {
      if (tileAt(room, col, row) === ch) out.push({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
    }
  }
  return out;
}

export function tileOf(v: number): number {
  return Math.floor(v / TILE);
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Push a circle out of solid tiles. Two passes handle corners. Velocity
 * pointing into a wall is removed so bodies slide along it.
 */
export function collideWalls(room: RoomState, b: Body, radius: number): boolean {
  let touched = false;
  for (let pass = 0; pass < 2; pass++) {
    const c0 = tileOf(b.x - radius);
    const c1 = tileOf(b.x + radius);
    const r0 = tileOf(b.y - radius);
    const r1 = tileOf(b.y + radius);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (!isSolid(room, col, row)) continue;
        const tx0 = col * TILE;
        const ty0 = row * TILE;
        const cx = clamp(b.x, tx0, tx0 + TILE);
        const cy = clamp(b.y, ty0, ty0 + TILE);
        const dx = b.x - cx;
        const dy = b.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= radius * radius) continue;
        touched = true;
        if (d2 === 0) {
          // Center inside the tile: push out along the shallowest axis.
          const left = b.x - tx0;
          const right = tx0 + TILE - b.x;
          const up = b.y - ty0;
          const down = ty0 + TILE - b.y;
          const m = Math.min(left, right, up, down);
          if (m === left) b.x = tx0 - radius;
          else if (m === right) b.x = tx0 + TILE + radius;
          else if (m === up) b.y = ty0 - radius;
          else b.y = ty0 + TILE + radius;
          continue;
        }
        const d = isqrt(d2);
        const push = radius - d;
        const nx = idiv(dx * push, d);
        const ny = idiv(dy * push, d);
        b.x += nx === 0 && push > 0 ? Math.sign(dx) : nx;
        b.y += ny === 0 && push > 0 ? Math.sign(dy) : ny;
        // Remove the velocity component pointing into the wall.
        const vn = idiv(b.vx * dx + b.vy * dy, d);
        if (vn < 0) {
          b.vx -= idiv(vn * dx, d);
          b.vy -= idiv(vn * dy, d);
        }
      }
    }
  }
  return touched;
}
