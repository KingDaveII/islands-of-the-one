import { defaultTuning, InventoryReason, kitRef, M2_KIT, M2_SCAFFOLD, RACK_PLACE, RACK_TEXT, rackWeapons, resolveChosen, type RackView } from '@iot/shared';
import { isWeaponAvailable, type Tuning } from '@iot/sim';
import { eq } from 'drizzle-orm';
import type { Transaction } from '../db/client.js';
import { kindled, type KindledRow } from '../db/schema.js';
import type { Holding, Inventory } from '../inventory/index.js';

/**
 * The weapon rack (docs/design/holding.md "The weapon rack", M2 Task 8): a
 * weapon is an item of kind `weapon` in the `rack` place, changed only
 * through `inventory.apply` like everything else. What hangs there in M2 is
 * the kit (`M2_KIT`, the Hookblade alone; GAME DESIGN), given once onto the
 * rack by the first holding request of a Kindled who owns no weapon, behind
 * `m2Scaffold` like Kesh's tide sliver: M3's wreck replaces it. The weapon a
 * run takes is `kindled.run_weapon`, chosen at the rack; null means the first
 * weapon in roster order the Kindled owns that can fight. Every function here
 * runs under the Kindled's lock the holding's requests take.
 */

/** The shipped tuning as the sim reads it: which weapons it can run (`isWeaponAvailable`). */
const TUNING: Tuning = defaultTuning;

/** Whether the sim can run a weapon: in the roster unlocked, with its data. */
export function weaponReady(weaponId: string): boolean {
  return isWeaponAvailable(TUNING, weaponId);
}

/** The weapon ids on a Kindled's rack, from its holdings. */
export function ownedWeapons(held: readonly Holding[]): string[] {
  return held.filter((h) => h.place === RACK_PLACE && h.quantity > 0).map((h) => h.itemId);
}

/** The rack in the holding answer: the weapons owned in roster order, each with its readiness, and the choice resolved. */
export function rackViewOf(held: readonly Holding[], runWeapon: string | null): RackView {
  const weapons = rackWeapons(ownedWeapons(held), weaponReady);
  return { weapons, chosen: resolveChosen(weapons, runWeapon) };
}

/**
 * The kit: while the scaffold is on and the Kindled owns no weapon, each
 * weapon of the kit is given onto the rack through `inventory.apply` (reason
 * `kit`), each under its own ref, so racing requests and repeats give it
 * once. Answers whether anything was given now.
 */
export async function giveKit(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  held: readonly Holding[],
  scaffold: boolean = M2_SCAFFOLD,
  kit: readonly string[] = M2_KIT,
): Promise<boolean> {
  if (!scaffold || ownedWeapons(held).length > 0) return false;
  let given = false;
  for (const itemId of kit) {
    const result = await inventory.apply([{ kindledId, itemId, place: RACK_PLACE, delta: 1 }], InventoryReason.Kit, {
      ref: kitRef(kindledId, itemId),
      tx,
    });
    if (!result.ok) throw new Error(`kit: ${result.message}`);
    if (!result.duplicate) given = true;
  }
  return given;
}

export type ChooseResult = { ok: true } | { ok: false; error: 'not-owned' | 'not-ready'; message: string };

/**
 * Chooses the weapon a run takes, under the Kindled's lock: it must hang on
 * the rack (`not-owned`) and the sim must run it (`not-ready`); then
 * `run_weapon` is written. The refusals' lines are `RACK_TEXT`'s (the panel's footer shows them).
 */
export async function chooseWeaponIn(tx: Transaction, k: Pick<KindledRow, 'id'>, held: readonly Holding[], weaponId: string): Promise<ChooseResult> {
  if (!ownedWeapons(held).includes(weaponId)) return { ok: false, error: 'not-owned', message: RACK_TEXT.NOT_OWNED };
  if (!weaponReady(weaponId)) return { ok: false, error: 'not-ready', message: RACK_TEXT.NOT_READY };
  await tx.update(kindled).set({ runWeapon: weaponId }).where(eq(kindled.id, k.id));
  return { ok: true };
}
