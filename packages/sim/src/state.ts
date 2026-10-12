/**
 * Plain-data run state. Everything here is integers, strings, booleans and
 * arrays (no Maps/Sets, no classes) so it can be hashed, cloned and compared,
 * and iteration order is always the array order.
 */

export type PlayerAction = 'idle' | 'light' | 'charge' | 'heavy' | 'ability' | 'dodge' | 'hurt' | 'dead';
export type BufferedAction = 'none' | 'light' | 'heavy' | 'dodge' | 'ability1' | 'ability2' | 'ability3';

/** The Haul hook while it is out: flying, then pulling one side along the chain. */
export interface HookState {
  /** Hook head position (units). */
  x: number;
  y: number;
  /** Flight direction. */
  dir: number;
  /** Units flown so far. */
  travel: number;
  /** Husk the hook locked on at launch (-1: flies along the aim). */
  targetId: number;
  /** Husk the hook hit (-1 while flying). */
  hitId: number;
  /** Who slides after the hit: the husk (light/medium) or the player (heavy). */
  pull: 'none' | 'husk' | 'player';
  /** Ticks of pull left. */
  pullLeft: number;
}

/** One consumable slot. */
export interface ItemSlot {
  /** Consumable id ('' = empty). */
  id: string;
  count: number;
}

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
  /** The Haul hook, while out. */
  hook: HookState | null;
  /** Armor frames granted by an event (arriving on a Haul), ticks left. */
  armor: number;
  /** Ticks left in which a light starts at combo hit 3 (after a Haul hit). */
  haulCombo: number;
  /** Consumable slots. */
  items: ItemSlot[];
  /** Healing over time: ticks left and milli-HP still to heal. */
  healLeft: number;
  healPool: number;
  /** Milli-HP carried between ticks. */
  healAcc: number;
}

export type HuskKind = 'peeling' | 'nutshell';
export type HuskAction = 'spawn' | 'chase' | 'windup' | 'attack' | 'recover' | 'stagger' | 'flinch' | 'held';

/** Pinned on the Hook-thrust: frozen for `left` ticks, then shoved `shove` units along `dir`. */
export interface HeldState {
  left: number;
  dir: number;
  shove: number;
  /** A shell layer broke on the hit: the hold ends in a stagger. */
  broke: boolean;
}

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
  /** Length of the current stagger, ticks (set when it starts). */
  stagger: number;
  held: HeldState | null;
  /** Ticks since the shell was last hit (capped), for the inner layer's regrow. */
  sinceHit: number;
}

export interface ChestState {
  id: number;
  x: number;
  y: number;
  opened: boolean;
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
  chests: ChestState[];
  /** Chests opened so far this run (indexes the scripted contents). */
  chestsOpened: number;
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
  /** The Hook-thrust pinned a husk. */
  | { type: 'held'; id: number; kind: HuskKind; ms: number }
  /** The hook landed: `pull` says which side slides along the chain. */
  | { type: 'haulHit'; id: number; kind: HuskKind; weightClass: string; pull: 'husk' | 'player'; x: number; y: number }
  | { type: 'haulMiss'; x: number; y: number; refund: number }
  | { type: 'itemUsed'; slot: number; id: string }
  | { type: 'chestOpened'; id: number; x: number; y: number; item: string; count: number }
  | { type: 'shellRegrow'; id: number; kind: HuskKind }
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
