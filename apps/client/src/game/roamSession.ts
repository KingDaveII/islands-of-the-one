import { holdingLayout, holdingRoomTiles, holdingStart, type HoldingLayout, type TilePoint } from '@iot/shared';
import {
  createRoam,
  decodeInput,
  encodeInput,
  hashRoamState,
  NO_INPUT,
  roomFromTemplate,
  stepRoam,
  SUB,
  TICK_HZ,
  tileCentre,
  type Roam,
  type RoamState,
} from '@iot/sim';
import type { Controls } from './controls.js';
import { quantizeMove } from './quantize.js';
import { tuningStore } from './tuningStore.js';

const TICK_MS = 1000 / TICK_HZ;
const MAX_STEPS_PER_FRAME = 5;

/**
 * Runs the roam sim (packages/sim/src/roam.ts) at a fixed 60 Hz from real
 * time on the holding, the way `Session` runs the combat run: the client
 * feeds the controls' input and reads the state for rendering, deciding
 * nothing itself. Positions on the holding are the client's (M2 holdings are
 * private; nothing of value depends on where you stand), so nothing here is
 * sent to the server but the station the Kindled uses.
 */
export class RoamSession {
  readonly roam: Roam;
  private acc = 0;
  /** The position before the latest step, sim units, for render interpolation. */
  private prev: { x: number; y: number };
  alpha = 0;
  /** Buttons pressed on the ticks of the latest update, or-ed (the interact press). */
  pressed = 0;
  /** A scripted input source for playtests (a packed input per tick from the state); overrides the controls. */
  inputSource: ((state: RoamState) => number) | null = null;
  /** Real-time pacing for playtests (1 = normal). */
  speed = 1;
  /** While the station panel is open the Kindled stands still: the controls are read but the roam gets no movement. */
  held = false;
  /** The named plots whose signposts are pillars in the room (M2 Task 5), as last set. */
  private solidPlots = '';
  /** The room's rows as the sim walks it (`holdingRoomTiles` with the pillars), for the tap walk's path (M2 Task 10). */
  tiles: string[];
  /**
   * The tap walk's autopilot (M2 Task 10): per tick, the stick a thumb would
   * hold (length ≤ 1), or null to leave the controls' move alone. `manual`
   * says the controls moved this tick (a stick or a key), which ends a walk.
   */
  steer: ((state: RoamState, manual: boolean) => { x: number; y: number } | null) | null = null;

  constructor(
    private readonly controls: Controls,
    readonly layout: HoldingLayout = holdingLayout(),
  ) {
    const start = holdingStart(layout);
    const t = tuningStore.get();
    this.tiles = holdingRoomTiles(layout);
    this.roam = createRoam({
      template: { name: layout.id, tiles: this.tiles },
      start: tileCentre(start.col, start.row),
      tuning: { player: t.player, roam: t.roam },
    });
    this.prev = { x: this.roam.state.x, y: this.roam.state.y };
  }

  get state(): RoamState {
    return this.roam.state;
  }

  /**
   * The named plots' signposts become pillars (M2 Task 5), and so do the
   * tiles of the pieces standing in them (M2 Task 6): the room is rebuilt
   * from the layout with those tiles solid, in place, so the Kindled keeps its
   * position. Nothing happens when the set hasn't changed.
   */
  setSolidPlots(plotIds: readonly string[], pieceTiles: readonly TilePoint[] = []): void {
    const key = `${[...plotIds].sort().join(',')}|${pieceTiles.map((t) => `${t.col}:${t.row}`).sort().join(',')}`;
    if (key === this.solidPlots) return;
    this.solidPlots = key;
    this.tiles = holdingRoomTiles(this.layout, plotIds, pieceTiles);
    this.roam.state.room = roomFromTemplate(0, { name: this.layout.id, tiles: this.tiles });
  }

  /** Advance by real time. Returns how many ticks ran. */
  update(dtMs: number): number {
    this.pressed = 0;
    let steps = 0;
    this.acc += Math.min(dtMs, 250) * this.speed;
    while (this.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
      const s = this.roam.state;
      this.prev = { x: s.x, y: s.y };
      const sampled = this.inputSource
        ? this.inputSource(s)
        : this.controls.sample(s.x / SUB, s.y / SUB, { enemies: [], context: 'calm', softLockDeg: 0 });
      const decoded = decodeInput(sampled);
      this.pressed |= decoded.buttons;
      let input = sampled;
      const steer = this.steer?.(s, decoded.moveMag > 0);
      if (steer) input = encodeInput({ ...decoded, ...quantizeMove(steer.x, steer.y) });
      stepRoam(this.roam, this.held ? NO_INPUT : input);
      this.acc -= TICK_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    this.alpha = Math.min(1, this.acc / TICK_MS);
    return steps;
  }

  /** The Kindled's interpolated position, sim px. */
  position(): { x: number; y: number } {
    const s = this.roam.state;
    const a = this.alpha;
    return { x: (this.prev.x + (s.x - this.prev.x) * a) / SUB, y: (this.prev.y + (s.y - this.prev.y) * a) / SUB };
  }

  hash(): number {
    return hashRoamState(this.roam.state);
  }
}
