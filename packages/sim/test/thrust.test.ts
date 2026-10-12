import { describe, expect, it } from 'vitest';
import {
  heavyHit,
  heavyTiming,
  isArmored,
  playerAttackPhase,
  SUB,
  type Run,
  type SimEvent,
} from '../src/index.js';
import {
  addHusk,
  arena,
  Button,
  chargeFull,
  retune,
  step,
  steps,
  stepUntil,
  WEAPON,
} from './helpers.js';

const hits = (events: SimEvent[]) => events.filter((e) => e.type === 'hit');

/** Husks stand still and the thrust does not step forward, so distances are exact. */
function fixed(run: Run): void {
  retune(run, (t) => {
    t.husks.peeling.speed = 0;
    t.husks.nutshell.speed = 0;
    const w = t.weapons[WEAPON];
    if (w) {
      w.heavy.tap.stepSpeed = 0;
      w.heavy.charged.stepSpeed = 0;
    }
  });
}

/** Tap the heavy (held for 2 ticks) and run the thrust to the end; returns its events. */
function tap(run: Run): SimEvent[] {
  const p = run.state.player;
  const events = steps(run, 2, Button.Heavy, 0);
  events.push(...step(run, 0, 0));
  expect(p.action).toBe('heavy');
  events.push(...stepUntil(run, () => p.action === 'idle'));
  return events;
}

describe('Hook-thrust hitbox: a rectangle along the aim, not a cone', () => {
  it('reaches straight ahead for its length and no further', () => {
    const P = arena().params;
    const length = P.weapon.heavy.length / SUB;
    const r = P.husks.peeling.radius / SUB;
    for (const [dist, hit] of [
      [length + r - 1, true],
      [length + r + 1, false],
      [12, true],
    ] as const) {
      const run = arena();
      fixed(run);
      addHusk(run, 'peeling', dist, { shell: [0], core: 1000 });
      expect(hits(tap(run)).length, `at ${dist}px`).toBe(hit ? 1 : 0);
    }
  });

  it('is only as wide as the thrust: a husk beside the line is missed, one on it is hit', () => {
    const P = arena().params;
    const half = P.weapon.heavy.halfWidth / SUB;
    const r = P.husks.peeling.radius / SUB;
    expect(half).toBe(6);
    for (const [side, hit] of [
      [half + r - 1, true],
      [half + r + 1, false],
    ] as const) {
      const run = arena();
      fixed(run);
      addHusk(run, 'peeling', 20, { shell: [0], core: 1000, y: run.state.player.y + side * SUB });
      expect(hits(tap(run)).length, `${side}px beside the line`).toBe(hit ? 1 : 0);
    }
  });

  it('misses what the old cone would have caught: a husk 60 degrees off the aim at close range', () => {
    const run = arena();
    fixed(run);
    const p = run.state.player;
    // 60° off: well inside a 220° arc, outside a 12 px wide line.
    addHusk(run, 'peeling', 0, { shell: [0], core: 1000, x: p.x + 10 * SUB, y: p.y + 17 * SUB });
    expect(hits(tap(run))).toHaveLength(0);
  });
});

describe('charge levels', () => {
  it('data: tap 1.2x the first light, charged 1.8x to 2.6x, poise 20 and 30-45', () => {
    const P = arena().params;
    const light = P.weapon.light[0]?.damage ?? 0;
    const h = P.weapon.heavy;
    expect(h.tap.damage).toBe(Math.round(light * 1.2));
    expect(h.charged.damage).toEqual([Math.round(light * 1.8), Math.round(light * 2.6)]);
    expect(h.tap.shellDamage).toBe(20);
    expect(h.charged.shellDamage).toEqual([30, 45]);
    expect([h.tap.startup, h.tap.active, h.tap.recovery]).toEqual([10, 6, 18]);
    expect([h.charged.startup, h.charged.active, h.charged.recovery]).toEqual([5, 7, 23]);
    expect([h.chargeMin, h.chargeMax, h.hold, h.hitstop]).toEqual([12, 36, 9, 7]);
  });

  it('a hold shorter than the charge window is the tap; longer holds scale the charged thrust', () => {
    const P = arena().params;
    const h = P.weapon.heavy;
    const at = (charge: number) => heavyHit(P, charge);
    expect(at(0).damage).toBe(h.tap.damage);
    expect(at(h.chargeMin - 1).damage).toBe(h.tap.damage);
    expect(heavyTiming(P, h.chargeMin - 1).startup).toBe(h.tap.startup);
    expect([at(h.chargeMin).damage, at(h.chargeMin).shellDamage]).toEqual([
      h.charged.damage[0],
      h.charged.shellDamage[0],
    ]);
    expect([at(h.chargeMax).damage, at(h.chargeMax).shellDamage]).toEqual([
      h.charged.damage[1],
      h.charged.shellDamage[1],
    ]);
    const mid = at((h.chargeMin + h.chargeMax) >> 1);
    expect(mid.damage).toBeGreaterThan(h.charged.damage[0]);
    expect(mid.damage).toBeLessThan(h.charged.damage[1]);
    expect(heavyTiming(P, h.chargeMax).startup).toBe(h.charged.startup);
    // Every thrust pins and never knocks back.
    expect([at(0).knockback, at(0).hold, at(0).shove]).toEqual([0, h.hold, h.shove]);
    expect(at(h.chargeMax).hitstop).toBe(h.hitstop);
  });

  it('the charge caps at the window and keeps the thrust at its strongest while held longer', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    stepUntil(run, () => p.charge >= P.weapon.heavy.chargeMax, 200, Button.Heavy);
    steps(run, 30, Button.Heavy);
    expect([p.action, p.charge]).toEqual(['charge', P.weapon.heavy.chargeMax]);
  });
});

describe('armor frames on a full charge', () => {
  it('a full hold is armored; a partial one is not', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    stepUntil(run, () => p.charge === P.weapon.heavy.chargeMax - 1, 200, Button.Heavy);
    expect(isArmored(p, P)).toBe(false);
    step(run, Button.Heavy);
    expect([p.action, isArmored(p, P)]).toEqual(['charge', true]);
  });

  it('released from a full charge, the thrust is armored through startup and active, not recovery', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    chargeFull(run);
    expect(p.action).toBe('heavy');
    const seen: Record<string, boolean[]> = {};
    while (p.action === 'heavy') {
      step(run);
      const ph = playerAttackPhase(p, P);
      if (ph && ph !== 'done') (seen[ph] ??= []).push(isArmored(p, P));
    }
    expect(seen.startup?.every(Boolean)).toBe(true);
    expect(seen.active?.every(Boolean)).toBe(true);
    expect(seen.recovery?.some(Boolean)).toBe(false);
  });

  it('released from a partial charge, nothing is armored', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    stepUntil(run, () => p.charge === P.weapon.heavy.chargeMin + 2, 200, Button.Heavy);
    step(run);
    expect(p.action).toBe('heavy');
    const armored: boolean[] = [];
    while (p.action === 'heavy') {
      step(run);
      armored.push(isArmored(p, P));
    }
    expect(armored.some(Boolean)).toBe(false);
  });

  it('a fully charged hold takes the hit but is not interrupted', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    stepUntil(run, () => p.charge >= P.weapon.heavy.chargeMax, 200, Button.Heavy);
    const peeling = addHusk(run, 'peeling', 14, {
      action: 'attack',
      t: 0,
      attackDir: 2048,
      attackHit: false,
    });
    const events = steps(run, 6, Button.Heavy);
    const hurt = events.find(
      (e): e is Extract<SimEvent, { type: 'playerHurt' }> => e.type === 'playerHurt',
    );
    expect(hurt?.armored).toBe(true);
    expect(p.action).toBe('charge');
    expect(p.hp).toBeLessThan(P.player.maxHp);
    expect(peeling.attackHit).toBe(true);
  });
});

describe('held, then shoved', () => {
  it('a hit husk is pinned for the hold (after hitstop), stays put, then is shoved 8 px', () => {
    const run = arena();
    fixed(run);
    const p = run.state.player;
    const P = run.params;
    const h = addHusk(run, 'peeling', 20, { shell: [0], core: 1000 });
    const x0 = h.x;
    const events = steps(run, 2, Button.Heavy, 0);
    events.push(...step(run, 0, 0));
    events.push(...stepUntil(run, () => p.hitIds.length > 0));
    expect(events.find((e) => e.type === 'held')).toEqual({
      type: 'held',
      id: h.id,
      kind: 'peeling',
      ms: P.weapon.heavy.hold,
    });
    expect([h.action, h.held?.left, h.held?.shove]).toEqual([
      'held',
      P.weapon.heavy.hold,
      P.weapon.heavy.shove,
    ]);
    expect(p.hitstop).toBe(P.weapon.heavy.hitstop);
    // Husks update after the player, so the husk has already spent one tick of its freeze.
    expect(h.hitstop).toBe(P.weapon.heavy.hitstop - 1);
    // Pinned: no knockback, no movement, through hitstop and the hold (counting the hit tick).
    let pinned = 1;
    while (h.action === 'held') {
      expect(h.x).toBe(x0);
      step(run);
      pinned++;
    }
    expect(pinned).toBe(P.weapon.heavy.hitstop + P.weapon.heavy.hold);
    expect(h.action).toBe('chase');
    // Then the shove: a light-class husk moves the full 8 px.
    expect(h.pushX).toBe(P.weapon.heavy.shove);
    steps(run, P.husks.knockbackTicks + 1);
    expect(h.x - x0).toBe(P.weapon.heavy.shove);
  });

  it('a hold that broke a shell layer ends in a stagger', () => {
    const run = arena();
    fixed(run);
    const p = run.state.player;
    const h = addHusk(run, 'peeling', 20, { shell: [5], core: 1000 });
    steps(run, 2, Button.Heavy, 0);
    step(run, 0, 0);
    stepUntil(run, () => p.hitIds.length > 0);
    expect([h.action, h.held?.broke]).toEqual(['held', true]);
    stepUntil(run, () => h.action !== 'held');
    expect(h.action).toBe('stagger');
    expect(h.stagger).toBe(run.params.husks.peeling.stagger);
  });

  it('a Nutshell is held on the hook but the shove never moves it', () => {
    const run = arena();
    fixed(run);
    const p = run.state.player;
    const h = addHusk(run, 'nutshell', 24, { shell: [0, 0], core: 1000 });
    const x0 = h.x;
    chargeFull(run);
    stepUntil(run, () => p.hitIds.length > 0);
    expect(h.action).toBe('held');
    stepUntil(run, () => h.action !== 'held');
    steps(run, 20);
    expect([h.x, h.pushX]).toEqual([x0, 0]);
  });

  it('the hold interrupts a wind-up, like a stagger would', () => {
    const run = arena();
    fixed(run);
    const p = run.state.player;
    addHusk(run, 'nutshell', 24, { action: 'windup', t: 0, attackDir: 2048 });
    steps(run, 2, Button.Heavy, 0);
    step(run, 0, 0);
    const events = stepUntil(run, () => p.hitIds.length > 0);
    events.push(...steps(run, 70));
    expect(events.some((e) => e.type === 'huskAttack')).toBe(false);
    expect(events.some((e) => e.type === 'playerHurt')).toBe(false);
  });
});
