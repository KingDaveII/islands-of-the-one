import { roomTemplates } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  autopilot,
  createRun,
  findTiles,
  hashRunState,
  replayRun,
  runResults,
  stepRun,
  type Run,
  type Tuning,
} from '../src/index.js';
import golden from './fixtures/golden-tuning.json' with { type: 'json' };
import { cloneTuning, retune, step, steps, stepUntil, tuning } from './helpers.js';

function drive(run: Run, maxTicks: number, reckless = false): void {
  for (let i = 0; i < maxTicks && run.state.status === 'playing'; i++) {
    stepRun(run, autopilot(run.state, run.params, { reckless }));
  }
}

describe('run flow', () => {
  it('rooms come from the templates in a seed-chosen order', () => {
    const a = createRun({ seed: 1, tuning, rooms: roomTemplates });
    const b = createRun({ seed: 1, tuning, rooms: roomTemplates });
    expect(a.state.roomOrder).toEqual(b.state.roomOrder);
    expect(a.state.roomOrder).toHaveLength(3);
    expect(new Set(a.state.roomOrder).size).toBe(3);
    const orders = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      orders.add(createRun({ seed, tuning, rooms: roomTemplates }).state.roomOrder.join());
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it('spawns waves, opens the door when cleared, and moves to the next room', () => {
    const run = createRun({ seed: 3, tuning, rooms: roomTemplates });
    const s = run.state;
    stepUntil(run, () => s.husks.length > 0);
    expect(s.room.phase).toBe('fighting');
    expect(s.room.doorOpen).toBe(false);
    const waves = run.params.run.rooms[0]?.waves.length ?? 0;
    for (let w = 0; w < waves; w++) {
      stepUntil(run, () => s.husks.length > 0);
      s.husks = [];
      step(run);
    }
    expect(s.room.phase).toBe('cleared');
    expect(s.room.doorOpen).toBe(true);
    const door = findTiles(s.room, 'D')[0];
    expect(door).toBeDefined();
    s.player.x = door?.x ?? 0;
    s.player.y = door?.y ?? 0;
    const events = step(run);
    expect(events).toContainEqual({ type: 'roomEnter', index: 1 });
    expect(s.roomIndex).toBe(1);
    expect(s.room.template).toBe(s.roomOrder[1]);
  });

  it('room 3 includes Nutshells', () => {
    const waves = tuning.run.rooms[2]?.waves ?? [];
    expect(waves.some((w) => w.nutshell > 0)).toBe(true);
  });

  it('a clear keeps all Sparkglass', () => {
    const run = createRun({ seed: 11, tuning, rooms: roomTemplates });
    drive(run, 60 * 60 * 5);
    expect(run.state.status).toBe('cleared');
    const r = runResults(run);
    expect(r.roomsCleared).toBe(3);
    expect(r.sparkglassKept).toBe(r.sparkglassCollected);
    expect(r.sparkglassCollected).toBeGreaterThan(0);
    expect(r.kills).toBe(27);
  });

  it('death ends the run and keeps half the Sparkglass', () => {
    const run = createRun({ seed: 5, tuning, rooms: roomTemplates });
    drive(run, 60 * 20);
    run.state.sparkglass = 9;
    // Stop fighting back.
    for (let i = 0; i < 60 * 120 && run.state.status === 'playing'; i++) stepRun(run, 0);
    expect(run.state.status).toBe('dead');
    expect(run.state.player.hp).toBe(0);
    const r = runResults(run);
    expect(r.sparkglassCollected).toBeGreaterThanOrEqual(9);
    expect(r.sparkglassKept).toBe(Math.floor(r.sparkglassCollected / 2));
    const ticks = run.state.tick;
    stepRun(run, 0);
    expect(run.state.tick).toBe(ticks);
  });

  it('carrying Sparkglass makes Husks pursue faster', () => {
    const calm = createRun({ seed: 2, tuning, rooms: roomTemplates });
    const eager = createRun({ seed: 2, tuning, rooms: roomTemplates });
    eager.state.sparkglass = 50;
    const dist = (r: Run) => {
      stepUntil(r, () => r.state.husks.some((h) => h.action === 'chase'));
      steps(r, 20);
      const p = r.state.player;
      return Math.min(...r.state.husks.map((h) => Math.hypot(h.x - p.x, h.y - p.y)));
    };
    expect(dist(eager)).toBeLessThan(dist(calm));
  });
});

describe('replay determinism', () => {
  it('same seed + inputs => identical final state hash', () => {
    const run = createRun({ seed: 1234, tuning, rooms: roomTemplates });
    drive(run, 60 * 60 * 5);
    expect(run.record.inputs.length).toBe(run.state.tick);
    const again = replayRun(run.record);
    expect(hashRunState(again.state)).toBe(hashRunState(run.state));
    expect(again.state).toEqual(run.state);
  });

  it('a different seed diverges', () => {
    const a = createRun({ seed: 1, tuning, rooms: roomTemplates });
    const b = createRun({ seed: 2, tuning, rooms: roomTemplates });
    drive(a, 600);
    drive(b, 600);
    expect(hashRunState(a.state)).not.toBe(hashRunState(b.state));
  });

  it('live tuning changes are part of the record and replay exactly', () => {
    const run = createRun({ seed: 99, tuning, rooms: roomTemplates });
    drive(run, 400);
    retune(run, (t) => {
      t.player.moveSpeed *= 1.5;
      t.husks.peeling.speed = 30;
    });
    drive(run, 900);
    retune(run, (t) => {
      t.dodge.iframesMs = 50;
    });
    drive(run, 900);
    expect(run.record.tuningChanges).toHaveLength(2);
    const again = replayRun(run.record);
    expect(hashRunState(again.state)).toBe(hashRunState(run.state));

    // Without the recorded changes the run plays out differently.
    const without = replayRun({ ...run.record, tuningChanges: [] });
    expect(hashRunState(without.state)).not.toBe(hashRunState(run.state));
  });

  it('records survive a JSON round trip', () => {
    const run = createRun({ seed: 42, tuning, rooms: roomTemplates });
    drive(run, 1500);
    const record = JSON.parse(JSON.stringify(run.record)) as typeof run.record;
    expect(hashRunState(replayRun(record).state)).toBe(hashRunState(run.state));
  });

  it('is pinned to a golden hash (frozen tuning fixture; update only for intentional sim changes)', () => {
    const t: Tuning = golden;
    const run = createRun({ seed: 2024, tuning: t, rooms: roomTemplates });
    drive(run, 60 * 30);
    expect(hashRunState(run.state)).toMatchInlineSnapshot(`967887538`);
  });

  it('cloneTuning does not alias the data file', () => {
    const t = cloneTuning();
    t.player.maxHp = 1;
    expect(tuning.player.maxHp).not.toBe(1);
  });
});
