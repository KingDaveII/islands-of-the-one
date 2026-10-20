import { TILE_SIZE_PX, type TilePoint } from '@iot/shared';

/**
 * Tap to walk on the holding (M2 Task 10, docs/design/holding.md §6): a path
 * over the roam's own room (`holdingRoomTiles`, as `RoamSession.setSolidPlots`
 * rebuilds it with the named plots' signposts and the pieces), and the
 * steering that walks it. Pure, so it is tested in node. The tiles are the
 * sim's legend: `#` (the edge, the void) and `o` (a pillar: a station, a
 * signpost, a piece) are solid, everything else is ground.
 */

const SOLID = new Set(['#', 'o']);

/** Whether a tile can be walked on (outside the rows is the void). */
export function walkable(tiles: readonly string[], col: number, row: number): boolean {
  const ch = tiles[row]?.[col];
  return ch !== undefined && !SOLID.has(ch);
}

/** The 8 directions: the 4 straight steps (cost 10), then the diagonals (cost 14). */
const STEPS: readonly [number, number, number][] = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [-1, 1, 14],
  [1, -1, 14],
  [-1, -1, 14],
];

/** The octile distance in the steps' units: a lower bound of the path's cost. */
const octile = (a: TilePoint, b: TilePoint): number => {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy);
};

/**
 * The shortest path from tile `from` to tile `to`, 8 directions with no
 * corner cutting (a diagonal step needs both straight neighbours free, so a
 * round body never clips a corner), every tile of it from `from` to `to`; or
 * null when `to` is solid or void or can't be reached. A* with the octile
 * distance; ties broken by insertion order, so the same room always gives
 * the same path.
 */
export function findPath(tiles: readonly string[], from: TilePoint, to: TilePoint): TilePoint[] | null {
  if (!walkable(tiles, to.col, to.row)) return null;
  const cols = tiles.reduce((m, r) => Math.max(m, r.length), 0);
  const key = (c: number, r: number): number => r * cols + c;
  const startKey = key(from.col, from.row);
  const goalKey = key(to.col, to.row);
  if (startKey === goalKey) return [{ ...from }];
  const g = new Map<number, number>([[startKey, 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  // A small binary heap of [f, order, key].
  const heap: [number, number, number][] = [];
  let order = 0;
  const push = (f: number, k: number): void => {
    heap.push([f, order++, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      const a = heap[i] as [number, number, number];
      const b = heap[p] as [number, number, number];
      if (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1])) break;
      heap[i] = b;
      heap[p] = a;
      i = p;
    }
  };
  const pop = (): [number, number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        const less = (x: number, y: number): boolean => {
          const a = heap[x] as [number, number, number];
          const b = heap[y] as [number, number, number];
          return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
        };
        if (l < heap.length && less(l, m)) m = l;
        if (r < heap.length && less(r, m)) m = r;
        if (m === i) break;
        const t = heap[i] as [number, number, number];
        heap[i] = heap[m] as [number, number, number];
        heap[m] = t;
        i = m;
      }
    }
    return top;
  };
  push(octile(from, to), startKey);
  for (let node = pop(); node; node = pop()) {
    const k = node[2];
    if (closed.has(k)) continue;
    if (k === goalKey) break;
    closed.add(k);
    const c = k % cols;
    const r = Math.floor(k / cols);
    const gk = g.get(k) ?? 0;
    for (const [dc, dr, cost] of STEPS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!walkable(tiles, nc, nr)) continue;
      if (dc !== 0 && dr !== 0 && (!walkable(tiles, c + dc, r) || !walkable(tiles, c, r + dr))) continue;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;
      const ng = gk + cost;
      if (ng >= (g.get(nk) ?? Infinity)) continue;
      g.set(nk, ng);
      came.set(nk, k);
      push(ng + octile({ col: nc, row: nr }, to), nk);
    }
  }
  if (!came.has(goalKey)) return null;
  const path: TilePoint[] = [];
  for (let k: number | undefined = goalKey; k !== undefined; k = k === startKey ? undefined : came.get(k))
    path.push({ col: k % cols, row: Math.floor(k / cols) });
  return path.reverse();
}

/**
 * Where a tap on a tile walks to: the tile itself when it can be walked on,
 * else the nearest walkable tile (by distance between centres, the first in
 * row order on a tie) within `maxTiles`, or null (a tap far out in the void).
 */
export function walkGoal(tiles: readonly string[], tile: TilePoint, maxTiles = 4): TilePoint | null {
  if (walkable(tiles, tile.col, tile.row)) return { ...tile };
  let best: { t: TilePoint; d: number } | null = null;
  for (let r = tile.row - maxTiles; r <= tile.row + maxTiles; r++)
    for (let c = tile.col - maxTiles; c <= tile.col + maxTiles; c++) {
      if (!walkable(tiles, c, r)) continue;
      const d = (c - tile.col) ** 2 + (r - tile.row) ** 2;
      if (d > maxTiles * maxTiles) continue;
      if (!best || d < best.d) best = { t: { col: c, row: r }, d };
    }
  return best ? best.t : null;
}

/** A path's turning points (sim px, tile centres): the tiles where its direction changes, and its end; the start is dropped. */
export function waypoints(path: readonly TilePoint[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const centre = (t: TilePoint): { x: number; y: number } => ({ x: (t.col + 0.5) * TILE_SIZE_PX, y: (t.row + 0.5) * TILE_SIZE_PX });
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as TilePoint;
    const b = path[i] as TilePoint;
    const c = path[i + 1];
    if (!c || c.col - b.col !== b.col - a.col || c.row - b.row !== b.row - a.row) out.push(centre(b));
  }
  return out;
}

/** How near (sim px) the Kindled must come to a waypoint to turn for the next, and to the last to have arrived. */
export const WAYPOINT_REACH_PX = 4;
export const ARRIVE_PX = 3;
/** Within this of the last waypoint (sim px) the deflection eases off, down to `SETTLE_MIN`, so the Kindled stops on it rather than past it. */
export const SETTLE_PX = 12;
export const SETTLE_MIN = 0.35;

/**
 * The client autopilot of a tap to walk: the stick a thumb would hold to walk
 * the path, at full deflection toward the next waypoint (so the roam walks,
 * then runs, as with the stick), easing off over the last few px, until the
 * last is reached. `step` returns the
 * deflection for the Kindled at (x, y) sim px, or null once arrived; a walk
 * that stops making headway (pushed into a corner) gives up.
 */
export class PathWalk {
  private next = 0;
  private best = Infinity;
  private stale = 0;
  /** Ticks without getting nearer the next waypoint before the walk gives up. */
  static readonly STUCK_TICKS = 45;
  done = false;

  constructor(readonly points: readonly { x: number; y: number }[]) {
    if (points.length === 0) this.done = true;
  }

  step(x: number, y: number): { x: number; y: number } | null {
    if (this.done) return null;
    for (;;) {
      const p = this.points[this.next];
      if (!p) {
        this.done = true;
        return null;
      }
      const last = this.next === this.points.length - 1;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= (last ? ARRIVE_PX : WAYPOINT_REACH_PX)) {
        this.next++;
        this.best = Infinity;
        this.stale = 0;
        continue;
      }
      if (d < this.best - 0.25) {
        this.best = d;
        this.stale = 0;
      } else if (++this.stale > PathWalk.STUCK_TICKS) {
        this.done = true;
        return null;
      }
      const push = last ? Math.max(SETTLE_MIN, Math.min(1, d / SETTLE_PX)) : 1;
      return { x: ((p.x - x) / d) * push, y: ((p.y - y) / d) * push };
    }
  }
}
