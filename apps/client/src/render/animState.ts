import {
  isAwaitingArt,
  isV2Sheet,
  SPRITE_FACINGS,
  type AnimTuning,
  type SpriteAnim,
  type SpriteFacing,
  type SpriteSheet,
} from '@iot/shared';
import {
  abilityAt,
  heavyTiming,
  huskParams,
  lightStrike,
  playerAttackPhase,
  SUB,
  TICK_HZ,
  TURN,
  type HuskState,
  type Params,
  type PlayerState,
  type RunState,
  type StrikePhase,
} from '@iot/sim';
import { facingIndex } from './facing.js';

/**
 * The animation state machine (docs/design/sprites.md, "Engine"): a pure map
 * from sim state to a sheet frame. The client never decides gameplay, so
 * every choice here reads the sim (action, phase ticks, hook, held husks,
 * shell layers, the tick for loops); the only client-side clocks are the
 * 100 ms hit frame, the Nutshell's regrow one-shot and the death animation,
 * which plays after the sim has stopped.
 *
 * Timing: the sim's move windows are the authority. An animation with a
 * window (dodge, lights, the thrust, Haul) is stretched or cut to fit its
 * startup / active / recovery ticks; looping and one-shot animations
 * (idle, charge, telegraph, death) run at the sheet's frame rate from the
 * sim tick, so they freeze in hitstop and slow with slow-mo. The Kindled's
 * walk and run on a v2 sheet play by distance instead (`Stride`): one cycle
 * per `anim.walkCyclePx` / `anim.runCyclePx` world px the body moves, so the
 * feet keep pace with the ground at any speed.
 */
export interface Pose {
  /** Key of the sheet's `anims` entry (`walk_SE`, `telegraph`). */
  anim: string;
  /** Index into that entry's frames. */
  frame: number;
}

export interface KindledPose extends Pose {
  /** The animation name before the facing (`walk`). */
  name: string;
  facing: SpriteFacing;
}

/** Client-side clocks, ms since the event (negative: never). */
export interface Clocks {
  /** Since the last hit on this entity. */
  hitMs: number;
  /** Since the sim stopped on the player's death. */
  deathMs?: number;
  /** Since the Nutshell's inner shell regrew. */
  regrowMs?: number;
}

/** The hit frame shows this long after a hit that did not stun (sprites.md: hit, 100 ms); a stun holds it for its whole length. */
export const HIT_MS = 100;
/** The player's walk cycle plays once the body moves faster than this (units per tick). */
const WALK_THRESHOLD = SUB / 4;

/**
 * How far the Kindled's body has moved, for the walk and run cycles: the
 * world px between its interpolated render positions, summed by the renderer
 * (`StrideMeter`). It keeps growing through stops, so a restart picks the
 * cycle up where it stopped. It only picks a frame; the sim moves the body.
 */
export interface Stride {
  /** World px moved so far. */
  distancePx: number;
  /** The `anim` tuning: world px per full walk cycle and per full run cycle. */
  cycles: AnimTuning;
}

/** The Kindled's two ways of moving. In an encounter it always runs (GAME DESIGN 2026-10-16); walking is M2's holding. */
export type Gait = 'walk' | 'run';

/** The animation that plays for a row on `ANIMS_AWAITING_ART`, or missing from a sheet (v1 has no run). */
const STAND_IN: Readonly<Record<string, string>> = { run: 'walk' };

const ticks = (ms: number): number => (ms * TICK_HZ) / 1000;

/** Frame of a looping animation at the sheet's rate, from a tick count. */
export function loopFrame(anim: SpriteAnim, tick: number): number {
  const n = anim.frames.length;
  if (n <= 1 || anim.frameRate <= 0) return 0;
  return Math.floor((Math.max(0, tick) * anim.frameRate) / TICK_HZ) % n;
}

/**
 * Frame of a cycle played by distance: `cyclePx` world px per full cycle, so
 * `floor(distance / cyclePx × frames) mod frames`.
 */
export function strideFrame(anim: SpriteAnim, distancePx: number, cyclePx: number): number {
  const n = anim.frames.length;
  if (n <= 1 || cyclePx <= 0) return 0;
  return Math.floor((Math.max(0, distancePx) * n) / cyclePx) % n;
}

/** Frame of a one-shot animation at the sheet's rate, holding the last frame, from a tick count. */
export function onceFrame(anim: SpriteAnim, tick: number): number {
  const n = anim.frames.length;
  if (n <= 1 || anim.frameRate <= 0) return 0;
  return Math.min(n - 1, Math.floor((Math.max(0, tick) * anim.frameRate) / TICK_HZ));
}

/** One phase of a move window: its length in ticks and the share of the animation's frames it gets. */
export interface Segment {
  len: number;
  share: number;
}

/**
 * Stretch or cut an animation of `n` frames over consecutive segments:
 * each segment gets a share of the frames (rounded cumulatively, so no
 * frame is lost) spread evenly over its ticks. `t` counts from 1 on the
 * first tick of the first segment (the sim's convention). A segment with
 * no frame of its own holds the previous one's last frame.
 */
export function spreadFrame(n: number, segments: readonly Segment[], t: number): number {
  if (n <= 1) return 0;
  const total = segments.reduce((sum, s) => sum + s.share, 0);
  let cum = 0;
  let start = 0;
  let elapsed = 0;
  for (const seg of segments) {
    cum += seg.share;
    const end = total > 0 ? Math.round((n * cum) / total) : n;
    const count = end - start;
    const tIn = t - elapsed;
    if (tIn <= seg.len || seg === segments[segments.length - 1]) {
      if (count <= 0) return Math.max(0, start - 1);
      const len = Math.max(1, seg.len);
      const i = Math.floor((Math.max(0, Math.min(len, tIn) - 1) * count) / len);
      return Math.min(n - 1, start + Math.max(0, Math.min(count - 1, i)));
    }
    elapsed += seg.len;
    start = end;
  }
  return n - 1;
}

/** The segments of a startup / active / recovery window with the given frame shares. */
function windowSegments(
  w: { startup: number; active: number; recovery: number },
  shares: [number, number, number],
): Segment[] {
  return [
    { len: w.startup, share: shares[0] },
    { len: w.active, share: shares[1] },
    { len: w.recovery, share: shares[2] },
  ];
}

/** Nearest of the 4 facings (S, E, N, W) to a sim angle; ties on the diagonals go clockwise. */
export function facing4(angle: number): SpriteFacing {
  const i = ((angle + TURN / 8) & (TURN - 1)) >> 10; // 0 E, 1 S, 2 W, 3 N
  return (['E', 'S', 'W', 'N'] as const)[i] ?? 'S';
}

/**
 * The facing the sheet has for an animation nearest to `angle`: one of 8
 * when the animation has all eight, else the nearest of 4, else of 2 (S, E),
 * else whatever it has.
 */
export function sheetFacing(sheet: SpriteSheet, name: string, angle: number): SpriteFacing {
  const has = (f: SpriteFacing): boolean => `${name}_${f}` in sheet.anims;
  const eight = SPRITE_FACINGS[facingIndex(angle)] ?? 'S';
  if (has(eight)) return eight;
  const four = facing4(angle);
  if (has(four)) return four;
  const two: SpriteFacing = four === 'W' ? 'E' : four === 'N' ? 'S' : four;
  if (has(two)) return two;
  return SPRITE_FACINGS.find(has) ?? 'S';
}

/** The pose of a Kindled animation: its sheet anim for the nearest facing, with a clamped frame. */
function kindledPoseOf(
  sheet: SpriteSheet,
  name: string,
  angle: number,
  frame: (anim: SpriteAnim) => number,
): KindledPose {
  const facing = sheetFacing(sheet, name, angle);
  const key = `${name}_${facing}`;
  const anim = sheet.anims[key];
  const n = anim?.frames.length ?? 1;
  return { name, facing, anim: key, frame: anim ? Math.max(0, Math.min(n - 1, frame(anim))) : 0 };
}

/** Whether the sheet has an animation in any facing. */
function hasAnim(sheet: SpriteSheet, name: string): boolean {
  return SPRITE_FACINGS.some((f) => `${name}_${f}` in sheet.anims);
}

/**
 * The Kindled moving at a gait: `run` (or `walk` standing in while run is on
 * `ANIMS_AWAITING_ART`, or missing from the sheet) at `anim.runCyclePx`, or
 * `walk` at `anim.walkCyclePx`, the cycle by the gait either way. On a v2
 * sheet the frame comes from the distance moved; a v1 sheet, or no stride
 * (tools, tests of other states), keeps the sheet's frame rate on the tick.
 */
export function gaitPose(
  sheet: SpriteSheet,
  gait: Gait,
  angle: number,
  tick: number,
  stride?: Stride,
): KindledPose {
  const standIn = STAND_IN[gait];
  const name = standIn !== undefined && (isAwaitingArt({ name: gait }) || !hasAnim(sheet, gait)) ? standIn : gait;
  if (!stride || !isV2Sheet(sheet)) return kindledPoseOf(sheet, name, angle, (a) => loopFrame(a, tick));
  const cyclePx = gait === 'run' ? stride.cycles.runCyclePx : stride.cycles.walkCyclePx;
  return kindledPoseOf(sheet, name, angle, (a) => strideFrame(a, stride.distancePx, cyclePx));
}

/** True while a Hook-thrust pins a Husk (the engine shows `heavy_hold`). */
function pinning(s: RunState): boolean {
  return s.husks.some((h) => h.action === 'held');
}

/**
 * The Kindled's pose from the player's sim state.
 *
 * - idle, or run while moving (walk standing in until ART draws run), facing
 *   the aim; run plays by `stride` on a v2 sheet (`gaitPose`);
 * - dodge: crouch, the roll (2 frames) and recover over the dodge window;
 * - light_1..3 by combo step, wind-up / swing / recover over the strike window;
 * - heavy_charge at the sheet's rate holding the last frame → heavy_thrust over
 *   startup + active → heavy_hold from the tick the thrust pins a Husk until the
 *   pin ends (through the hitstop) → heavy_recover over the rest of the recovery;
 * - Haul: haul_throw (arm out, then the last frame only while the hook flies),
 *   haul_pull while the chain pulls a Husk, haul_slide while it pulls the player,
 *   haul_recover over the recovery;
 * - hit through the hurt stun: frame 0 (the flinch) for the first 100 ms, frame 1
 *   (the stagger) to the end of the stun; frame 0 alone for 100 ms after an
 *   armored hit; death at the sheet's rate after the sim stops.
 */
export function kindledPose(
  s: RunState,
  P: Params,
  sheet: SpriteSheet,
  clocks: Clocks,
  stride?: Stride,
): KindledPose {
  const p = s.player;
  const tick = s.tick;
  if (p.action === 'dead') {
    return kindledPoseOf(sheet, 'death', p.dir, (a) => onceFrame(a, ticks(clocks.deathMs ?? 0)));
  }
  // Standing, charging or stunned the Kindled faces the aim; a move faces the direction it locked at its start.
  const faceAngle =
    p.action === 'idle' || p.action === 'charge' || p.action === 'hurt' ? p.aim : p.dir;
  // Stunned: the flinch (frame 0) for the first 100 ms of the stun, then the stagger (frame 1) held to its end.
  if (p.action === 'hurt') return kindledPoseOf(sheet, 'hit', faceAngle, () => (p.t <= ticks(HIT_MS) ? 0 : 1));
  // An armored hit (no stun) still shows the hit frame for 100 ms.
  if (clocks.hitMs >= 0 && clocks.hitMs < HIT_MS)
    return kindledPoseOf(sheet, 'hit', faceAngle, () => 0);
  switch (p.action) {
    case 'dodge': {
      const d = P.dodge;
      return kindledPoseOf(sheet, 'dodge', p.dir, (a) =>
        spreadFrame(a.frames.length, windowSegments(d, [1, 2, 1]), p.t),
      );
    }
    case 'light': {
      const st = lightStrike(P, p.comboStep);
      const name = `light_${Math.min(p.comboStep, P.weapon.light.length - 1) + 1}`;
      return kindledPoseOf(sheet, name, p.dir, (a) =>
        spreadFrame(a.frames.length, windowSegments(st, [1, 1, 1]), p.t),
      );
    }
    case 'charge':
      return kindledPoseOf(sheet, 'heavy_charge', p.aim, (a) => onceFrame(a, p.t));
    case 'heavy':
      return heavyPose(s, p, P, sheet);
    case 'ability':
      return abilityPose(p, P, sheet);
    default:
      break;
  }
  const moving = Math.abs(p.vx) + Math.abs(p.vy) > WALK_THRESHOLD;
  // In an encounter (Combat and Calm alike) the Kindled always runs; walking is for outside encounters (M2).
  if (moving) return gaitPose(sheet, 'run', p.aim, tick, stride);
  return kindledPoseOf(sheet, 'idle', p.aim, (a) => loopFrame(a, tick));
}

function heavyPose(s: RunState, p: PlayerState, P: Params, sheet: SpriteSheet): KindledPose {
  const tm = heavyTiming(P, p.charge);
  const phase: StrikePhase | null = playerAttackPhase(p, P);
  const activeEnd = tm.startup + tm.active;
  // The pin starts the tick the thrust lands: the hold frame runs through the hitstop and the hold, whatever the phase.
  if (pinning(s)) return kindledPoseOf(sheet, 'heavy_hold', p.dir, () => 0);
  if (phase === 'startup' || phase === 'active') {
    const segs: Segment[] = [
      { len: tm.startup, share: 1 },
      { len: tm.active, share: 1 },
    ];
    return kindledPoseOf(sheet, 'heavy_thrust', p.dir, (a) =>
      spreadFrame(a.frames.length, segs, p.t),
    );
  }
  return kindledPoseOf(sheet, 'heavy_recover', p.dir, (a) =>
    spreadFrame(a.frames.length, [{ len: tm.recovery, share: 1 }], p.t - activeEnd),
  );
}

function abilityPose(p: PlayerState, P: Params, sheet: SpriteSheet): KindledPose {
  const a = abilityAt(P, p.abilitySlot);
  const phase = playerAttackPhase(p, P);
  if (!a || a.kind !== 'haul') {
    // Other abilities have no sheet animation yet (Turning Blade is a spin): the last light's frames over the window.
    const w = a ?? { startup: 1, active: 1, recovery: 1 };
    return kindledPoseOf(sheet, `light_${P.weapon.light.length}`, p.dir, (anim) =>
      spreadFrame(anim.frames.length, windowSegments(w, [1, 1, 1]), p.t),
    );
  }
  const hk = p.hook;
  if (phase === 'active' && hk && hk.hitId >= 0) {
    if (hk.pull === 'player')
      return kindledPoseOf(sheet, 'haul_slide', p.dir, (anim) => loopFrame(anim, p.t));
    if (hk.pull === 'husk')
      return kindledPoseOf(sheet, 'haul_pull', p.dir, (anim) => loopFrame(anim, p.t));
  }
  // The throw: the arm goes out over the startup, then the last frame holds only while the hook flies.
  if (phase === 'startup' || (phase === 'active' && hk !== null)) {
    return kindledPoseOf(sheet, 'haul_throw', p.dir, (anim) =>
      phase === 'startup' ? spreadFrame(anim.frames.length, [{ len: a.startup, share: 1 }], p.t) : anim.frames.length - 1,
    );
  }
  // The chain reels in: haul_recover over the recovery (its first frame while the active ticks run out after a miss).
  const activeEnd = a.startup + a.active;
  return kindledPoseOf(sheet, 'haul_recover', p.dir, (anim) =>
    phase === 'recovery' ? spreadFrame(anim.frames.length, [{ len: a.recovery, share: 1 }], p.t - activeEnd) : 0,
  );
}

/** Index of the first broken shell layer from the outside, counting how many are gone. */
function brokenLayers(h: HuskState): number {
  let gone = 0;
  for (const v of h.shell) if (v <= 0) gone++;
  return gone;
}

/** The Husk's resting pose: its chipped frame once a shell layer is gone, else the idle breath. */
function huskBase(h: HuskState, sheet: SpriteSheet, tick: number): Pose {
  const gone = brokenLayers(h);
  const idle = sheet.anims.idle;
  if (gone === 0 || !idle) return { anim: 'idle', frame: idle ? loopFrame(idle, tick) : 0 };
  if (h.kind === 'nutshell') {
    return { anim: gone >= h.shell.length ? 'chipped_inner' : 'chipped_outer', frame: 0 };
  }
  return { anim: 'chipped', frame: 0 };
}

/**
 * A Husk's pose from its sim state: spawn stretched over the spawn-in (the
 * engine's ring stays under it; the Husk is not awake until it ends),
 * telegraph during the wind-up (blinking with the resting pose while the
 * attack still tracks, solid once it has locked), the Peeling's lunge
 * (stretch, hit) over the attack and its settle through the recovery, the
 * Nutshell's walk from its velocity in the chase and its slam (frame 0 over
 * the first half of the active ticks, frame 1 over the second, held through
 * the recovery), the hit frame for 100 ms after a hit, the regrow one-shot
 * after the inner shell regrows, chipped frames once a layer is gone, idle
 * otherwise. Death plays on a transient the renderer keeps after the Husk is
 * gone.
 */
export function huskPose(
  s: RunState,
  P: Params,
  h: HuskState,
  sheet: SpriteSheet,
  clocks: Clocks,
  blink: boolean,
): Pose {
  const hp = huskParams(P, h.kind);
  if (h.action === 'spawn') {
    const spawn = sheet.anims.spawn;
    if (!spawn) return { anim: 'idle', frame: 0 };
    const n = spawn.frames.length;
    return { anim: 'spawn', frame: Math.min(n - 1, Math.floor((Math.max(0, h.t) * n) / Math.max(1, hp.spawn))) };
  }
  if (clocks.hitMs >= 0 && clocks.hitMs < HIT_MS && 'hit' in sheet.anims)
    return { anim: 'hit', frame: 0 };
  const regrow = sheet.anims.regrow;
  if (regrow && clocks.regrowMs !== undefined && clocks.regrowMs >= 0) {
    const length = (regrow.frames.length / Math.max(1, regrow.frameRate)) * 1000;
    if (clocks.regrowMs < length)
      return { anim: 'regrow', frame: onceFrame(regrow, ticks(clocks.regrowMs)) };
  }
  const base = huskBase(h, sheet, s.tick);
  switch (h.action) {
    case 'windup': {
      const telegraph = sheet.anims.telegraph;
      if (!telegraph) return base;
      const tracking = h.t <= hp.track;
      if (tracking && !blink) return base;
      return { anim: 'telegraph', frame: onceFrame(telegraph, h.t) };
    }
    case 'attack': {
      if (h.kind === 'peeling') {
        const lunge = sheet.anims.lunge;
        if (!lunge) return base;
        // Stretch and hit over the active ticks; the last frame (settle) is the recovery's.
        const n = Math.max(1, lunge.frames.length - 1);
        return {
          anim: 'lunge',
          frame: Math.min(n - 1, Math.floor((Math.max(0, h.t - 1) * n) / Math.max(1, hp.active))),
        };
      }
      // The slam: the shell dropping over the first half of the active ticks, the impact over the second.
      const slam = sheet.anims.slam;
      if (!slam) return base;
      const n = slam.frames.length;
      return { anim: 'slam', frame: Math.min(n - 1, Math.floor((Math.max(0, h.t - 1) * n) / Math.max(1, hp.active))) };
    }
    case 'recover': {
      const lunge = sheet.anims.lunge;
      if (h.kind === 'peeling' && lunge) return { anim: 'lunge', frame: lunge.frames.length - 1 };
      const slam = sheet.anims.slam;
      if (h.kind === 'nutshell' && slam) return { anim: 'slam', frame: slam.frames.length - 1 };
      return base;
    }
    case 'chase': {
      // The Nutshell walks: its shell rocks forward while it moves, as long as it is whole.
      const walk = sheet.anims.walk;
      const moving = Math.abs(h.vx) + Math.abs(h.vy) > WALK_THRESHOLD;
      if (walk && moving && base.anim === 'idle') return { anim: 'walk', frame: loopFrame(walk, s.tick) };
      return base;
    }
    default:
      return base;
  }
}

/**
 * Whether a Husk sprite is flipped (Husks have no facings; the sheet faces
 * east): while winding up, lunging or recovering, by the attack direction;
 * otherwise by its movement, keeping the previous flip when still.
 */
export function huskFlip(h: HuskState, prev: boolean): boolean {
  if (h.action === 'windup' || h.action === 'attack' || h.action === 'recover') {
    const a = h.attackDir & (TURN - 1);
    return a > TURN / 4 && a < (3 * TURN) / 4;
  }
  if (Math.abs(h.vx) > WALK_THRESHOLD) return h.vx < 0;
  return prev;
}
