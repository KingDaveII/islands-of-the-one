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
 */
export interface StrikeTuning {
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  reachPx: number;
  arcDeg: number;
  damage: number;
  shellDamage: number;
  /** Knockback impulse, px/s. */
  knockback: number;
  hitstopMs: number;
  /** Screen-shake strength reported with the hit (presentation only). */
  shake: number;
  /** Forward step speed during startup + active, px/s. */
  stepSpeed: number;
}

export interface HeavyTuning {
  fullChargeMs: number;
  chargeMoveFactor: number;
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  reachPx: number;
  arcDeg: number;
  damageMin: number;
  damageMax: number;
  shellDamageMin: number;
  shellDamageMax: number;
  knockbackMin: number;
  knockbackMax: number;
  hitstopMinMs: number;
  hitstopMaxMs: number;
  shakeMin: number;
  shakeMax: number;
  stepSpeed: number;
}

export interface AbilitySlotTuning {
  /** Key into `abilities` (e.g. "lunge"). */
  id: string;
  name: string;
  locked: boolean;
}

export interface WeaponTuning {
  name: string;
  comboResetMs: number;
  light: StrikeTuning[];
  heavy: HeavyTuning;
  abilities: AbilitySlotTuning[];
}

export interface LungeTuning {
  cooldownMs: number;
  dashSpeed: number;
  dashMs: number;
  recoveryMs: number;
  hitRadiusPx: number;
  damage: number;
  shellDamage: number;
  knockback: number;
  hitstopMs: number;
  shake: number;
}

export interface HuskTuning {
  radiusPx: number;
  /** Shell layers, outermost first. */
  shell: number[];
  core: number;
  speed: number;
  acceleration: number;
  friction: number;
  /** Knockback resistance: knockback is divided by this. */
  weight: number;
  attackRangePx: number;
  windupMs: number;
  /** Part of the wind-up during which the attack still tracks the player. */
  trackMs: number;
  recoverMs: number;
  cooldownMs: number;
  cooldownJitterMs: number;
  damage: number;
  knockback: number;
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
  lungeMs: number;
  hitPadPx: number;
}

export interface NutshellTuning extends HuskTuning {
  slamRadiusPx: number;
  slamOffsetPx: number;
  slamActiveMs: number;
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
    weight: number;
    hurtStunMs: number;
    hurtInvulnMs: number;
    hurtKnockback: number;
    weapon: string;
  };
  dodge: {
    speed: number;
    durationMs: number;
    iframesMs: number;
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
  weapons: Record<string, WeaponTuning>;
  abilities: {
    lunge: LungeTuning;
  };
  husks: {
    aggroPerSparkglass: number;
    aggroMax: number;
    /** Fraction of a hit's core damage that lands on the hit that breaks a shell layer. */
    shellBreakCoreFactor: number;
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

export interface Strike {
  startup: number;
  active: number;
  recovery: number;
  reach: number;
  halfArc: number;
  damage: number;
  shellDamage: number;
  knockback: number;
  hitstop: number;
  shake: number;
  step: number;
}

export interface HuskParams {
  radius: number;
  shell: number[];
  core: number;
  speed: number;
  accel: number;
  friction: number;
  weight: number;
  attackRange: number;
  windup: number;
  track: number;
  recover: number;
  cooldown: number;
  cooldownJitter: number;
  damage: number;
  knockback: number;
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
    weight: number;
    hurtStun: number;
    hurtInvuln: number;
    hurtKnockback: number;
  };
  dodge: { speed: number; duration: number; iframes: number; cooldown: number; exitSpeed: number };
  perfect: { window: number; margin: number; slowmo: number; slowmoScale: number; bonus: number };
  bufferTicks: number;
  weapon: {
    comboReset: number;
    light: Strike[];
    heavy: {
      fullCharge: number;
      chargeMove: number;
      startup: number;
      active: number;
      recovery: number;
      reach: number;
      halfArc: number;
      damage: [number, number];
      shellDamage: [number, number];
      knockback: [number, number];
      hitstop: [number, number];
      shake: [number, number];
      step: number;
    };
    /** Ability id per slot, or null when the slot is locked. */
    slots: (string | null)[];
  };
  lunge: {
    cooldown: number;
    speed: number;
    dash: number;
    recovery: number;
    radius: number;
    damage: number;
    shellDamage: number;
    knockback: number;
    hitstop: number;
    shake: number;
  };
  husks: {
    aggroPer: number;
    aggroMax: number;
    breakCore: number;
    peeling: HuskParams & { lungeSpeed: number; lunge: number; hitPad: number };
    nutshell: HuskParams & { slamRadius: number; slamOffset: number; slamActive: number };
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

function int(v: number): number {
  return Math.round(v);
}

function strike(s: StrikeTuning): Strike {
  return {
    startup: msToTicks(s.startupMs),
    active: Math.max(1, msToTicks(s.activeMs)),
    recovery: msToTicks(s.recoveryMs),
    reach: pxToUnits(s.reachPx),
    halfArc: degToAngle(s.arcDeg) >> 1,
    damage: int(s.damage),
    shellDamage: int(s.shellDamage),
    knockback: speedToUnits(s.knockback),
    hitstop: msToTicks(s.hitstopMs),
    shake: int(s.shake),
    step: speedToUnits(s.stepSpeed),
  };
}

function husk(h: HuskTuning): HuskParams {
  return {
    radius: pxToUnits(h.radiusPx),
    shell: h.shell.map(int),
    core: Math.max(1, int(h.core)),
    speed: speedToUnits(h.speed),
    accel: accelToUnits(h.acceleration),
    friction: accelToUnits(h.friction),
    weight: Math.max(1, toPermille(h.weight)),
    attackRange: pxToUnits(h.attackRangePx),
    windup: Math.max(1, msToTicks(h.windupMs)),
    track: msToTicks(h.trackMs),
    recover: msToTicks(h.recoverMs),
    cooldown: msToTicks(h.cooldownMs),
    cooldownJitter: msToTicks(h.cooldownJitterMs),
    damage: int(h.damage),
    knockback: speedToUnits(h.knockback),
    hitstop: msToTicks(h.hitstopMs),
    shake: int(h.shake),
    stagger: msToTicks(h.staggerMs),
    flinch: msToTicks(h.flinchMs),
    armoredKb: toPermille(h.armoredKnockbackFactor),
    drop: int(h.sparkglassDrop),
    spawn: msToTicks(h.spawnMs),
  };
}

/** Convert tuning (human units) into integer sim parameters. */
export function compileTuning(t: Tuning): Params {
  const weapon = t.weapons[t.player.weapon];
  if (!weapon) throw new Error(`unknown weapon "${t.player.weapon}"`);
  if (weapon.light.length === 0) throw new Error('weapon needs at least one light strike');
  if (t.run.rooms.length === 0) throw new Error('run needs at least one room');
  const h = weapon.heavy;
  const l = t.abilities.lunge;
  const pTun = t.husks.peeling;
  const nTun = t.husks.nutshell;
  return {
    player: {
      radius: pxToUnits(t.player.radiusPx),
      maxHp: Math.max(1, int(t.player.maxHp)),
      speed: speedToUnits(t.player.moveSpeed),
      accel: accelToUnits(t.player.acceleration),
      friction: accelToUnits(t.player.friction),
      weight: Math.max(1, toPermille(t.player.weight)),
      hurtStun: msToTicks(t.player.hurtStunMs),
      hurtInvuln: msToTicks(t.player.hurtInvulnMs),
      hurtKnockback: speedToUnits(t.player.hurtKnockback),
    },
    dodge: {
      speed: speedToUnits(t.dodge.speed),
      duration: Math.max(1, msToTicks(t.dodge.durationMs)),
      iframes: msToTicks(t.dodge.iframesMs),
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
      comboReset: msToTicks(weapon.comboResetMs),
      light: weapon.light.map(strike),
      heavy: {
        fullCharge: Math.max(1, msToTicks(h.fullChargeMs)),
        chargeMove: toPermille(h.chargeMoveFactor),
        startup: msToTicks(h.startupMs),
        active: Math.max(1, msToTicks(h.activeMs)),
        recovery: msToTicks(h.recoveryMs),
        reach: pxToUnits(h.reachPx),
        halfArc: degToAngle(h.arcDeg) >> 1,
        damage: [int(h.damageMin), int(h.damageMax)],
        shellDamage: [int(h.shellDamageMin), int(h.shellDamageMax)],
        knockback: [speedToUnits(h.knockbackMin), speedToUnits(h.knockbackMax)],
        hitstop: [msToTicks(h.hitstopMinMs), msToTicks(h.hitstopMaxMs)],
        shake: [int(h.shakeMin), int(h.shakeMax)],
        step: speedToUnits(h.stepSpeed),
      },
      slots: weapon.abilities.map((s) => (s.locked ? null : s.id)),
    },
    lunge: {
      cooldown: msToTicks(l.cooldownMs),
      speed: speedToUnits(l.dashSpeed),
      dash: Math.max(1, msToTicks(l.dashMs)),
      recovery: msToTicks(l.recoveryMs),
      radius: pxToUnits(l.hitRadiusPx),
      damage: int(l.damage),
      shellDamage: int(l.shellDamage),
      knockback: speedToUnits(l.knockback),
      hitstop: msToTicks(l.hitstopMs),
      shake: int(l.shake),
    },
    husks: {
      aggroPer: toPermille(t.husks.aggroPerSparkglass),
      aggroMax: toPermille(t.husks.aggroMax),
      breakCore: toPermille(t.husks.shellBreakCoreFactor),
      peeling: {
        ...husk(pTun),
        lungeSpeed: speedToUnits(pTun.lungeSpeed),
        lunge: Math.max(1, msToTicks(pTun.lungeMs)),
        hitPad: pxToUnits(pTun.hitPadPx),
      },
      nutshell: {
        ...husk(nTun),
        slamRadius: pxToUnits(nTun.slamRadiusPx),
        slamOffset: pxToUnits(nTun.slamOffsetPx),
        slamActive: Math.max(1, msToTicks(nTun.slamActiveMs)),
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
