import { describe, expect, it } from 'vitest';
import {
  collideChests,
  HALF_TURN,
  length,
  roomFromTemplate,
  SUB,
  TILE,
  type ChestState,
  stepRun,
  type Run,
  type SimEvent,
} from '../src/index.js';
import { addHusk, arena, Button, input, step, stepUntil, tuning } from './helpers.js';

/**
 * Chests are solid (GAME DESIGN 2026-10-17): a round pillar of
 * `run.chestRadiusPx` that blocks the Kindled and every Husk, opened by touch
 * within `run.chestOpenReachPx` of its edge, standing and still solid once
 * open. Projectiles and the Haul's hook pass over it.
 */

/** A 12 × 12 open room with the player in its middle and one chest `dxPx`, `dyPx` from the player (no template chests). */
function openRoom(run: Run, dxPx: number, dyPx: number): ChestState {
  const s = run.state;
  const rows = [
    '############',
    ...Array.from({ length: 10 }, () => '#..........#'),
    '############',
  ];
  s.room = roomFromTemplate(0, { name: 'Open', tiles: rows });
  const p = s.player;
  p.x = 6 * TILE;
  p.y = 6 * TILE;
  p.vx = 0;
  p.vy = 0;
  const chest: ChestState = { id: 900, x: p.x + dxPx * SUB, y: p.y + dyPx * SUB, opened: false };
  s.chests = [chest];
  return chest;
}

const EAST = 0;
const opened = (events: SimEvent[]) => events.filter((e) => e.type === 'chestOpened');

/** `n` ticks of full-stick movement along `moveDir` (1/256 turn) aiming `aim`; returns the events. */
function move(run: Run, n: number, moveDir: number, aim = EAST): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...stepRun(run, input(0, aim, 7, moveDir)));
  return all;
}

describe('chests are solid pillars', () => {
  const minDist = (run: Run) => run.params.player.radius + run.params.run.chestRadius;
  /** The push-out truncates to whole units, as the bodies' does: a body may sit a few units (under 1/32 px) inside. */
  const SLACK = SUB / 32;

  it('takes the radius and the open reach from the tuning: 8 px and 2 px', () => {
    const run = arena();
    expect(tuning.run.chestRadiusPx).toBe(8);
    expect(tuning.run.chestOpenReachPx).toBe(2);
    expect(run.params.run.chestRadius).toBe(8 * SUB);
    expect(run.params.run.chestOpenReach).toBe(2 * SUB);
  });

  it('blocks the Kindled running into it, opens it on touch, and stays solid once open', () => {
    const run = arena();
    const chest = openRoom(run, 40, 0);
    const p = run.state.player;
    const events = move(run, 90, EAST);
    // Pushed out every tick: never closer than the two radii (an integer push-out may leave a unit).
    const d = length(p.x - chest.x, p.y - chest.y);
    expect(d).toBeGreaterThanOrEqual(minDist(run) - SLACK);
    expect(d).toBeLessThan(minDist(run) + run.params.run.chestOpenReach);
    expect(opened(events)).toHaveLength(1);
    expect(chest.opened).toBe(true);
    // Open and still solid: another second of running east moves it no further.
    const x = p.x;
    move(run, 60, EAST);
    expect(Math.abs(p.x - x)).toBeLessThanOrEqual(SUB);
    expect(length(p.x - chest.x, p.y - chest.y)).toBeGreaterThanOrEqual(minDist(run) - SLACK);
    expect(p.y).toBe(chest.y);
  });

  it('opens within the reach of the edge and not beyond it', () => {
    for (const [gapPx, opens] of [
      [3, false],
      [2, true],
    ] as const) {
      const run = arena();
      const chest = openRoom(run, 0, 0);
      const p = run.state.player;
      chest.x = p.x + minDist(run) + gapPx * SUB;
      const events = step(run);
      expect(opened(events).length, `${gapPx} px gap`).toBe(opens ? 1 : 0);
      expect(chest.opened).toBe(opens);
      // Not touching: nothing pushed the Kindled.
      expect(p.x).toBe(6 * TILE);
    }
  });

  it('is cover to circle around: running diagonally past it slides around, never through', () => {
    const run = arena();
    const chest = openRoom(run, 30, 4);
    const p = run.state.player;
    let closest = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < 120; i++) {
      move(run, 1, EAST);
      closest = Math.min(closest, length(p.x - chest.x, p.y - chest.y));
    }
    expect(closest).toBeGreaterThanOrEqual(minDist(run) - SLACK);
    // It got past: pushed off the line and on beyond the chest.
    expect(p.x).toBeGreaterThan(chest.x + minDist(run));
    expect(p.y).not.toBe(chest.y);
  });

  it('blocks a Husk the same way, and the chest never moves', () => {
    const run = arena();
    const chest = openRoom(run, 0, 0);
    const p = run.state.player;
    chest.x = p.x + 40 * SUB;
    const at = { x: chest.x, y: chest.y };
    // A Peeling chasing the player from beyond the chest, dead on its line.
    const h = addHusk(run, 'peeling', 80, { cooldown: 100_000 });
    const hr = run.params.husks.peeling.radius + run.params.run.chestRadius;
    let closest = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < 150; i++) {
      step(run, 0, EAST);
      closest = Math.min(closest, length(h.x - chest.x, h.y - chest.y));
    }
    expect(closest).toBeGreaterThanOrEqual(hr - SLACK);
    // Held on the far side of the chest, off its line as it tries to get round.
    expect(h.x).toBeGreaterThan(chest.x);
    expect(h.x).toBeLessThan(chest.x + 40 * SUB);
    expect({ x: chest.x, y: chest.y }).toEqual(at);
    expect(chest.opened).toBe(false);
  });

  it('lets the Haul hook and the pickups pass over it', () => {
    const run = arena();
    const chest = openRoom(run, 40, 0);
    const h = addHusk(run, 'peeling', 80, { shell: [0], core: 1000 });
    const s = run.state;
    s.room.timer = -1_000_000;
    const events = step(run, Button.Ability1, EAST);
    events.push(...stepUntil(run, () => s.player.action === 'idle', 400, 0, EAST));
    expect(events.filter((e) => e.type === 'haulHit')).toEqual([
      expect.objectContaining({ id: h.id }),
    ]);
    expect(chest.opened).toBe(false);
    // A Sparkglass piece scattered west over the chest from beyond it reaches the Kindled.
    s.pickups.push({ id: 901, x: chest.x + 20 * SUB, y: chest.y, vx: -6 * SUB, vy: 0, value: 1 });
    s.husks = [];
    const got = stepUntil(run, () => s.pickups.length === 0, 300, 0, HALF_TURN);
    expect(got.some((e) => e.type === 'pickup')).toBe(true);
  });

  it('pushes a body the whole overlap along the line of centres, in integer units', () => {
    const chest: ChestState = { id: 1, x: 1000, y: 1000, opened: false };
    const b = { x: 1000 - 300, y: 1000 - 400 };
    // 500 apart, radii 400 + 400: pushed 300 out along (-3, -4) / 5, to a unit (idiv truncates like the bodies' push-out).
    expect(collideChests([chest], b, 400, 400)).toBe(true);
    expect(Math.abs(b.x - (1000 - 480))).toBeLessThanOrEqual(1);
    expect(Math.abs(b.y - (1000 - 640))).toBeLessThanOrEqual(1);
    // The unit left settles within a pass or two; then nothing pushes.
    for (let i = 0; i < 3 && collideChests([chest], b, 400, 400); i++);
    expect(collideChests([chest], b, 400, 400)).toBe(false);
    expect(length(b.x - chest.x, b.y - chest.y)).toBeGreaterThanOrEqual(800);
    // Dead on the centre: east, like two bodies on one point.
    const c = { x: 1000, y: 1000 };
    collideChests([chest], c, 100, 100);
    expect(c).toEqual({ x: 1200, y: 1000 });
  });

  it("keeps the template chests of a run solid: the first room's chest stops the bot at its edge", () => {
    const run = arena(tuning, 3);
    const s = run.state;
    const chest = s.chests[0];
    expect(chest).toBeDefined();
    if (!chest) return;
    const p = s.player;
    p.x = chest.x - 30 * SUB;
    p.y = chest.y;
    move(run, 60, EAST);
    expect(length(p.x - chest.x, p.y - chest.y)).toBeGreaterThanOrEqual(minDist(run) - SLACK);
    expect(chest.opened).toBe(true);
  });
});
