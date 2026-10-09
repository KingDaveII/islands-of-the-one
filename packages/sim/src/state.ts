/**
 * Plain-data run state. Everything here is integers, strings, booleans and
 * arrays (no Maps/Sets, no classes) so it can be hashed, cloned and compared,
 * and iteration order is always the array order.
 */

export type PlayerAction = 'idle' | 'light' | 'charge' | 'heavy' | 'ability' | 'dodge' | 'hurt' | 'dead';
export type BufferedAction = 'none' | 'light' | 'heavy' | 'dodge' | 'ability1' | 'ability2' | 'ability3';

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  /** Aim angle from the latest input. */
  aim: number;
  /** Last movement input angle (used for dodge direction). */
  moveAngle: number;
  moveMag: number;
  action: PlayerAction;
  /** Ticks spent in the current action. */
  t: number;
  /** Direction locked at the start of an attack / dodge. */
  dir: number;
  /** Light combo step currently executing. */
  comboStep: number;
  /** Light combo step the next light press will perform. */
  nextCombo: number;
  /** Ticks left to continue the combo after a light attack finished. */
  comboTimer: number;
  /** Charge ticks (while charging, and the charge used by the heavy). */
  charge: number;
  /** Ability slot executing while action is 'ability'. */
  abilitySlot: number;
  /** Husk ids already hit by the current attack. */
  hitIds: number[];
  /**
   * Strongest hitstop the current swing has played so far. A swing that hits
   * several husks freezes once, at its strongest hit's level, never summed.
   */
  swingHitstop: number;
  dodgeCooldown: number;
  iframes: number;
  /** Ticks since the last dodge started (capped). */
  dodgeAge: number;
  perfectUsed: boolean;
  hurtInvuln: number;
  hitstop: number;
  /** Per ability slot. */
  cooldowns: number[];
  heavyHeld: boolean;
  buffer: BufferedAction;
  bufferAge: number;
}

export type HuskKind = 'peeling' | 'nutshell';
export type HuskAction = 'spawn' | 'chase' | 'windup' | 'attack' | 'recover' | 'stagger' | 'flinch';

export interface HuskState {
  id: number;
  kind: HuskKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Remaining HP per shell layer, outermost first. */
  shell: number[];
  core: number;
  action: HuskAction;
  t: number;
  attackDir: number;
  attackHit: boolean;
  cooldown: number;
  hitstop: number;
  /** +1 / -1: which way it circles while waiting to attack. */
  strafe: number;
  /** Knockback/pull displacement still to apply (units), spread over pushT ticks. */
  pushX: number;
  pushY: number;
  pushT: number;
}

export interface PickupState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
}

export type RoomPhase = 'intro' | 'fighting' | 'cleared';

export interface RoomState {
  /** Index into the room templates. */
  template: number;
  cols: number;
  rows: number;
  tiles: string[];
  doorOpen: boolean;
  phase: RoomPhase;
  wave: number;
  timer: number;
}

export type RunStatus = 'playing' | 'dead' | 'cleared';

export interface RunStats {
  kills: number;
  perfectDodges: number;
  hitsLanded: number;
  damageTaken: number;
}

export interface RunState {
  tick: number;
  rng: number;
  status: RunStatus;
  endTick: number;
  roomIndex: number;
  roomOrder: number[];
  room: RoomState;
  player: PlayerState;
  husks: HuskState[];
  pickups: PickupState[];
  nextId: number;
  /** Sparkglass carried this run. */
  sparkglass: number;
  stats: RunStats;
  /** Sim ticks of perfect-dodge slow-mo left (presentation plays them slower). */
  slowmo: number;
  /** Ticks until the run counts as cleared after the last room is cleared. */
  clearTimer: number;
}

/** Things that happened this tick, for presentation (sound, particles, shake). Not hashed. */
export type SimEvent =
  /** `step`: combo step (light), charge ticks (heavy) or slot index (ability). */
  | { type: 'swing'; attack: 'light' | 'heavy' | 'ability'; step: number; x: number; y: number; dir: number }
  | {
      type: 'hit';
      id: number;
      kind: HuskKind;
      x: number;
      y: number;
      dir: number;
      shake: number;
      /** Hit was absorbed by a shell layer. */
      shell: boolean;
      /** A shell layer broke on this hit (index of the layer). */
      broke: number;
      killed: boolean;
    }
  /** `armored`: the hit landed during armor frames (damage taken, no interrupt). */
  | { type: 'playerHurt'; x: number; y: number; damage: number; shake: number; dir: number; armored: boolean }
  | { type: 'dodge'; x: number; y: number; dir: number }
  | { type: 'perfectDodge'; x: number; y: number; bonus: number }
  | { type: 'telegraph'; id: number; kind: HuskKind }
  | { type: 'huskAttack'; id: number; kind: HuskKind }
  | { type: 'huskDeath'; id: number; kind: HuskKind; x: number; y: number }
  | { type: 'spawn'; id: number; kind: HuskKind; x: number; y: number }
  | { type: 'pickup'; x: number; y: number; value: number }
  | { type: 'roomEnter'; index: number }
  | { type: 'roomCleared'; index: number }
  | { type: 'runEnd'; status: RunStatus };
