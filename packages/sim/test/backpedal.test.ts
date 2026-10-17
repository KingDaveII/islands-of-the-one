import { roomTemplates } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  backpedalFactor,
  createRun,
  degToAngle,
  HALF_TURN,
  hashRunState,
  length,
  replayRun,
  roomFromTemplate,
  stepRun,
  SUB,
  TILE,
  type Run,
} from '../src/index.js';
import {
  addHusk,
  arena,
  Button,
  input,
  retune,
  step,
  stepUntil,
  tuning,
  WEAPON,
} from './helpers.js';

/**
 * The backpedal (GAME DESIGN 2026-10-17): free movement away from the aim is
 * slower, 1 up to 90° (strafing is never slowed), easing linearly to 0.85 at
 * 135° and staying there to 180°. Free movement only: the dodge, the Haul's
 * pull and every forced movement keep their full distances.
 */

/** A 16 × 16 open room with the player in its middle, no chests. */
function openRoom(run: Run): void {
  const s = run.state;
  s.room = roomFromTemplate(0, {
    name: 'Open',
    tiles: [
      '################',
      ...Array.from({ length: 14 }, () => '#..............#'),
      '################',
    ],
  });
  s.chests = [];
  s.player.x = 8 * TILE;
  s.player.y = 8 * TILE;
  s.player.vx = 0;
  s.player.vy = 0;
}

/** Move directions in 1/256 turn. */
const E = 0;
const S = 64;
const W = 128;
const AIM_E = 0;

/**
 * World px the Kindled moved over `ticks` of full-stick movement along
 * `moveDir` while aiming `aim`; in Combat (a Peeling awake across the room,
 * held still) or in Calm (no hostile).
 */
function travel(moveDir: number, aim: number, ticks = 60, buttons = 0, combat = true): number {
  const run = arena();
  openRoom(run);
  if (combat) {
    retune(run, (t) => {
      t.husks.peeling.speed = 0;
    });
    addHusk(run, 'peeling', 0, { x: run.state.player.x, y: run.state.player.y - 100 * SUB });
    step(run);
    expect(run.state.context).toBe('combat');
  }
  const p = run.state.player;
  const x0 = p.x;
  const y0 = p.y;
  for (let i = 0; i < ticks; i++) stepRun(run, input(buttons, aim, 7, moveDir));
  return length(p.x - x0, p.y - y0) / SUB;
}

describe('the backpedal factor', () => {
  it('takes its numbers from the tuning: 0.85 from 90° to 135°', () => {
    const P = arena().params;
    expect([
      tuning.player.backpedalFactor,
      tuning.player.backpedalFromDeg,
      tuning.player.backpedalFullDeg,
    ]).toEqual([0.85, 90, 135]);
    expect([P.player.backpedal, P.player.backpedalFrom, P.player.backpedalFull]).toEqual([
      850, 1024, 1536,
    ]);
  });

  it('is 1 at 0° and 90°, eases to 0.925 at 112.5° and 0.85 at 135°, and stays there to 180°', () => {
    const P = arena().params;
    const at = (deg: number) => backpedalFactor(P, degToAngle(deg), AIM_E);
    expect([0, 90, 112.5, 135, 180].map(at)).toEqual([1000, 1000, 925, 850, 850]);
    // The short way round, on either side of the aim.
    expect([-90, -112.5, -135, -180, 270, 225].map(at)).toEqual([1000, 925, 850, 850, 1000, 850]);
    expect(backpedalFactor(P, degToAngle(45), degToAngle(180))).toBe(850);
    expect(backpedalFactor(P, degToAngle(100), degToAngle(10))).toBe(1000);
    // Linear between the two angles, in whole permille: never above 1000 or below the factor.
    for (let deg = 0; deg <= 360; deg += 5) {
      const f = at(deg);
      expect(f).toBeGreaterThanOrEqual(850);
      expect(f).toBeLessThanOrEqual(1000);
    }
    expect(at(101.25)).toBe(963);
    expect(at(123.75)).toBe(888);
  });

  it('slows free movement away from the aim to 0.85 in Combat, strafing and running toward the aim not at all', () => {
    const forward = travel(E, AIM_E);
    const strafe = travel(S, AIM_E);
    const back = travel(W, AIM_E);
    // A second at 100 px/s, less the acceleration ramp (the room's wall is 122 px away).
    expect(forward).toBeGreaterThan(80);
    expect(strafe).toBeCloseTo(forward, 0);
    expect(back / forward).toBeCloseTo(0.85, 2);
    // With the aim following the movement (a centred pad stick), nothing is slowed.
    expect(travel(W, HALF_TURN)).toBeCloseTo(forward, 0);
  });

  it('never slows in Calm: a cleared room, or the holding (GAME DESIGN 2026-10-17)', () => {
    const forward = travel(E, AIM_E, 60, 0, false);
    const back = travel(W, AIM_E, 60, 0, false);
    expect(forward).toBeGreaterThan(80);
    expect(back).toBe(forward);
    // The arena is Calm until a hostile wakes.
    const run = arena();
    expect(run.state.context).toBe('calm');
  });

  it("never slows the heavy's charge walk: 0.45 × with no backpedal on top, even at 180° in Combat", () => {
    const forward = travel(E, AIM_E, 60, Button.Heavy);
    const back = travel(W, AIM_E, 60, Button.Heavy);
    expect(forward).toBeGreaterThan(30);
    expect(forward).toBeLessThan(travel(E, AIM_E));
    expect(back).toBe(forward);
  });

  it('a dodge at a backwards angle keeps its full distance', () => {
    const roll = (moveDir: number, aim: number): number => {
      const run = arena();
      openRoom(run);
      const p = run.state.player;
      const x0 = p.x;
      const y0 = p.y;
      stepRun(run, input(Button.Dodge, aim, 7, moveDir));
      expect(p.action).toBe('dodge');
      stepUntil(run, () => p.action !== 'dodge', 100, 0, aim);
      return length(p.x - x0, p.y - y0);
    };
    const toward = roll(E, AIM_E);
    const away = roll(W, AIM_E);
    expect(toward).toBeGreaterThan(40 * SUB);
    expect(away).toBe(toward);
  });

  it("a Haul's pull at a backwards angle keeps its full distance and time", () => {
    const pulled = (aimDuringPull: number): { ticks: number; dist: number } => {
      const run = arena();
      openRoom(run);
      const s = run.state;
      s.room.timer = -1_000_000;
      const p = run.state.player;
      const h = addHusk(run, 'nutshell', 100, { cooldown: 100_000 });
      step(run, Button.Ability1, AIM_E);
      stepUntil(run, () => p.hook?.pull === 'player', 60, 0, AIM_E);
      let ticks = 0;
      while (p.hook !== null) {
        step(run, 0, aimDuringPull);
        ticks++;
      }
      return { ticks, dist: length(h.x - p.x, h.y - p.y) };
    };
    const facing = pulled(AIM_E);
    const turned = pulled(HALF_TURN);
    expect(facing.ticks).toBeGreaterThan(3);
    expect(turned).toEqual(facing);
    const haul = arena().params.weapon.abilities[0]?.haul;
    expect(turned.dist).toBeLessThanOrEqual(haul?.playerPull ?? 0);
  });

  it('replays exactly: a run with backpedalling inputs gives the same hash again', () => {
    const run = createRun({ seed: 77, tuning, rooms: roomTemplates, weapon: WEAPON });
    const s = run.state;
    for (let i = 0; i < 600; i++) {
      const dir = [E, S, W, 192][Math.floor(i / 40) % 4] ?? 0;
      const buttons = i % 150 === 149 ? Button.Dodge : i % 70 === 69 ? Button.Light : 0;
      stepRun(run, input(buttons, AIM_E, 7, dir));
    }
    expect(s.tick).toBe(600);
    const again = replayRun(run.record);
    expect(hashRunState(again.state)).toBe(hashRunState(s));
    expect(again.state).toEqual(s);
  });
});
