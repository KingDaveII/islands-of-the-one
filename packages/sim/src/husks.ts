import { accelerate, brake, moveBody } from './body.js';
import { huskAttackPlayer, huskParams, stepPush, type Ctx } from './combat.js';
import { idiv, length, QUARTER_TURN } from './fixed.js';
import { randInt } from './rng.js';
import type { HuskKind, HuskState } from './state.js';
import { atan2, dirX, dirY } from './trig.js';

/**
 * Pursuit multiplier (permille) from the Sparkglass the player carries:
 * Husks are drawn to it, so carrying more makes them faster and more eager.
 */
export function huskAggro(ctx: Ctx): number {
  const { s, P } = ctx;
  return 1000 + Math.min(P.husks.aggroMax, s.sparkglass * P.husks.aggroPer);
}

export function createHusk(ctx: Ctx, kind: HuskKind, x: number, y: number): HuskState {
  const { s, P } = ctx;
  const hp = huskParams(P, kind);
  const h: HuskState = {
    id: s.nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    shell: [...hp.shell],
    core: hp.core,
    action: 'spawn',
    t: 0,
    attackDir: 0,
    attackHit: false,
    cooldown: 0,
    hitstop: 0,
    strafe: randInt(s, 0, 1) === 0 ? 1 : -1,
    pushX: 0,
    pushY: 0,
    pushT: 0,
  };
  ctx.events.push({ type: 'spawn', id: h.id, kind, x, y });
  return h;
}

/** Center of a Nutshell slam. */
export function slamCenter(ctx: Ctx, h: HuskState): { x: number; y: number } {
  const off = ctx.P.husks.nutshell.slamOffset;
  return { x: h.x + dirX(h.attackDir, off), y: h.y + dirY(h.attackDir, off) };
}

function toChase(h: HuskState, cooldown: number): void {
  h.action = 'chase';
  h.t = 0;
  h.cooldown = Math.max(h.cooldown, cooldown);
}

function rolledCooldown(ctx: Ctx, h: HuskState): number {
  const hp = huskParams(ctx.P, h.kind);
  const base = hp.cooldown + randInt(ctx.s, 0, hp.cooldownJitter);
  return idiv(base * 1000, huskAggro(ctx));
}

export function updateHusk(ctx: Ctx, h: HuskState): void {
  const { s, P } = ctx;
  const hp = huskParams(P, h.kind);
  const p = s.player;
  if (h.hitstop > 0) {
    h.hitstop--;
    return;
  }
  stepPush(h);
  if (h.cooldown > 0) h.cooldown--;
  h.t++;
  const dx = p.x - h.x;
  const dy = p.y - h.y;
  const dist = length(dx, dy);
  const toward = atan2(dy, dx);
  const playerAlive = p.action !== 'dead';

  switch (h.action) {
    case 'spawn':
      brake(h, hp.friction);
      if (h.t >= hp.spawn) {
        toChase(h, idiv(hp.cooldown, 2) + randInt(s, 0, hp.cooldownJitter));
      }
      break;
    case 'chase': {
      if (!playerAlive) {
        brake(h, hp.friction);
        break;
      }
      if (h.cooldown === 0 && dist <= hp.attackRange) {
        h.action = 'windup';
        h.t = 0;
        h.attackDir = toward;
        brake(h, hp.friction);
        ctx.events.push({ type: 'telegraph', id: h.id, kind: h.kind });
        break;
      }
      const aggro = huskAggro(ctx);
      let speed = idiv(hp.speed * aggro, 1000);
      let angle = toward;
      // Waiting for the next attack: circle at the edge of attack range instead of crowding in.
      if (h.cooldown > 0 && dist < hp.attackRange + hp.radius) {
        angle = toward + h.strafe * (QUARTER_TURN + QUARTER_TURN / 3);
        speed = idiv(speed * 3, 5);
      }
      accelerate(h, dirX(angle, speed), dirY(angle, speed), hp.accel);
      break;
    }
    // Attack timing: startup = wind-up (telegraph), active = lunge/slam, recovery = recover.
    case 'windup':
      brake(h, hp.friction);
      if (h.t <= hp.track && playerAlive) h.attackDir = toward;
      if (h.t >= hp.startup) {
        h.action = 'attack';
        h.t = 0;
        h.attackHit = false;
        ctx.events.push({ type: 'huskAttack', id: h.id, kind: h.kind });
        if (h.kind === 'peeling') {
          h.vx = dirX(h.attackDir, P.husks.peeling.lungeSpeed);
          h.vy = dirY(h.attackDir, P.husks.peeling.lungeSpeed);
        }
      }
      break;
    case 'attack':
      if (h.kind === 'peeling') {
        const pe = P.husks.peeling;
        h.vx = dirX(h.attackDir, pe.lungeSpeed);
        h.vy = dirY(h.attackDir, pe.lungeSpeed);
        if (!h.attackHit) {
          h.attackHit = huskAttackPlayer(ctx, h, dist, P.player.radius + pe.radius + pe.hitPad);
        }
        if (h.t >= hp.active) {
          h.action = 'recover';
          h.t = 0;
        }
      } else {
        const nu = P.husks.nutshell;
        brake(h, hp.friction);
        if (!h.attackHit) {
          const c = slamCenter(ctx, h);
          const d = length(p.x - c.x, p.y - c.y);
          h.attackHit = huskAttackPlayer(ctx, h, d, nu.slamRadius + P.player.radius);
        }
        if (h.t >= hp.active) {
          h.action = 'recover';
          h.t = 0;
        }
      }
      break;
    case 'recover':
      brake(h, hp.friction);
      if (h.t >= hp.recovery) toChase(h, rolledCooldown(ctx, h));
      break;
    case 'stagger':
      brake(h, hp.friction);
      if (h.t >= hp.stagger) toChase(h, rolledCooldown(ctx, h));
      break;
    case 'flinch':
      brake(h, hp.friction);
      if (h.t >= hp.flinch) toChase(h, idiv(hp.cooldown, 3));
      break;
  }
  moveBody(s.room, h, hp.radius);
}
