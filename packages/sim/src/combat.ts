import { angleDiff, clamp, idiv, length, TRIG_ONE } from './fixed.js';
import { isArmored } from './moves.js';
import { randInt } from './rng.js';
import { isSolid, tileOf } from './rooms.js';
import { atan2, cos, dirX, dirY, sin } from './trig.js';
import type { HuskParams, Params } from './tuning.js';
import type { HuskKind, HuskState, RunState, SimEvent } from './state.js';

export interface Ctx {
  s: RunState;
  P: Params;
  events: SimEvent[];
}

/** Resolved numbers for one hit (already scaled by charge etc.). */
export interface Hit {
  damage: number;
  shellDamage: number;
  /** Knockback distance (units) for a light-class husk. */
  knockback: number;
  hitstop: number;
  shake: number;
  /** Ticks the target is pinned ("held") after the hit; 0 for none. */
  hold: number;
  /** Shove distance (units, weight-scaled) when the hold ends. */
  shove: number;
}

export function huskParams(P: Params, kind: HuskKind): HuskParams {
  return kind === 'peeling' ? P.husks.peeling : P.husks.nutshell;
}

/** Husks that can be hit (alive and done materializing). */
export function isHittable(h: HuskState): boolean {
  return h.core > 0 && h.action !== 'spawn';
}

/**
 * Pull or knock a husk `dist` units along `dir` (a pull is a knockback aimed at
 * the attacker). The weight class scales the distance: light husks move all of
 * it, medium half, heavy not at all. The move is spread over a short slide.
 */
export function displace(ctx: Ctx, h: HuskState, dir: number, dist: number): void {
  slide(ctx, h, dir, idiv(dist * huskParams(ctx.P, h.kind).kbScale, 1000));
}

/** Slide a husk `dist` units along `dir` over the knockback time, unscaled (the Haul pulls by its own class rules). */
export function slide(ctx: Ctx, h: HuskState, dir: number, dist: number): void {
  if (dist <= 0) return;
  h.pushX += dirX(dir, dist);
  h.pushY += dirY(dir, dist);
  h.pushT = ctx.P.husks.knockbackTicks;
}

/** Put a husk in a stagger of `ticks` (interrupts anything it was doing). */
export function staggerHusk(h: HuskState, ticks: number): void {
  h.action = 'stagger';
  h.t = 0;
  h.stagger = Math.max(1, ticks);
  h.held = null;
}

/** Apply one tick of a pending knockback/pull slide. */
export function stepPush(h: HuskState): void {
  if (h.pushT <= 0) return;
  const sx = idiv(h.pushX, h.pushT);
  const sy = idiv(h.pushY, h.pushT);
  h.x += sx;
  h.y += sy;
  h.pushX -= sx;
  h.pushY -= sy;
  h.pushT--;
}

/**
 * Hitstop for a player hit. One swing freezes the player once, at the level of
 * its strongest hit so far: a weaker or equal hit adds nothing, a stronger one
 * only tops the freeze up to its level. Struck husks freeze at that level too.
 */
function swingHitstop(ctx: Ctx, h: HuskState, level: number): void {
  const p = ctx.s.player;
  if (level > p.swingHitstop) {
    p.hitstop += level - p.swingHitstop;
    p.swingHitstop = level;
  }
  h.hitstop = Math.max(h.hitstop, p.swingHitstop);
}

/** Husks struck in the same tick share the swing's (strongest) hitstop. */
function syncHitstop(ctx: Ctx, struck: HuskState[]): void {
  const level = ctx.s.player.swingHitstop;
  for (const h of struck) h.hitstop = Math.max(h.hitstop, level);
}

/**
 * Apply a player hit to a husk. The shell is armor-poise: while a layer holds,
 * hits only chip the shell (no flinch, reduced knockback). The hit that breaks
 * a layer staggers the husk (interrupting any attack) and lets a fraction of
 * the core damage through. With the shell gone every core hit flinches.
 */
export function hitHusk(ctx: Ctx, h: HuskState, hit: Hit, fromX: number, fromY: number): void {
  const { s, P } = ctx;
  const hp = huskParams(P, h.kind);
  const dir = atan2(h.y - fromY, h.x - fromX);
  const layer = h.shell.findIndex((v) => v > 0);
  let broke = -1;
  let absorbed = false;
  let coreDamage = 0;
  if (layer >= 0) {
    const left = (h.shell[layer] ?? 0) - hit.shellDamage;
    if (left <= 0) {
      h.shell[layer] = 0;
      broke = layer;
      coreDamage = idiv(hit.damage * P.husks.breakCore, 1000);
    } else {
      h.shell[layer] = left;
      absorbed = true;
    }
  } else {
    coreDamage = hit.damage;
  }
  h.core -= coreDamage;
  h.sinceHit = 0;
  const killed = h.core <= 0;

  const kb = absorbed ? idiv(hit.knockback * hp.armoredKb, 1000) : hit.knockback;
  displace(ctx, h, dir, kb);

  if (!killed) {
    if (hit.hold > 0) {
      // Pinned on the hook: frozen, then shoved. A broken layer staggers once the hold ends.
      h.action = 'held';
      h.t = 0;
      h.held = { left: hit.hold, dir, shove: hit.shove, broke: broke >= 0 };
      ctx.events.push({ type: 'held', id: h.id, kind: h.kind, ms: hit.hold });
    } else if (broke >= 0) {
      staggerHusk(h, hp.stagger);
    } else if (!absorbed && h.action !== 'stagger' && h.action !== 'held') {
      h.action = 'flinch';
      h.t = 0;
    }
  }

  swingHitstop(ctx, h, hit.hitstop);
  s.stats.hitsLanded++;
  ctx.events.push({
    type: 'hit',
    id: h.id,
    kind: h.kind,
    x: h.x,
    y: h.y,
    dir,
    shake: hit.shake,
    shell: absorbed,
    broke,
    killed,
  });
  if (killed) killHusk(ctx, h);
}

function killHusk(ctx: Ctx, h: HuskState): void {
  const { s, P } = ctx;
  const hp = huskParams(P, h.kind);
  h.core = 0;
  s.stats.kills++;
  ctx.events.push({ type: 'huskDeath', id: h.id, kind: h.kind, x: h.x, y: h.y });
  for (let i = 0; i < hp.drop; i++) {
    const a = randInt(s, 0, 4095);
    const speed = idiv(P.run.pickupScatter * randInt(s, 500, 1000), 1000);
    s.pickups.push({ id: s.nextId++, x: h.x, y: h.y, vx: dirX(a, speed), vy: dirY(a, speed), value: 1 });
  }
}

/** Melee arc test from (x, y) along dir. Hits each husk once per attack. */
export function strikeArc(
  ctx: Ctx,
  x: number,
  y: number,
  dir: number,
  reach: number,
  halfArc: number,
  hit: Hit,
  hitIds: number[],
): void {
  const { s, P } = ctx;
  const struck: HuskState[] = [];
  for (const h of s.husks) {
    if (!isHittable(h) || hitIds.includes(h.id)) continue;
    const r = huskParams(P, h.kind).radius;
    const dx = h.x - x;
    const dy = h.y - y;
    const d2 = dx * dx + dy * dy;
    const maxR = reach + r;
    if (d2 > maxR * maxR) continue;
    const touch = P.player.radius + r;
    if (d2 > touch * touch && Math.abs(angleDiff(atan2(dy, dx), dir)) > halfArc) continue;
    hitIds.push(h.id);
    struck.push(h);
    hitHusk(ctx, h, hit, x, y);
  }
  syncHitstop(ctx, struck);
}

/** Circle hit test (dash strikes). */
export function strikeCircle(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  hit: Hit,
  hitIds: number[],
): void {
  const { s, P } = ctx;
  const struck: HuskState[] = [];
  for (const h of s.husks) {
    if (!isHittable(h) || hitIds.includes(h.id)) continue;
    const maxR = radius + huskParams(P, h.kind).radius;
    const dx = h.x - x;
    const dy = h.y - y;
    if (dx * dx + dy * dy > maxR * maxR) continue;
    hitIds.push(h.id);
    struck.push(h);
    hitHusk(ctx, h, hit, x, y);
  }
  syncHitstop(ctx, struck);
}

/**
 * Thrust hit test: a rectangle `length` long (from (x, y) along dir) and
 * 2 × `halfWidth` wide, against each husk's circle. Hits each husk once per attack.
 */
export function strikeRect(
  ctx: Ctx,
  x: number,
  y: number,
  dir: number,
  length: number,
  halfWidth: number,
  hit: Hit,
  hitIds: number[],
): void {
  const { s, P } = ctx;
  const struck: HuskState[] = [];
  const c = cos(dir);
  const sn = sin(dir);
  for (const h of s.husks) {
    if (!isHittable(h) || hitIds.includes(h.id)) continue;
    const r = huskParams(P, h.kind).radius;
    const dx = h.x - x;
    const dy = h.y - y;
    // Husk center in the thrust's frame: along the thrust, and across it.
    const along = idiv(dx * c + dy * sn, TRIG_ONE);
    const across = idiv(dy * c - dx * sn, TRIG_ONE);
    const nx = along - clamp(along, 0, length);
    const ny = across - clamp(across, -halfWidth, halfWidth);
    if (nx * nx + ny * ny > r * r) continue;
    hitIds.push(h.id);
    struck.push(h);
    hitHusk(ctx, h, hit, x, y);
  }
  syncHitstop(ctx, struck);
}

/**
 * Haul targeting: the nearest hittable husk inside the cone (half-angle
 * `halfCone` around `aim`) and within `range` of (x, y), or -1. Only Husks are
 * ever candidates: the player and any ally are never hooked.
 */
export function pickHaulTarget(ctx: Ctx, x: number, y: number, aim: number, halfCone: number, range: number): number {
  const { s, P } = ctx;
  let best = -1;
  let bestDist = Number.MAX_SAFE_INTEGER;
  for (const h of s.husks) {
    if (!isHittable(h)) continue;
    const dx = h.x - x;
    const dy = h.y - y;
    const d = length(dx, dy);
    if (d - huskParams(P, h.kind).radius > range) continue;
    if (Math.abs(angleDiff(atan2(dy, dx), aim)) > halfCone) continue;
    if (d < bestDist) {
      bestDist = d;
      best = h.id;
    }
  }
  return best;
}

/**
 * Sweep the hook head from (x0, y0) to (x1, y1): the first hittable husk the
 * segment touches (nearest along the segment), or null. `radius` is the hook
 * head's radius; a solid tile under the head end snags the hook (null).
 */
export function sweepHook(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
): { husk: HuskState; x: number; y: number } | null {
  const { s, P } = ctx;
  const abx = x1 - x0;
  const aby = y1 - y0;
  const den = abx * abx + aby * aby;
  let best: { husk: HuskState; x: number; y: number; at: number } | null = null;
  for (const h of s.husks) {
    if (!isHittable(h)) continue;
    const num = den === 0 ? 0 : clamp((h.x - x0) * abx + (h.y - y0) * aby, 0, den);
    const cx = den === 0 ? x0 : x0 + idiv(abx * num, den);
    const cy = den === 0 ? y0 : y0 + idiv(aby * num, den);
    const reach = radius + huskParams(P, h.kind).radius;
    const dx = h.x - cx;
    const dy = h.y - cy;
    if (dx * dx + dy * dy > reach * reach) continue;
    if (!best || num < best.at) best = { husk: h, x: cx, y: cy, at: num };
  }
  if (best) return { husk: best.husk, x: best.x, y: best.y };
  return null;
}

/** True when the hook head would be inside a wall. */
export function hookSnags(s: RunState, x: number, y: number): boolean {
  return isSolid(s.room, tileOf(x), tileOf(y));
}

/**
 * A husk attack reaches toward the player. `dist` is the distance from the
 * attack's center to the player center, `reach` the distance at which it
 * connects. Returns true when the attack is spent (it hit, or was perfectly
 * dodged), so each attack connects at most once.
 */
export function huskAttackPlayer(ctx: Ctx, h: HuskState, dist: number, reach: number): boolean {
  const { s, P } = ctx;
  const p = s.player;
  if (p.action === 'dead') return false;
  if (p.iframes > 0) {
    // Generous near-miss check for the perfect dodge; the attack itself whiffs.
    if (dist <= reach + P.perfect.margin && !p.perfectUsed && p.dodgeAge <= P.perfect.window) {
      p.perfectUsed = true;
      s.slowmo = P.perfect.slowmo;
      s.sparkglass += P.perfect.bonus;
      s.stats.perfectDodges++;
      // The flare also takes time off every ability cooldown.
      for (let i = 0; i < p.cooldowns.length; i++) p.cooldowns[i] = Math.max(0, (p.cooldowns[i] ?? 0) - P.perfect.cooldownRefund);
      ctx.events.push({ type: 'perfectDodge', x: p.x, y: p.y, bonus: P.perfect.bonus });
      return true;
    }
    return false;
  }
  if (dist > reach || p.hurtInvuln > 0) return false;

  const hp = huskParams(P, h.kind);
  const dir = atan2(p.y - h.y, p.x - h.x);
  // Armor frames: the damage lands, but the move is not interrupted.
  const armored = isArmored(p, P);
  p.hp -= hp.damage;
  s.stats.damageTaken += hp.damage;
  p.hurtInvuln = P.player.hurtInvuln;
  if (!armored) {
    p.vx = dirX(dir, P.player.hurtKnockback);
    p.vy = dirY(dir, P.player.hurtKnockback);
  }
  p.hitstop = Math.max(p.hitstop, hp.hitstop);
  h.hitstop = Math.max(h.hitstop, hp.hitstop);
  ctx.events.push({ type: 'playerHurt', x: p.x, y: p.y, damage: hp.damage, shake: hp.shake, dir, armored });
  if (p.hp <= 0) {
    p.hp = 0;
    p.action = 'dead';
    p.t = 0;
    s.status = 'dead';
    s.endTick = s.tick;
    ctx.events.push({ type: 'runEnd', status: 'dead' });
  } else if (!armored) {
    p.action = 'hurt';
    p.t = 0;
    p.hitIds = [];
    p.buffer = 'none';
    p.charge = 0;
    p.nextCombo = 0;
    p.comboTimer = 0;
    p.hook = null;
  }
  return true;
}
