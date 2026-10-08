import { angleDiff, idiv } from './fixed.js';
import { randInt } from './rng.js';
import { atan2, dirX, dirY } from './trig.js';
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
  knockback: number;
  hitstop: number;
  shake: number;
}

export function huskParams(P: Params, kind: HuskKind): HuskParams {
  return kind === 'peeling' ? P.husks.peeling : P.husks.nutshell;
}

/** Husks that can be hit (alive and done materializing). */
export function isHittable(h: HuskState): boolean {
  return h.core > 0 && h.action !== 'spawn';
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
  const killed = h.core <= 0;

  let kb = idiv(hit.knockback * 1000, hp.weight);
  if (absorbed) kb = idiv(kb * hp.armoredKb, 1000);
  h.vx += dirX(dir, kb);
  h.vy += dirY(dir, kb);

  if (!killed) {
    if (broke >= 0) {
      h.action = 'stagger';
      h.t = 0;
    } else if (!absorbed && h.action !== 'stagger') {
      h.action = 'flinch';
      h.t = 0;
    }
  }

  h.hitstop = Math.max(h.hitstop, hit.hitstop);
  s.player.hitstop = Math.max(s.player.hitstop, hit.hitstop);
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
    hitHusk(ctx, h, hit, x, y);
  }
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
  for (const h of s.husks) {
    if (!isHittable(h) || hitIds.includes(h.id)) continue;
    const maxR = radius + huskParams(P, h.kind).radius;
    const dx = h.x - x;
    const dy = h.y - y;
    if (dx * dx + dy * dy > maxR * maxR) continue;
    hitIds.push(h.id);
    hitHusk(ctx, h, hit, x, y);
  }
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
      ctx.events.push({ type: 'perfectDodge', x: p.x, y: p.y, bonus: P.perfect.bonus });
      return true;
    }
    return false;
  }
  if (dist > reach || p.hurtInvuln > 0) return false;

  const hp = huskParams(P, h.kind);
  const dir = atan2(p.y - h.y, p.x - h.x);
  p.hp -= hp.damage;
  s.stats.damageTaken += hp.damage;
  p.hurtInvuln = P.player.hurtInvuln;
  p.vx = dirX(dir, P.player.hurtKnockback);
  p.vy = dirY(dir, P.player.hurtKnockback);
  p.hitstop = Math.max(p.hitstop, hp.hitstop);
  h.hitstop = Math.max(h.hitstop, hp.hitstop);
  p.hitIds = [];
  ctx.events.push({ type: 'playerHurt', x: p.x, y: p.y, damage: hp.damage, shake: hp.shake, dir });
  if (p.hp <= 0) {
    p.hp = 0;
    p.action = 'dead';
    p.t = 0;
    s.status = 'dead';
    s.endTick = s.tick;
    ctx.events.push({ type: 'runEnd', status: 'dead' });
  } else {
    p.action = 'hurt';
    p.t = 0;
    p.buffer = 'none';
    p.charge = 0;
    p.nextCombo = 0;
    p.comboTimer = 0;
  }
  return true;
}
