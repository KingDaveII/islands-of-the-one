import { accelerate, brake, moveBody } from './body.js';
import {
  hitHusk,
  hookSnags,
  huskParams,
  pickHaulTarget,
  slide,
  staggerHusk,
  strikeArc,
  strikeCircle,
  strikeRect,
  sweepHook,
  type Ctx,
  type Hit,
} from './combat.js';
import { angleDiff, idiv, length } from './fixed.js';
import { Button, MOVE_MAG_MAX, moveDirToAngle, type TickInput } from './input.js';
import {
  abilityAt,
  beforeChainPoint,
  heavyTiming,
  isCharged,
  lightStrike,
  playerAttackPhase,
  strikePhase,
  type StrikePhase,
} from './moves.js';
import type { Ability, Haul, Params, Strike } from './tuning.js';
import type { BufferedAction, HuskState, PlayerState } from './state.js';
import { atan2, dirX, dirY } from './trig.js';

/** Linear interpolation across the charge window (chargeMin..chargeMax), integer result. */
function byCharge(range: [number, number], charge: number, min: number, max: number): number {
  const span = Math.max(1, max - min);
  const f = Math.max(0, Math.min(charge - min, span));
  return range[0] + idiv((range[1] - range[0]) * f, span);
}

/**
 * The Hook-thrust's hit for a given charge: the tap below `chargeMin`, else
 * the charged thrust scaling from `chargeMin` to `chargeMax`. Every thrust
 * pins its target (hold, then shove) and has no knockback.
 */
export function heavyHit(P: Params, charge: number): Hit {
  const h = P.weapon.heavy;
  const base = { knockback: h.knockback, hitstop: h.hitstop, hold: h.hold, shove: h.shove };
  if (!isCharged(P, charge)) {
    return { ...base, damage: h.tap.damage, shellDamage: h.tap.shellDamage, shake: h.tap.shake };
  }
  const c = h.charged;
  return {
    ...base,
    damage: byCharge(c.damage, charge, h.chargeMin, h.chargeMax),
    shellDamage: byCharge(c.shellDamage, charge, h.chargeMin, h.chargeMax),
    shake: byCharge(c.shake, charge, h.chargeMin, h.chargeMax),
  };
}

export type Intent = 'light' | 'heavy' | 'ability' | 'dodge';

/**
 * Cancel rules: what may start now, given the current move.
 *
 * - idle: anything.
 * - light recovery: a heavy, an ability or a dodge from its first tick; the
 *   next light only once `lightChainTicks` of the recovery have passed.
 * - heavy recovery: the next light, a heavy, an ability or a dodge.
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
      return playerAttackPhase(p, P) === 'recovery' && !(intent === 'light' && beforeChainPoint(p, P));
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
  let step = continuing ? p.nextCombo : 0;
  // A light shortly after a Haul hit starts at the last combo hit.
  if (p.haulCombo > 0) step = P.weapon.light.length - 1;
  p.haulCombo = 0;
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
  p.hook = null;
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
  p.hook = null;
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
      if (!canStart(p, P, 'light')) return false;
      startLight(ctx);
      return true;
    case 'heavy':
      if (!canStart(p, P, 'heavy')) return false;
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

/**
 * Use the consumable in a slot. Items are instant (no move): a Ration starts a
 * heal over time; using another while one runs adds to the pool and restarts
 * the duration. Presses are not buffered.
 */
function useItem(ctx: Ctx, slotIndex: number): void {
  const { s, P } = ctx;
  const p = s.player;
  const slot = p.items[slotIndex];
  if (!slot || slot.count <= 0) return;
  const kind = P.consumables.kinds.find((k) => k.id === slot.id);
  if (!kind) return;
  slot.count--;
  const id = slot.id;
  if (slot.count === 0) slot.id = '';
  p.healPool += idiv(P.player.maxHp * kind.heal, 1000) * 1000;
  p.healLeft = kind.duration;
  ctx.events.push({ type: 'itemUsed', slot: slotIndex, id });
}

/** One tick of healing over time, spread evenly (in milli-HP) over the remaining ticks. */
function healTick(p: PlayerState, maxHp: number): void {
  if (p.healLeft <= 0) return;
  const rate = p.healLeft === 1 ? p.healPool : idiv(p.healPool, p.healLeft);
  p.healPool -= rate;
  p.healLeft--;
  p.healAcc += rate;
  const whole = idiv(p.healAcc, 1000);
  if (whole > 0) {
    p.hp = Math.min(maxHp, p.hp + whole);
    p.healAcc -= whole * 1000;
  }
  if (p.healLeft === 0) p.healPool = 0;
}

/**
 * The backpedal's speed factor, permille (GAME DESIGN 2026-10-17): moving away
 * from the aim is slower. 1000 while the movement is within
 * `player.backpedalFrom` of the aim (strafing, at 90°, is never slowed),
 * eased linearly in integer math on the 1/4096-turn angles down to
 * `player.backpedal` at `player.backpedalFull`, and held there to 180°. With
 * a gamepad stick centred the aim follows the movement, so that player is
 * never slowed. Applied in Combat only, to the idle run (`locomotion`).
 */
export function backpedalFactor(P: Params, moveAngle: number, aim: number): number {
  const { backpedal, backpedalFrom, backpedalFull } = P.player;
  const sep = Math.abs(angleDiff(moveAngle, aim));
  if (sep <= backpedalFrom) return 1000;
  if (sep >= backpedalFull) return backpedal;
  return 1000 - idiv((1000 - backpedal) * (sep - backpedalFrom), backpedalFull - backpedalFrom);
}

/**
 * Free movement: the stick or keys toward a target speed, at `factorPermille`
 * of `player.speed` (the charge walks slower at `chargeMove`, with no
 * backpedal on top; GAME DESIGN 2026-10-17). The backpedal's factor applies
 * only with `backpedal`: the idle run in Combat, never in Calm (a cleared
 * room, the holding). The dodge, the Haul's pull and every forced movement
 * keep their full distances.
 */
function locomotion(ctx: Ctx, factorPermille: number, backpedal: boolean): void {
  const { s, P } = ctx;
  const p = s.player;
  if (p.moveMag === 0) {
    brake(p, P.player.friction);
    return;
  }
  const full = idiv(idiv(P.player.speed * p.moveMag, MOVE_MAG_MAX) * factorPermille, 1000);
  const speed = backpedal ? idiv(full * backpedalFactor(P, p.moveAngle, p.aim), 1000) : full;
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

/** The Hook-thrust: a straight rectangle hitbox along the aim. */
function advanceHeavy(ctx: Ctx): StrikePhase {
  const { s, P } = ctx;
  const p = s.player;
  const h = P.weapon.heavy;
  const tm = heavyTiming(P, p.charge);
  const hit = heavyHit(P, p.charge);
  p.t++;
  const ph = strikePhase(p.t, tm.startup, tm.active, tm.recovery);
  if (ph === 'startup' || ph === 'active') {
    p.vx = dirX(p.dir, tm.step);
    p.vy = dirY(p.dir, tm.step);
  } else {
    brake(p, P.player.friction);
  }
  if (ph === 'active') strikeRect(ctx, p.x, p.y, p.dir, h.length, h.halfWidth, hit, p.hitIds);
  return ph;
}

// --- Haul -------------------------------------------------------------------

function launchHook(ctx: Ctx, haul: Haul): void {
  const { s } = ctx;
  const p = s.player;
  const targetId = pickHaulTarget(ctx, p.x, p.y, p.aim, haul.halfCone, haul.range);
  const target = s.husks.find((h) => h.id === targetId);
  const dir = target ? atan2(target.y - p.y, target.x - p.x) : p.aim;
  p.dir = dir;
  p.hook = { x: p.x, y: p.y, dir, travel: 0, targetId, hitId: -1, pull: 'none', pullLeft: 0 };
}

/** The hook landed: damage, stagger, and the pull by weight class. */
function hookHit(ctx: Ctx, a: Ability, haul: Haul, h: HuskState): void {
  const { s, P } = ctx;
  const p = s.player;
  const hk = p.hook;
  if (!hk) return;
  const hit: Hit = {
    damage: a.damage,
    shellDamage: a.shellDamage,
    knockback: 0,
    hitstop: a.hitstop,
    shake: a.shake,
    hold: 0,
    shove: 0,
  };
  hitHusk(ctx, h, hit, p.x, p.y);
  hk.hitId = h.id;
  hk.x = h.x;
  hk.y = h.y;
  const weightClass = huskParams(P, h.kind).weightClass;
  if (h.core <= 0) {
    // The hook killed it: nothing to pull.
    ctx.events.push({ type: 'haulHit', id: h.id, kind: h.kind, weightClass, pull: 'husk', x: h.x, y: h.y });
    p.hook = null;
    return;
  }
  const d = length(h.x - p.x, h.y - p.y);
  if (weightClass === 'heavy') {
    // Too heavy to move: the chain pulls the player to it instead.
    staggerHusk(h, haul.staggerHeavy);
    hk.pull = 'player';
    hk.pullLeft = idiv(Math.max(0, d - haul.playerPull) + a.speed - 1, Math.max(1, a.speed)) + 1;
  } else {
    staggerHusk(h, haul.stagger);
    const full = Math.max(0, d - haul.pullLight);
    const dist = weightClass === 'medium' ? idiv(full * haul.pullMedium, 1000) : full;
    slide(ctx, h, atan2(p.y - h.y, p.x - h.x), dist);
    hk.pull = 'husk';
    hk.pullLeft = P.husks.knockbackTicks;
  }
  p.haulCombo = haul.comboWindow;
  ctx.events.push({ type: 'haulHit', id: h.id, kind: h.kind, weightClass, pull: hk.pull, x: h.x, y: h.y });
}

function hookMiss(ctx: Ctx, a: Ability, haul: Haul): void {
  const p = ctx.s.player;
  const hk = p.hook;
  if (!hk) return;
  const refund = idiv(a.cooldown * haul.missRefund, 1000);
  p.cooldowns[p.abilitySlot] = Math.max(0, (p.cooldowns[p.abilitySlot] ?? 0) - refund);
  ctx.events.push({ type: 'haulMiss', x: hk.x, y: hk.y, refund });
  p.hook = null;
}

/** One tick of the hook: flight (first hit only, range, walls), then the pull. Returns true while the hook is still out. */
function stepHook(ctx: Ctx, a: Ability, haul: Haul): boolean {
  const { s } = ctx;
  const p = s.player;
  const hk = p.hook;
  if (!hk) return false;
  if (hk.hitId < 0) {
    const step = Math.min(haul.speed, haul.range - hk.travel);
    const nx = hk.x + dirX(hk.dir, step);
    const ny = hk.y + dirY(hk.dir, step);
    const found = sweepHook(ctx, hk.x, hk.y, nx, ny, a.radius);
    if (found) {
      hk.x = found.x;
      hk.y = found.y;
      hookHit(ctx, a, haul, found.husk);
      return p.hook !== null;
    }
    hk.x = nx;
    hk.y = ny;
    hk.travel += step;
    if (hookSnags(s, nx, ny) || hk.travel >= haul.range) hookMiss(ctx, a, haul);
    return p.hook !== null;
  }
  const h = s.husks.find((x) => x.id === hk.hitId);
  if (hk.pull === 'player' && h && h.core > 0) {
    hk.x = h.x;
    hk.y = h.y;
    const d = length(h.x - p.x, h.y - p.y);
    if (d <= haul.playerPull || hk.pullLeft <= 0) {
      // Arrived: the chain stops the player dead, with a short armor window to act out of.
      p.vx = 0;
      p.vy = 0;
      p.armor = Math.max(p.armor, haul.arrivalArmor);
      p.hook = null;
      return false;
    }
    const dir = atan2(h.y - p.y, h.x - p.x);
    const move = Math.min(a.speed, d - haul.playerPull);
    p.vx = dirX(dir, move);
    p.vy = dirY(dir, move);
    hk.pullLeft--;
    return true;
  }
  if (h && h.core > 0) {
    hk.x = h.x;
    hk.y = h.y;
  }
  hk.pullLeft--;
  if (hk.pullLeft <= 0 || !h || h.core <= 0) p.hook = null;
  return p.hook !== null;
}

/**
 * Haul: startup, then the hook flies during the active frames. A hit extends
 * the active phase for the pull (the husk's slide, or the player's travel);
 * recovery starts the tick after the hook is done, or after the flight on a miss.
 */
function advanceHaul(ctx: Ctx, a: Ability, haul: Haul): StrikePhase {
  const { s, P } = ctx;
  const p = s.player;
  const activeEnd = a.startup + a.active;
  // The nominal active frames may run out while the chain is still pulling: hold there.
  if (!(p.hook && p.t >= activeEnd)) p.t++;
  if (p.t === a.startup + 1) launchHook(ctx, haul);
  const ph = strikePhase(p.t, a.startup, a.active, a.recovery);
  const pullingPlayer = p.hook?.pull === 'player';
  let out = p.hook !== null;
  if (out && ph === 'active') {
    out = stepHook(ctx, a, haul);
    if (!out) p.t = activeEnd;
  }
  if (!(pullingPlayer && out)) brake(p, P.player.friction);
  return strikePhase(p.t, a.startup, a.active, a.recovery);
}

function advanceAction(ctx: Ctx): void {
  const { s, P } = ctx;
  const p = s.player;
  switch (p.action) {
    case 'idle':
      // The backpedal costs speed in Combat only (GAME DESIGN 2026-10-17).
      locomotion(ctx, 1000, s.context === 'combat');
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
      p.charge = Math.min(P.weapon.heavy.chargeMax, p.charge + 1);
      locomotion(ctx, P.weapon.heavy.chargeMove, false);
      if (!p.heavyHeld) startHeavy(ctx);
      break;
    case 'heavy':
      if (advanceHeavy(ctx) === 'done') {
        p.action = 'idle';
        p.t = 0;
        p.charge = 0;
      }
      break;
    case 'ability': {
      const a = abilityAt(P, p.abilitySlot);
      let ph: StrikePhase = 'done';
      if (a?.kind === 'haul' && a.haul) {
        ph = advanceHaul(ctx, a, a.haul);
      } else if (a) {
        p.t++;
        ph = strikePhase(p.t, a.startup, a.active, a.recovery);
        if (ph === 'active') {
          p.vx = dirX(p.dir, a.speed);
          p.vy = dirY(p.dir, a.speed);
          strikeCircle(ctx, p.x, p.y, a.radius, a, p.hitIds);
        } else {
          brake(p, P.player.friction);
        }
      }
      if (ph === 'done') {
        p.action = 'idle';
        p.t = 0;
        p.hook = null;
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
  // Holding light keeps attacking (GAME DESIGN, 2026-10-21): the client sends Light on every tick it is held, so the
  // chain comes out at its own pace, like tapping as fast as the buffer takes it. A light held since the last tick
  // never replaces another buffered press (a dodge, an ability, a heavy), so holding light never eats them, and the
  // release only stops: a light buffered by holding alone is dropped when light is let go.
  const light = (input.buttons & Button.Light) !== 0;
  const lightHeld = light && p.lightHeld;
  const lightReleased = !light && p.lightHeld;
  p.lightHeld = light;
  p.aim = input.aim;
  p.moveMag = input.moveMag;
  if (input.moveMag > 0) p.moveAngle = moveDirToAngle(input.moveDir);
  const pressed = pressedAction(input, heavyPressed);
  const heldOverOther = pressed === 'light' && lightHeld && p.buffer !== 'none' && p.buffer !== 'light';
  if (pressed !== 'none' && !heldOverOther) {
    // Holding refreshes a light a fresh press buffered without making it a held one.
    if (!(pressed === 'light' && lightHeld && p.buffer === 'light')) p.bufferFromHold = pressed === 'light' && lightHeld;
    p.buffer = pressed;
    p.bufferAge = 0;
  }
  if (lightReleased && p.buffer === 'light' && p.bufferFromHold) {
    p.buffer = 'none';
    p.bufferAge = 0;
  }
  if (input.buttons & Button.Item1) useItem(ctx, 0);
  if (input.buttons & Button.Item2) useItem(ctx, 1);
  // Interact is a Calm action: a press that reaches the sim in Combat (a stale replay, a forged input) is ignored.
  if (input.buttons & Button.Interact && s.context === 'calm') ctx.events.push({ type: 'interact', x: p.x, y: p.y });

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
  if (p.armor > 0) p.armor--;
  // The combo window opens once the chain lets go (the pull is part of the hit).
  if (p.haulCombo > 0 && p.hook === null) p.haulCombo--;
  if (p.dodgeAge < 600) p.dodgeAge++;
  healTick(p, P.player.maxHp);

  advanceAction(ctx);

  if (p.buffer !== 'none') {
    if (tryAction(ctx, p.buffer)) {
      p.buffer = 'none';
      p.bufferAge = 0;
    } else if (p.buffer === 'light' && beforeChainPoint(p, P)) {
      // A buffered light waits for the chain point without aging: the wait may be longer than the buffer.
    } else if (++p.bufferAge > P.bufferTicks) {
      p.buffer = 'none';
      p.bufferAge = 0;
    }
  }

  moveBody(s.room, p, P.player.radius);
}
