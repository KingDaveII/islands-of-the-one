import { accelerate, brake, moveBody } from './body.js';
import {
  accelToUnits,
  angleDiff,
  degToAngle,
  HALF_TURN,
  idiv,
  msToTicks,
  pxToUnits,
  speedToUnits,
  TILE_PX,
  toPermille,
} from './fixed.js';
import { hashValue } from './hash.js';
import { decodeInput, MOVE_MAG_MAX, moveDirToAngle } from './input.js';
import { roomFromTemplate, type RoomTemplate } from './rooms.js';
import type { RoomState } from './state.js';
import { dirX, dirY } from './trig.js';
import type { Tuning } from './tuning.js';

/**
 * Roaming (docs/design/holding.md, GAME DESIGN 2026-10-16): deterministic
 * integer movement for everywhere outside encounters. The holding is its
 * first user; it is not part of the combat run. The same rules as the run's
 * free movement (acceleration toward a target speed, friction, `collideWalls`
 * against the layout's solids), with one difference: the Kindled **walks**
 * at `roam.walkFactor` of `player.moveSpeed` and breaks into a run on its own
 * after `roam.runAfterMs` of moving without stopping or turning more than
 * `roam.resetTurnDeg`, ramping up to full speed over `roam.rampMs`. Stopping
 * or a sharp turn drops it back to a walk. A stick pushed less than
 * `roam.walkStickMax` always walks (the keyboard counts as a full push); there
 * is no run button. No combat, no backpedal: the facing follows the movement
 * direction and standing still keeps the last facing.
 *
 * Integers only, like the run: positions and velocities in sub-pixel units,
 * angles in 1/4096 turn, factors in permille, time in ticks; the input is the
 * run's packed `TickInput` (its aim and buttons are ignored here), so the
 * client's sampler serves both. A record (the template, the start, the
 * tuning, the inputs) replays to the same hash on any machine.
 */

/** The `roam` block of tuning.json, in human units. */
export interface RoamTuning {
  /** The walk's speed as a fraction of `player.moveSpeed`. */
  walkFactor: number;
  /** Moving this long without a stop or a sharp turn starts the run. */
  runAfterMs: number;
  /** The run ramps from the walk's speed to full speed over this. */
  rampMs: number;
  /** A turn sharper than this (degrees) between one tick's movement and the next drops the run. */
  resetTurnDeg: number;
  /** A stick pushed less than this (0..1 of its travel) always walks. */
  walkStickMax: number;
}

/** The compiled integer parameters of a roam. */
export interface RoamParams {
  radius: number;
  /** Full (run) speed, units/tick. */
  speed: number;
  accel: number;
  friction: number;
  /** The walk's share of the full speed, permille. */
  walk: number;
  /** Ticks of moving before the run starts. */
  runAfter: number;
  /** Ticks the run takes to reach full speed. */
  ramp: number;
  /** A turn over this (1/4096 turn) drops the run. */
  resetTurn: number;
  /** The highest move magnitude (0..7) that always walks. */
  walkMagMax: number;
}

export type Gait = 'walk' | 'run';

/** Plain-data roam state: integers, strings and booleans only, so it hashes and replays. */
export interface RoamState {
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The facing, 1/4096 turn: the movement's direction, kept while standing still. */
  facing: number;
  /** The latest input's movement. */
  moveAngle: number;
  moveMag: number;
  /** Ticks moving at a full push without a stop or a sharp turn (the run clock). */
  movingTicks: number;
  gait: Gait;
  room: RoomState;
}

export interface RoamConfig {
  /** The layout's rows, every solid tile `#` or `o` (the holding's `holdingRoomTiles`). */
  template: RoomTemplate;
  /** The start, sim px. */
  start: { x: number; y: number };
  tuning: Pick<Tuning, 'player'> & { roam: RoamTuning };
}

/** Everything needed to replay a roam exactly. */
export interface RoamRecord {
  template: RoomTemplate;
  start: { x: number; y: number };
  tuning: RoamConfig['tuning'];
  /** Packed input per tick (`encodeInput`). */
  inputs: number[];
}

export interface Roam {
  state: RoamState;
  params: RoamParams;
  record: RoamRecord;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** The roam's integer parameters from the player and roam blocks of the tuning. */
export function compileRoam(player: Tuning['player'], roam: RoamTuning): RoamParams {
  return {
    radius: pxToUnits(player.radiusPx),
    speed: speedToUnits(player.moveSpeed),
    accel: accelToUnits(player.acceleration),
    friction: accelToUnits(player.friction),
    walk: Math.max(0, Math.min(1000, toPermille(roam.walkFactor))),
    runAfter: msToTicks(roam.runAfterMs),
    ramp: Math.max(1, msToTicks(roam.rampMs)),
    resetTurn: Math.max(0, Math.min(HALF_TURN, degToAngle(roam.resetTurnDeg))),
    // A magnitude is 1..7 of the stick's live travel: below the threshold's share of the top it walks.
    walkMagMax: Math.max(0, Math.min(MOVE_MAG_MAX, Math.floor(toPermille(roam.walkStickMax) * MOVE_MAG_MAX / 1000))),
  };
}

export function createRoam(config: RoamConfig): Roam {
  const tuning = clone(config.tuning);
  const params = compileRoam(tuning.player, tuning.roam);
  const room = roomFromTemplate(0, config.template);
  const state: RoamState = {
    tick: 0,
    x: pxToUnits(config.start.x),
    y: pxToUnits(config.start.y),
    vx: 0,
    vy: 0,
    facing: 1024,
    moveAngle: 0,
    moveMag: 0,
    movingTicks: 0,
    gait: 'walk',
    room,
  };
  return {
    state,
    params,
    record: { template: clone(config.template), start: { ...config.start }, tuning: clone(tuning), inputs: [] },
  };
}

/** The centre of a layout tile in sim px (the start, a station's interact point). */
export function tileCentre(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_PX + TILE_PX / 2, y: row * TILE_PX + TILE_PX / 2 };
}

/**
 * The speed factor this tick, permille of the full speed: the walk until
 * the run clock passes `runAfter`, then a linear ramp to 1000 over `ramp`
 * ticks, in integer math.
 */
export function roamSpeedFactor(P: RoamParams, movingTicks: number): number {
  if (movingTicks <= P.runAfter) return P.walk;
  const into = Math.min(P.ramp, movingTicks - P.runAfter);
  return P.walk + idiv((1000 - P.walk) * into, P.ramp);
}

/** Advance the roam by one tick on a packed input (aim and buttons ignored). */
export function stepRoam(roam: Roam, packedInput: number): void {
  const s = roam.state;
  const P = roam.params;
  roam.record.inputs.push(packedInput >>> 0);
  s.tick++;
  const input = decodeInput(packedInput);
  s.moveMag = input.moveMag;
  if (input.moveMag === 0) {
    // Stopping drops the run; the facing is kept.
    s.movingTicks = 0;
    s.gait = 'walk';
    brake(s, P.friction);
    moveBody(s.room, s, P.radius);
    return;
  }
  const angle = moveDirToAngle(input.moveDir);
  // A sharp turn drops the run too: the clock restarts from this tick.
  if (s.movingTicks > 0 && Math.abs(angleDiff(angle, s.moveAngle)) > P.resetTurn) s.movingTicks = 0;
  s.moveAngle = angle;
  s.facing = angle;
  // A light push always walks: the clock only counts full pushes.
  if (input.moveMag <= P.walkMagMax) s.movingTicks = 0;
  else s.movingTicks++;
  const factor = roamSpeedFactor(P, s.movingTicks);
  s.gait = s.movingTicks > P.runAfter ? 'run' : 'walk';
  const target = idiv(idiv(P.speed * input.moveMag, MOVE_MAG_MAX) * factor, 1000);
  accelerate(s, dirX(angle, target), dirY(angle, target), P.accel);
  moveBody(s.room, s, P.radius);
}

/** Re-run a recorded roam from scratch. */
export function replayRoam(record: RoamRecord): Roam {
  const roam = createRoam({ template: record.template, start: record.start, tuning: record.tuning });
  for (const input of record.inputs) stepRoam(roam, input);
  return roam;
}

export function hashRoamState(state: RoamState): number {
  return hashValue(state);
}
