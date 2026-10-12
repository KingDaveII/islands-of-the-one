import { describe, expect, it } from 'vitest';
import { lightStrike, playerAttackPhase, type SimEvent } from '../src/index.js';
import { addHusk, arena, Button, retune, step, steps, stepUntil } from './helpers.js';

const swings = (events: SimEvent[]) => events.filter((e) => e.type === 'swing');

describe('light combo chaining', () => {
  it('chains three light hits when pressed in each recovery, then wraps', () => {
    const run = arena();
    const p = run.state.player;
    const n = run.params.weapon.light.length;
    expect(n).toBe(3);
    step(run, Button.Light);
    expect([p.action, p.comboStep]).toEqual(['light', 0]);
    for (let k = 1; k <= n; k++) {
      stepUntil(run, () => playerAttackPhase(p, run.params) === 'recovery');
      step(run, Button.Light);
      expect(p.action).toBe('light');
      expect(p.comboStep).toBe(k % n);
      expect(p.t).toBe(0);
    }
  });

  it('third hit is stronger with more knockback', () => {
    const run = arena();
    const [a, , c] = [0, 1, 2].map((i) => lightStrike(run.params, i));
    expect(c?.damage).toBeGreaterThan(a?.damage ?? 0);
    expect(c?.knockback).toBeGreaterThan(a?.knockback ?? 0);
  });

  it('continues the chain within comboReset after the attack ends, restarts after', () => {
    const run = arena();
    const p = run.state.player;
    step(run, Button.Light);
    stepUntil(run, () => p.action === 'idle');
    // The timer also counts down on the tick of the press.
    steps(run, run.params.weapon.comboReset - 2);
    step(run, Button.Light);
    expect(p.comboStep).toBe(1);

    stepUntil(run, () => p.action === 'idle');
    steps(run, run.params.weapon.comboReset + 1);
    step(run, Button.Light);
    expect(p.comboStep).toBe(0);
  });

  it('third hit damages an exposed core more than the first', () => {
    const run = arena();
    const p = run.state.player;
    const h = addHusk(run, 'nutshell', 18, { shell: [0, 0], core: 500, cooldown: 100_000 });
    const before = h.core;
    step(run, Button.Light);
    stepUntil(run, () => p.hitIds.length > 0);
    const first = before - h.core;
    for (let k = 1; k <= 2; k++) {
      stepUntil(run, () => playerAttackPhase(p, run.params) === 'recovery');
      step(run, Button.Light);
    }
    const mid = h.core;
    stepUntil(run, () => p.hitIds.length > 0);
    expect(mid - h.core).toBeGreaterThan(first);
  });
});

describe('input buffering', () => {
  it('a press shortly before recovery performs the action on the first recovery tick', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    step(run, Button.Light);
    stepUntil(run, () => playerAttackPhase(p, P) === 'recovery');
    step(run, Button.Light); // now in combo step 1
    const st = lightStrike(P, 1);
    const recoveryStart = st.startup + st.active + 1;
    expect(recoveryStart - P.bufferTicks).toBeGreaterThanOrEqual(1);
    stepUntil(run, () => p.t === recoveryStart - P.bufferTicks - 1);
    step(run, Button.Light); // press: buffered (t becomes recoveryStart - bufferTicks)
    expect([p.comboStep, p.buffer]).toEqual([1, 'light']);
    steps(run, P.bufferTicks - 1);
    expect(p.comboStep).toBe(1);
    step(run); // first recovery tick: buffered press fires
    expect([p.action, p.comboStep, p.t, p.buffer]).toEqual(['light', 2, 0, 'none']);
  });

  it('drops presses older than the buffer window', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    // Get to combo step 2 (longest startup), then press dodge too early.
    step(run, Button.Light);
    for (let k = 0; k < 2; k++) {
      stepUntil(run, () => playerAttackPhase(p, P) === 'recovery');
      step(run, Button.Light);
    }
    expect(p.comboStep).toBe(2);
    const st = lightStrike(P, 2);
    const recoveryStart = st.startup + st.active + 1;
    expect(recoveryStart - P.bufferTicks - 2).toBeGreaterThanOrEqual(0);
    stepUntil(run, () => p.t === recoveryStart - P.bufferTicks - 2);
    const events = step(run, Button.Dodge);
    events.push(...stepUntil(run, () => p.action === 'idle'));
    expect(events.some((e) => e.type === 'dodge')).toBe(false);
  });

  it('buffers dodge through hitstop without aging', () => {
    const run = arena();
    const p = run.state.player;
    addHusk(run, 'peeling', 14, { shell: [100] });
    step(run, Button.Light);
    stepUntil(run, () => p.hitstop > 0);
    const stop = p.hitstop;
    step(run, Button.Dodge);
    steps(run, stop - 1);
    expect([p.buffer, p.bufferAge]).toEqual(['dodge', 0]);
  });
});

describe('dodge', () => {
  it('cancels attack recovery immediately', () => {
    const run = arena();
    const p = run.state.player;
    step(run, Button.Light);
    stepUntil(run, () => playerAttackPhase(p, run.params) === 'recovery');
    const events = step(run, Button.Dodge);
    expect(p.action).toBe('dodge');
    expect(events.some((e) => e.type === 'dodge')).toBe(true);
    expect(p.iframes).toBe(run.params.dodge.active);
  });

  it('cannot cancel startup or active frames (it is buffered until recovery)', () => {
    const run = arena();
    const p = run.state.player;
    step(run, Button.Light);
    step(run, Button.Dodge);
    expect(p.action).toBe('light');
    stepUntil(run, () => p.action === 'dodge');
    expect(playerAttackPhase(p, run.params)).toBeNull();
  });

  it('respects the cooldown and grants i-frames for iframes ticks', () => {
    const run = arena();
    const p = run.state.player;
    step(run, Button.Dodge);
    let iframeTicks = 0;
    while (p.action === 'dodge') {
      if (p.iframes > 0) iframeTicks++;
      step(run);
    }
    const d = run.params.dodge;
    expect(iframeTicks).toBe(Math.min(d.active, d.startup + d.active + d.recovery));
    expect(p.dodgeCooldown).toBeGreaterThan(0);
    step(run, Button.Dodge);
    expect(p.action).not.toBe('dodge');
  });
});

describe('poise (shell armor)', () => {
  it('a hit that breaks a shell layer interrupts the wind-up', () => {
    const run = arena();
    const h = addHusk(run, 'nutshell', 20, { action: 'windup', t: 0, attackDir: 2048, shell: [5, 40] });
    const events = step(run, Button.Light);
    events.push(...stepUntil(run, () => h.action !== 'windup', 60));
    expect(h.action).toBe('stagger');
    expect(h.shell).toEqual([0, 40]);
    const hit = events.find((e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit');
    expect(hit?.broke).toBe(0);
    // The slam never lands.
    const later = steps(run, run.params.husks.nutshell.stagger);
    expect(later.some((e) => e.type === 'playerHurt')).toBe(false);
  });

  it('while the shell holds, hits chip it but the attack continues (super armor)', () => {
    const run = arena();
    const p = run.state.player;
    const h = addHusk(run, 'nutshell', 20, { action: 'windup', t: 0, attackDir: 2048 });
    step(run, Button.Light);
    stepUntil(run, () => p.hitIds.length > 0);
    expect(h.action).toBe('windup');
    expect(h.shell[0]).toBeLessThan(run.params.husks.nutshell.shell[0] ?? 0);
    expect(h.core).toBe(run.params.husks.nutshell.core);
    const events = stepUntil(run, () => p.action === 'hurt', 120);
    expect(events.some((e) => e.type === 'huskAttack')).toBe(true);
  });

  it('with the shell gone, core hits flinch', () => {
    const run = arena();
    const h = addHusk(run, 'peeling', 14, { action: 'windup', t: 0, shell: [0], core: 100 });
    step(run, Button.Light);
    stepUntil(run, () => h.action !== 'windup', 30);
    expect(h.action).toBe('flinch');
    expect(h.core).toBeLessThan(100);
  });
});

describe('perfect dodge timing', () => {
  /** Peeling about to lunge at a stationary player; returns the tick the hit lands with no dodge. */
  function setup(dodgeTicksBeforeHit: number | null, hitTick?: number) {
    const run = arena();
    // Freeze dodge movement so the hit tick does not depend on the dodge, and
    // measure the timing window alone (no near-miss margin).
    retune(run, (t) => {
      t.dodge.speed = 0;
      t.dodge.exitSpeedFactor = 0;
      t.perfectDodge.marginPx = 0;
    });
    const p = run.state.player;
    const P = run.params;
    addHusk(run, 'peeling', 40, { action: 'windup', t: P.husks.peeling.startup - 3, attackDir: 2048 });
    const events: SimEvent[] = [];
    for (let i = 1; i <= 40; i++) {
      const press = hitTick !== undefined && dodgeTicksBeforeHit !== null && i === hitTick - dodgeTicksBeforeHit;
      events.push(...step(run, press ? Button.Dodge : 0));
      if (events.some((e) => e.type === 'playerHurt' || e.type === 'perfectDodge')) {
        return { run, p, P, events, tick: i };
      }
    }
    return { run, p, P, events, tick: -1 };
  }

  it('dodging within the window before the hit is perfect: slow-mo + Sparkglass, no damage', () => {
    const base = setup(null);
    expect(base.events.some((e) => e.type === 'playerHurt')).toBe(true);
    const hitTick = base.tick;
    const window = base.P.perfect.window;
    expect(window).toBeGreaterThanOrEqual(6); // ~100 ms+, generous
    for (let k = 0; k <= window; k++) {
      const r = setup(k, hitTick);
      expect(r.events.some((e) => e.type === 'perfectDodge'), `k=${k}`).toBe(true);
      expect(r.events.some((e) => e.type === 'playerHurt'), `k=${k}`).toBe(false);
      expect(r.run.state.slowmo).toBeGreaterThan(0);
      expect(r.run.state.sparkglass).toBe(r.P.perfect.bonus);
      expect(r.run.state.stats.perfectDodges).toBe(1);
      expect(r.p.hp).toBe(r.P.player.maxHp);
    }
  });

  it('dodging earlier still avoids damage with i-frames, but is not perfect', () => {
    const base = setup(null);
    const { window, } = base.P.perfect;
    const iframes = base.P.dodge.active;
    expect(iframes).toBeGreaterThan(window + 1);
    const r = setup(window + 1, base.tick);
    expect(r.events.some((e) => e.type === 'perfectDodge')).toBe(false);
    expect(r.p.hp).toBe(r.P.player.maxHp);
    expect(r.run.state.sparkglass).toBe(0);
  });

  it('dodging so early that i-frames ran out gets hit', () => {
    const base = setup(null);
    const r = setup(base.P.dodge.active + 1, base.tick);
    expect(r.events.some((e) => e.type === 'playerHurt')).toBe(true);
    expect(r.events.some((e) => e.type === 'perfectDodge')).toBe(false);
  });
});

describe('perfect dodge near-miss margin', () => {
  it('a lunge that would just miss still counts as a perfect dodge (generous)', () => {
    const run = arena();
    retune(run, (t) => {
      t.dodge.speed = 0;
      t.dodge.exitSpeedFactor = 0;
    });
    const P = run.params;
    const reachPx = (P.player.radius + P.husks.peeling.radius + P.husks.peeling.hitPad) / 256;
    const marginPx = P.perfect.margin / 256;
    // Aim the lunge so its closest approach lands between reach and reach + margin.
    const missBy = reachPx + marginPx / 2;
    const offset = Math.round((Math.asin(missBy / 40) / (2 * Math.PI)) * 4096);
    const lockedDir = 2048 + offset;
    const base = arena();
    addHusk(base, 'peeling', 40, { action: 'windup', t: base.params.husks.peeling.startup - 1, attackDir: lockedDir });
    const whiff = steps(base, 30);
    expect(whiff.some((e) => e.type === 'playerHurt')).toBe(false);

    addHusk(run, 'peeling', 40, { action: 'windup', t: P.husks.peeling.startup - 1, attackDir: lockedDir });
    const events = steps(run, 3, Button.Dodge);
    events.push(...steps(run, 30));
    expect(events.some((e) => e.type === 'perfectDodge')).toBe(true);
  });
});

describe('heavy and abilities', () => {
  it('a short hold releases the tap thrust; a full hold the strongest charged thrust', () => {
    const run = arena();
    // A straight thrust needs the target on the line: keep the Nutshell from circling.
    retune(run, (t) => {
      t.husks.nutshell.speed = 0;
    });
    const p = run.state.player;
    const P = run.params;
    const quick = addHusk(run, 'nutshell', 22, { shell: [0, 0], core: 1000 });
    steps(run, 3, Button.Heavy);
    expect(p.action).toBe('charge');
    step(run);
    expect(p.action).toBe('heavy');
    stepUntil(run, () => p.hitIds.length > 0);
    expect(1000 - quick.core).toBe(P.weapon.heavy.tap.damage);

    stepUntil(run, () => p.action === 'idle');
    steps(run, 30);
    quick.core = 1000;
    quick.action = 'chase';
    stepUntil(run, () => p.charge >= P.weapon.heavy.chargeMax, 200, Button.Heavy);
    steps(run, 5, Button.Heavy);
    expect(p.charge).toBe(P.weapon.heavy.chargeMax);
    step(run);
    stepUntil(run, () => p.hitIds.length > 0);
    expect(1000 - quick.core).toBe(P.weapon.heavy.charged.damage[1]);
    expect(1000 - quick.core).toBeGreaterThan(P.weapon.heavy.tap.damage);
  });

  it('Haul is slot 1, hits and goes on cooldown; The Catch and Turning Blade are locked', () => {
    const run = arena();
    const p = run.state.player;
    const h = addHusk(run, 'peeling', 60, { shell: [0], core: 100 });
    const events = step(run, Button.Ability1, 0);
    expect([p.action, p.abilitySlot]).toEqual(['ability', 0]);
    expect(p.cooldowns[0]).toBe(run.params.weapon.abilities[0]?.cooldown);
    events.push(...stepUntil(run, () => p.action === 'idle'));
    expect(h.core).toBeLessThan(100);
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(1);
    step(run, Button.Ability1);
    expect(p.action).not.toBe('ability');

    expect(run.params.weapon.abilities.map((a) => [a.id, a.name, a.locked])).toEqual([
      ['haul', 'Haul', false],
      ['the-catch', 'The Catch', true],
      ['turning-blade', 'Turning Blade', true],
    ]);
    step(run, Button.Ability2);
    step(run, Button.Ability3);
    expect(p.action).toBe('idle');
    expect(swings(events)).toHaveLength(1);
  });
});
