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

export interface HeavyTuning extends MoveTiming, ArmorTiming {
  fullChargeMs: number;
  chargeMoveFactor: number;
  reachPx: number;
  arcDeg: number;
  damageMin: number;
  damageMax: number;
  shellDamageMin: number;
  shellDamageMax: number;
  knockbackMinPx: number;
  knockbackMaxPx: number;
  hitstopMinMs: number;
  hitstopMaxMs: number;
  shakeMin: number;
  shakeMax: number;
  stepSpeed: number;
}

/** Ability kinds the sim knows how to run. */
export const ABILITY_KINDS = ['dash-strike', 'spin', 'none'] as const;
export type AbilityKind = (typeof ABILITY_KINDS)[number];

/**
 * One of a weapon's three ability slots. Each slot has its own cooldown; there
 * is no mana/energy resource. During `active` the player moves along the aim
 * at `speed` and hits everything within `hitRadiusPx`.
 */
export interface AbilityTuning extends MoveTiming, ArmorTiming {
  id: string;
  name: string;
  /** Locked slots exist in data but never execute. */
  locked: boolean;
  /** One of ABILITY_KINDS. */
  kind: string;
  cooldownMs: number;
  /** Travel speed during active, px/s (0 = stationary). */
  speed: number;
  hitRadiusPx: number;
  damage: number;
  shellDamage: number;
  knockbackPx: number;
  hitstopMs: number;
  shake: number;
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
  };
  input: {
    bufferMs: number;
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
  run: {
    rooms: { waves: WaveTuning[] }[];
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
  step: number;
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
}

export interface HuskParams {
  radius: number;
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
  perfect: { window: number; margin: number; slowmo: number; slowmoScale: number; bonus: number };
  bufferTicks: number;
  weapon: {
    id: string;
    comboReset: number;
    light: Strike[];
    heavy: Timing & {
      fullCharge: number;
      chargeMove: number;
      reach: number;
      halfArc: number;
      damage: [number, number];
      shellDamage: [number, number];
      knockback: [number, number];
      hitstop: [number, number];
      shake: [number, number];
      step: number;
    };
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
  run: {
    rooms: { waves: WaveTuning[] }[];
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
    step: speedToUnits(s.stepSpeed),
  };
}

function isAbilityKind(k: string): k is AbilityKind {
  return (ABILITY_KINDS as readonly string[]).includes(k);
}

function isWeightClass(k: string): k is WeightClass {
  return (WEIGHT_CLASSES as readonly string[]).includes(k);
}

function ability(a: AbilityTuning): Ability {
  if (!isAbilityKind(a.kind)) throw new Error(`unknown ability kind "${a.kind}"`);
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
  };
}

function husk(h: HuskTuning, classes: Record<WeightClass, number>): HuskParams {
  if (!isWeightClass(h.weightClass)) throw new Error(`unknown weight class "${h.weightClass}"`);
  return {
    radius: pxToUnits(h.radiusPx),
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
  const h = weapon.heavy;
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
    },
    bufferTicks: msToTicks(t.input.bufferMs),
    weapon: {
      id: weaponId,
      comboReset: msToTicks(weapon.comboResetMs),
      light: weapon.light.map(strike),
      heavy: {
        ...timing(h),
        fullCharge: Math.max(1, msToTicks(h.fullChargeMs)),
        chargeMove: toPermille(h.chargeMoveFactor),
        reach: pxToUnits(h.reachPx),
        halfArc: degToAngle(h.arcDeg) >> 1,
        damage: [int(h.damageMin), int(h.damageMax)],
        shellDamage: [int(h.shellDamageMin), int(h.shellDamageMax)],
        knockback: [pxToUnits(h.knockbackMinPx), pxToUnits(h.knockbackMaxPx)],
        hitstop: [msToTicks(h.hitstopMinMs), msToTicks(h.hitstopMaxMs)],
        shake: [int(h.shakeMin), int(h.shakeMax)],
        step: speedToUnits(h.stepSpeed),
      },
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
      },
    },
    run: {
      rooms: t.run.rooms.map((r) => ({
        waves: r.waves.map((w) => ({ peeling: int(w.peeling), nutshell: int(w.nutshell) })),
      })),
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
