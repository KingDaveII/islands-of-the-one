import tuningJson from '../data/tuning.json' with { type: 'json' };

/**
 * The weapons as data/tuning.json names them (M2 Task 8, docs/design/holding.md
 * "The weapon rack"): the roster (`weaponRoster`, in the order the rack shows
 * them; a locked entry is a weapon whose combat hasn't landed) and the weapons
 * the sim can run (`weapons`). An item of kind `weapon` must be one of these,
 * so the ledger and the sim share ids. `weaponCanFight` is the static mirror
 * of the sim's `isWeaponAvailable` over the shipped tuning, for shared code
 * that may not depend on the sim (the item validator).
 */

/** The roster's ids, in roster order: the order the rack shows weapons in. */
export const WEAPON_ROSTER: readonly { id: string; locked: boolean }[] = tuningJson.weaponRoster.map((w) => ({ id: w.id, locked: w.locked }));

/** Every weapon id the tuning names: the roster's and the `weapons` block's keys. */
export const WEAPON_IDS: readonly string[] = [
  ...new Set([...WEAPON_ROSTER.map((w) => w.id), ...Object.keys(tuningJson.weapons)]),
];

export function isWeaponId(value: unknown): value is string {
  return typeof value === 'string' && WEAPON_IDS.includes(value);
}

/** True when the shipped roster offers the weapon unlocked and the sim has its data (the sim's `isWeaponAvailable`). */
export function weaponCanFight(weaponId: string): boolean {
  return WEAPON_ROSTER.some((w) => w.id === weaponId && !w.locked) && Object.hasOwn(tuningJson.weapons, weaponId);
}

/** A weapon's place in roster order (an id outside the roster last). */
export function weaponOrder(weaponId: string): number {
  const i = WEAPON_ROSTER.findIndex((w) => w.id === weaponId);
  return i < 0 ? WEAPON_ROSTER.length : i;
}
