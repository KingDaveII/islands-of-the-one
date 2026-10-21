import { describe, expect, it } from 'vitest';
import type { Ctx } from '../src/combat.js';
import {
  degToAngle,
  isArmored,
  length,
  pickHaulTarget,
  playerAttackPhase,
  SUB,
  type Haul,
  type Run,
  type SimEvent,
} from '../src/index.js';
import { addHusk, arena, Button, retune, step, steps, stepUntil, WEAPON } from './helpers.js';

const hits = (events: SimEvent[]) => events.filter((e) => e.type === 'hit');
const haulHits = (events: SimEvent[]) =>
  events.filter((e): e is Extract<SimEvent, { type: 'haulHit' }> => e.type === 'haulHit');

function still(run: Run): void {
  retune(run, (t) => {
    t.husks.peeling.speed = 0;
    t.husks.nutshell.speed = 0;
  });
}

function haulParams(run: Run): Haul {
  const h = run.params.weapon.abilities[0]?.haul;
  if (!h) throw new Error('slot 1 is not a Haul');
  return h;
}

/** Press Haul and run it to the end; returns all events. */
function haul(run: Run, aim = 0): SimEvent[] {
  const p = run.state.player;
  const events = step(run, Button.Ability1, aim);
  events.push(...stepUntil(run, () => p.action === 'idle', 400, 0, aim));
  return events;
}

/** A husk at `distPx`, `deg` degrees off the aim (which points along +x). */
function husk(run: Run, kind: 'peeling' | 'nutshell', distPx: number, deg: number, patch = {}) {
  const p = run.state.player;
  const a = (deg * Math.PI) / 180;
  return addHusk(run, kind, 0, {
    x: p.x + Math.round(Math.cos(a) * distPx * SUB),
    y: p.y + Math.round(Math.sin(a) * distPx * SUB),
    shell: [0],
    core: 1000,
    ...patch,
  });
}

describe('Haul: data', () => {
  it('slot 1 is the Haul with its data converted', () => {
    const run = arena();
    const a = run.params.weapon.abilities[0];
    const h = haulParams(run);
    expect([a?.id, a?.kind, a?.locked]).toEqual(['haul', 'haul', false]);
    expect(h.halfCone).toBe(degToAngle(20) >> 1);
    expect(h.range).toBe(112 * SUB);
    expect(h.speed).toBe(10 * SUB); // 600 px/s
    expect([h.pullLight, h.pullMedium, h.playerPull]).toEqual([20 * SUB, 500, 24 * SUB]);
    expect([h.arrivalArmor, h.stagger, h.staggerHeavy, h.comboWindow, h.missRefund]).toEqual([
      6, 36, 24, 24, 500,
    ]);
    expect(a?.cooldown).toBe(480);
  });
});

describe('Haul: targeting', () => {
  it('locks the nearest husk inside the cone and within range', () => {
    const run = arena();
    still(run);
    const far = husk(run, 'peeling', 90, 0);
    const near = husk(run, 'peeling', 60, 7);
    const ctx: Ctx = { s: run.state, P: run.params, events: [] };
    const h = haulParams(run);
    const p = run.state.player;
    expect(pickHaulTarget(ctx, p.x, p.y, 0, h.halfCone, h.range)).toBe(near.id);
    near.core = 0;
    expect(pickHaulTarget(ctx, p.x, p.y, 0, h.halfCone, h.range)).toBe(far.id);
  });

  it('a husk outside the 20 degree cone is not a target; the hook flies along the aim and misses', () => {
    const run = arena();
    still(run);
    const h = husk(run, 'peeling', 60, 16);
    const events = haul(run);
    expect(hits(events)).toHaveLength(0);
    expect(h.core).toBe(1000);
    expect(events.some((e) => e.type === 'haulMiss')).toBe(true);
  });

  it('a husk 7 degrees off the aim is targeted and hit', () => {
    const run = arena();
    still(run);
    const h = husk(run, 'peeling', 60, 7);
    const events = haul(run);
    expect(hits(events)).toHaveLength(1);
    expect(h.core).toBeLessThan(1000);
  });

  it('beyond the range nothing is hooked', () => {
    const run = arena();
    still(run);
    const range = haulParams(run).range / SUB;
    const h = husk(run, 'peeling', range + 12, 0);
    const events = haul(run);
    expect(hits(events)).toHaveLength(0);
    expect(h.core).toBe(1000);
  });

  it('first hit only: a husk in the way takes the hook, the one behind it is untouched', () => {
    const run = arena();
    still(run);
    const front = husk(run, 'peeling', 40, 0);
    const back = husk(run, 'peeling', 80, 0);
    const events = haul(run);
    expect(hits(events).map((e) => ('id' in e ? e.id : -1))).toEqual([front.id]);
    expect(back.core).toBe(1000);
    expect(haulHits(events)).toHaveLength(1);
  });

  it('only Husks are candidates: the player and other bodies (pickups) are never hooked', () => {
    const run = arena();
    const s = run.state;
    const p = s.player;
    s.pickups.push({ id: s.nextId++, x: p.x + 70 * SUB, y: p.y, vx: 0, vy: 0, value: 1 });
    const ctx: Ctx = { s, P: run.params, events: [] };
    const h = haulParams(run);
    expect(pickHaulTarget(ctx, p.x, p.y, 0, h.halfCone, h.range)).toBe(-1);
    const events = haul(run);
    expect(hits(events)).toHaveLength(0);
    expect(s.pickups).toHaveLength(1);
    expect(p.hp).toBe(run.params.player.maxHp);
  });
});

describe('Haul: pull by weight class', () => {
  it('a light husk is pulled all the way to 20 px from the player and staggered 600 ms', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    const h = husk(run, 'peeling', 90, 0);
    const events = haul(run);
    expect(haulHits(events)).toEqual([
      expect.objectContaining({ id: h.id, weightClass: 'light', pull: 'husk' }),
    ]);
    const d = length(h.x - p.x, h.y - p.y);
    expect(Math.abs(d - haulParams(run).pullLight)).toBeLessThanOrEqual(SUB);
    expect(h.stagger).toBe(haulParams(run).stagger);
  });

  it('a medium husk is pulled half the distance', () => {
    const run = arena();
    retune(run, (t) => {
      t.husks.peeling.speed = 0;
      t.husks.peeling.weightClass = 'medium';
    });
    const p = run.state.player;
    const h = husk(run, 'peeling', 90, 0);
    const events = haul(run);
    expect(haulHits(events)[0]?.weightClass).toBe('medium');
    const d = length(h.x - p.x, h.y - p.y);
    const expected = 90 * SUB - Math.trunc((90 * SUB - haulParams(run).pullLight) / 2);
    expect(Math.abs(d - expected)).toBeLessThanOrEqual(SUB);
  });

  it('a heavy husk pulls the player to 24 px from it, with armor frames on arrival', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    const P = run.params;
    const hp = haulParams(run);
    const h = husk(run, 'nutshell', 90, 0, { shell: [0, 0] });
    const x0 = h.x;
    const events = step(run, Button.Ability1, 0);
    events.push(...stepUntil(run, () => p.hook?.pull === 'player', 60));
    expect(haulHits(events)).toEqual([
      expect.objectContaining({ id: h.id, weightClass: 'heavy', pull: 'player' }),
    ]);
    expect(h.stagger).toBe(hp.staggerHeavy);
    // The player slides along the chain; the Nutshell never moves.
    stepUntil(run, () => p.hook === null, 60);
    expect(h.x).toBe(x0);
    const d = length(h.x - p.x, h.y - p.y);
    expect(Math.abs(d - hp.playerPull)).toBeLessThanOrEqual(SUB);
    expect(p.armor).toBe(hp.arrivalArmor);
    expect(isArmored(p, P)).toBe(true);
    steps(run, hp.arrivalArmor);
    expect(isArmored(p, P)).toBe(false);
    expect(p.action).toBe('ability');
    expect(playerAttackPhase(p, P)).toBe('recovery');
  });

  it('the active phase lasts as long as the pull, then recovery', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    const P = run.params;
    const a = P.weapon.abilities[0];
    husk(run, 'nutshell', 100, 0, { shell: [0, 0] });
    step(run, Button.Ability1, 0);
    let active = 0;
    while (playerAttackPhase(p, P) !== 'recovery') {
      if (playerAttackPhase(p, P) === 'active') active++;
      step(run);
    }
    expect(active).toBeGreaterThan(a?.active ?? 0);
  });
});

describe('Haul: combo step and miss refund', () => {
  it('a light within the window after a Haul hit starts at combo hit 3', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    husk(run, 'peeling', 60, 0);
    haul(run);
    expect(p.haulCombo).toBeGreaterThan(0);
    step(run, Button.Light);
    expect([p.action, p.comboStep]).toEqual(['light', run.params.weapon.light.length - 1]);
  });

  it('light held through the Haul comes out at combo hit 3 (holding light, GAME DESIGN 2026-10-21)', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    husk(run, 'peeling', 60, 0);
    step(run, Button.Ability1 | Button.Light, 0);
    expect(p.action).toBe('ability');
    stepUntil(run, () => p.action === 'light', 300, Button.Light);
    expect(p.comboStep).toBe(run.params.weapon.light.length - 1);
  });

  it('after the window a light starts at hit 1 again', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    husk(run, 'peeling', 60, 0);
    haul(run);
    steps(run, haulParams(run).comboWindow + 1);
    expect(p.haulCombo).toBe(0);
    step(run, Button.Light);
    expect([p.action, p.comboStep]).toEqual(['light', 0]);
  });

  it('the window opens when the chain lets go and outlasts the recovery, even after the longer player pull', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    const P = run.params;
    husk(run, 'nutshell', 100, 0, { shell: [0, 0] });
    step(run, Button.Ability1, 0);
    stepUntil(run, () => p.hook?.pull === 'player', 60);
    const atHit = p.haulCombo;
    stepUntil(run, () => p.hook === null, 60);
    expect(p.haulCombo).toBe(atHit);
    stepUntil(run, () => p.action === 'idle');
    expect(p.haulCombo).toBeGreaterThan(0);
    // A press buffered in the last part of the recovery fires on the first idle tick.
    const run2 = arena();
    still(run2);
    const p2 = run2.state.player;
    husk(run2, 'peeling', 60, 0);
    step(run2, Button.Ability1, 0);
    stepUntil(run2, () => playerAttackPhase(p2, P) === 'recovery');
    const a = P.weapon.abilities[0];
    const end = (a?.startup ?? 0) + (a?.active ?? 0) + (a?.recovery ?? 0);
    stepUntil(run2, () => p2.t === end - 2);
    step(run2, Button.Light);
    expect(p2.action).toBe('ability');
    stepUntil(run2, () => p2.action !== 'ability');
    expect([p2.action, p2.comboStep]).toEqual(['light', 2]);
  });

  it('a miss refunds half the cooldown; a hit does not', () => {
    const miss = arena();
    const a = miss.params.weapon.abilities[0];
    const events = haul(miss);
    const refund = events.find(
      (e): e is Extract<SimEvent, { type: 'haulMiss' }> => e.type === 'haulMiss',
    );
    expect(refund?.refund).toBe(Math.trunc((a?.cooldown ?? 0) / 2));
    const spent = miss.state.tick - 1;
    expect(miss.state.player.cooldowns[0]).toBe((a?.cooldown ?? 0) - (refund?.refund ?? 0) - spent);

    const hit = arena();
    still(hit);
    husk(hit, 'peeling', 60, 0);
    haul(hit);
    expect(hit.state.player.cooldowns[0]).toBeGreaterThan(
      (a?.cooldown ?? 0) - (refund?.refund ?? 0) - spent,
    );
  });

  it('the hook snags on a wall and misses', () => {
    const run = arena();
    const p = run.state.player;
    // Aim at the wall left of the start: the room edge is closer than the range.
    const events = haul(run, 2048);
    expect(events.some((e) => e.type === 'haulMiss')).toBe(true);
    expect(p.action).toBe('idle');
  });

  it('getting hit during the flight drops the hook', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    addHusk(run, 'peeling', 14, {
      action: 'attack',
      t: 0,
      attackDir: 2048,
      attackHit: false,
      y: run.state.player.y - 8 * SUB,
    });
    step(run, Button.Ability1, 0);
    stepUntil(run, () => p.action === 'hurt' || p.action === 'idle', 30);
    expect(p.action).toBe('hurt');
    expect(p.hook).toBeNull();
  });
});

describe('Lunge is gone', () => {
  it('no ability kind dashes along the aim any more', () => {
    const run = arena();
    expect(run.params.weapon.abilities.map((a) => a.kind)).toEqual(['haul', 'none', 'spin']);
    expect(() => {
      retune(run, (t) => {
        const a = t.weapons[WEAPON]?.abilities[0];
        if (a) a.kind = 'dash-strike';
      });
    }).toThrow(/unknown ability kind/);
  });
});
