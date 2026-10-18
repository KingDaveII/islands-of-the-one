import { defaultTuning, holdingLayout, holdingRoomTiles, holdingStart, spriteSheets, SPRITE_FACINGS, type SpriteSheet } from '@iot/shared';
import { createRoam, encodeInput, stepRoam, tileCentre, type Roam } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import { RoamGaitClock, roamPose } from './animState.js';
import { PLAYER_SHEET } from './characters.js';
import { StrideMeter } from './stride.js';

/**
 * The Kindled on the holding (M2 Task 3b): walk by distance while walking, run
 * once the roam breaks into one, idle standing, the facing from the movement;
 * the run transitions from the roam's gait where a sheet has them.
 */
const KINDLED = spriteSheets[PLAYER_SHEET];
const CYCLES = defaultTuning.anim;
const layout = holdingLayout();
const roam = (): Roam =>
  createRoam({
    template: { name: layout.id, tiles: holdingRoomTiles(layout) },
    start: tileCentre(holdingStart(layout).col, holdingStart(layout).row),
    tuning: { player: defaultTuning.player, roam: defaultTuning.roam },
  });
const move = (dir: number, mag = 7): number => encodeInput({ aim: 0, moveDir: dir, moveMag: mag, buttons: 0 });
const still = encodeInput({ aim: 0, moveDir: 0, moveMag: 0, buttons: 0 });
const NONE = { runStartMs: -1, runStopMs: -1 };

/** kindled-ash with the run transitions, made from the run's frames (indexes only). */
const WITH_TRANSITIONS: SpriteSheet = {
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
        ];
      }),
    ),
  },
};

describe('roamPose', () => {
  it('idles facing south at the start, walks by distance facing the movement, then runs once the gait turns', () => {
    const r = roam();
    const stride = new StrideMeter();
    const at = (): { distancePx: number; cycles: typeof CYCLES } => ({ distancePx: stride.step(r.state.x / 256, r.state.y / 256), cycles: CYCLES });
    expect(roamPose(r.state, KINDLED, NONE, at())).toMatchObject({ name: 'idle', facing: 'S' });
    for (let i = 0; i < 30; i++) stepRoam(r, move(0));
    const walk = roamPose(r.state, KINDLED, NONE, at());
    expect(walk).toMatchObject({ name: 'walk', facing: 'E', anim: 'walk_E' });
    expect(walk.frame).toBe(Math.floor((stride.distancePx * 6) / CYCLES.walkCyclePx) % 6);
    for (let i = 0; i < 80; i++) stepRoam(r, move(0));
    expect(r.state.gait).toBe('run');
    const run = roamPose(r.state, KINDLED, NONE, at());
    expect(run).toMatchObject({ name: 'run', facing: 'E', anim: 'run_E' });
    expect(run.frame).toBe(Math.floor((stride.distancePx * 8) / CYCLES.runCyclePx) % 8);
    // Standing still keeps the last facing.
    for (let i = 0; i < 40; i++) stepRoam(r, still);
    expect(roamPose(r.state, KINDLED, NONE, at())).toMatchObject({ name: 'idle', facing: 'E' });
    // Without a stride the loops run on the tick.
    expect(roamPose(r.state, KINDLED, NONE).name).toBe('idle');
  });

  it('plays run_start when the run begins and run_stop when it ends, on a sheet with them, from the roam gait clock', () => {
    const r = roam();
    const clock = new RoamGaitClock();
    let pose = roamPose(r.state, WITH_TRANSITIONS, clock.update(r.state));
    expect(pose.name).toBe('idle');
    for (let i = 0; i < 72; i++) {
      stepRoam(r, move(0));
      pose = roamPose(r.state, WITH_TRANSITIONS, clock.update(r.state));
      expect(pose.name).toBe('walk');
    }
    stepRoam(r, move(0));
    expect(r.state.gait).toBe('run');
    pose = roamPose(r.state, WITH_TRANSITIONS, clock.update(r.state));
    expect(pose).toMatchObject({ name: 'run_start', frame: 0 });
    for (let i = 0; i < 5; i++) stepRoam(r, move(0));
    expect(roamPose(r.state, WITH_TRANSITIONS, clock.update(r.state))).toMatchObject({ name: 'run_start', frame: 1 });
    for (let i = 0; i < 6; i++) stepRoam(r, move(0));
    expect(roamPose(r.state, WITH_TRANSITIONS, clock.update(r.state)).name).toBe('run');
    // A stop: run_stop for 100 ms, then idle.
    stepRoam(r, still);
    expect(roamPose(r.state, WITH_TRANSITIONS, clock.update(r.state))).toMatchObject({ name: 'run_stop', frame: 0 });
    for (let i = 0; i < 7; i++) stepRoam(r, still);
    expect(roamPose(r.state, WITH_TRANSITIONS, clock.update(r.state)).name).toBe('idle');
    // kindled-ash lacks the rows: it switches directly.
    const q = roam();
    const qc = new RoamGaitClock();
    for (let i = 0; i < 73; i++) stepRoam(q, move(0));
    expect(roamPose(q.state, KINDLED, qc.update(q.state)).name).toBe('run');
  });
});
