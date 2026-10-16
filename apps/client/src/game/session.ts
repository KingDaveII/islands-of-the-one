import { roomTemplates } from '@iot/shared';
import {
  autopilot,
  createRun,
  hashRunState,
  runResults,
  setRunTuning,
  stepRun,
  SUB,
  TICK_HZ,
  type AutopilotOptions,
  type Params,
  type RoomTemplate,
  type Run,
  type RunState,
  type RunResults,
  type SimEvent,
} from '@iot/sim';
import type { Controls, SampleContext } from './controls.js';
import { tuningStore } from './tuningStore.js';

const TICK_MS = 1000 / TICK_HZ;
const MAX_STEPS_PER_FRAME = 5;

export interface Snapshot {
  x: number;
  y: number;
}

/**
 * Runs the sim at a fixed 60 Hz from real time. The client never changes
 * gameplay state: it only feeds inputs and reads state/events for rendering.
 */
export class Session {
  readonly run: Run;
  private acc = 0;
  /** Positions before the latest step (by entity key), for render interpolation. */
  prev = new Map<string, Snapshot>();
  alpha = 0;
  stepsThisFrame = 0;
  autopilot: AutopilotOptions | null = null;
  /** A scripted input source for playtests (packed input per tick from the state); overrides the controls and the autopilot. */
  inputSource: ((state: RunState, params: Params) => number) | null = null;
  /** Real-time pacing for playtests and screenshots (1 = normal); presentation only, never part of the record. */
  speed = 1;
  private unsubscribe: () => void;
  /** The events of creating the run (the first room's `roomEnter`), delivered with the first update: stepRun would drop them. */
  private pending: SimEvent[];

  constructor(
    readonly seed: number,
    readonly weapon: string,
    private readonly controls: Controls,
    rooms: readonly RoomTemplate[] = roomTemplates,
  ) {
    // One weapon per run: it is part of the run config and never changes mid-run.
    this.run = createRun({ seed, tuning: tuningStore.get(), rooms: [...rooms], weapon });
    this.pending = this.run.events;
    this.unsubscribe = tuningStore.subscribe((t) => {
      if (this.run.state.status === 'playing') setRunTuning(this.run, t);
    });
  }

  dispose(): void {
    this.unsubscribe();
  }

  get state() {
    return this.run.state;
  }

  /** Real-time multiplier (perfect-dodge slow-mo). */
  timeScale(): number {
    return this.run.state.slowmo > 0 ? this.run.params.perfect.slowmoScale / 1000 : 1;
  }

  /** What the input sampler needs from the world: enemy offsets (soft lock) and the input context. */
  private sampleContext(): SampleContext {
    const s = this.run.state;
    const p = s.player;
    const soft = this.run.tuning.softlock;
    return {
      enemies: s.husks
        .filter((h) => h.core > 0 && h.action !== 'spawn')
        .map((h) => ({ id: h.id, dx: (h.x - p.x) / SUB, dy: (h.y - p.y) / SUB })),
      context: s.context,
      softLockDeg: this.controls.preset.aim === 'left-stick' ? soft.leftStickAngleDeg : soft.angleDeg,
    };
  }

  private snapshot(): void {
    const s = this.run.state;
    this.prev.set('p', { x: s.player.x, y: s.player.y });
    for (const h of s.husks) this.prev.set(`h${h.id}`, { x: h.x, y: h.y });
    for (const k of s.pickups) this.prev.set(`k${k.id}`, { x: k.x, y: k.y });
  }

  isEnded(): boolean {
    return this.run.state.status !== 'playing';
  }

  /** Advance by real time; returns events from all steps taken. */
  update(dtMs: number): SimEvent[] {
    const events: SimEvent[] = this.pending;
    this.pending = [];
    this.stepsThisFrame = 0;
    if (this.isEnded()) return events;
    this.acc += Math.min(dtMs, 250) * this.timeScale() * this.speed;
    while (this.acc >= TICK_MS && this.stepsThisFrame < MAX_STEPS_PER_FRAME) {
      this.snapshot();
      const p = this.run.state.player;
      const input = this.inputSource
        ? this.inputSource(this.run.state, this.run.params)
        : this.autopilot
          ? autopilot(this.run.state, this.run.params, this.autopilot)
          : this.controls.sample(p.x / SUB, p.y / SUB, this.sampleContext());
      events.push(...stepRun(this.run, input));
      this.acc -= TICK_MS;
      this.stepsThisFrame++;
      if (this.isEnded()) break;
    }
    if (this.stepsThisFrame === MAX_STEPS_PER_FRAME) this.acc = 0;
    this.alpha = Math.min(1, this.acc / TICK_MS);
    return events;
  }

  /** Interpolated world-pixel position for an entity. */
  lerp(key: string, x: number, y: number): { x: number; y: number } {
    const prev = this.prev.get(key);
    if (!prev || Math.abs(prev.x - x) > 32 * SUB || Math.abs(prev.y - y) > 32 * SUB) return { x: x / SUB, y: y / SUB };
    const a = this.alpha;
    return { x: (prev.x + (x - prev.x) * a) / SUB, y: (prev.y + (y - prev.y) * a) / SUB };
  }

  results(): RunResults {
    return runResults(this.run);
  }

  hash(): number {
    return hashRunState(this.run.state);
  }
}
