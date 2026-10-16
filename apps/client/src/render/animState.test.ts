import {
  defaultTuning,
  isRequiredAnim,
  KINDLED_ANIMS,
  roomTemplates,
  spriteSheets,
  type SpriteSheet,
} from '@iot/shared';
import { autopilot, createRun, stepRun, TURN, type HuskState, type Run } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import {
  facing4,
  gaitPose,
  huskFlip,
  huskPose,
  kindledPose,
  loopFrame,
  onceFrame,
  sheetFacing,
  spreadFrame,
  strideFrame,
  type Clocks,
  type Stride,
} from './animState.js';
import { PLAYER_SHEET } from './characters.js';
import { StrideMeter } from './stride.js';

const KINDLED = spriteSheets[PLAYER_SHEET];
const PEELING = spriteSheets['husk-peeling'];
const NUTSHELL = spriteSheets['husk-nutshell'];
const NO_CLOCKS: Clocks = { hitMs: -1 };
const CYCLES = defaultTuning.anim;
/** The Kindled sheet without `run`, as M1's v1 sheets were: `walk` stands in. */
const KINDLED_NO_RUN: SpriteSheet = {
  ...KINDLED,
  anims: Object.fromEntries(Object.entries(KINDLED.anims).filter(([key]) => !key.startsWith('run_'))),
};
/** The Kindled sheet as a v1 (M1) sheet: no run, the fixed frame rate. */
const KINDLED_V1: SpriteSheet = { ...KINDLED_NO_RUN, meta: { ...KINDLED.meta, version: '1' } };
const deg = (d: number): number => Math.round((d * TURN) / 360) & (TURN - 1);

/** Animations a run can show in M1: the required rows (carry and sit are M2's and have no sim state yet). */
const M1_PLAYABLE = KINDLED_ANIMS.filter(isRequiredAnim).map((a) => a.name);

/** The Kindled sheet as a finished M1 sheet may ship: without the optional (M2) animations. */
const KINDLED_M1: SpriteSheet = {
  ...KINDLED,
  anims: Object.fromEntries(
    Object.entries(KINDLED.anims).filter(([key]) => M1_PLAYABLE.some((n) => key.startsWith(`${n}_`))),
  ),
};

function newRun(seed: number): Run {
  return createRun({ seed, tuning: defaultTuning, rooms: roomTemplates, weapon: 'hookblade' });
}

/** Drive a run with the autopilot through the state machine, collecting the animations it showed. */
function playthrough(
  run: Run,
  maxTicks: number,
  hits: Set<string> = new Set(),
  sheet: SpriteSheet = KINDLED,
): Set<string> {
  let hitAt = -1000;
  for (let i = 0; i < maxTicks && run.state.status === 'playing'; i++) {
    // Patient: the autopilot lets moves play out (it would otherwise cancel every recovery and pin into the next move).
    const events = stepRun(run, autopilot(run.state, run.params, { patient: true }));
    if (events.some((e) => e.type === 'playerHurt')) hitAt = run.state.tick;
    const sinceHit = ((run.state.tick - hitAt) * 1000) / 60;
    const pose = kindledPose(run.state, run.params, sheet, {
      hitMs: hitAt < 0 ? -1 : sinceHit,
      deathMs: 0,
    });
    expect(sheet.anims[pose.anim], pose.anim).toBeDefined();
    expect(pose.frame).toBeLessThan(sheet.anims[pose.anim]?.frames.length ?? 0);
    hits.add(pose.name);
  }
  return hits;
}

describe('frame timing helpers', () => {
  it('loops and holds at the sheet rate from a tick count', () => {
    const walk = KINDLED.anims.walk_S;
    const charge = KINDLED.anims.heavy_charge_S;
    expect(walk && charge).toBeTruthy();
    if (!walk || !charge) return;
    expect([0, 5, 6, 12, 36].map((t) => loopFrame(walk, t))).toEqual([0, 0, 1, 2, 0]);
    expect([0, 4, 5, 10, 60].map((t) => onceFrame(charge, t))).toEqual([0, 0, 1, 2, 2]);
  });

  it('stretches or cuts frames over the move window by phase shares', () => {
    const w = [
      { len: 4, share: 1 },
      { len: 3, share: 1 },
      { len: 12, share: 1 },
    ];
    // 3 frames: one per phase, held for the phase's ticks.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 13, 19].map((t) => spreadFrame(3, w, t))).toEqual([
      0, 0, 0, 0, 1, 1, 1, 2, 2, 2,
    ]);
    // 6 frames: two per phase, spread evenly.
    expect([1, 2, 3, 4, 5, 7, 8, 13, 14, 19].map((t) => spreadFrame(6, w, t))).toEqual([
      0, 0, 1, 1, 2, 3, 4, 4, 5, 5,
    ]);
    // The dodge: crouch / roll / recover with the roll getting two of four frames.
    const dodge = [
      { len: 0, share: 1 },
      { len: 13, share: 2 },
      { len: 3, share: 1 },
    ];
    expect([1, 7, 8, 13, 14, 16].map((t) => spreadFrame(4, dodge, t))).toEqual([1, 1, 2, 2, 3, 3]);
    // A single frame is just itself; past the end holds the last.
    expect(spreadFrame(1, w, 5)).toBe(0);
    expect(spreadFrame(3, w, 99)).toBe(2);
  });

  it('maps a diagonal to the nearest of 4 facings and finds the facings a sheet has', () => {
    expect(facing4(deg(0))).toBe('E');
    expect(facing4(deg(90))).toBe('S');
    expect(facing4(deg(180))).toBe('W');
    expect(facing4(deg(270))).toBe('N');
    expect(facing4(deg(30))).toBe('E');
    expect(facing4(deg(60))).toBe('S');
    expect(sheetFacing(KINDLED, 'walk', deg(45))).toBe('SE');
    expect(sheetFacing(KINDLED, 'hit', deg(45))).toBe('S');
    expect(sheetFacing(KINDLED, 'death', deg(300))).toBe('N');
    // sit is drawn in S and E only (an M2 animation, so a sheet of its own here).
    const idle = KINDLED.anims.idle_S;
    if (!idle) throw new Error('no idle_S');
    const sitting: SpriteSheet = { ...KINDLED, anims: { sit_S: idle, sit_E: idle } };
    expect(sheetFacing(sitting, 'sit', deg(180))).toBe('E');
    expect(sheetFacing(sitting, 'sit', deg(270))).toBe('S');
  });
});

describe('walk and run by distance (G1.5c)', () => {
  const stride = (distancePx: number): Stride => ({ distancePx, cycles: CYCLES });

  it('takes the cycles from the anim tuning: 64 world px a walk, 96 a run', () => {
    expect(CYCLES).toEqual({ walkCyclePx: 64, runCyclePx: 96 });
  });

  it('picks the frame from distance: floor(distance / cyclePx × frames) mod frames', () => {
    const walk = KINDLED.anims.walk_S;
    if (!walk) throw new Error('no walk_S');
    // 6 frames over 96 px: a frame every 16 px, wrapping each cycle.
    expect([0, 15, 16, 47, 48, 95, 96, 100, 96 * 7 + 80].map((d) => strideFrame(walk, d, 96))).toEqual([
      0, 0, 1, 2, 3, 5, 0, 0, 5,
    ]);
    // Over a 64 px walk cycle a frame lasts 64 / 6 px.
    expect([0, 10, 11, 32, 63, 64].map((d) => strideFrame(walk, d, 64))).toEqual([0, 0, 1, 3, 5, 0]);
  });

  it('runs in an encounter at the run cycle, with walk standing in on a sheet without run', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    s.player.vx = 300;
    // 8 run frames over the 96 px cycle: a frame every 12 px.
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(48))).toMatchObject({
      name: 'run',
      anim: 'run_E',
      frame: 4,
    });
    // A sheet without run plays walk in its place, at the run's cycle: 6 frames over 96 px, 16 px a frame.
    expect(kindledPose(s, run.params, KINDLED_NO_RUN, NO_CLOCKS, stride(48))).toMatchObject({
      name: 'walk',
      anim: 'walk_E',
      frame: 3,
    });
    // Walking for its own sake (M2's holding) keeps the walk's own 64 px cycle.
    expect(gaitPose(KINDLED, 'walk', deg(0), 0, stride(48))).toMatchObject({ anim: 'walk_E', frame: 4 });
    expect(gaitPose(KINDLED, 'run', deg(0), 0, stride(48))).toMatchObject({ anim: 'run_E', frame: 4 });
  });

  it('advances with distance, not with time: standing still or against a wall, the frame stays', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.vx = 300;
    const at = (tick: number, d: number): number => {
      s.tick = tick;
      return kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(d)).frame;
    };
    expect([at(0, 20), at(6, 20), at(60, 20), at(600, 20)]).toEqual([1, 1, 1, 1]);
    expect([at(600, 36), at(600, 52)]).toEqual([3, 4]);
  });

  it('carries the cycle on through a stop: a restart does not pop to frame 0', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    const meter = new StrideMeter();
    const pose = () => kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(meter.distancePx));
    meter.step(100, 100);
    // Moving east 6 sim px (12 world px) a frame: one run frame per step.
    s.player.vx = 300;
    const frames: number[] = [];
    for (const x of [106, 112, 118]) {
      meter.step(x, 100);
      frames.push(pose().frame);
    }
    expect(frames).toEqual([1, 2, 3]);
    // Stop for a second: idle, and the distance holds.
    s.player.vx = 0;
    for (let i = 0; i < 60; i++) {
      s.tick++;
      meter.step(118, 100);
      expect(pose().name).toBe('idle');
    }
    expect(meter.distancePx).toBe(36);
    // Restart: the cycle picks up at frame 3, then 4.
    s.player.vx = 300;
    expect(pose().frame).toBe(3);
    meter.step(124, 100);
    expect(pose().frame).toBe(4);
    // A diagonal step counts its length: 6, 8 sim px is 10 sim px, 20 world px.
    meter.step(130, 108);
    expect(meter.distancePx).toBe(68);
  });

  it('keeps a v1 sheet, and a pose without a stride, on the fixed frame rate', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    s.player.vx = 300;
    s.tick = 6;
    // 10 fps on the 60 Hz tick: frame 1 at tick 6, whatever the distance.
    expect(kindledPose(s, run.params, KINDLED_V1, NO_CLOCKS, stride(0))).toMatchObject({ anim: 'walk_E', frame: 1 });
    expect(kindledPose(s, run.params, KINDLED_V1, NO_CLOCKS, stride(80)).frame).toBe(1);
    s.tick = 18;
    expect(kindledPose(s, run.params, KINDLED_V1, NO_CLOCKS, stride(80)).frame).toBe(3);
    // A v2 sheet without a stride: run's 16 fps on the tick.
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS)).toMatchObject({ anim: 'run_E', frame: 4 });
    // The Nutshell's walk stays time-based too (huskPose takes no stride).
  });
});

describe('the Kindled state machine', () => {
  it('idles facing the aim, runs when it moves, and reads the hit and death clocks', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(180);
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS)).toMatchObject({
      name: 'idle',
      facing: 'W',
      frame: 0,
    });
    s.player.vx = 300;
    s.tick = 6;
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS)).toMatchObject({
      name: 'run',
      facing: 'W',
      frame: 1,
    });
    expect(kindledPose(s, run.params, KINDLED, { hitMs: 50 })).toMatchObject({
      name: 'hit',
      anim: 'hit_W',
    });
    expect(kindledPose(s, run.params, KINDLED, { hitMs: 120 }).name).toBe('run');
    // Stunned: the flinch for the first 100 ms of the stun, then the stagger held to its end, whatever the hit clock says.
    s.player.action = 'hurt';
    s.player.t = 1;
    expect(kindledPose(s, run.params, KINDLED, { hitMs: 120 })).toMatchObject({ name: 'hit', anim: 'hit_W', frame: 0 });
    s.player.t = 6; // 100 ms
    expect(kindledPose(s, run.params, KINDLED, { hitMs: 120 })).toMatchObject({ name: 'hit', frame: 0 });
    s.player.t = 7;
    expect(kindledPose(s, run.params, KINDLED, { hitMs: 120 })).toMatchObject({ name: 'hit', frame: 1 });
    s.player.t = run.params.player.hurtStun;
    expect(kindledPose(s, run.params, KINDLED, { hitMs: 500 })).toMatchObject({ name: 'hit', frame: 1 });
    // An armored hit that does not stun: the flinch alone for 100 ms.
    s.player.action = 'idle';
    expect(kindledPose(s, run.params, KINDLED, { hitMs: 50 })).toMatchObject({ name: 'hit', frame: 0 });
    s.player.action = 'dead';
    s.player.dir = deg(45);
    expect(kindledPose(s, run.params, KINDLED, { hitMs: -1, deathMs: 0 })).toMatchObject({
      name: 'death',
      facing: 'S',
      frame: 0,
    });
    expect(kindledPose(s, run.params, KINDLED, { hitMs: -1, deathMs: 5000 }).frame).toBe(5);
  });

  it('plays heavy_charge → heavy_thrust → heavy_hold → heavy_recover, and the Haul branches', () => {
    const run = newRun(2);
    const s = run.state;
    const P = run.params;
    const p = s.player;
    p.action = 'charge';
    p.t = 1;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'heavy_charge', frame: 0 });
    p.t = 60;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'heavy_charge', frame: 2 });
    p.action = 'heavy';
    p.charge = P.weapon.heavy.chargeMax;
    const tm = P.weapon.heavy.charged;
    p.t = 1;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'heavy_thrust', frame: 0 });
    p.t = tm.startup + 1;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'heavy_thrust', frame: 1 });
    // The pin: heavy_hold from the hit (still in the active phase, through the hitstop) until the Husk is let go.
    s.husks.push({ ...fakeHusk(1, 'peeling'), action: 'held' });
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'heavy_hold', frame: 0 });
    p.t = tm.startup + tm.active + 1;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'heavy_hold', frame: 0 });
    s.husks = [];
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({
      name: 'heavy_recover',
      frame: 0,
    });
    p.t = tm.startup + tm.active + tm.recovery;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({
      name: 'heavy_recover',
      frame: 1,
    });

    const haul = P.weapon.abilities[0];
    if (!haul) throw new Error('no Haul');
    p.action = 'ability';
    p.abilitySlot = 0;
    p.t = 1;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'haul_throw', frame: 0 });
    p.t = haul.startup + 1;
    p.hook = { x: 0, y: 0, dir: 0, travel: 0, targetId: -1, hitId: -1, pull: 'none', pullLeft: 0 };
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'haul_throw', frame: 1 });
    p.hook.hitId = 1;
    p.hook.pull = 'husk';
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS).name).toBe('haul_pull');
    p.hook.pull = 'player';
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS).name).toBe('haul_slide');
    // The hook is gone (a miss) with active ticks still to run: haul_recover's first frame, then it plays over the recovery.
    p.hook = null;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'haul_recover', frame: 0 });
    p.t = haul.startup + haul.active + 1;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'haul_recover', frame: 0 });
    p.t = haul.startup + haul.active + haul.recovery;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({ name: 'haul_recover', frame: 1 });
  });

  it('picks light_1..3 by combo step and the dodge frames by phase', () => {
    const run = newRun(3);
    const s = run.state;
    const P = run.params;
    const p = s.player;
    p.action = 'light';
    for (const step of [0, 1, 2]) {
      p.comboStep = step;
      const st = P.weapon.light[step];
      if (!st) throw new Error('no strike');
      p.t = 1;
      expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({
        name: `light_${step + 1}`,
        frame: 0,
      });
      p.t = st.startup + 1;
      expect(kindledPose(s, P, KINDLED, NO_CLOCKS).frame).toBe(1);
      p.t = st.startup + st.active + 1;
      expect(kindledPose(s, P, KINDLED, NO_CLOCKS).frame).toBe(2);
    }
    p.action = 'dodge';
    p.dir = deg(90);
    p.t = 1;
    const d = P.dodge;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS)).toMatchObject({
      name: 'dodge',
      facing: 'S',
      frame: d.startup === 0 ? 1 : 0,
    });
    p.t = d.startup + d.active;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS).frame).toBe(2);
    p.t = d.startup + d.active + d.recovery;
    expect(kindledPose(s, P, KINDLED, NO_CLOCKS).frame).toBe(3);
  });
});

function fakeHusk(id: number, kind: 'peeling' | 'nutshell'): HuskState {
  const hp = defaultTuning.husks[kind];
  return {
    id,
    kind,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    shell: [...hp.shell],
    core: hp.core,
    action: 'chase',
    t: 0,
    attackDir: 0,
    attackHit: false,
    cooldown: 0,
    hitstop: 0,
    strafe: 1,
    pushX: 0,
    pushY: 0,
    pushT: 0,
    stagger: 0,
    held: null,
    sinceHit: 0,
  };
}

describe('the Husk state machine', () => {
  it('Peeling: idle, telegraph (blinking while tracking), lunge over the attack, settle, chipped, hit', () => {
    const run = newRun(4);
    const s = run.state;
    const P = run.params;
    const h = fakeHusk(1, 'peeling');
    const hp = P.husks.peeling;
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, true)).toEqual({ anim: 'idle', frame: 0 });
    s.tick = 20;
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, true)).toEqual({ anim: 'idle', frame: 1 });
    h.action = 'windup';
    h.t = 1;
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, true)).toEqual({ anim: 'telegraph', frame: 0 });
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, false)).toEqual({ anim: 'idle', frame: 1 });
    h.t = hp.track + 1;
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, false)).toEqual({ anim: 'telegraph', frame: 1 });
    h.action = 'attack';
    h.t = 1;
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, true)).toEqual({ anim: 'lunge', frame: 0 });
    h.t = hp.active;
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, true)).toEqual({ anim: 'lunge', frame: 1 });
    h.action = 'recover';
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, true)).toEqual({ anim: 'lunge', frame: 2 });
    h.action = 'chase';
    h.shell = [0];
    expect(huskPose(s, P, h, PEELING, NO_CLOCKS, true)).toEqual({ anim: 'chipped', frame: 0 });
    expect(huskPose(s, P, h, PEELING, { hitMs: 10 }, true)).toEqual({ anim: 'hit', frame: 0 });
    expect(huskPose(s, P, h, PEELING, { hitMs: 100 }, true)).toEqual({ anim: 'chipped', frame: 0 });
  });

  it('spawn stretches over the spawn-in for both kinds', () => {
    const run = newRun(6);
    const s = run.state;
    const P = run.params;
    for (const [kind, sheet] of [
      ['peeling', PEELING],
      ['nutshell', NUTSHELL],
    ] as const) {
      const h = fakeHusk(9, kind);
      h.action = 'spawn';
      const spawn = P.husks[kind].spawn;
      h.t = 0;
      expect(huskPose(s, P, h, sheet, NO_CLOCKS, true), kind).toEqual({ anim: 'spawn', frame: 0 });
      h.t = Math.floor(spawn / 2);
      expect(huskPose(s, P, h, sheet, NO_CLOCKS, true), kind).toEqual({ anim: 'spawn', frame: 2 });
      h.t = spawn - 1;
      expect(huskPose(s, P, h, sheet, NO_CLOCKS, true), kind).toEqual({ anim: 'spawn', frame: 3 });
      // A hit clock never interrupts the spawn (a spawning Husk cannot be hit anyway).
      expect(huskPose(s, P, h, sheet, { hitMs: 10 }, true).anim, kind).toBe('spawn');
    }
  });

  it('Nutshell: walk from velocity in the chase, the slam over the active ticks and held through the recovery, chipped layers, the regrow one-shot', () => {
    const run = newRun(5);
    const s = run.state;
    const P = run.params;
    const h = fakeHusk(2, 'nutshell');
    const hp = P.husks.nutshell;
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'idle', frame: 0 });
    h.vx = 200;
    s.tick = 0;
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'walk', frame: 0 });
    s.tick = 10;
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'walk', frame: 1 });
    h.vx = 0;
    h.action = 'attack';
    h.t = 1;
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'slam', frame: 0 });
    h.t = Math.ceil(hp.active / 2);
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'slam', frame: 0 });
    h.t = hp.active;
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'slam', frame: 1 });
    h.action = 'recover';
    h.t = 1;
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'slam', frame: 1 });
    h.action = 'chase';
    h.shell = [0, 20];
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({
      anim: 'chipped_outer',
      frame: 0,
    });
    h.shell = [0, 0];
    expect(huskPose(s, P, h, NUTSHELL, NO_CLOCKS, true)).toEqual({
      anim: 'chipped_inner',
      frame: 0,
    });
    h.shell = [0, 20];
    expect(huskPose(s, P, h, NUTSHELL, { hitMs: -1, regrowMs: 0 }, true)).toEqual({
      anim: 'regrow',
      frame: 0,
    });
    expect(huskPose(s, P, h, NUTSHELL, { hitMs: -1, regrowMs: 340 }, true)).toEqual({
      anim: 'regrow',
      frame: 2,
    });
    expect(huskPose(s, P, h, NUTSHELL, { hitMs: -1, regrowMs: 600 }, true)).toEqual({
      anim: 'chipped_outer',
      frame: 0,
    });
  });

  it('flips west by the attack direction while attacking, by movement otherwise, keeping the last flip when still', () => {
    const h = fakeHusk(3, 'peeling');
    expect(huskFlip(h, false)).toBe(false);
    expect(huskFlip(h, true)).toBe(true);
    h.vx = -300;
    expect(huskFlip(h, false)).toBe(true);
    h.vx = 300;
    expect(huskFlip(h, true)).toBe(false);
    h.action = 'windup';
    h.attackDir = deg(180);
    expect(huskFlip(h, false)).toBe(true);
    h.attackDir = deg(45);
    expect(huskFlip(h, true)).toBe(false);
  });
});

describe('headless playtest (autopilot through the state machine)', () => {
  it('shows every M1 Kindled animation at least once across a clear and a death', () => {
    // Seed 1237: the patient bot lands a Haul on a Nutshell (haul_slide); at moveSpeed 100 seed 1234 no longer does.
    const shown = playthrough(newRun(1237), 60 * 60 * 5);
    playthrough(newRun(11), 60 * 60 * 5, shown);
    const deathRun = newRun(5);
    playthrough(deathRun, 60 * 20, shown);
    // Stop fighting back until the run ends, then a few frames of the death animation.
    for (let i = 0; i < 60 * 120 && deathRun.state.status === 'playing'; i++) stepRun(deathRun, 0);
    expect(deathRun.state.status).toBe('dead');
    shown.add(
      kindledPose(deathRun.state, deathRun.params, KINDLED, { hitMs: -1, deathMs: 300 }).name,
    );
    // walk is an M1 row but plays only in M2's holding (and for run on a sheet without it), never in an encounter.
    const missing = M1_PLAYABLE.filter((n) => n !== 'walk' && !shown.has(n));
    expect(shown.has('walk')).toBe(false);
    // Logged for the PR's playtest record (vitest shows stdout with --silent=false).
    console.log(`Kindled animations played: ${[...shown].sort().join(', ')}`);
    expect(missing).toEqual([]);
  });

  it('plays on a finished M1 sheet without carry or sit: nothing asks for them', () => {
    expect(Object.keys(KINDLED_M1.anims).some((k) => /^(carry_|sit_)/.test(k))).toBe(false);
    const shown = playthrough(newRun(1234), 60 * 60, new Set(), KINDLED_M1);
    playthrough(newRun(5), 60 * 20, shown, KINDLED_M1);
    expect([...shown].filter((n) => !M1_PLAYABLE.includes(n))).toEqual([]);
  });
});
