import {
  ANIMS_AWAITING_ART,
  defaultTuning,
  HUSK_ANIMS,
  isRequiredAnim,
  KINDLED_ANIMS,
  roomTemplates,
  SPRITE_FACINGS,
  spriteSheets,
  type SpriteSheet,
} from '@iot/shared';
import { autopilot, createRun, stepRun, TURN, type HuskKind, type HuskState, type Run } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import {
  BACKPEDAL_OFF_DEG,
  BACKPEDAL_ON_DEG,
  backpedalFrame,
  backpedals,
  facing4,
  GaitClock,
  gaitPose,
  huskFlip,
  huskPose,
  isMoving,
  kindledPose,
  loopFrame,
  onceFrame,
  separationDeg,
  sheetFacing,
  simDeg,
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
/** The Kindled sheet without `run`, as a sheet is while run is on `ANIMS_AWAITING_ART`: `walk` stands in. */
const KINDLED_NO_RUN: SpriteSheet = {
  ...KINDLED,
  anims: Object.fromEntries(Object.entries(KINDLED.anims).filter(([key]) => !key.startsWith('run_'))),
};
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

/**
 * The Kindled sheet as it will be once ART's run transitions land: `run_start`
 * and `run_stop` (2 frames at 20 fps, once) and `run_back` (4 frames, by
 * distance) in every facing, made from the run's frames (the test reads frame
 * indexes, never pixels).
 */
const KINDLED_TRANSITIONS: SpriteSheet = {
  ...KINDLED,
  anims: {
    ...KINDLED.anims,
    ...Object.fromEntries(
      SPRITE_FACINGS.flatMap((f) => {
        const run = KINDLED.anims[`run_${f}`];
        if (!run) throw new Error(`no run_${f}`);
        return [
          [`run_start_${f}`, { frames: run.frames.slice(0, 2), frameRate: 20, repeat: 0 }],
          [`run_stop_${f}`, { frames: run.frames.slice(2, 4), frameRate: 20, repeat: 0 }],
          [`run_back_${f}`, { frames: run.frames.slice(0, 4), frameRate: 0, repeat: -1 }],
        ];
      }),
    ),
  },
};

function newRun(seed: number): Run {
  return createRun({ seed, tuning: defaultTuning, rooms: roomTemplates, weapon: 'hookblade' });
}

/** The Husk animations a playthrough showed, per kind. */
type HuskShown = Record<HuskKind, Set<string>>;

const HUSK_SHEETS: Record<HuskKind, SpriteSheet> = { peeling: PEELING, nutshell: NUTSHELL };

/**
 * Drive a run with the autopilot through the state machine, collecting the
 * animations it showed: the Kindled's in `hits`, each Husk's in `husks` (the
 * hit and regrow clocks from the sim's events, as the client keeps them; the
 * telegraph blink at the tuning's rate from the tick).
 */
function playthrough(
  run: Run,
  maxTicks: number,
  hits: Set<string> = new Set(),
  sheet: SpriteSheet = KINDLED,
  husks: HuskShown = { peeling: new Set(), nutshell: new Set() },
): Set<string> {
  let hitAt = -1000;
  const huskHitAt = new Map<number, number>();
  const regrowAt = new Map<number, number>();
  const blinkHz = defaultTuning.juice.telegraphBlinkHz;
  for (let i = 0; i < maxTicks && run.state.status === 'playing'; i++) {
    // Patient: the autopilot lets moves play out (it would otherwise cancel every recovery and pin into the next move).
    const events = stepRun(run, autopilot(run.state, run.params, { patient: true }));
    const tick = run.state.tick;
    if (events.some((e) => e.type === 'playerHurt')) hitAt = tick;
    for (const e of events) {
      if (e.type === 'hit') huskHitAt.set(e.id, tick);
      if (e.type === 'shellRegrow') regrowAt.set(e.id, tick);
    }
    const ms = (ticks: number): number => (ticks * 1000) / 60;
    const pose = kindledPose(run.state, run.params, sheet, {
      hitMs: hitAt < 0 ? -1 : ms(tick - hitAt),
      deathMs: 0,
    });
    expect(sheet.anims[pose.anim], pose.anim).toBeDefined();
    expect(pose.frame).toBeLessThan(sheet.anims[pose.anim]?.frames.length ?? 0);
    hits.add(pose.name);
    const blink = Math.floor((ms(tick) / 1000) * blinkHz) % 2 === 0;
    for (const h of run.state.husks) {
      const hs = HUSK_SHEETS[h.kind];
      const hit = huskHitAt.get(h.id);
      const regrow = regrowAt.get(h.id);
      const hp = huskPose(run.state, run.params, h, hs, {
        hitMs: hit === undefined ? -1 : ms(tick - hit),
        ...(regrow === undefined ? {} : { regrowMs: ms(tick - regrow) }),
      }, blink);
      expect(hs.anims[hp.anim], `${h.kind} ${hp.anim}`).toBeDefined();
      expect(hp.frame).toBeLessThan(hs.anims[hp.anim]?.frames.length ?? 0);
      husks[h.kind].add(hp.anim);
    }
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

  it('takes the cycles from the anim tuning: 64 world px a walk, 96 a run, 48 a run_back', () => {
    expect(CYCLES).toEqual({ walkCyclePx: 64, runCyclePx: 96, backCyclePx: 48 });
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

  it('keeps a pose without a stride on the fixed frame rate; with one, distance wins whatever the tick', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    s.player.vx = 300;
    s.tick = 18;
    // Without a stride (tools, tests of other states): run's 16 fps on the tick.
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS)).toMatchObject({ anim: 'run_E', frame: 4 });
    // With one, the distance alone picks the frame: 80 px into a 96 px cycle of 8 is frame 6, at tick 18 as at tick 6.
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(80))).toMatchObject({ anim: 'run_E', frame: 6 });
    s.tick = 6;
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(80)).frame).toBe(6);
    // The Nutshell's walk stays time-based (huskPose takes no stride): 6 fps on the tick.
    const h = fakeHusk(1, 'nutshell');
    h.vx = 200;
    s.tick = 10;
    expect(huskPose(s, run.params, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'walk', frame: 1 });
    s.tick = 20;
    expect(huskPose(s, run.params, h, NUTSHELL, NO_CLOCKS, true)).toEqual({ anim: 'walk', frame: 2 });
  });
});

describe('the backpedal: the run played in reverse (G1.5h)', () => {
  const stride = (distancePx: number, backpedal: boolean): Stride => ({ distancePx, cycles: CYCLES, backpedal });

  /** The run frames over one cycle (8 frames, 12 world px each) facing east while moving `moveDeg` from east. */
  function cycle(moveDeg: number): number[] {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    s.player.vx = 300;
    const back = backpedals(false, separationDeg(moveDeg, simDeg(s.player.aim)));
    return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(k * 12, back)).frame);
  }

  it('measures the angle between movement and facing the short way round, and reads the sim aim in degrees', () => {
    expect(separationDeg(0, 0)).toBe(0);
    expect(separationDeg(90, 0)).toBe(90);
    expect(separationDeg(0, 90)).toBe(90);
    expect(separationDeg(180, 0)).toBe(180);
    expect(separationDeg(350, 10)).toBe(20);
    expect(separationDeg(-90, 90)).toBe(180);
    expect(separationDeg(135, -90)).toBe(135);
    expect([deg(0), deg(90), deg(180), deg(270)].map(simDeg)).toEqual([0, 90, 180, 270]);
  });

  it('plays forwards at 0° and 90° (strafing), backwards at 135° and 180°: frame n − 1 − f, the facing the aim\'s', () => {
    expect(cycle(0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(cycle(90)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(cycle(135)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(cycle(180)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    const run = newRun(1);
    run.state.player.aim = deg(0);
    run.state.player.vx = -300;
    expect(kindledPose(run.state, run.params, KINDLED, NO_CLOCKS, stride(12, true))).toMatchObject({
      name: 'run',
      anim: 'run_E',
      frame: 6,
    });
    expect(backpedalFrame(8, 0)).toBe(7);
    expect(backpedalFrame(8, 7)).toBe(0);
    expect(backpedalFrame(1, 0)).toBe(0);
  });

  it('turns on above 112.5° and off below 100°; 105° keeps whatever it had', () => {
    expect([BACKPEDAL_ON_DEG, BACKPEDAL_OFF_DEG]).toEqual([112.5, 100]);
    expect(backpedals(false, 113)).toBe(true);
    expect(backpedals(false, 112.5)).toBe(false);
    expect(backpedals(true, 99)).toBe(false);
    expect(backpedals(true, 100)).toBe(true);
    expect(backpedals(false, 105)).toBe(false);
    expect(backpedals(true, 105)).toBe(true);
    // A stick wandering over the boundary: on once past 112.5, held through 105, off once under 100.
    let back = false;
    const trace = [90, 105, 112, 113, 110, 105, 101, 99, 105].map((a) => (back = backpedals(back, a)));
    expect(trace).toEqual([false, false, false, true, true, true, true, false, false]);
  });

  it('keeps walk, and the Nutshell, forwards: only the run gait reverses', () => {
    expect(gaitPose(KINDLED, 'walk', deg(0), 0, stride(11, true))).toMatchObject({ anim: 'walk_E', frame: 1 });
    expect(gaitPose(KINDLED, 'run', deg(0), 0, stride(12, true))).toMatchObject({ anim: 'run_E', frame: 6 });
    // walk standing in for run (a sheet without run) is the run gait: it reverses with it, at the run's cycle.
    expect(gaitPose(KINDLED_NO_RUN, 'run', deg(0), 0, stride(16, true))).toMatchObject({ anim: 'walk_E', frame: 4 });
  });

  it('carries the distance cycle on through a stop while backpedalling, and the meter keeps the heading', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    const meter = new StrideMeter();
    let back = false;
    const pose = () => {
      if (meter.headingDeg !== null) back = backpedals(back, separationDeg(meter.headingDeg, simDeg(s.player.aim)));
      return kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(meter.distancePx, back));
    };
    meter.step(100, 100);
    expect(meter.headingDeg).toBeNull();
    // Running west 6 sim px (12 world px) a frame while facing east: the cycle counts down from 7.
    s.player.vx = -300;
    const frames: number[] = [];
    for (const x of [94, 88, 82]) {
      meter.step(x, 100);
      frames.push(pose().frame);
    }
    expect(meter.headingDeg).toBe(180);
    expect(frames).toEqual([6, 5, 4]);
    // Stop for a second: idle; the distance and the heading hold.
    s.player.vx = 0;
    for (let i = 0; i < 60; i++) {
      s.tick++;
      meter.step(82, 100);
      expect(pose().name).toBe('idle');
    }
    expect(meter.distancePx).toBe(36);
    expect(meter.headingDeg).toBe(180);
    // Restart west: the cycle picks up at 4, then 3; no pop to 7.
    s.player.vx = -300;
    expect(pose().frame).toBe(4);
    meter.step(76, 100);
    expect(pose().frame).toBe(3);
    // Turn and run east, towards the aim: forwards from the same distance, 60 px in is frame 5.
    s.player.vx = 300;
    meter.step(82, 100);
    expect(meter.headingDeg).toBe(0);
    expect(pose().frame).toBe(5);
    // South is 90°, strafing: forwards, and the diagonal's heading is 45°.
    meter.step(82, 106);
    expect(meter.headingDeg).toBe(90);
    expect(pose().frame).toBe(6);
    meter.step(88, 112);
    expect(meter.headingDeg).toBeCloseTo(45);
  });
});

describe('run transitions and run_back (M1 polish, ART 2026-10-17)', () => {
  const stride = (distancePx: number, backpedal = false): Stride => ({ distancePx, cycles: CYCLES, backpedal });
  const T = KINDLED_TRANSITIONS;

  it('lists the three rows as awaiting art, so kindled-ash without them is still finished and plays as before', () => {
    expect(ANIMS_AWAITING_ART).toEqual(['run_start', 'run_stop', 'run_back']);
    expect(Object.keys(KINDLED.anims).some((k) => /^run_(start|stop|back)_/.test(k))).toBe(false);
    expect(Object.keys(T.anims).filter((k) => /^run_(start|stop|back)_/.test(k))).toHaveLength(24);
  });

  it('plays run_back forwards by distance, one cycle per anim.backCyclePx, when the sheet has it; else the run in reverse', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    s.player.vx = -300;
    // 4 frames over 48 px: a frame every 12 px, like the run's, wrapping each cycle.
    const back = [0, 11, 12, 24, 36, 47, 48, 60].map((d) => kindledPose(s, run.params, T, NO_CLOCKS, stride(d, true)));
    expect(back.map((p) => p.frame)).toEqual([0, 0, 1, 2, 3, 3, 0, 1]);
    expect(back[0]).toMatchObject({ name: 'run_back', anim: 'run_back_E', facing: 'E' });
    // Not backpedalling: the run, forwards, whatever the sheet has.
    expect(kindledPose(s, run.params, T, NO_CLOCKS, stride(12))).toMatchObject({ name: 'run', frame: 1 });
    // The same on kindled-ash today: the run in reverse (the stopgap).
    expect(kindledPose(s, run.params, KINDLED, NO_CLOCKS, stride(12, true))).toMatchObject({ name: 'run', frame: 6 });
    // walk never backpedals, and the gait helper agrees.
    expect(gaitPose(T, 'walk', deg(0), 0, stride(12, true))).toMatchObject({ anim: 'walk_E', frame: 1 });
    expect(gaitPose(T, 'run', deg(0), 0, stride(24, true))).toMatchObject({ anim: 'run_back_E', frame: 2 });
  });

  it('plays run_start once (2 frames at 20 fps, 100 ms) from the start clock, then hands over to the run at its distance phase', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(0);
    s.player.vx = 300;
    const at = (runStartMs: number, d = 60) => kindledPose(s, run.params, T, { hitMs: -1, runStartMs }, stride(d));
    expect(at(0)).toMatchObject({ name: 'run_start', anim: 'run_start_E', frame: 0 });
    expect(at(49)).toMatchObject({ name: 'run_start', frame: 0 });
    expect(at(50)).toMatchObject({ name: 'run_start', frame: 1 });
    expect(at(99)).toMatchObject({ name: 'run_start', frame: 1 });
    // Over: the run, 60 px into its 96 px cycle (frame 5), not frame 0.
    expect(at(100)).toMatchObject({ name: 'run', frame: 5 });
    expect(at(-1)).toMatchObject({ name: 'run', frame: 5 });
    // Into a backpedal the start plays too, then run_back at its phase.
    s.player.vx = -300;
    expect(kindledPose(s, run.params, T, { hitMs: -1, runStartMs: 0 }, stride(24, true))).toMatchObject({ name: 'run_start', frame: 0 });
    expect(kindledPose(s, run.params, T, { hitMs: -1, runStartMs: 100 }, stride(24, true))).toMatchObject({ name: 'run_back', frame: 2 });
    // Without the row on the sheet the run plays directly, as today.
    expect(kindledPose(s, run.params, KINDLED, { hitMs: -1, runStartMs: 0 }, stride(24))).toMatchObject({ name: 'run' });
  });

  it('plays run_stop once from the stop clock, then idle; nothing without the row', () => {
    const run = newRun(1);
    const s = run.state;
    s.player.aim = deg(90);
    const at = (runStopMs: number) => kindledPose(s, run.params, T, { hitMs: -1, runStopMs });
    expect(at(0)).toMatchObject({ name: 'run_stop', anim: 'run_stop_S', frame: 0 });
    expect(at(50)).toMatchObject({ name: 'run_stop', frame: 1 });
    expect(at(100)).toMatchObject({ name: 'idle' });
    expect(at(-1)).toMatchObject({ name: 'idle' });
    expect(kindledPose(s, run.params, KINDLED, { hitMs: -1, runStopMs: 0 })).toMatchObject({ name: 'idle' });
    // A hit, an attack or a dodge wins over a transition clock: the sim's state is the authority.
    expect(kindledPose(s, run.params, T, { hitMs: 10, runStopMs: 0 })).toMatchObject({ name: 'hit' });
    s.player.action = 'dodge';
    s.player.t = 1;
    expect(kindledPose(s, run.params, T, { hitMs: -1, runStopMs: 0, runStartMs: 0 })).toMatchObject({ name: 'dodge' });
  });

  it('GaitClock: starts from idle, stops, ends on a turn, an attack or a stop again, in sim ticks', () => {
    const run = newRun(1);
    const s = run.state;
    const p = s.player;
    const clock = new GaitClock();
    const tick = (n: number, patch: Partial<typeof p> = {}) => {
      s.tick = n;
      Object.assign(p, patch);
      return clock.update(s);
    };
    p.aim = deg(0);
    expect(tick(0)).toEqual({ runStartMs: -1, runStopMs: -1 });
    // Starts moving at tick 10: the start clock runs, 50 ms at tick 13.
    expect(tick(10, { vx: 300 })).toEqual({ runStartMs: 0, runStopMs: -1 });
    expect(tick(13)).toEqual({ runStartMs: 50, runStopMs: -1 });
    expect(tick(16)).toEqual({ runStartMs: 100, runStopMs: -1 });
    // Stops at tick 40: the stop clock runs, the start one is gone.
    expect(tick(40, { vx: 0 })).toEqual({ runStartMs: -1, runStopMs: 0 });
    expect(tick(43)).toEqual({ runStartMs: -1, runStopMs: 50 });
    // Starts again during the stop: run_start, and the stop ends.
    expect(tick(44, { vx: 300 })).toEqual({ runStartMs: 0, runStopMs: -1 });
    // Stops again during the start: run_stop.
    expect(tick(46, { vx: 0 })).toEqual({ runStartMs: -1, runStopMs: 0 });
    // A turn (the 8-way facing changes) ends a transition at once.
    expect(tick(47, { aim: deg(90) })).toEqual({ runStartMs: -1, runStopMs: -1 });
    expect(tick(50, { vx: 300 })).toEqual({ runStartMs: 0, runStopMs: -1 });
    expect(tick(51, { aim: deg(180) })).toEqual({ runStartMs: -1, runStopMs: -1 });
    // An attack clears the clocks; a move ending with the body still moving starts no run_start.
    expect(tick(60, { action: 'light', t: 1 })).toEqual({ runStartMs: -1, runStopMs: -1 });
    expect(tick(70, { action: 'idle', t: 0 })).toEqual({ runStartMs: -1, runStopMs: -1 });
    // ... but stopping after it does play run_stop, and starting from that idle plays run_start.
    expect(tick(72, { vx: 0 })).toEqual({ runStartMs: -1, runStopMs: 0 });
    expect(tick(80, { vx: 300 })).toEqual({ runStartMs: 0, runStopMs: -1 });
    // A dodge mid-run: the clocks clear and stay clear while the roll ends with the body moving.
    expect(tick(81, { action: 'dodge', t: 1 })).toEqual({ runStartMs: -1, runStopMs: -1 });
    expect(tick(95, { action: 'idle', vx: 200 })).toEqual({ runStartMs: -1, runStopMs: -1 });
    expect(isMoving({ vx: 64, vy: 0 })).toBe(false);
    expect(isMoving({ vx: 65, vy: 0 })).toBe(true);
  });

  it('shows run_start, run_stop and run_back on a sheet with them through an autopilot run, and the transition frames never go past 1', () => {
    const run = newRun(1237);
    const s = run.state;
    const clock = new GaitClock();
    const meter = new StrideMeter();
    let back = false;
    const shown = new Map<string, Set<number>>();
    for (let i = 0; i < 60 * 60 * 2 && s.status === 'playing'; i++) {
      stepRun(run, autopilot(s, run.params, { patient: true }));
      meter.step(s.player.x / 256, s.player.y / 256);
      if (meter.headingDeg !== null) back = backpedals(back, separationDeg(meter.headingDeg, simDeg(s.player.aim)));
      const pose = kindledPose(s, run.params, T, { hitMs: -1, ...clock.update(s) }, { distancePx: meter.distancePx, cycles: CYCLES, backpedal: back });
      expect(T.anims[pose.anim], pose.anim).toBeDefined();
      (shown.get(pose.name) ?? shown.set(pose.name, new Set()).get(pose.name))?.add(pose.frame);
    }
    expect([...shown.keys()]).toEqual(expect.arrayContaining(['run_start', 'run_stop', 'run_back', 'run', 'idle']));
    expect([...(shown.get('run_start') ?? [])].sort()).toEqual([0, 1]);
    // The bot rarely stands still for the full 100 ms: run_stop shows its first frame at least, never a third.
    expect([...(shown.get('run_stop') ?? [])].every((f) => f === 0 || f === 1)).toBe(true);
    expect(shown.get('run_stop')?.has(0)).toBe(true);
    expect(Math.max(...(shown.get('run_back') ?? []))).toBeLessThanOrEqual(3);
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

/**
 * Husk animations the state machine never returns: `death` and `drop` play on
 * the corpse the renderer keeps after the sim removes the Husk (characters.ts,
 * on the client clock), so no `huskPose` of a living Husk can show them.
 */
const HUSK_ON_CORPSE = ['death', 'drop'];
/**
 * Husk animations the autopilot never reaches: the Nutshell's `regrow` needs
 * its inner shell chipped and then `innerRegrowMs` (8 s) with no hit, and
 * the bot never backs off a chipped Nutshell (no seed in 1–80 regrows one).
 * The state test above plays it from a regrow clock instead.
 */
const HUSK_NOT_BY_AUTOPILOT = ['regrow'];

describe('headless playtest (autopilot through the state machine)', () => {
  it('shows every M1 Kindled animation, and every Husk animation of both tables the sim can reach, across a clear and a death', () => {
    // Seed 1237: the patient bot lands a Haul on a Nutshell (haul_slide); at moveSpeed 100 seed 1234 no longer does.
    const husks: HuskShown = { peeling: new Set(), nutshell: new Set() };
    const shown = playthrough(newRun(1237), 60 * 60 * 5, new Set(), KINDLED, husks);
    playthrough(newRun(11), 60 * 60 * 5, shown, KINDLED, husks);
    const deathRun = newRun(5);
    playthrough(deathRun, 60 * 20, shown, KINDLED, husks);
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
    // Every Husk animation the bot can reach showed; death and drop belong to the corpse, regrow to a patient player.
    for (const kind of ['peeling', 'nutshell'] as const) {
      const reachable = HUSK_ANIMS[kind].filter((n) => !HUSK_ON_CORPSE.includes(n) && !HUSK_NOT_BY_AUTOPILOT.includes(n));
      console.log(`${kind} animations played: ${[...husks[kind]].sort().join(', ')}`);
      expect(reachable.filter((n) => !husks[kind].has(n)), kind).toEqual([]);
      expect([...husks[kind]].filter((n) => HUSK_ON_CORPSE.includes(n) || HUSK_NOT_BY_AUTOPILOT.includes(n)), kind).toEqual([]);
    }
  });

  it('plays on a finished M1 sheet without carry or sit: nothing asks for them', () => {
    expect(Object.keys(KINDLED_M1.anims).some((k) => /^(carry_|sit_)/.test(k))).toBe(false);
    const shown = playthrough(newRun(1234), 60 * 60, new Set(), KINDLED_M1);
    playthrough(newRun(5), 60 * 20, shown, KINDLED_M1);
    expect([...shown].filter((n) => !M1_PLAYABLE.includes(n))).toEqual([]);
  });
});
