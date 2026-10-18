import { defaultTuning, holdingLayout, holdingRoomTiles, holdingStart } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  compileRoam,
  createRoam,
  encodeInput,
  hashRoamState,
  length,
  replayRoam,
  roamSpeedFactor,
  stepRoam,
  SUB,
  TICK_HZ,
  tileCentre,
  TILE_PX,
  type Roam,
  type RoamConfig,
} from '../src/index.js';

/**
 * Roaming (docs/design/holding.md): the walk, the automatic run after
 * `runAfterMs` of moving, the ramp, the reset on a stop and on a sharp turn,
 * the stick threshold, the facing, the collision with the layout's solids,
 * and the replay: the same inputs give the same hash.
 */
const layout = holdingLayout();
const start = tileCentre(holdingStart(layout).col, holdingStart(layout).row);
const config: RoamConfig = {
  template: { name: layout.id, tiles: holdingRoomTiles(layout) },
  start,
  tuning: { player: defaultTuning.player, roam: defaultTuning.roam },
};
const roam = (): Roam => createRoam(config);
/** Move directions in 1/256 turn. */
const E = 0;
const S = 64;
const W = 128;
const NE = 224;
const move = (dir: number, mag = 7): number => encodeInput({ aim: 0, moveDir: dir, moveMag: mag, buttons: 0 });
const still = encodeInput({ aim: 0, moveDir: 0, moveMag: 0, buttons: 0 });
const ticks = (ms: number): number => Math.round((ms * TICK_HZ) / 1000);
const speedOf = (r: Roam): number => length(r.state.vx, r.state.vy);
const steps = (r: Roam, n: number, input: number): void => {
  for (let i = 0; i < n; i++) stepRoam(r, input);
};

describe('the roam parameters', () => {
  it("compile tuning.json's roam block into integers: 0.7 of the run, 1200 ms, 400 ms, 90°, a stick under 0.6 walks, a 250 ms dip grace", () => {
    const P = compileRoam(defaultTuning.player, defaultTuning.roam);
    expect(P.speed).toBe(Math.round((100 * SUB) / TICK_HZ));
    expect(P.walk).toBe(700);
    expect(P.runAfter).toBe(72);
    expect(P.ramp).toBe(24);
    expect(P.resetTurn).toBe(1024);
    expect(P.walkMagMax).toBe(4);
    expect(P.dipGrace).toBe(15);
    expect(P.radius).toBe(6 * SUB);
    expect(roamSpeedFactor(P, 0)).toBe(700);
    expect(roamSpeedFactor(P, 72)).toBe(700);
    expect(roamSpeedFactor(P, 84)).toBe(850);
    expect(roamSpeedFactor(P, 96)).toBe(1000);
    expect(roamSpeedFactor(P, 600)).toBe(1000);
  });
});

describe('walking and running', () => {
  it('starts at the layout start, facing south, standing still', () => {
    const r = roam();
    expect(r.state.x).toBe(start.x * SUB);
    expect(r.state.y).toBe(start.y * SUB);
    expect(r.state.facing).toBe(1024);
    expect(r.state.gait).toBe('walk');
    expect(r.state.tick).toBe(0);
  });

  it('walks at 0.7 of the run speed, then breaks into a run after 1200 ms and reaches full speed 400 ms later', () => {
    const r = roam();
    const P = r.params;
    const full = P.speed;
    steps(r, ticks(1200), move(E));
    expect(r.state.gait).toBe('walk');
    expect(speedOf(r)).toBe(Math.trunc((full * 700) / 1000));
    stepRoam(r, move(E));
    expect(r.state.gait).toBe('run');
    steps(r, ticks(400) - 1, move(E));
    // The target reaches the full speed on the last ramp tick; the body follows at its acceleration.
    steps(r, 10, move(E));
    expect(speedOf(r)).toBe(full);
    expect(r.state.facing).toBe(0);
  });

  it('keeps the walk while the body turns gently, and drops the run on a stop and on a sharp turn', () => {
    const r = roam();
    steps(r, ticks(1600) + 10, move(E));
    expect(r.state.gait).toBe('run');
    expect(speedOf(r)).toBe(r.params.speed);
    // 45° (NE): the run carries on.
    stepRoam(r, move(NE));
    expect(r.state.gait).toBe('run');
    expect(r.state.facing).toBe(3584);
    // A stop: back to a walk, the facing kept.
    stepRoam(r, still);
    expect(r.state.gait).toBe('walk');
    expect(r.state.movingTicks).toBe(0);
    expect(r.state.facing).toBe(3584);
    // Moving again waits the full 1200 ms.
    steps(r, ticks(1200), move(E));
    expect(r.state.gait).toBe('walk');
    stepRoam(r, move(E));
    expect(r.state.gait).toBe('run');
    // A sharp turn (180°) drops it and restarts the clock from that tick.
    stepRoam(r, move(W));
    expect(r.state.gait).toBe('walk');
    expect(r.state.movingTicks).toBe(1);
    expect(r.state.facing).toBe(2048);
    // Exactly 90° is not a sharp turn; past it is.
    const q = roam();
    steps(q, ticks(1200) + 1, move(E));
    expect(q.state.gait).toBe('run');
    stepRoam(q, move(S));
    expect(q.state.gait).toBe('run');
    stepRoam(q, move(S + 1));
    expect(q.state.gait).toBe('run');
    stepRoam(q, move(S + 66));
    expect(q.state.gait).toBe('walk');
  });

  it('always walks on a stick pushed less than 0.6; the keyboard counts as a full push', () => {
    const light = roam();
    steps(light, ticks(1500), move(E, 4));
    expect(light.state.gait).toBe('walk');
    expect(light.state.movingTicks).toBe(0);
    expect(speedOf(light)).toBe(Math.trunc((Math.trunc((light.params.speed * 4) / 7) * 700) / 1000));
    const firm = roam();
    steps(firm, ticks(1200) + 1, move(E, 5));
    expect(firm.state.gait).toBe('run');
    // Easing the stick back to a light push for longer than the grace drops the run.
    steps(firm, ticks(250) + 1, move(E, 3));
    expect(firm.state.gait).toBe('walk');
    expect(firm.state.movingTicks).toBe(0);
    // A light push from a standstill never starts the clock, grace or not.
    const light2 = roam();
    steps(light2, 5, move(E, 3));
    expect(light2.state.movingTicks).toBe(0);
    expect(light2.state.dipTicks).toBe(5);
  });

  it("keeps the run clock through a dip under 60% shorter than 250 ms, and resets it on a longer one (GAME DESIGN 2026-10-18)", () => {
    // A 200 ms dip to a light push: the run goes on, the clock still counting.
    const wobble = roam();
    steps(wobble, ticks(1600), move(E));
    expect(wobble.state.gait).toBe('run');
    const before = wobble.state.movingTicks;
    steps(wobble, ticks(200), move(E, 3));
    expect(wobble.state.gait).toBe('run');
    expect(wobble.state.movingTicks).toBe(before + ticks(200));
    expect(wobble.state.dipTicks).toBe(ticks(200));
    stepRoam(wobble, move(E));
    expect(wobble.state.gait).toBe('run');
    expect(wobble.state.dipTicks).toBe(0);
    // A 300 ms dip: the clock resets on the tick past the grace and the run drops; the next full push starts it over.
    const slip = roam();
    steps(slip, ticks(1600), move(E));
    steps(slip, ticks(250), move(E, 3));
    expect(slip.state.gait).toBe('run');
    stepRoam(slip, move(E, 3));
    expect(slip.state.gait).toBe('walk');
    expect(slip.state.movingTicks).toBe(0);
    steps(slip, ticks(300) - ticks(250) - 1, move(E, 3));
    expect(slip.state.movingTicks).toBe(0);
    steps(slip, ticks(1200), move(E));
    expect(slip.state.gait).toBe('walk');
    stepRoam(slip, move(E));
    expect(slip.state.gait).toBe('run');
    // A stop in the dip is still a stop: no grace.
    const stop = roam();
    steps(stop, ticks(1600), move(E));
    stepRoam(stop, still);
    expect(stop.state.gait).toBe('walk');
    expect(stop.state.movingTicks).toBe(0);
  });

  it("stays inside the edge and out of the stations' tiles (the same wall collision as the rooms)", () => {
    const r = roam();
    // Run north for a long time up the path west of the post (col 13): the edge stops the body a radius short of row 0's bottom.
    r.state.x = tileCentre(13, 15).x * SUB;
    steps(r, 60 * 20, move(192));
    expect(r.state.y).toBe(TILE_PX * SUB + r.params.radius);
    // The Writ post is a solid tile at (14, 13): walking into it from the start stops short.
    const q = roam();
    steps(q, 60 * 5, move(192));
    expect(q.state.y).toBeGreaterThanOrEqual((13 + 1) * TILE_PX * SUB + q.params.radius);
    // A tree (cols 4-5, rows 10-11): walking west along row 10 stops at its east side.
    const w = roam();
    w.state.y = tileCentre(0, 10).y * SUB;
    steps(w, 60 * 10, move(W));
    expect(w.state.x).toBe(6 * TILE_PX * SUB + w.params.radius);
    // The reserved weapon rack (cols 17-18, row 13) is plain ground: walking east along row 13 crosses it and stops at the outcrop (col 23).
    const e = roam();
    e.state.y = tileCentre(0, 13).y * SUB;
    e.state.x = tileCentre(16, 13).x * SUB;
    steps(e, 60 * 10, move(E));
    expect(e.state.x).toBe(23 * TILE_PX * SUB - e.params.radius);
  });
});

describe('determinism', () => {
  it('gives the same hash for the same inputs, and the record replays to it', () => {
    const script = [
      ...Array.from({ length: 100 }, () => move(E)),
      ...Array.from({ length: 30 }, () => move(S, 3)),
      ...Array.from({ length: 10 }, () => still),
      ...Array.from({ length: 200 }, () => move(W)),
      ...Array.from({ length: 50 }, () => move(NE, 6)),
    ];
    const a = roam();
    const b = roam();
    for (const input of script) {
      stepRoam(a, input);
      stepRoam(b, input);
    }
    expect(hashRoamState(a.state)).toBe(hashRoamState(b.state));
    expect(a.state).toEqual(b.state);
    expect(replayRoam(a.record).state).toEqual(a.state);
    expect(hashRoamState(replayRoam(a.record).state)).toBe(hashRoamState(a.state));
    // A different input gives another hash.
    const c = roam();
    for (const input of script.slice(0, -1)) stepRoam(c, input);
    stepRoam(c, move(S));
    expect(hashRoamState(c.state)).not.toBe(hashRoamState(a.state));
    // Every number in the state is an integer (the hash throws otherwise).
    expect(() => hashRoamState(a.state)).not.toThrow();
  });
});
