import { huskParams } from './combat.js';
import { idiv, length, TILE, TURN } from './fixed.js';
import { Button, encodeInput, MOVE_DIRS, MOVE_MAG_MAX } from './input.js';
import { playerAttackPhase } from './player.js';
import { isSolid, tileAt, tileOf } from './rooms.js';
import type { HuskState, RunState } from './state.js';
import { atan2 } from './trig.js';
import type { Params } from './tuning.js';

/**
 * Deterministic input driver for tests and headless playtests. A pure function
 * of the run state (no hidden memory), so a run driven by it replays exactly.
 * Not used by gameplay.
 */
export interface AutopilotOptions {
  /** Never dodge or retreat (used to playtest a death). */
  reckless?: boolean;
}

function moveToward(angle: number): { moveDir: number; moveMag: number } {
  return { moveDir: idiv(((angle % TURN) + TURN) % TURN, TURN / MOVE_DIRS) & 0xff, moveMag: MOVE_MAG_MAX };
}

/** Next step (tile center) on a BFS path from the player's tile to the goal tile, or null. */
function pathStep(s: RunState, goalCol: number, goalRow: number): { x: number; y: number } | null {
  const room = s.room;
  const sc = tileOf(s.player.x);
  const sr = tileOf(s.player.y);
  if (sc === goalCol && sr === goalRow) return null;
  const idx = (c: number, r: number) => r * room.cols + c;
  const prev = new Int32Array(room.cols * room.rows).fill(-1);
  const queue: number[] = [idx(sc, sr)];
  prev[idx(sc, sr)] = idx(sc, sr);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  while (queue.length > 0) {
    const cur = queue.shift() ?? 0;
    const c = cur % room.cols;
    const r = Math.floor(cur / room.cols);
    if (c === goalCol && r === goalRow) {
      let node = cur;
      while ((prev[node] ?? -1) !== idx(sc, sr)) node = prev[node] ?? idx(sc, sr);
      return { x: (node % room.cols) * TILE + TILE / 2, y: Math.floor(node / room.cols) * TILE + TILE / 2 };
    }
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= room.cols || nr >= room.rows) continue;
      const ni = idx(nc, nr);
      if ((prev[ni] ?? 0) !== -1) continue;
      if (isSolid(room, nc, nr) && !(nc === goalCol && nr === goalRow)) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  return null;
}

function lineClear(s: RunState, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.max(1, idiv(length(x1 - x0, y1 - y0), TILE / 4));
  for (let i = 1; i < steps; i++) {
    const x = x0 + idiv((x1 - x0) * i, steps);
    const y = y0 + idiv((y1 - y0) * i, steps);
    if (isSolid(s.room, tileOf(x), tileOf(y))) return false;
  }
  return true;
}

function goTo(s: RunState, x: number, y: number): { moveDir: number; moveMag: number } {
  const p = s.player;
  if (lineClear(s, p.x, p.y, x, y)) return moveToward(atan2(y - p.y, x - p.x));
  const step = pathStep(s, tileOf(x), tileOf(y));
  if (!step) return moveToward(atan2(y - p.y, x - p.x));
  return moveToward(atan2(step.y - p.y, step.x - p.x));
}

function threat(s: RunState, P: Params, h: HuskState): boolean {
  const p = s.player;
  const d = length(p.x - h.x, p.y - h.y);
  if (h.kind === 'peeling') {
    const pe = P.husks.peeling;
    const reach = P.player.radius + pe.radius + pe.hitPad;
    // Dodge as the lunge is about to connect (within ~2 ticks of travel).
    if (h.action === 'attack' && !h.attackHit) return d <= reach + pe.lungeSpeed * 2;
    return h.action === 'windup' && pe.windup - h.t <= 0 && d <= reach + pe.lungeSpeed;
  }
  const nu = P.husks.nutshell;
  return h.action === 'windup' && nu.windup - h.t <= 2 && d <= nu.slamRadius + nu.slamOffset + P.player.radius;
}

export function autopilot(s: RunState, P: Params, opts: AutopilotOptions = {}): number {
  const p = s.player;
  if (s.status !== 'playing' || p.action === 'dead') return 0;
  let aim = p.aim;
  let move = { moveDir: 0, moveMag: 0 };
  let buttons = 0;

  // Room cleared: walk to the open door.
  if (s.room.phase === 'cleared' && s.room.doorOpen) {
    for (let r = 0; r < s.room.rows; r++) {
      for (let c = 0; c < s.room.cols; c++) {
        if (tileAt(s.room, c, r) === 'D') {
          move = goTo(s, c * TILE + TILE / 2, r * TILE + TILE / 2);
          return encodeInput({ aim, ...move, buttons });
        }
      }
    }
  }

  const targets = s.husks.filter((h) => h.core > 0 && h.action !== 'spawn');
  if (targets.length === 0) {
    // Hover around the room middle while waves spawn.
    move = goTo(s, idiv(s.room.cols * TILE, 2), idiv(s.room.rows * TILE, 2));
    if (length(p.x - idiv(s.room.cols * TILE, 2), p.y - idiv(s.room.rows * TILE, 2)) < TILE * 2) move.moveMag = 0;
    return encodeInput({ aim, ...move, buttons });
  }

  let target = targets[0] as HuskState;
  let best = Number.MAX_SAFE_INTEGER;
  for (const h of targets) {
    const d = length(h.x - p.x, h.y - p.y);
    if (d < best) {
      best = d;
      target = h;
    }
  }
  aim = atan2(target.y - p.y, target.x - p.x);
  const reach = P.weapon.light[0]?.reach ?? TILE;
  const tr = huskParams(P, target.kind).radius;
  const phase = playerAttackPhase(p, P);

  // Defend: dodge through incoming attacks just before they land.
  const danger = targets.find((h) => threat(s, P, h));
  if (!opts.reckless && danger && p.dodgeCooldown === 0 && p.action !== 'dodge') {
    aim = atan2(danger.y - p.y, danger.x - p.x);
    const away = danger.kind === 'nutshell' ? aim + TURN / 2 : aim + TURN / 4;
    return encodeInput({ aim, ...moveToward(away), buttons: Button.Dodge });
  }
  // Back off from a winding-up Nutshell instead of trading blows.
  const slammer = targets.find((h) => h.kind === 'nutshell' && h.action === 'windup' && h.shell.some((v) => v > 0));
  if (!opts.reckless && slammer && length(slammer.x - p.x, slammer.y - p.y) < P.husks.nutshell.slamRadius + 20 * 256) {
    return encodeInput({ aim, ...moveToward(atan2(p.y - slammer.y, p.x - slammer.x)), buttons });
  }

  if (p.action === 'charge') {
    // Keep charging until full, then release.
    const held = p.charge < P.weapon.heavy.fullCharge;
    return encodeInput({ aim, ...goTo(s, target.x, target.y), buttons: held ? Button.Heavy : 0 });
  }

  if (best > reach + tr) {
    move = goTo(s, target.x, target.y);
    const lungeReady = (p.cooldowns[0] ?? 1) === 0 && P.weapon.slots[0] === 'lunge';
    if (lungeReady && best < 90 * 256 && best > 50 * 256 && lineClear(s, p.x, p.y, target.x, target.y)) {
      buttons |= Button.Ability1;
    }
  } else {
    const shelled = target.kind === 'nutshell' && target.shell.some((v) => v > 0);
    const busy = target.action === 'stagger' || target.action === 'flinch';
    if (shelled && !busy && (p.action === 'idle' || phase === 'recovery') && (s.tick & 3) === 0) {
      buttons |= Button.Heavy;
    } else if ((s.tick & 1) === 0) {
      buttons |= Button.Light;
    }
  }
  return encodeInput({ aim, ...move, buttons });
}
