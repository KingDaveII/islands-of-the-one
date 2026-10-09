import { roomTemplates } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { hitHusk, type Ctx } from '../src/combat.js';
import {
  canStart,
  createRun,
  displace,
  HALF_TURN,
  msToTicks,
  playerAttackPhase,
  setRunTuning,
  SUB,
  type Run,
  type SimEvent,
} from '../src/index.js';
import { addHusk, arena, Button, cloneTuning, retune, step, steps, stepUntil, tuning, WEAPON } from './helpers.js';

const swings = (events: SimEvent[]) => events.filter((e) => e.type === 'swing');
const hits = (events: SimEvent[]) => events.filter((e) => e.type === 'hit');
const AWAY = HALF_TURN; // aim left, away from husks placed on the right

/** Husks that stand still unless hit (no chasing or strafing). */
function still(run: Run): void {
  retune(run, (t) => {
    t.husks.peeling.speed = 0;
    t.husks.nutshell.speed = 0;
  });
}

function toRecovery(run: Run): void {
  stepUntil(run, () => playerAttackPhase(run.state.player, run.params) === 'recovery');
}

describe('move timing model', () => {
  it('converts every move timing from ms in data to ticks at load', () => {
    const run = arena();
    const P = run.params;
    const w = tuning.weapons[WEAPON];
    expect(w).toBeDefined();
    if (!w) return;
    w.light.forEach((l, i) => {
      expect(P.weapon.light[i]?.startup).toBe(msToTicks(l.startupMs));
      expect(P.weapon.light[i]?.active).toBe(msToTicks(l.activeMs));
      expect(P.weapon.light[i]?.recovery).toBe(msToTicks(l.recoveryMs));
    });
    expect(P.weapon.heavy.recovery).toBe(msToTicks(w.heavy.recoveryMs));
    w.abilities.forEach((a, i) => {
      expect(P.weapon.abilities[i]?.startup).toBe(msToTicks(a.startupMs));
      expect(P.weapon.abilities[i]?.recovery).toBe(msToTicks(a.recoveryMs));
      expect(P.weapon.abilities[i]?.cooldown).toBe(msToTicks(a.cooldownMs));
    });
    expect([P.dodge.startup, P.dodge.active, P.dodge.recovery]).toEqual(
      [tuning.dodge.startupMs, tuning.dodge.activeMs, tuning.dodge.recoveryMs].map(msToTicks),
    );
    expect(P.husks.peeling.startup).toBe(msToTicks(tuning.husks.peeling.attack.startupMs));
    expect(P.husks.nutshell.active).toBe(msToTicks(tuning.husks.nutshell.attack.activeMs));
  });

  it('a light attack lasts exactly startup + active + recovery ticks', () => {
    const run = arena();
    const p = run.state.player;
    const st = run.params.weapon.light[0];
    step(run, Button.Light);
    let n = 0;
    while (p.action === 'light') {
      step(run);
      n++;
    }
    expect(n).toBe((st?.startup ?? 0) + (st?.active ?? 0) + (st?.recovery ?? 0) + 1);
  });

  it('the Hookblade has three ability slots, slots 2-3 locked, and no armor frames yet', () => {
    const P = arena().params;
    expect(P.weapon.abilities.map((a) => a.locked)).toEqual([false, true, true]);
    const moves = [...P.weapon.light, P.weapon.heavy, ...P.weapon.abilities];
    expect(moves.every((m) => m.armorEnd === 0)).toBe(true);
  });
});

describe('cancel windows', () => {
  it('light recovery cancels into an ability', () => {
    const run = arena();
    const p = run.state.player;
    step(run, Button.Light);
    toRecovery(run);
    const events = step(run, Button.Ability1);
    expect([p.action, p.abilitySlot, p.t]).toEqual(['ability', 0, 0]);
    expect(swings(events)).toEqual([expect.objectContaining({ attack: 'ability', step: 0 })]);
  });

  it('heavy recovery cancels into an ability', () => {
    const run = arena();
    const p = run.state.player;
    steps(run, 2, Button.Heavy);
    step(run);
    expect(p.action).toBe('heavy');
    toRecovery(run);
    step(run, Button.Ability1);
    expect(p.action).toBe('ability');
  });

  it('light startup and active frames cannot be cancelled into an ability', () => {
    const run = arena();
    const p = run.state.player;
    step(run, Button.Light);
    step(run, Button.Ability1);
    expect(playerAttackPhase(p, run.params)).toBe('startup');
    expect(p.action).toBe('light');
    expect(p.buffer).toBe('ability1');
  });

  it('an ability can only be cancelled by a dodge, and only during its recovery', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    const lunge = P.weapon.abilities[0];
    expect(lunge?.recovery).toBeGreaterThan(P.bufferTicks);

    // Active frames: not even a dodge.
    step(run, Button.Ability1);
    step(run, Button.Dodge);
    expect(playerAttackPhase(p, P)).toBe('active');
    expect(p.action).toBe('ability');

    // Recovery: light, heavy and other abilities are refused...
    const run2 = arena();
    const p2 = run2.state.player;
    retune(run2, (t) => {
      const sweep = t.weapons[WEAPON]?.abilities[1];
      if (sweep) sweep.locked = false;
    });
    step(run2, Button.Ability1);
    toRecovery(run2);
    for (const b of [Button.Light, Button.Heavy, Button.Ability2]) {
      step(run2, b);
      expect(p2.action).toBe('ability');
      expect(p2.abilitySlot).toBe(0);
    }
    // ...but a dodge cancels it.
    const events = step(run2, Button.Dodge);
    expect(p2.action).toBe('dodge');
    expect(events.some((e) => e.type === 'dodge')).toBe(true);
  });

  it('a dodge cancels light recovery (unchanged) but nothing cancels a dodge', () => {
    const run = arena();
    const p = run.state.player;
    step(run, Button.Light);
    toRecovery(run);
    step(run, Button.Dodge);
    expect(p.action).toBe('dodge');
    for (const b of [Button.Light, Button.Ability1, Button.Heavy]) {
      step(run, b);
      expect(p.action).toBe('dodge');
    }
  });

  it('charging a heavy can only be cancelled by a dodge', () => {
    const run = arena();
    const p = run.state.player;
    steps(run, 3, Button.Heavy);
    step(run, Button.Heavy | Button.Ability1);
    expect(p.action).toBe('charge');
    step(run, Button.Heavy | Button.Dodge);
    expect(p.action).toBe('dodge');
  });

  it('canStart matches the cancel table', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    const all = (): boolean[] => (['attack', 'ability', 'dodge'] as const).map((i) => canStart(p, P, i));
    expect(all()).toEqual([true, true, true]);
    step(run, Button.Light);
    expect(all()).toEqual([false, false, false]);
    toRecovery(run);
    expect(all()).toEqual([true, true, true]);
    step(run, Button.Ability1);
    expect(all()).toEqual([false, false, false]);
    toRecovery(run);
    expect(all()).toEqual([false, false, true]);
  });
});

describe('ability buffering', () => {
  it('an ability pressed during light active frames fires on the first recovery tick', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    const st = P.weapon.light[0];
    const recoveryStart = (st?.startup ?? 0) + (st?.active ?? 0) + 1;
    step(run, Button.Light);
    // Press inside the buffer window (bufferTicks before recovery).
    stepUntil(run, () => p.t === recoveryStart - P.bufferTicks);
    step(run, Button.Ability1);
    expect([p.action, p.buffer]).toEqual(['light', 'ability1']);
    const events = stepUntil(run, () => p.action !== 'light');
    expect(p.action).toBe('ability');
    expect(swings(events)).toHaveLength(1);
  });

  it('an ability press older than the buffer window is dropped', () => {
    const run = arena();
    const p = run.state.player;
    const P = run.params;
    const st = P.weapon.light[2];
    // Combo step 3 has the longest startup.
    step(run, Button.Light);
    for (let k = 0; k < 2; k++) {
      toRecovery(run);
      step(run, Button.Light);
    }
    const recoveryStart = (st?.startup ?? 0) + (st?.active ?? 0) + 1;
    expect(recoveryStart - P.bufferTicks - 2).toBeGreaterThanOrEqual(0);
    stepUntil(run, () => p.t === recoveryStart - P.bufferTicks - 2);
    step(run, Button.Ability1);
    stepUntil(run, () => p.action !== 'light');
    expect(p.action).toBe('idle');
  });
});

describe('ability slots', () => {
  it('each slot has its own cooldown; there is no shared resource', () => {
    const run = arena();
    const p = run.state.player;
    retune(run, (t) => {
      const sweep = t.weapons[WEAPON]?.abilities[1];
      if (sweep) sweep.locked = false;
    });
    const [lunge, sweep] = run.params.weapon.abilities;
    step(run, Button.Ability1);
    expect(p.cooldowns[0]).toBe(lunge?.cooldown);
    stepUntil(run, () => p.action === 'idle');
    step(run, Button.Ability2);
    expect([p.action, p.abilitySlot]).toEqual(['ability', 1]);
    expect(p.cooldowns[1]).toBe(sweep?.cooldown);
    expect(p.cooldowns[0]).toBeGreaterThan(0);
  });

  it('locked slots never execute', () => {
    const run = arena();
    const p = run.state.player;
    const events = [...step(run, Button.Ability2), ...step(run, Button.Ability3)];
    events.push(...steps(run, 10));
    expect(p.action).toBe('idle');
    expect(swings(events)).toHaveLength(0);
    expect(p.cooldowns).toEqual([0, 0, 0]);
  });
});

describe('multi-hit hitstop', () => {
  /** Ticks a Lunge takes from press to idle (hitstop freezes add to it). */
  function lungeTicks(run: Run): { ticks: number; events: SimEvent[] } {
    const p = run.state.player;
    const events = step(run, Button.Ability1, 0);
    let ticks = 0;
    while (p.action === 'ability') {
      events.push(...step(run));
      ticks++;
    }
    return { ticks, events };
  }

  it('hits on different ticks of one swing freeze once, never summed', () => {
    const base = lungeTicks(arena()).ticks;
    const run = arena();
    still(run);
    addHusk(run, 'peeling', 20, { shell: [0], core: 1000 });
    addHusk(run, 'peeling', 50, { shell: [0], core: 1000 });
    const { ticks, events } = lungeTicks(run);
    const lunge = run.params.weapon.abilities[0];
    expect(hits(events)).toHaveLength(2);
    expect(ticks - base).toBe(lunge?.hitstop);
  });

  it('several husks hit in the same tick freeze once', () => {
    const run = arena();
    still(run);
    const p = run.state.player;
    for (const y of [-10, 0, 10]) addHusk(run, 'peeling', 18, { shell: [0], core: 1000, y: p.y + y * SUB });
    step(run, Button.Light, 0);
    const events = stepUntil(run, () => p.hitIds.length > 0);
    expect(hits(events)).toHaveLength(3);
    expect(p.hitstop).toBe(run.params.weapon.light[0]?.hitstop);
  });

  it('plays at the strongest level: a stronger hit tops up, a weaker one adds nothing', () => {
    const run = arena();
    const s = run.state;
    const ctx: Ctx = { s, P: run.params, events: [] };
    const [a, b, c] = [20, 30, 40].map((d) => addHusk(run, 'peeling', d, { shell: [0], core: 1000 }));
    if (!a || !b || !c) throw new Error('husks');
    const hit = (hitstop: number) => ({ damage: 1, shellDamage: 1, knockback: 0, hitstop, shake: 0 });
    s.player.swingHitstop = 0;
    hitHusk(ctx, a, hit(3), s.player.x, s.player.y);
    expect(s.player.hitstop).toBe(3);
    hitHusk(ctx, b, hit(5), s.player.x, s.player.y);
    expect(s.player.hitstop).toBe(5);
    hitHusk(ctx, c, hit(4), s.player.x, s.player.y);
    expect(s.player.hitstop).toBe(5);
    expect(c.hitstop).toBe(5);
  });
});

describe('weight classes', () => {
  /** Third light hit (strongest knockback) on an exposed husk; returns how far the hit pushes it. */
  function knock(weightClass: string): { pushed: number; moved: number; kb: number } {
    const run = arena();
    retune(run, (t) => {
      t.husks.peeling.weightClass = weightClass;
      t.husks.peeling.speed = 0;
      // No forward step, so the player never bumps the husk.
      for (const l of t.weapons[WEAPON]?.light ?? []) l.stepSpeed = 0;
    });
    const p = run.state.player;
    p.nextCombo = 2;
    p.comboTimer = 10;
    const h = addHusk(run, 'peeling', 20, { shell: [0], core: 1000 });
    const x0 = h.x;
    step(run, Button.Light, 0);
    stepUntil(run, () => p.hitIds.length > 0);
    const pushed = h.pushX;
    steps(run, 30);
    return { pushed, moved: h.x - x0, kb: run.params.weapon.light[2]?.knockback ?? 0 };
  }

  it('light moves the full distance, medium half, heavy not at all', () => {
    const light = knock('light');
    expect(light.kb).toBeGreaterThan(0);
    expect(light.pushed).toBe(light.kb);
    expect(light.moved).toBe(light.kb);
    const medium = knock('medium');
    expect(medium.pushed).toBe(Math.trunc(light.kb / 2));
    expect(medium.moved).toBe(Math.trunc(light.kb / 2));
    const heavy = knock('heavy');
    expect([heavy.pushed, heavy.moved]).toEqual([0, 0]);
  });

  it('Peeling is light and Nutshell is heavy: a full heavy swing does not move a Nutshell', () => {
    expect([tuning.husks.peeling.weightClass, tuning.husks.nutshell.weightClass]).toEqual(['light', 'heavy']);
    const run = arena();
    retune(run, (t) => {
      const w = t.weapons[WEAPON];
      if (w) w.heavy.stepSpeed = 0;
      t.husks.nutshell.speed = 0;
    });
    const p = run.state.player;
    const h = addHusk(run, 'nutshell', 22, { shell: [0, 0], core: 1000 });
    const [x0, y0] = [h.x, h.y];
    stepUntil(run, () => p.charge >= run.params.weapon.heavy.fullCharge, 200, Button.Heavy);
    step(run);
    const events = stepUntil(run, () => p.action === 'idle');
    expect(hits(events)).toHaveLength(1);
    expect(run.params.weapon.heavy.knockback[1]).toBeGreaterThan(0);
    expect([h.x, h.y]).toEqual([x0, y0]);
  });

  it('pulls scale by weight class the same way', () => {
    const run = arena();
    const ctx: Ctx = { s: run.state, P: run.params, events: [] };
    const pe = addHusk(run, 'peeling', 40);
    const nu = addHusk(run, 'nutshell', 40, { y: run.state.player.y + 30 * SUB });
    const toward = HALF_TURN; // husks are to the right; pull them left
    displace(ctx, pe, toward, 16 * SUB);
    displace(ctx, nu, toward, 16 * SUB);
    expect([pe.pushX, pe.pushT]).toEqual([-16 * SUB, run.params.husks.knockbackTicks]);
    expect([nu.pushX, nu.pushT]).toEqual([0, 0]);
  });
});

describe('armor frames', () => {
  /** A Peeling lunges into the player while they swing away from it. */
  function struckMidSwing(armorEndMs: number, armorStartMs = 0) {
    const t = cloneTuning();
    const light = t.weapons[WEAPON]?.light[0];
    if (light) {
      light.armorStartMs = armorStartMs;
      light.armorEndMs = armorEndMs;
    }
    const run = arena(t);
    const p = run.state.player;
    addHusk(run, 'peeling', 14, { action: 'attack', t: 0, attackDir: HALF_TURN, attackHit: false });
    const events = step(run, Button.Light, AWAY);
    for (let i = 0; i < 10 && !events.some((e) => e.type === 'playerHurt'); i++) events.push(...step(run, 0, AWAY));
    return { run, p, events };
  }

  it('armored frames take damage but are not interrupted', () => {
    const { run, p, events } = struckMidSwing(1000);
    const hurt = events.find((e): e is Extract<SimEvent, { type: 'playerHurt' }> => e.type === 'playerHurt');
    expect(hurt?.armored).toBe(true);
    expect(p.hp).toBe(run.params.player.maxHp - run.params.husks.peeling.damage);
    expect(p.action).toBe('light');
    // The swing runs to completion.
    const rest = stepUntil(run, () => p.action !== 'light');
    expect(p.action).toBe('idle');
    expect(rest.some((e) => e.type === 'playerHurt')).toBe(false);
  });

  it('without armor the same hit interrupts the swing', () => {
    const { run, p, events } = struckMidSwing(0);
    const hurt = events.find((e): e is Extract<SimEvent, { type: 'playerHurt' }> => e.type === 'playerHurt');
    expect(hurt?.armored).toBe(false);
    expect(p.hp).toBe(run.params.player.maxHp - run.params.husks.peeling.damage);
    expect(p.action).toBe('hurt');
  });

  it('armor only covers its window', () => {
    // Armor starts after the lunge lands.
    const { p, events } = struckMidSwing(1000, 200);
    const hurt = events.find((e): e is Extract<SimEvent, { type: 'playerHurt' }> => e.type === 'playerHurt');
    expect(hurt?.armored).toBe(false);
    expect(p.action).toBe('hurt');
  });
});

describe('one weapon per run', () => {
  it('runs start with an available weapon only', () => {
    const cfg = { seed: 1, tuning, rooms: roomTemplates };
    expect(() => createRun({ ...cfg, weapon: WEAPON })).not.toThrow();
    const locked = tuning.weaponRoster.find((w) => w.locked);
    expect(locked).toBeDefined();
    expect(() => createRun({ ...cfg, weapon: locked?.id ?? '' })).toThrow(/not available/);
    expect(() => createRun({ ...cfg, weapon: 'nope' })).toThrow(/not available/);
  });

  it('the weapon is part of the record and live tuning cannot swap it', () => {
    const run = arena();
    expect(run.record.weapon).toBe(WEAPON);
    setRunTuning(run, cloneTuning());
    expect(run.params.weapon.id).toBe(WEAPON);
    expect(run.record.tuningChanges[0]).not.toHaveProperty('weapon');
  });
});
