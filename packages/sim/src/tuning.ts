import {
  accelToUnits,
  degToAngle,
  msToTicks,
  pxToUnits,
  speedToUnits,
  toPermille,
} from './fixed.js';

/**
 * Tuning values in human units (px, px/s, px/s², ms, degrees, fractions).
 * The canonical values live in packages/shared/data/tuning.json; a run takes
 * a full copy as part of its config, so tuning never breaks determinism.
 *
 * Shapes are kept JSON-friendly (no tuples, no discriminated unions) so the
 * imported JSON type-checks against this interface structurally.
 *
 * Every move has a startup / active / recovery timing in milliseconds; the
 * sim converts them to ticks when the tuning is compiled.
 */
export interface MoveTiming {
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
}

/**
 * Armor frames: ticks of the move (counted from its start, in ms) during which
 * the player still takes damage but is not interrupted. 0/0 means none.
 */
export interface ArmorTiming {
  armorStartMs: number;
  armorEndMs: number;
}

export interface StrikeTuning extends MoveTiming, ArmorTiming {
  reachPx: number;
  arcDeg: number;
  damage: number;
  shellDamage: number;
  /** Knockback distance for a light-class enemy, px (scaled by weight class). */
  knockbackPx: number;
  hitstopMs: number;
  /** Screen-shake strength reported with the hit (presentation only). */
  shake: number;
  /** Forward step speed during startup + active, px/s. */
  stepSpeed: number;
}

/** The tap thrust (released before `charge.minMs`). Damage is a factor of the first light hit. */
export interface HeavyTapTuning extends MoveTiming, ArmorTiming {
  damageFactor: number;
  /** Poise (shell) damage. */
  shellDamage: number;
  shake: number;
  stepSpeed: number;
}

/** The charged thrust: everything scales with the charge between `charge.minMs` and `charge.maxMs`. */
export interface HeavyChargedTuning extends MoveTiming, ArmorTiming {
  damageFactorMin: number;
  damageFactorMax: number;
  shellDamageMin: number;
  shellDamageMax: number;
  shakeMin: number;
  shakeMax: number;
  stepSpeed: number;
}

/**
 * The heavy attack: a Hook-thrust. Its hitbox is a rectangle `thrust.lengthPx`
 * long and `thrust.widthPx` wide along the aim. A hit pins the target ("held")
 * for `holdMs`, then shoves it `shovePx`; there is no knockback.
 */
export interface HeavyTuning {
  thrust: { lengthPx: number; widthPx: number };
  /** Hold shorter than minMs for the tap; the charge fills between minMs and maxMs. */
  charge: { minMs: number; maxMs: number };
  holdMs: number;
  hitstopMs: number;
  shovePx: number;
  knockbackPx: number;
  chargeMoveFactor: number;
  tap: HeavyTapTuning;
  charged: HeavyChargedTuning;
}

/** Ability kinds the sim knows how to run. */
export const ABILITY_KINDS = ['haul', 'spin', 'none'] as const;
export type AbilityKind = (typeof ABILITY_KINDS)[number];

/** The Haul hook: a projectile that pulls by weight class. */
export interface HaulTuning {
  /** Full cone width centered on the aim, degrees. */
  coneDeg: number;
  rangePx: number;
  /** Hook speed, px/s. */
  speed: number;
  /** A light-class target ends this far from the player. */
  pullLightPx: number;
  /** Fraction of a light pull a medium-class target gets. */
  pullMedium: number;
  /** A heavy-class target pulls the player to this distance from it instead. */
  playerPullDistancePx: number;
  /** Armor frames once the player arrives at a heavy target. */
  arrivalArmorMs: number;
  /** Stagger on a light/medium target. */
  staggerMs: number;
  /** Stagger on a heavy target. */
  staggerHeavyMs: number;
  /** A light pressed this long after the hit starts at combo hit 3. */
  comboWindowMs: number;
  /** Fraction of the cooldown refunded when the hook hits nothing. */
  missRefund: number;
}

/**
 * One of a weapon's three ability slots. Each slot has its own cooldown; there
 * is no mana/energy resource. `kind` says how the sim runs it: `haul` fires
 * the hook (needs `haul`), `spin` hits everything within `hitRadiusPx` without
 * moving, `none` is a locked placeholder.
 */
export interface AbilityTuning extends MoveTiming, ArmorTiming {
  id: string;
  name: string;
  /** Locked slots exist in data but never execute. */
  locked: boolean;
  /** One of ABILITY_KINDS. */
  kind: string;
  cooldownMs: number;
  /** Player travel speed during active, px/s (Haul: the pull toward a heavy target). */
  speed: number;
  /** Hit radius (Haul: the hook head). */
  hitRadiusPx: number;
  damage: number;
  shellDamage: number;
  knockbackPx: number;
  hitstopMs: number;
  shake: number;
  haul?: HaulTuning;
}

export interface WeaponTuning {
  name: string;
  /** Rarity tier (1–5), shown as pips. */
  tier: number;
  blurb: string;
  lore: string;
  comboResetMs: number;
  light: StrikeTuning[];
  heavy: HeavyTuning;
  abilities: AbilityTuning[];
}

/** Weapons offered on the start screen. Locked entries are placeholders. */
export interface WeaponRosterEntry {
  id: string;
  name: string;
  locked: boolean;
}

/** Enemy weight classes: how far pulls and knockback move them. */
export const WEIGHT_CLASSES = ['light', 'medium', 'heavy'] as const;
export type WeightClass = (typeof WEIGHT_CLASSES)[number];

export interface HuskTuning {
  radiusPx: number;
  /** Shell layers, outermost first. */
  shell: number[];
  core: number;
  speed: number;
  acceleration: number;
  friction: number;
  /** Body mass for pushing apart overlapping bodies (not knockback). */
  mass: number;
  /** One of WEIGHT_CLASSES. */
  weightClass: string;
  attackRangePx: number;
  /** startup = wind-up (telegraph), active = lunge/slam, recovery = recover. */
  attack: MoveTiming;
  /** Part of the wind-up during which the attack still tracks the player. */
  trackMs: number;
  cooldownMs: number;
  cooldownJitterMs: number;
  damage: number;
  hitstopMs: number;
  shake: number;
  /** Stagger after a shell layer breaks (interrupts attacks). */
  staggerMs: number;
  /** Flinch after a core hit once the shell is gone (interrupts attacks). */
  flinchMs: number;
  /** Knockback multiplier while the shell absorbs the hit. */
  armoredKnockbackFactor: number;
  sparkglassDrop: number;
  spawnMs: number;
}

export interface PeelingTuning extends HuskTuning {
  lungeSpeed: number;
  hitPadPx: number;
}

export interface NutshellTuning extends HuskTuning {
  slamRadiusPx: number;
  slamOffsetPx: number;
  /** The inner shell layer regrows this long after its last hit, unless it broke. */
  innerRegrowMs: number;
}

export interface ConsumableTuning {
  name: string;
  /** Fraction of max HP healed over `durationMs`. */
  healFraction: number;
  durationMs: number;
  stackMax: number;
}

/** What a chest holds; chests are scripted in the order they are opened in a run. */
export interface ChestTuning {
  item: string;
  count: number;
}

export interface WaveTuning {
  peeling: number;
  nutshell: number;
}

export interface Tuning {
  player: {
    radiusPx: number;
    maxHp: number;
    moveSpeed: number;
    acceleration: number;
    friction: number;
    mass: number;
    hurtStunMs: number;
    hurtInvulnMs: number;
    hurtKnockback: number;
  };
  /** startup = no i-frames yet, active = i-frames, recovery = still sliding. */
  dodge: MoveTiming & {
    speed: number;
    cooldownMs: number;
    exitSpeedFactor: number;
  };
  perfectDodge: {
    windowMs: number;
    marginPx: number;
    slowmoMs: number;
    slowmoScale: number;
    sparkglassBonus: number;
    /** Taken off every ability cooldown. */
    cooldownRefundMs: number;
  };
  input: {
    bufferMs: number;
  };
  /** Gamepad soft lock (client only; the sim never reads it). */
  softlock: {
    angleDeg: number;
    leftStickAngleDeg: number;
  };
  weaponRoster: WeaponRosterEntry[];
  weapons: Record<string, WeaponTuning>;
  husks: {
    aggroPerSparkglass: number;
    aggroMax: number;
    /** Fraction of a hit's core damage that lands on the hit that breaks a shell layer. */
    shellBreakCoreFactor: number;
    /** Fraction of a pull/knockback distance applied per weight class. */
    weightClasses: Record<WeightClass, number>;
    /** Time a knockback slide takes. */
    knockbackMs: number;
    peeling: PeelingTuning;
    nutshell: NutshellTuning;
  };
  consumables: {
    slots: number;
    ration: ConsumableTuning;
  };
  run: {
    rooms: { waves: WaveTuning[] }[];
    chests: ChestTuning[];
    chestRadiusPx: number;
    waveDelayMs: number;
    clearDelayMs: number;
    spawnMinDistancePx: number;
    sparkglassKeptOnDeath: number;
    pickupMagnetRadiusPx: number;
    pickupSpeed: number;
    pickupScatter: number;
  };
}

// --- Compiled (integer) parameters used by the sim -------------------------

export interface Timing {
  startup: number;
  active: number;
  recovery: number;
  /** Armored while armorStart < t <= armorEnd (t = ticks since the move started). */
  armorStart: number;
  armorEnd: number;
}

export interface Strike extends Timing {
  reach: number;
  halfArc: number;
  damage: number;
  shellDamage: number;
  knockback: number;
  hitstop: number;
  shake: number;
  /** Strikes never pin (see the heavy). */
  hold: number;
  shove: number;
  step: number;
}

export interface Haul {
  halfCone: number;
  range: number;
  /** Hook speed, units/tick. */
  speed: number;
  pullLight: number;
  /** Permille. */
  pullMedium: number;
  playerPull: number;
  arrivalArmor: number;
  stagger: number;
  staggerHeavy: number;
  comboWindow: number;
  /** Permille. */
  missRefund: number;
}

export interface Ability extends Timing {
  id: string;
  name: string;
  locked: boolean;
  kind: AbilityKind;
  cooldown: number;
  speed: number;
  radius: number;
  damage: number;
  shellDamage: number;
  knockback: number;
  hitstop: number;
  shake: number;
  hold: number;
  shove: number;
  /** Present for the `haul` kind. */
  haul: Haul | null;
}

/** The Hook-thrust (compiled). */
export interface Heavy {
  chargeMin: number;
  chargeMax: number;
  chargeMove: number;
  hold: number;
  hitstop: number;
  shove: number;
  knockback: number;
  length: number;
  halfWidth: number;
  tap: Timing & { damage: number; shellDamage: number; shake: number; step: number };
  charged: Timing & {
    damage: [number, number];
    shellDamage: [number, number];
    shake: [number, number];
    step: number;
  };
}

export interface Consumable {
  id: string;
  name: string;
  /** Permille of max HP. */
  heal: number;
  duration: number;
  stackMax: number;
}

export interface HuskParams {
  radius: number;
  weightClass: WeightClass;
  shell: number[];
  core: number;
  speed: number;
  accel: number;
  friction: number;
  mass: number;
  /** Permille of a pull/knockback distance this husk actually moves. */
  kbScale: number;
  attackRange: number;
  startup: number;
  active: number;
  recovery: number;
  track: number;
  cooldown: number;
  cooldownJitter: number;
  damage: number;
  hitstop: number;
  shake: number;
  stagger: number;
  flinch: number;
  armoredKb: number;
  drop: number;
  spawn: number;
  /** Ticks after its last hit before the innermost layer regrows (0 = never). */
  innerRegrow: number;
}

export interface Params {
  player: {
    radius: number;
    maxHp: number;
    speed: number;
    accel: number;
    friction: number;
    mass: number;
    hurtStun: number;
    hurtInvuln: number;
    hurtKnockback: number;
  };
  dodge: { startup: number; active: number; recovery: number; speed: number; cooldown: number; exitSpeed: number };
  perfect: { window: number; margin: number; slowmo: number; slowmoScale: number; bonus: number; cooldownRefund: number };
  bufferTicks: number;
  weapon: {
    id: string;
    comboReset: number;
    light: Strike[];
    heavy: Heavy;
    /** Always three slots. */
    abilities: Ability[];
  };
  husks: {
    aggroPer: number;
    aggroMax: number;
    breakCore: number;
    knockbackTicks: number;
    peeling: HuskParams & { lungeSpeed: number; hitPad: number };
    nutshell: HuskParams & { slamRadius: number; slamOffset: number };
  };
  consumables: {
    slots: number;
    kinds: Consumable[];
  };
  run: {
    rooms: { waves: WaveTuning[] }[];
    chests: { item: string; count: number }[];
    chestRadius: number;
    waveDelay: number;
    clearDelay: number;
    spawnMinDistance: number;
    keptOnDeath: number;
    magnetRadius: number;
    pickupSpeed: number;
    pickupScatter: number;
  };
}

export const ABILITY_SLOTS = 3;

function int(v: number): number {
  return Math.round(v);
}

function timing(m: MoveTiming & ArmorTiming): Timing {
  return {
    startup: msToTicks(m.startupMs),
    active: Math.max(1, msToTicks(m.activeMs)),
    recovery: msToTicks(m.recoveryMs),
    armorStart: msToTicks(m.armorStartMs),
    armorEnd: msToTicks(m.armorEndMs),
  };
}

function strike(s: StrikeTuning): Strike {
  return {
    ...timing(s),
    reach: pxToUnits(s.reachPx),
    halfArc: degToAngle(s.arcDeg) >> 1,
    damage: int(s.damage),
    shellDamage: int(s.shellDamage),
    knockback: pxToUnits(s.knockbackPx),
    hitstop: msToTicks(s.hitstopMs),
    shake: int(s.shake),
    hold: 0,
    shove: 0,
    step: speedToUnits(s.stepSpeed),
  };
}

function isAbilityKind(k: string): k is AbilityKind {
  return (ABILITY_KINDS as readonly string[]).includes(k);
}

function isWeightClass(k: string): k is WeightClass {
  return (WEIGHT_CLASSES as readonly string[]).includes(k);
}

function haul(h: HaulTuning): Haul {
  return {
    halfCone: degToAngle(h.coneDeg) >> 1,
    range: pxToUnits(h.rangePx),
    speed: Math.max(1, speedToUnits(h.speed)),
    pullLight: pxToUnits(h.pullLightPx),
    pullMedium: toPermille(h.pullMedium),
    playerPull: pxToUnits(h.playerPullDistancePx),
    arrivalArmor: msToTicks(h.arrivalArmorMs),
    stagger: msToTicks(h.staggerMs),
    staggerHeavy: msToTicks(h.staggerHeavyMs),
    comboWindow: msToTicks(h.comboWindowMs),
    missRefund: Math.max(0, Math.min(1000, toPermille(h.missRefund))),
  };
}

function ability(a: AbilityTuning): Ability {
  if (!isAbilityKind(a.kind)) throw new Error(`unknown ability kind "${a.kind}"`);
  if (a.kind === 'haul' && !a.haul) throw new Error(`ability "${a.id}" is a haul but has no haul data`);
  return {
    ...timing(a),
    id: a.id,
    name: a.name,
    locked: a.locked || a.kind === 'none',
    kind: a.kind,
    cooldown: msToTicks(a.cooldownMs),
    speed: speedToUnits(a.speed),
    radius: pxToUnits(a.hitRadiusPx),
    damage: int(a.damage),
    shellDamage: int(a.shellDamage),
    knockback: pxToUnits(a.knockbackPx),
    hitstop: msToTicks(a.hitstopMs),
    shake: int(a.shake),
    hold: 0,
    shove: 0,
    haul: a.kind === 'haul' && a.haul ? haul(a.haul) : null,
  };
}

function heavy(h: HeavyTuning, lightDamage: number): Heavy {
  const chargeMin = Math.max(1, msToTicks(h.charge.minMs));
  return {
    chargeMin,
    chargeMax: Math.max(chargeMin, msToTicks(h.charge.maxMs)),
    chargeMove: toPermille(h.chargeMoveFactor),
    hold: msToTicks(h.holdMs),
    hitstop: msToTicks(h.hitstopMs),
    shove: pxToUnits(h.shovePx),
    knockback: pxToUnits(h.knockbackPx),
    length: pxToUnits(h.thrust.lengthPx),
    halfWidth: pxToUnits(h.thrust.widthPx) >> 1,
    tap: {
      ...timing(h.tap),
      damage: int(lightDamage * h.tap.damageFactor),
      shellDamage: int(h.tap.shellDamage),
      shake: int(h.tap.shake),
      step: speedToUnits(h.tap.stepSpeed),
    },
    charged: {
      ...timing(h.charged),
      damage: [int(lightDamage * h.charged.damageFactorMin), int(lightDamage * h.charged.damageFactorMax)],
      shellDamage: [int(h.charged.shellDamageMin), int(h.charged.shellDamageMax)],
      shake: [int(h.charged.shakeMin), int(h.charged.shakeMax)],
      step: speedToUnits(h.charged.stepSpeed),
    },
  };
}

function consumable(id: string, c: ConsumableTuning): Consumable {
  return {
    id,
    name: c.name,
    heal: Math.max(0, toPermille(c.healFraction)),
    duration: Math.max(1, msToTicks(c.durationMs)),
    stackMax: Math.max(1, int(c.stackMax)),
  };
}

function husk(h: HuskTuning, classes: Record<WeightClass, number>): HuskParams {
  if (!isWeightClass(h.weightClass)) throw new Error(`unknown weight class "${h.weightClass}"`);
  return {
    radius: pxToUnits(h.radiusPx),
    weightClass: h.weightClass,
    shell: h.shell.map(int),
    core: Math.max(1, int(h.core)),
    speed: speedToUnits(h.speed),
    accel: accelToUnits(h.acceleration),
    friction: accelToUnits(h.friction),
    mass: Math.max(1, toPermille(h.mass)),
    kbScale: Math.max(0, toPermille(classes[h.weightClass])),
    attackRange: pxToUnits(h.attackRangePx),
    startup: Math.max(1, msToTicks(h.attack.startupMs)),
    active: Math.max(1, msToTicks(h.attack.activeMs)),
    recovery: msToTicks(h.attack.recoveryMs),
    track: msToTicks(h.trackMs),
    cooldown: msToTicks(h.cooldownMs),
    cooldownJitter: msToTicks(h.cooldownJitterMs),
    damage: int(h.damage),
    hitstop: msToTicks(h.hitstopMs),
    shake: int(h.shake),
    stagger: msToTicks(h.staggerMs),
    flinch: msToTicks(h.flinchMs),
    armoredKb: toPermille(h.armoredKnockbackFactor),
    drop: int(h.sparkglassDrop),
    spawn: msToTicks(h.spawnMs),
    innerRegrow: 0,
  };
}

/** True when the roster offers this weapon and it has data. */
export function isWeaponAvailable(t: Tuning, weaponId: string): boolean {
  return t.weaponRoster.some((w) => w.id === weaponId && !w.locked) && weaponId in t.weapons;
}

/** Convert tuning (human units) into integer sim parameters for one weapon. */
export function compileTuning(t: Tuning, weaponId: string): Params {
  const weapon = t.weapons[weaponId];
  if (!weapon) throw new Error(`unknown weapon "${weaponId}"`);
  if (weapon.light.length === 0) throw new Error('weapon needs at least one light strike');
  if (weapon.abilities.length !== ABILITY_SLOTS) throw new Error(`weapon needs exactly ${ABILITY_SLOTS} ability slots`);
  if (t.run.rooms.length === 0) throw new Error('run needs at least one room');
  const pTun = t.husks.peeling;
  const nTun = t.husks.nutshell;
  const classes = t.husks.weightClasses;
  return {
    player: {
      radius: pxToUnits(t.player.radiusPx),
      maxHp: Math.max(1, int(t.player.maxHp)),
      speed: speedToUnits(t.player.moveSpeed),
      accel: accelToUnits(t.player.acceleration),
      friction: accelToUnits(t.player.friction),
      mass: Math.max(1, toPermille(t.player.mass)),
      hurtStun: msToTicks(t.player.hurtStunMs),
      hurtInvuln: msToTicks(t.player.hurtInvulnMs),
      hurtKnockback: speedToUnits(t.player.hurtKnockback),
    },
    dodge: {
      startup: msToTicks(t.dodge.startupMs),
      active: msToTicks(t.dodge.activeMs),
      recovery: msToTicks(t.dodge.recoveryMs),
      speed: speedToUnits(t.dodge.speed),
      cooldown: msToTicks(t.dodge.cooldownMs),
      exitSpeed: toPermille(t.dodge.exitSpeedFactor),
    },
    perfect: {
      window: msToTicks(t.perfectDodge.windowMs),
      margin: pxToUnits(t.perfectDodge.marginPx),
      // Slow-mo is expressed in real time; this many sim ticks play at slowmoScale.
      slowmo: msToTicks(t.perfectDodge.slowmoMs * t.perfectDodge.slowmoScale),
      slowmoScale: toPermille(t.perfectDodge.slowmoScale),
      bonus: int(t.perfectDodge.sparkglassBonus),
      cooldownRefund: msToTicks(t.perfectDodge.cooldownRefundMs),
    },
    bufferTicks: msToTicks(t.input.bufferMs),
    weapon: {
      id: weaponId,
      comboReset: msToTicks(weapon.comboResetMs),
      light: weapon.light.map(strike),
      heavy: heavy(weapon.heavy, (weapon.light[0] as StrikeTuning).damage),
      abilities: weapon.abilities.map(ability),
    },
    husks: {
      aggroPer: toPermille(t.husks.aggroPerSparkglass),
      aggroMax: toPermille(t.husks.aggroMax),
      breakCore: toPermille(t.husks.shellBreakCoreFactor),
      knockbackTicks: Math.max(1, msToTicks(t.husks.knockbackMs)),
      peeling: {
        ...husk(pTun, classes),
        lungeSpeed: speedToUnits(pTun.lungeSpeed),
        hitPad: pxToUnits(pTun.hitPadPx),
      },
      nutshell: {
        ...husk(nTun, classes),
        slamRadius: pxToUnits(nTun.slamRadiusPx),
        slamOffset: pxToUnits(nTun.slamOffsetPx),
        innerRegrow: msToTicks(nTun.innerRegrowMs),
      },
    },
    consumables: {
      slots: Math.max(1, int(t.consumables.slots)),
      kinds: [consumable('ration', t.consumables.ration)],
    },
    run: {
      rooms: t.run.rooms.map((r) => ({
        waves: r.waves.map((w) => ({ peeling: int(w.peeling), nutshell: int(w.nutshell) })),
      })),
      chests: t.run.chests.map((c) => ({ item: c.item, count: Math.max(0, int(c.count)) })),
      chestRadius: pxToUnits(t.run.chestRadiusPx),
      waveDelay: msToTicks(t.run.waveDelayMs),
      clearDelay: msToTicks(t.run.clearDelayMs),
      spawnMinDistance: pxToUnits(t.run.spawnMinDistancePx),
      keptOnDeath: toPermille(t.run.sparkglassKeptOnDeath),
      magnetRadius: pxToUnits(t.run.pickupMagnetRadiusPx),
      pickupSpeed: speedToUnits(t.run.pickupSpeed),
      pickupScatter: speedToUnits(t.run.pickupScatter),
    },
  };
}
