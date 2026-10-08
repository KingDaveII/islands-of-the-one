import { accelerate, brake, moveBody } from './body.js';
import { strikeArc, strikeCircle, type Ctx, type Hit } from './combat.js';
import { idiv } from './fixed.js';
import { Button, MOVE_MAG_MAX, moveDirToAngle, type TickInput } from './input.js';
import type { Params, Strike } from './tuning.js';
import type { BufferedAction, PlayerState } from './state.js';
import { dirX, dirY } from './trig.js';

export type StrikePhase = 'startup' | 'active' | 'recovery' | 'done';

/** Phase of an attack `t` ticks after it started (t = 1 on the first tick after starting). */
export function strikePhase(t: number, startup: number, active: number, recovery: number): StrikePhase {
  if (t <= startup) return 'startup';
  if (t <= startup + active) return 'active';
  if (t <= startup + active + recovery) return 'recovery';
  return 'done';
}

export function lightStrike(P: Params, step: number): Strike {
  const strikes = P.weapon.light;
  return strikes[Math.min(step, strikes.length - 1)] as Strike;
}

/** Linear interpolation by charge fraction (charge / fullCharge), integer result. */
function byCharge(range: [number, number], charge: number, full: number): number {
  return range[0] + idiv((range[1] - range[0]) * Math.min(charge, full), full);
}

export function heavyHit(P: Params, charge: number): Hit {
  const h = P.weapon.heavy;
  return {
    damage: byCharge(h.damage, charge, h.fullCharge),
    shellDamage: byCharge(h.shellDamage, charge, h.fullCharge),
    knockback: byCharge(h.knockback, charge, h.fullCharge),
    hitstop: byCharge(h.hitstop, charge, h.fullCharge),
    shake: byCharge(h.shake, charge, h.fullCharge),
  };
}

/** Current phase of the player's attack, or null when not attacking. */
export function playerAttackPhase(p: PlayerState, P: Params): StrikePhase | null {
  switch (p.action) {
    case 'light': {
      const s = lightStrike(P, p.comboStep);
      return strikePhase(p.t, s.startup, s.active, s.recovery);
    }
    case 'heavy': {
      const h = P.weapon.heavy;
      return strikePhase(p.t, h.startup, h.active, h.recovery);
    }
    case 'lunge':
      return strikePhase(p.t, 0, P.lunge.dash, P.lunge.recovery);
    default:
      return null;
  }
}

/** Recovery is the cancel window: dodge, the next combo hit, heavy and abilities may start. */
function canCancel(p: PlayerState, P: Params): boolean {
  return playerAttackPhase(p, P) === 'recovery';
}

function isFree(p: PlayerState, P: Params): boolean {
  return p.action === 'idle' || canCancel(p, P);
}

function resetCombo(p: PlayerState): void {
  p.nextCombo = 0;
  p.comboTimer = 0;
}

function startLight(ctx: Ctx): void {
  const { s, P } = ctx;
  const p = s.player;
  const continuing = p.action === 'light' || p.comboTimer > 0;
  const step = continuing ? p.nextCombo : 0;
  p.action = 'light';
  p.t = 0;
  p.comboStep = step;
  p.nextCombo = (step + 1) % P.weapon.light.length;
  p.comboTimer = 0;
  p.dir = p.aim;
  p.hitIds = [];
  ctx.events.push({ type: 'swing', attack: 'light', step, x: p.x, y: p.y, dir: p.dir });
}

function startCharge(p: PlayerState): void {
  p.action = 'charge';
  p.t = 0;
  p.charge = 0;
  p.dir = p.aim;
  resetCombo(p);
}

function startHeavy(ctx: Ctx): void {
  const p = ctx.s.player;
  p.action = 'heavy';
  p.t = 0;
  p.dir = p.aim;
  p.hitIds = [];
  ctx.events.push({ type: 'swing', attack: 'heavy', step: p.charge, x: p.x, y: p.y, dir: p.dir });
}

function startDodge(ctx: Ctx): void {
  const { s, P } = ctx;
  const p = s.player;
  p.action = 'dodge';
  p.t = 0;
  p.dir = p.moveMag > 0 ? p.moveAngle : p.aim;
  p.iframes = P.dodge.iframes;
  p.dodgeAge = 0;
  p.perfectUsed = false;
  p.charge = 0;
  resetCombo(p);
  ctx.events.push({ type: 'dodge', x: p.x, y: p.y, dir: p.dir });
}

function startLunge(ctx: Ctx, slot: number): void {
  const { s, P } = ctx;
  const p = s.player;
  p.action = 'lunge';
  p.t = 0;
  p.dir = p.aim;
  p.hitIds = [];
  p.cooldowns[slot] = P.lunge.cooldown;
  resetCombo(p);
  ctx.events.push({ type: 'swing', attack: 'lunge', step: 0, x: p.x, y: p.y, dir: p.dir });
}

const ABILITY_SLOT: Partial<Record<BufferedAction, number>> = { ability1: 0, ability2: 1, ability3: 2 };

/** Try to perform a (possibly buffered) action now. Returns true if it was consumed. */
function tryAction(ctx: Ctx, action: BufferedAction): boolean {
  const { s, P } = ctx;
  const p = s.player;
  const free = isFree(p, P);
  switch (action) {
    case 'none':
      return true;
    case 'dodge':
      if (!(free || p.action === 'charge') || p.dodgeCooldown > 0) return false;
      startDodge(ctx);
      return true;
    case 'light':
      if (!free) return false;
      startLight(ctx);
      return true;
    case 'heavy':
      if (!free) return false;
      startCharge(p);
      return true;
    default: {
      const slot = ABILITY_SLOT[action] ?? 0;
      const id = P.weapon.slots[slot];
      // Locked slots swallow the press.
      if (id !== 'lunge') return true;
      if (!free || (p.cooldowns[slot] ?? 0) > 0) return false;
      startLunge(ctx, slot);
      return true;
    }
  }
}

function pressedAction(input: TickInput, heavyPressed: boolean): BufferedAction {
  const b = input.buttons;
  if (b & Button.Dodge) return 'dodge';
  if (b & Button.Ability1) return 'ability1';
  if (b & Button.Ability2) return 'ability2';
  if (b & Button.Ability3) return 'ability3';
  if (heavyPressed) return 'heavy';
  if (b & Button.Light) return 'light';
  return 'none';
}

function locomotion(ctx: Ctx, factorPermille: number): void {
  const { s, P } = ctx;
  const p = s.player;
  if (p.moveMag === 0) {
    brake(p, P.player.friction);
    return;
  }
  const speed = idiv(idiv(P.player.speed * p.moveMag, MOVE_MAG_MAX) * factorPermille, 1000);
  accelerate(p, dirX(p.moveAngle, speed), dirY(p.moveAngle, speed), P.player.accel);
}

function advanceStrike(ctx: Ctx, st: Strike): StrikePhase {
  const { s, P } = ctx;
  const p = s.player;
  p.t++;
  const ph = strikePhase(p.t, st.startup, st.active, st.recovery);
  if (ph === 'startup' || ph === 'active') {
    p.vx = dirX(p.dir, st.step);
    p.vy = dirY(p.dir, st.step);
  } else {
    brake(p, P.player.friction);
  }
  if (ph === 'active') strikeArc(ctx, p.x, p.y, p.dir, st.reach, st.halfArc, st, p.hitIds);
  return ph;
}

function advanceAction(ctx: Ctx): void {
  const { s, P } = ctx;
  const p = s.player;
  switch (p.action) {
    case 'idle':
      locomotion(ctx, 1000);
      if (p.comboTimer > 0 && --p.comboTimer === 0) p.nextCombo = 0;
      break;
    case 'light':
      if (advanceStrike(ctx, lightStrike(P, p.comboStep)) === 'done') {
        p.action = 'idle';
        p.t = 0;
        p.comboTimer = P.weapon.comboReset;
      }
      break;
    case 'charge':
      p.t++;
      p.charge = Math.min(P.weapon.heavy.fullCharge, p.charge + 1);
      locomotion(ctx, P.weapon.heavy.chargeMove);
      if (!p.heavyHeld) startHeavy(ctx);
      break;
    case 'heavy': {
      const h = P.weapon.heavy;
      const hit = heavyHit(P, p.charge);
      const st: Strike = { ...hit, startup: h.startup, active: h.active, recovery: h.recovery, reach: h.reach, halfArc: h.halfArc, step: h.step };
      if (advanceStrike(ctx, st) === 'done') {
        p.action = 'idle';
        p.t = 0;
        p.charge = 0;
      }
      break;
    }
    case 'lunge': {
      const L = P.lunge;
      p.t++;
      if (p.t <= L.dash) {
        p.vx = dirX(p.dir, L.speed);
        p.vy = dirY(p.dir, L.speed);
        strikeCircle(ctx, p.x, p.y, L.radius, L, p.hitIds);
      } else {
        brake(p, P.player.friction);
        if (p.t > L.dash + L.recovery) {
          p.action = 'idle';
          p.t = 0;
        }
      }
      break;
    }
    case 'dodge':
      p.t++;
      p.vx = dirX(p.dir, P.dodge.speed);
      p.vy = dirY(p.dir, P.dodge.speed);
      if (p.t >= P.dodge.duration) {
        const exit = idiv(P.dodge.speed * P.dodge.exitSpeed, 1000);
        p.vx = dirX(p.dir, exit);
        p.vy = dirY(p.dir, exit);
        p.action = 'idle';
        p.t = 0;
        p.dodgeCooldown = P.dodge.cooldown;
      }
      break;
    case 'hurt':
      p.t++;
      brake(p, P.player.friction);
      if (p.t >= P.player.hurtStun) {
        p.action = 'idle';
        p.t = 0;
      }
      break;
    case 'dead':
      brake(p, P.player.friction);
      break;
  }
}

/** One tick of player control. Presses are buffered and retried for `bufferTicks`. */
export function updatePlayer(ctx: Ctx, input: TickInput): void {
  const { s, P } = ctx;
  const p = s.player;
  if (p.action === 'dead') {
    advanceAction(ctx);
    moveBody(s.room, p, P.player.radius);
    return;
  }

  const held = (input.buttons & Button.Heavy) !== 0;
  const heavyPressed = held && !p.heavyHeld;
  p.heavyHeld = held;
  p.aim = input.aim;
  p.moveMag = input.moveMag;
  if (input.moveMag > 0) p.moveAngle = moveDirToAngle(input.moveDir);
  const pressed = pressedAction(input, heavyPressed);
  if (pressed !== 'none') {
    p.buffer = pressed;
    p.bufferAge = 0;
  }

  // Hitstop freezes the player completely; buffered presses wait without aging.
  if (p.hitstop > 0) {
    p.hitstop--;
    return;
  }

  if (p.dodgeCooldown > 0) p.dodgeCooldown--;
  for (let i = 0; i < p.cooldowns.length; i++) {
    const c = p.cooldowns[i] ?? 0;
    if (c > 0) p.cooldowns[i] = c - 1;
  }
  if (p.iframes > 0) p.iframes--;
  if (p.hurtInvuln > 0) p.hurtInvuln--;
  if (p.dodgeAge < 600) p.dodgeAge++;

  advanceAction(ctx);

  if (p.buffer !== 'none') {
    if (tryAction(ctx, p.buffer)) {
      p.buffer = 'none';
      p.bufferAge = 0;
    } else if (++p.bufferAge > P.bufferTicks) {
      p.buffer = 'none';
      p.bufferAge = 0;
    }
  }

  moveBody(s.room, p, P.player.radius);
}
