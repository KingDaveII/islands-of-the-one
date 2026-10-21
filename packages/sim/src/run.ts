import { brake, collideChests, moveBody } from './body.js';
import { huskParams, type Ctx } from './combat.js';
import { idiv, isqrt, length, SUB, TILE } from './fixed.js';
import { hashValue } from './hash.js';
import { createHusk, updateHusk } from './husks.js';
import { decodeInput } from './input.js';
import { updatePlayer } from './player.js';
import { randInt, shuffle } from './rng.js';
import { collideWalls, findTiles, roomFromTemplate, tileAt, tileOf, type RoomTemplate } from './rooms.js';
import type { HuskState, ItemSlot, PlayerState, RunState, SimEvent } from './state.js';
import { atan2, dirX, dirY } from './trig.js';
import { compileTuning, isWeaponAvailable, type Params, type Tuning } from './tuning.js';

export interface RunConfig {
  seed: number;
  tuning: Tuning;
  rooms: RoomTemplate[];
  /** One weapon per run, picked on the start screen; it can't change mid-run. */
  weapon: string;
}

/** Everything needed to replay a run exactly. */
export interface RunRecord {
  seed: number;
  tuning: Tuning;
  rooms: RoomTemplate[];
  weapon: string;
  /** Packed input per tick (see encodeInput). */
  inputs: number[];
  /** Live tuning changes; each applies before the step at `tick`. */
  tuningChanges: { tick: number; tuning: Tuning }[];
}

export interface Run {
  state: RunState;
  params: Params;
  tuning: Tuning;
  templates: RoomTemplate[];
  record: RunRecord;
  /** Events from the latest step. */
  events: SimEvent[];
}

const PICKUP_RADIUS = 2 * SUB;
const PICKUP_COLLECT = 6 * SUB;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function newPlayer(P: Params, x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    hp: P.player.maxHp,
    aim: 0,
    moveAngle: 0,
    moveMag: 0,
    action: 'idle',
    t: 0,
    dir: 0,
    comboStep: 0,
    nextCombo: 0,
    comboTimer: 0,
    charge: 0,
    abilitySlot: 0,
    hitIds: [],
    swingHitstop: 0,
    dodgeCooldown: 0,
    iframes: 0,
    dodgeAge: 600,
    perfectUsed: false,
    hurtInvuln: 0,
    hitstop: 0,
    cooldowns: P.weapon.abilities.map(() => 0),
    heavyHeld: false,
    lightHeld: false,
    buffer: 'none',
    bufferAge: 0,
    hook: null,
    armor: 0,
    haulCombo: 0,
    items: Array.from({ length: P.consumables.slots }, (): ItemSlot => ({ id: '', count: 0 })),
    healLeft: 0,
    healPool: 0,
    healAcc: 0,
  };
}

/**
 * Put `count` of a consumable into the player's slots: onto a stack of the
 * same item first (capped at its stackMax), else into an empty slot. Returns
 * how many were taken.
 */
export function giveItem(p: PlayerState, P: Params, id: string, count: number): number {
  const kind = P.consumables.kinds.find((k) => k.id === id);
  if (!kind || count <= 0) return 0;
  const slot = p.items.find((i) => i.id === id && i.count > 0) ?? p.items.find((i) => i.count === 0);
  if (!slot) return 0;
  const room = kind.stackMax - (slot.id === id ? slot.count : 0);
  const taken = Math.max(0, Math.min(count, room));
  if (taken === 0) return 0;
  slot.id = id;
  slot.count += taken;
  return taken;
}

function enterRoom(ctx: Ctx, templates: RoomTemplate[], index: number): void {
  const { s } = ctx;
  const templateIndex = s.roomOrder[index] ?? 0;
  const template = templates[templateIndex];
  if (!template) throw new Error(`missing room template ${templateIndex}`);
  s.roomIndex = index;
  s.room = roomFromTemplate(templateIndex, template);
  const start = findTiles(s.room, 'P')[0] ?? { x: TILE * 2, y: TILE * 2 };
  const p = s.player;
  p.x = start.x;
  p.y = start.y;
  p.vx = 0;
  p.vy = 0;
  s.husks = [];
  s.pickups = [];
  s.chests = findTiles(s.room, 'C').map((c) => ({ id: s.nextId++, x: c.x, y: c.y, opened: false }));
  ctx.events.push({ type: 'roomEnter', index });
}

export function createRun(config: RunConfig): Run {
  if (config.rooms.length === 0) throw new Error('no room templates');
  if (!isWeaponAvailable(config.tuning, config.weapon)) throw new Error(`weapon "${config.weapon}" is not available`);
  const tuning = clone(config.tuning);
  const P = compileTuning(tuning, config.weapon);
  const placeholderRoom = roomFromTemplate(0, config.rooms[0] as RoomTemplate);
  const s: RunState = {
    tick: 0,
    rng: config.seed >>> 0,
    status: 'playing',
    endTick: 0,
    roomIndex: 0,
    roomOrder: [],
    room: placeholderRoom,
    player: newPlayer(P, 0, 0),
    husks: [],
    pickups: [],
    chests: [],
    chestsOpened: 0,
    nextId: 1,
    sparkglass: 0,
    stats: { kills: 0, perfectDodges: 0, hitsLanded: 0, damageTaken: 0 },
    slowmo: 0,
    clearTimer: 0,
    context: 'calm',
    calmTimer: 0,
  };
  const order = shuffle(
    s,
    config.rooms.map((_, i) => i),
  );
  s.roomOrder = P.run.rooms.map((_, i) => order[i % order.length] ?? 0);
  const run: Run = {
    state: s,
    params: P,
    tuning,
    templates: clone(config.rooms),
    record: {
      seed: config.seed >>> 0,
      tuning: clone(tuning),
      rooms: clone(config.rooms),
      weapon: config.weapon,
      inputs: [],
      tuningChanges: [],
    },
    events: [],
  };
  enterRoom({ s, P, events: run.events }, run.templates, 0);
  return run;
}

/**
 * Replace the run's tuning from the next step on (recorded for replays). The
 * run keeps its weapon: tuning edits change the weapon's numbers, never which
 * weapon is held.
 */
export function setRunTuning(run: Run, tuning: Tuning): void {
  const t = clone(tuning);
  run.params = compileTuning(t, run.record.weapon);
  run.tuning = t;
  run.record.tuningChanges.push({ tick: run.state.tick, tuning: clone(t) });
}

function spawnWave(ctx: Ctx): void {
  const { s, P } = ctx;
  const wave = P.run.rooms[s.roomIndex]?.waves[s.room.wave];
  if (!wave) return;
  const p = s.player;
  const points = findTiles(s.room, 'S');
  const far = points.filter((pt) => length(pt.x - p.x, pt.y - p.y) >= P.run.spawnMinDistance);
  const pool = shuffle(s, far.length > 0 ? far : points);
  if (pool.length === 0) return;
  const kinds = [
    ...Array.from({ length: wave.nutshell }, () => 'nutshell' as const),
    ...Array.from({ length: wave.peeling }, () => 'peeling' as const),
  ];
  kinds.forEach((kind, i) => {
    const pt = pool[i % pool.length] ?? { x: 0, y: 0 };
    const jitter = 4 * SUB;
    s.husks.push(createHusk(ctx, kind, pt.x + randInt(s, -jitter, jitter), pt.y + randInt(s, -jitter, jitter)));
  });
}

function updateRoom(ctx: Ctx, templates: RoomTemplate[]): void {
  const { s, P } = ctx;
  const room = s.room;
  const waves = P.run.rooms[s.roomIndex]?.waves ?? [];
  const last = s.roomIndex >= P.run.rooms.length - 1;
  switch (room.phase) {
    case 'intro':
      if (++room.timer >= P.run.waveDelay) {
        room.phase = 'fighting';
        room.timer = 0;
        spawnWave(ctx);
      }
      break;
    case 'fighting':
      if (s.husks.length > 0) break;
      if (room.wave + 1 < waves.length) {
        room.wave++;
        room.phase = 'intro';
        room.timer = 0;
      } else {
        room.phase = 'cleared';
        room.doorOpen = !last;
        ctx.events.push({ type: 'roomCleared', index: s.roomIndex });
        if (last) s.clearTimer = Math.max(1, P.run.clearDelay);
      }
      break;
    case 'cleared': {
      if (last) {
        if (--s.clearTimer <= 0 && s.status === 'playing') {
          s.status = 'cleared';
          s.endTick = s.tick;
          ctx.events.push({ type: 'runEnd', status: 'cleared' });
        }
        break;
      }
      const p = s.player;
      if (tileAt(room, tileOf(p.x), tileOf(p.y)) === 'D') enterRoom(ctx, templates, s.roomIndex + 1);
      break;
    }
  }
}

/** True for a hostile that is awake: spawned in and alive. (An unstruck Glowing Shell will not count.) */
export function isAwakeHostile(h: HuskState): boolean {
  return h.core > 0 && h.action !== 'spawn';
}

/**
 * The input context: Combat the tick a hostile is awake, Calm once none has
 * been for `calmDelayTicks`. Runs after the husks so a Husk that woke this
 * tick counts at once.
 */
function updateContext(ctx: Ctx): void {
  const { s, P } = ctx;
  const was = s.context;
  if (s.husks.some(isAwakeHostile)) {
    s.context = 'combat';
    s.calmTimer = P.calmDelayTicks;
  } else if (s.context === 'combat') {
    if (s.calmTimer > 0) s.calmTimer--;
    if (s.calmTimer <= 0) s.context = 'calm';
  }
  if (s.context !== was) ctx.events.push({ type: 'context', context: s.context });
}

/** Push overlapping bodies apart, split by mass. Dodging players and abilities pass through. */
function separate(ctx: Ctx): void {
  const { s, P } = ctx;
  const bodies: { b: { x: number; y: number }; r: number; w: number }[] = [];
  const p = s.player;
  if (p.action !== 'dodge' && p.action !== 'ability' && p.action !== 'dead') {
    bodies.push({ b: p, r: P.player.radius, w: P.player.mass });
  }
  for (const h of s.husks) {
    if (h.action === 'spawn' || h.core <= 0) continue;
    const hp = huskParams(P, h.kind);
    bodies.push({ b: h, r: hp.radius, w: hp.mass });
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const c = bodies[j];
      if (!a || !c) continue;
      const dx = c.b.x - a.b.x;
      const dy = c.b.y - a.b.y;
      const min = a.r + c.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = isqrt(d2);
      const overlap = min - d;
      const nx = d === 0 ? SUB : idiv(dx * SUB, d);
      const ny = d === 0 ? 0 : idiv(dy * SUB, d);
      const total = a.w + c.w;
      const pa = idiv(overlap * c.w, total);
      const pc = overlap - pa;
      a.b.x -= idiv(nx * pa, SUB);
      a.b.y -= idiv(ny * pa, SUB);
      c.b.x += idiv(nx * pc, SUB);
      c.b.y += idiv(ny * pc, SUB);
    }
  }
}

function updatePickups(ctx: Ctx): void {
  const { s, P } = ctx;
  const p = s.player;
  const alive = p.action !== 'dead';
  const magnetAll = s.room.phase === 'cleared';
  s.pickups = s.pickups.filter((k) => {
    const dx = p.x - k.x;
    const dy = p.y - k.y;
    const d = length(dx, dy);
    if (alive && d <= PICKUP_COLLECT + P.player.radius) {
      s.sparkglass += k.value;
      ctx.events.push({ type: 'pickup', x: k.x, y: k.y, value: k.value });
      return false;
    }
    if (alive && (magnetAll || d <= P.run.magnetRadius)) {
      const a = atan2(dy, dx);
      k.vx = dirX(a, P.run.pickupSpeed);
      k.vy = dirY(a, P.run.pickupSpeed);
    } else {
      brake(k, idiv(P.run.pickupScatter, 20) + 1);
    }
    moveBody(s.room, k, PICKUP_RADIUS);
    return true;
  });
}

/**
 * Chests are solid pillars (GAME DESIGN 2026-10-17): after the walls, the
 * Kindled and every Husk are pushed out of every chest as circles. A body a
 * chest pushed gets a second wall pass, so a chest near a wall (the clearance
 * rule asks for two tiles of floor around one, but not every template keeps
 * it yet) never leaves a body in the wall at the end of a tick.
 */
function collideBodiesWithChests(ctx: Ctx): void {
  const { s, P } = ctx;
  const r = P.run.chestRadius;
  if (collideChests(s.chests, s.player, P.player.radius, r)) collideWalls(s.room, s.player, P.player.radius);
  for (const h of s.husks) {
    const radius = huskParams(P, h.kind).radius;
    if (collideChests(s.chests, h, radius, r)) collideWalls(s.room, h, radius);
  }
}

/**
 * A chest opens when the Kindled touches it: its edge within
 * `run.chestOpenReachPx` of the chest's edge (the chest is solid, so the two
 * never overlap). It stays standing, still solid, with its lid open. Its
 * contents are scripted by the order chests are opened in the run.
 */
function updateChests(ctx: Ctx): void {
  const { s, P } = ctx;
  const p = s.player;
  if (p.action === 'dead') return;
  for (const c of s.chests) {
    if (c.opened) continue;
    if (length(p.x - c.x, p.y - c.y) > P.player.radius + P.run.chestRadius + P.run.chestOpenReach) continue;
    c.opened = true;
    const script = P.run.chests;
    const contents = script[Math.min(s.chestsOpened, script.length - 1)];
    s.chestsOpened++;
    const count = contents ? giveItem(p, P, contents.item, contents.count) : 0;
    ctx.events.push({ type: 'chestOpened', id: c.id, x: c.x, y: c.y, item: contents?.item ?? '', count });
  }
}

/** Advance the run by one tick. Returns this tick's presentation events. */
export function stepRun(run: Run, packedInput: number): SimEvent[] {
  const s = run.state;
  run.events = [];
  if (s.status !== 'playing') return run.events;
  run.record.inputs.push(packedInput >>> 0);
  const ctx: Ctx = { s, P: run.params, events: run.events };
  s.tick++;

  updatePlayer(ctx, decodeInput(packedInput));
  s.husks = s.husks.filter((h) => h.core > 0);
  for (const h of s.husks) updateHusk(ctx, h);
  s.husks = s.husks.filter((h) => h.core > 0);
  updateContext(ctx);
  separate(ctx);
  collideWalls(s.room, s.player, run.params.player.radius);
  for (const h of s.husks) collideWalls(s.room, h, huskParams(run.params, h.kind).radius);
  collideBodiesWithChests(ctx);
  updatePickups(ctx);
  updateChests(ctx);
  updateRoom(ctx, run.templates);
  if (s.slowmo > 0) s.slowmo--;
  return run.events;
}

/** Re-run a recorded run from scratch. */
export function replayRun(record: RunRecord): Run {
  const run = createRun({ seed: record.seed, tuning: record.tuning, rooms: record.rooms, weapon: record.weapon });
  run.record.tuningChanges = [];
  let change = 0;
  for (const input of record.inputs) {
    while (change < record.tuningChanges.length && (record.tuningChanges[change]?.tick ?? 0) <= run.state.tick) {
      const c = record.tuningChanges[change];
      if (c) setRunTuning(run, c.tuning);
      change++;
    }
    stepRun(run, input);
  }
  return run;
}

export function hashRunState(state: RunState): number {
  return hashValue(state);
}

export interface RunResults {
  status: RunState['status'];
  ticks: number;
  kills: number;
  perfectDodges: number;
  sparkglassCollected: number;
  sparkglassKept: number;
  roomsCleared: number;
}

export function runResults(run: Run): RunResults {
  const s = run.state;
  const P = run.params;
  const cleared = s.status === 'cleared';
  const roomsCleared = s.roomIndex + (s.room.phase === 'cleared' ? 1 : 0);
  return {
    status: s.status,
    ticks: s.endTick || s.tick,
    kills: s.stats.kills,
    perfectDodges: s.stats.perfectDodges,
    sparkglassCollected: s.sparkglass,
    sparkglassKept: cleared ? s.sparkglass : idiv(s.sparkglass * P.run.keptOnDeath, 1000),
    roomsCleared,
  };
}
