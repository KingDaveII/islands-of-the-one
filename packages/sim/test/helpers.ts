import { defaultTuning, roomTemplates } from '@iot/shared';
import {
  Button,
  createRun,
  encodeInput,
  huskParams,
  setRunTuning,
  stepRun,
  SUB,
  type HuskKind,
  type HuskState,
  type Run,
  type SimEvent,
  type Tuning,
} from '../src/index.js';

/** The real data file must satisfy the sim's tuning type. */
export const tuning: Tuning = defaultTuning;

export const WEAPON = 'hookblade';

export function cloneTuning(): Tuning {
  return JSON.parse(JSON.stringify(tuning)) as Tuning;
}

/** A run in its first room with wave spawning disabled, so tests control the husks. */
export function arena(t: Tuning = tuning, seed = 7): Run {
  const run = createRun({ seed, tuning: t, rooms: roomTemplates, weapon: WEAPON });
  run.state.room.timer = -1_000_000;
  return run;
}

export function input(buttons = 0, aim = 0, moveMag = 0, moveDir = 0): number {
  return encodeInput({ aim, moveDir, moveMag, buttons });
}

/** Hold heavy until the charge is full, then release; returns the events of the hold. */
export function chargeFull(run: Run, aim = 0): SimEvent[] {
  const p = run.state.player;
  const events = stepUntil(run, () => p.action === 'charge' && p.charge >= run.params.weapon.heavy.chargeMax, 200, Button.Heavy, aim);
  events.push(...step(run, 0, aim));
  return events;
}

/** Step once; returns that tick's events. */
export function step(run: Run, buttons = 0, aim = 0): SimEvent[] {
  return stepRun(run, input(buttons, aim));
}

export function steps(run: Run, n: number, buttons = 0, aim = 0): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...step(run, buttons, aim));
  return all;
}

export function stepUntil(run: Run, pred: () => boolean, max = 600, buttons = 0, aim = 0): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < max; i++) {
    if (pred()) return all;
    all.push(...step(run, buttons, aim));
  }
  throw new Error('stepUntil: condition not reached');
}

/** Place a husk `distPx` to the right of the player (aim 0 points at it). */
export function addHusk(run: Run, kind: HuskKind, distPx: number, patch: Partial<HuskState> = {}): HuskState {
  const s = run.state;
  const hp = huskParams(run.params, kind);
  const h: HuskState = {
    id: s.nextId++,
    kind,
    x: s.player.x + distPx * SUB,
    y: s.player.y,
    vx: 0,
    vy: 0,
    shell: [...hp.shell],
    core: hp.core,
    action: 'chase',
    t: 0,
    attackDir: 2048,
    attackHit: false,
    cooldown: 10_000,
    hitstop: 0,
    strafe: 1,
    pushX: 0,
    pushY: 0,
    pushT: 0,
    stagger: 0,
    held: null,
    sinceHit: 0,
    ...patch,
  };
  s.husks.push(h);
  return h;
}

export function retune(run: Run, edit: (t: Tuning) => void): void {
  const t = cloneTuning();
  edit(t);
  setRunTuning(run, t);
}

export { Button };
