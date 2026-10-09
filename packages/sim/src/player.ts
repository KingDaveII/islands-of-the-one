import { accelerate, brake, moveBody } from './body.js';
import { strikeArc, strikeCircle, type Ctx, type Hit } from './combat.js';
import { idiv } from './fixed.js';
import { Button, MOVE_MAG_MAX, moveDirToAngle, type TickInput } from './input.js';
import { abilityAt, lightStrike, playerAttackPhase, strikePhase, type StrikePhase } from './moves.js';
import type { Params, Strike } from './tuning.js';
import type { BufferedAction, PlayerState } from './state.js';
import { dirX, dirY } from './trig.js';

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

export type Intent = 'attack' | 'ability' | 'dodge';

/**
 * Cancel rules: what may start now, given the current move.
 *
 * - idle: anything.
 * - light / heavy recovery: the next light, a heavy, an ability or a dodge.
 * - ability recovery: only a dodge.
 * - charging a heavy: only a dodge.
 * - startup / active of any move, dodge, hurt: nothing (presses stay buffered).
 */
export function canStart(p: PlayerState, P: Params, intent: Intent): boolean {
  switch (p.action) {
    case 'idle':
      return true;
    case 'charge':
      return intent === 'dodge';
    case 'light':
    case 'heavy':
      return playerAttackPhase(p, P) === 'recovery';
    case 'ability':
      return intent === 'dodge' && playerAttackPhase(p, P) === 'recovery';
    default:
      return false;
  }
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
  p.swingHitstop = 0;
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
  p.swingHitstop = 0;
  ctx.events.push({ type: 'swing', attack: 'heavy', step: p.charge, x: p.x, y: p.y, dir: p.dir });
}

function startDodge(ctx: Ctx): void {
  const { s, P } = ctx;
  const p = s.player;
  p.action = 'dodge';
  p.t = 0;
  p.dir = p.moveMag > 0 ? p.moveAngle : p.aim;
  p.charge = 0;
  resetCombo(p);
  if (P.dodge.startup === 0) beginIframes(p, P);
  ctx.events.push({ type: 'dodge', x: p.x, y: p.y, dir: p.dir });
}

/** The dodge's active phase: i-frames, and the perfect-dodge window opens. */
function beginIframes(p: PlayerState, P: Params): void {
  p.iframes = P.dodge.active;
  p.dodgeAge = 0;
  p.perfectUsed = false;
}

function startAbility(ctx: Ctx, slot: number, cooldown: number): void {
  const p = ctx.s.player;
  p.action = 'ability';
  p.abilitySlot = slot;
  p.t = 0;
  p.dir = p.aim;
  p.hitIds = [];
  p.swingHitstop = 0;
  p.charge = 0;
  p.cooldowns[slot] = cooldown;
  resetCombo(p);
  ctx.events.push({ type: 'swing', attack: 'ability', step: slot, x: p.x, y: p.y, dir: p.dir });
}

const ABILITY_SLOT: Partial<Record<BufferedAction, number>> = { ability1: 0, ability2: 1, ability3: 2 };

/** Try to perform a (possibly buffered) action now. Returns true if it was consumed. */
function tryAction(ctx: Ctx, action: BufferedAction): boolean {
  const { s, P } = ctx;
  const p = s.player;
  switch (action) {
    case 'none':
      return true;
    case 'dodge':
      if (!canStart(p, P, 'dodge') || p.dodgeCooldown > 0) return false;
      startDodge(ctx);
      return true;
    case 'light':
      if (!canStart(p, P, 'attack')) return false;
      startLight(ctx);
      return true;
    case 'heavy':
      if (!canStart(p, P, 'attack')) return false;
      startCharge(p);
      return true;
    default: {
      const slot = ABILITY_SLOT[action] ?? 0;
      const a = abilityAt(P, slot);
      // Locked slots swallow the press.
      if (!a || a.locked) return true;
      if (!canStart(p, P, 'ability') || (p.cooldowns[slot] ?? 0) > 0) return false;
      startAbility(ctx, slot, a.cooldown);
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
      const st: Strike = {
        ...hit,
        startup: h.startup,
        active: h.active,
        recovery: h.recovery,
        armorStart: h.armorStart,
        armorEnd: h.armorEnd,
        reach: h.reach,
        halfArc: h.halfArc,
        step: h.step,
      };
      if (advanceStrike(ctx, st) === 'done') {
        p.action = 'idle';
        p.t = 0;
        p.charge = 0;
      }
      break;
    }
    case 'ability': {
      const a = abilityAt(P, p.abilitySlot);
      p.t++;
      const ph = a ? strikePhase(p.t, a.startup, a.active, a.recovery) : 'done';
      if (a && ph === 'active') {
        p.vx = dirX(p.dir, a.speed);
        p.vy = dirY(p.dir, a.speed);
        strikeCircle(ctx, p.x, p.y, a.radius, a, p.hitIds);
      } else {
        brake(p, P.player.friction);
      }
      if (ph === 'done') {
        p.action = 'idle';
        p.t = 0;
      }
      break;
    }
    case 'dodge': {
      const d = P.dodge;
      p.t++;
      if (p.t <= d.startup) {
        brake(p, P.player.friction);
        if (p.t === d.startup) beginIframes(p, P);
      } else {
        p.vx = dirX(p.dir, d.speed);
        p.vy = dirY(p.dir, d.speed);
      }
      if (p.t >= d.startup + d.active + d.recovery) {
        const exit = idiv(d.speed * d.exitSpeed, 1000);
        p.vx = dirX(p.dir, exit);
        p.vy = dirY(p.dir, exit);
        p.action = 'idle';
        p.t = 0;
        p.dodgeCooldown = d.cooldown;
      }
      break;
    }
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
