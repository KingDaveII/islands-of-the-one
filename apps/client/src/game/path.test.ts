import { holdingLayout, holdingRoomTiles, TILE_SIZE_PX, type TilePoint } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { findPath, PathWalk, walkable, walkGoal, waypoints } from './path.js';

const layout = holdingLayout();
const tiles = holdingRoomTiles(layout);

/** Every step of a path is one of the 8 directions, on ground, and no diagonal cuts a solid corner. */
function checkSteps(room: readonly string[], path: readonly TilePoint[]): void {
  for (const t of path) expect(walkable(room, t.col, t.row), `${t.col},${t.row}`).toBe(true);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as TilePoint;
    const b = path[i] as TilePoint;
    const dc = b.col - a.col;
    const dr = b.row - a.row;
    expect(Math.max(Math.abs(dc), Math.abs(dr)), `step ${i}`).toBe(1);
    if (dc !== 0 && dr !== 0) {
      expect(walkable(room, a.col + dc, a.row), `corner at step ${i}`).toBe(true);
      expect(walkable(room, a.col, a.row + dr), `corner at step ${i}`).toBe(true);
    }
  }
}

describe('findPath', () => {
  it('goes round a tree on the holding, 8 directions, never through it', () => {
    // The tree at cols 4-5, rows 6-7: from left of it to right of it.
    const from = { col: 3, row: 6 };
    const to = { col: 6, row: 7 };
    expect(walkable(tiles, 4, 6)).toBe(false);
    const path = findPath(tiles, from, to);
    expect(path).not.toBeNull();
    if (!path) return;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    checkSteps(tiles, path);
    expect(path.some((t) => t.col >= 4 && t.col <= 5 && t.row >= 6 && t.row <= 7)).toBe(false);
  });

  it("goes round a named plot's signpost and the pieces standing in it", () => {
    const plot = layout.plots[0];
    if (!plot) throw new Error('no plot');
    const post = plot.station.rect;
    // A piece along the row under the signpost's interact tile, west of it.
    const pieces = [0, 1, 2].map((i) => ({ col: post.col - 1 - i, row: post.row + 1 }));
    const room = holdingRoomTiles(layout, [plot.id], pieces);
    expect(walkable(room, post.col, post.row)).toBe(false);
    for (const p of pieces) expect(walkable(room, p.col, p.row)).toBe(false);
    const from = { col: post.col - 2, row: post.row + 2 };
    const to = { col: post.col, row: post.row - 1 };
    const path = findPath(room, from, to);
    expect(path).not.toBeNull();
    if (!path) return;
    checkSteps(room, path);
    // Unnamed, the signpost tile is ground and the path may cross it; named, never.
    expect(path.some((t) => t.col === post.col && t.row === post.row)).toBe(false);
  });

  it('never cuts a corner: a diagonal between two solid tiles is no way through', () => {
    const room = ['#####', '#..o#', '#.o.#', '#...#', '#####'];
    // From (1,1)... to (3,2) diagonally past the pillars at (3,1) and (2,2): round by the bottom.
    const path = findPath(room, { col: 1, row: 1 }, { col: 3, row: 2 });
    expect(path).not.toBeNull();
    if (!path) return;
    checkSteps(room, path);
    expect(path.length).toBeGreaterThan(3);
    // Walled in: no path.
    expect(findPath(['#####', '#.o.#', '#o#.#', '#####'], { col: 1, row: 1 }, { col: 3, row: 1 })).toBeNull();
  });

  it('has no path to a void tile, nor into a solid one', () => {
    expect(findPath(tiles, { col: 14, row: 15 }, { col: 0, row: 0 })).toBeNull();
    expect(findPath(tiles, { col: 14, row: 15 }, { col: 40, row: 40 })).toBeNull();
    expect(findPath(tiles, { col: 14, row: 15 }, { col: 14, row: 13 })).toBeNull();
    // The same tile: a path of one.
    expect(findPath(tiles, { col: 14, row: 15 }, { col: 14, row: 15 })).toEqual([{ col: 14, row: 15 }]);
  });

  it('is the same path every time (the same room, the same ends)', () => {
    const a = findPath(tiles, { col: 2, row: 12 }, { col: 27, row: 8 });
    const b = findPath(tiles, { col: 2, row: 12 }, { col: 27, row: 8 });
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });
});

describe('walkGoal', () => {
  it('is the tile when it is ground, else the nearest walkable tile; nothing far out in the void', () => {
    expect(walkGoal(tiles, { col: 14, row: 15 })).toEqual({ col: 14, row: 15 });
    // The Writ post (14, 13) is solid: the nearest ground, straight above it (the first in row order).
    expect(walkGoal(tiles, { col: 14, row: 13 })).toEqual({ col: 14, row: 12 });
    // Just past the shore: the shore.
    expect(walkGoal(tiles, { col: 0, row: 8 })).toEqual({ col: 1, row: 8 });
    expect(walkGoal(tiles, { col: 60, row: 8 })).toBeNull();
  });
});

describe('the walk along a path', () => {
  it('keeps only the turning points, at the tiles’ centres', () => {
    const pts = waypoints([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 1 },
      { col: 4, row: 2 },
    ]);
    const c = (n: number): number => (n + 0.5) * TILE_SIZE_PX;
    expect(pts).toEqual([
      { x: c(2), y: c(0) },
      { x: c(4), y: c(2) },
    ]);
  });

  it('steers at full deflection toward each waypoint, eases off at the end and stops there', () => {
    const walk = new PathWalk([
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(walk.step(0, 0)).toEqual({ x: 1, y: 0 });
    // Reached the first: turn for the second.
    const turn = walk.step(98, 0);
    expect(turn?.y).toBeGreaterThan(0.99);
    // Close to the last: less than full.
    const near = walk.step(100, 94);
    expect(near && Math.hypot(near.x, near.y)).toBeLessThan(1);
    expect(walk.step(100, 99)).toBeNull();
    expect(walk.done).toBe(true);
  });

  it('gives up when it stops getting nearer (pushed into a corner)', () => {
    const walk = new PathWalk([{ x: 100, y: 0 }]);
    let steps = 0;
    while (walk.step(0, 0) && steps < 1000) steps++;
    expect(walk.done).toBe(true);
    expect(steps).toBeLessThan(PathWalk.STUCK_TICKS + 3);
  });
});
