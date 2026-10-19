import { itemDef } from './items.js';
import { weaponCanFight, weaponOrder } from './weapons.js';

/**
 * The weapon rack (M2 Task 8, docs/design/holding.md "The weapon rack"): the
 * rack of twisted logs by the Writ post where every weapon a Kindled owns
 * hangs. A weapon is an item of kind `weapon` in the `rack` place, one of
 * each; the one a run takes is chosen here (`kindled.run_weapon`), and the
 * start screen's START RUN reads it from the holding answer. Every
 * player-facing line is here, LORE's word for word (GAME DESIGN's row said
 * CHOOSE and Chosen; LORE's TAKE and Taken are the words).
 */

/** The place weapons hang in (`FIXED_PLACES`). */
export const RACK_PLACE = 'rack';

export const RACK_TEXT = {
  /** The panel's title and the station's name. */
  TITLE: 'Weapon rack',
  /** LORE's tooltip line, muted under the title. */
  TOOLTIP: 'Every weapon you own hangs here. Take one out with you; the others wait.',
  /** The station's tooltip as LORE wrote it, the name and the line. */
  STATION_TIP: 'Weapon rack: Every weapon you own hangs here. Take one out with you; the others wait.',
  /** The weapon going out next run (highlighted). */
  TAKEN: 'Taken',
  /** The button on an owned weapon that can fight. */
  TAKE: 'TAKE',
  /** LORE's line on an owned weapon the sim can't run yet (greyed). Never shown in M2. */
  NOT_READY: "Your hands aren't ready for this one yet.",
  /**
   * GAME DESIGN's Found-weapons line, for a *rusted* weapon of a kind the game can't play yet: kept for the
   * state that comes with the Forge, not drawn on the rack (MAIN; both asked to confirm on the Task 8 PR).
   */
  NEEDS_SMITH: 'It needs a smith who knows it',
  /** The start screen, under the weapon's name, when it came from a holding answer. */
  FROM_RACK: 'Taken from your weapon rack.',
  /** Between a kit's moves: "Arc · Hook-thrust · Haul". */
  KIT_JOIN: ' · ',
} as const;

/** One weapon on the rack as the holding answers it: owned, and whether the sim can run it. */
export interface RackWeapon {
  itemId: string;
  ready: boolean;
}

/** The idempotency ref of a weapon given as kit: once per Kindled and weapon, however many requests race. */
export function kitRef(kindledId: string, weaponId: string): string {
  return `kit:${kindledId}:${weaponId}`;
}

/**
 * The rack's weapons from the ids a Kindled owns: in roster order, each with
 * whether it can fight (`canFight`, the sim's `isWeaponAvailable`; the static
 * `weaponCanFight` by default). An id that is not a weapon is left out.
 */
export function rackWeapons(owned: readonly string[], canFight: (weaponId: string) => boolean = weaponCanFight): RackWeapon[] {
  return [...new Set(owned)]
    .filter((id) => itemDef(id)?.kind === 'weapon')
    .sort((a, b) => weaponOrder(a) - weaponOrder(b))
    .map((itemId) => ({ itemId, ready: canFight(itemId) }));
}

/**
 * The weapon a run takes, resolved: the stored choice while it is owned and
 * can fight, else the first weapon in roster order that is (GAME DESIGN:
 * "One weapon is always chosen"); null only while none can fight.
 */
export function resolveChosen(weapons: readonly RackWeapon[], stored: string | null): string | null {
  if (stored !== null && weapons.some((w) => w.itemId === stored && w.ready)) return stored;
  return weapons.find((w) => w.ready)?.itemId ?? null;
}

/** A weapon's kit on one line, in input order: "Arc · Hook-thrust · Haul"; empty for a weapon without one. */
export function kitLine(weaponId: string): string {
  return (itemDef(weaponId)?.kit ?? []).join(RACK_TEXT.KIT_JOIN);
}
