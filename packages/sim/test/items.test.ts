import { roomTemplates } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  createRun,
  findTiles,
  giveItem,
  isArmored,
  SUB,
  type Run,
  type SimEvent,
} from '../src/index.js';
import {
  addHusk,
  arena,
  Button,
  retune,
  step,
  steps,
  stepUntil,
  tuning,
  WEAPON,
} from './helpers.js';

describe('perfect dodge: cooldown refund', () => {
  /** A Peeling lunges at a stationary player; `dodgeBefore` ticks before the hit the player dodges. */
  function run(
    dodgeBefore: number | null,
    hitTick = 0,
  ): { run: Run; events: SimEvent[]; tick: number } {
    const r = arena();
    retune(r, (t) => {
      t.dodge.speed = 0;
      t.dodge.exitSpeedFactor = 0;
      t.perfectDodge.marginPx = 0;
    });
    const p = r.state.player;
    p.cooldowns = [300, 100, 0];
    addHusk(r, 'peeling', 40, {
      action: 'windup',
      t: r.params.husks.peeling.startup - 3,
      attackDir: 2048,
    });
    const events: SimEvent[] = [];
    for (let i = 1; i <= 40; i++) {
      const press = dodgeBefore !== null && i === hitTick - dodgeBefore;
      events.push(...step(r, press ? Button.Dodge : 0));
      if (events.some((e) => e.type === 'playerHurt' || e.type === 'perfectDodge'))
        return { run: r, events, tick: i };
    }
    return { run: r, events, tick: -1 };
  }

  it('takes the refund off every ability cooldown, never below zero', () => {
    const base = run(null);
    expect(base.events.some((e) => e.type === 'playerHurt')).toBe(true);
    const r = run(2, base.tick);
    expect(r.events.some((e) => e.type === 'perfectDodge')).toBe(true);
    const refund = r.run.params.perfect.cooldownRefund;
    expect(refund).toBe(120);
    const elapsed = r.tick;
    expect(r.run.state.player.cooldowns).toEqual([300 - elapsed - refund, 0, 0]);
  });

  it('an ordinary (early) dodge refunds nothing', () => {
    const base = run(null);
    const r = run(base.run.params.dodge.active + 1, base.tick);
    expect(r.events.some((e) => e.type === 'perfectDodge')).toBe(false);
    expect(r.run.state.player.cooldowns[0]).toBe(300 - r.tick);
  });
});

describe('consumables: the Ration', () => {
  it('two slots; Rations stack to 5 and go onto an existing stack first', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    expect(p.items).toHaveLength(2);
    expect(giveItem(p, P, 'ration', 2)).toBe(2);
    expect(p.items).toEqual([
      { id: 'ration', count: 2 },
      { id: '', count: 0 },
    ]);
    expect(giveItem(p, P, 'ration', 7)).toBe(3);
    expect(p.items[0]).toEqual({ id: 'ration', count: 5 });
    expect(giveItem(p, P, 'nope', 1)).toBe(0);
  });

  it('heals 30% of max HP over 5 s, consuming one Ration', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    giveItem(p, P, 'ration', 2);
    p.hp = 40;
    const events = step(run, Button.Item1);
    expect(events).toContainEqual({ type: 'itemUsed', slot: 0, id: 'ration' });
    expect(p.items[0]).toEqual({ id: 'ration', count: 1 });
    const duration = P.consumables.kinds[0]?.duration ?? 0;
    expect(duration).toBe(300);
    steps(run, duration / 2 - 1);
    expect(p.hp).toBe(40 + 15);
    steps(run, duration / 2);
    expect(p.hp).toBe(70);
    steps(run, 60);
    expect(p.hp).toBe(70);
    expect([p.healLeft, p.healPool]).toEqual([0, 0]);
  });

  it('never heals past max HP; the second slot works with its own key; empty slots do nothing', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    p.items[1] = { id: 'ration', count: 1 };
    p.hp = 90;
    step(run, Button.Item2);
    expect(p.items[1]).toEqual({ id: '', count: 0 });
    steps(run, 400);
    expect(p.hp).toBe(P.player.maxHp);
    const events = step(run, Button.Item1 | Button.Item2);
    expect(events.some((e) => e.type === 'itemUsed')).toBe(false);
  });

  it('using a second Ration while one runs adds its heal and restarts the clock', () => {
    const run = arena();
    const p = run.state.player;
    giveItem(p, run.params, 'ration', 2);
    p.hp = 10;
    step(run, Button.Item1);
    steps(run, 150);
    step(run, Button.Item1);
    // The clock restarts on the press tick, which also heals its first tick.
    expect(p.healLeft).toBe(299);
    steps(run, 299);
    expect(p.hp).toBe(10 + 30 + 30);
  });
});

describe('chests', () => {
  it('every room template has a chest tile', () => {
    for (const t of roomTemplates)
      expect(
        t.tiles.some((row) => row.includes('C')),
        t.name,
      ).toBe(true);
  });

  it('opens on contact; the first chest of the run gives 2 Rations, later ones follow the script', () => {
    const run = createRun({ seed: 3, tuning, rooms: roomTemplates, weapon: WEAPON });
    const s = run.state;
    const p = s.player;
    expect(s.chests).toHaveLength(1);
    const chest = s.chests[0];
    if (!chest) return;
    p.x = chest.x + 20 * SUB;
    p.y = chest.y;
    step(run);
    expect(chest.opened).toBe(false);
    p.x = chest.x + 4 * SUB;
    const events = step(run);
    expect(events).toContainEqual({
      type: 'chestOpened',
      id: chest.id,
      x: chest.x,
      y: chest.y,
      item: 'ration',
      count: 2,
    });
    expect(chest.opened).toBe(true);
    expect(p.items[0]).toEqual({ id: 'ration', count: 2 });
    expect(s.chestsOpened).toBe(1);
    step(run);
    expect(p.items[0]?.count).toBe(2);

    // Next room: a new chest, scripted as the second one.
    s.room.timer = -1_000_000;
    s.room.phase = 'cleared';
    s.room.doorOpen = true;
    const door = findTiles(s.room, 'D')[0];
    p.x = door?.x ?? 0;
    p.y = door?.y ?? 0;
    step(run);
    expect(s.roomIndex).toBe(1);
    const next = s.chests[0];
    expect(next?.opened).toBe(false);
    p.x = next?.x ?? 0;
    p.y = next?.y ?? 0;
    const more = step(run);
    expect(more.find((e) => e.type === 'chestOpened')).toMatchObject({ item: 'ration', count: 1 });
    expect(p.items[0]).toEqual({ id: 'ration', count: 3 });
  });
});

describe('Nutshell shells', () => {
  it('has an outer layer of 30 and an inner layer of 20', () => {
    expect(tuning.husks.nutshell.shell).toEqual([30, 20]);
    expect(arena().params.husks.nutshell.innerRegrow).toBe(480);
  });

  it('the inner layer regrows 8 s after its last hit if it was not broken', () => {
    const run = arena();
    const h = addHusk(run, 'nutshell', 60, { shell: [0, 7], sinceHit: 0 });
    const regrow = run.params.husks.nutshell.innerRegrow;
    const events = steps(run, regrow - 2);
    expect(h.shell).toEqual([0, 7]);
    expect(events.some((e) => e.type === 'shellRegrow')).toBe(false);
    const more = steps(run, 2);
    expect(h.shell).toEqual([0, 20]);
    expect(more).toContainEqual({ type: 'shellRegrow', id: h.id, kind: 'nutshell' });
  });

  it('a broken inner layer stays broken, and the outer never regrows', () => {
    const run = arena();
    const h = addHusk(run, 'nutshell', 60, { shell: [12, 0], sinceHit: 0 });
    steps(run, run.params.husks.nutshell.innerRegrow + 5);
    expect(h.shell).toEqual([12, 0]);
    const chipped = addHusk(run, 'nutshell', 80, { shell: [12, 20], sinceHit: 0 });
    steps(run, run.params.husks.nutshell.innerRegrow + 5);
    expect(chipped.shell).toEqual([12, 20]);
  });

  it('a hit restarts the regrow clock', () => {
    const run = arena();
    retune(run, (t) => {
      t.husks.nutshell.speed = 0;
    });
    const p = run.state.player;
    const h = addHusk(run, 'nutshell', 18, { shell: [0, 15], sinceHit: 400 });
    step(run, Button.Light);
    stepUntil(run, () => p.hitIds.length > 0);
    expect(h.shell[1]).toBeLessThan(15);
    expect(h.sinceHit).toBeLessThan(5);
    steps(run, run.params.husks.nutshell.innerRegrow - 10);
    expect(h.shell[1]).toBeLessThan(15);
    steps(run, 12);
    expect(h.shell[1]).toBe(20);
  });

  it('the Peeling has no regrow', () => {
    const run = arena();
    const h = addHusk(run, 'peeling', 60, { shell: [3], sinceHit: 0 });
    steps(run, 600);
    expect(h.shell).toEqual([3]);
  });
});

describe('armor from events', () => {
  it('p.armor counts down and armors the player whatever they do', () => {
    const run = arena();
    const p = run.state.player;
    p.armor = 3;
    expect(isArmored(p, run.params)).toBe(true);
    steps(run, 3);
    expect(isArmored(p, run.params)).toBe(false);
  });
});
