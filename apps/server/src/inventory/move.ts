import { canMove, InventoryReason, isItemId, type Place } from '@iot/shared';
import type { KindledRow } from '../db/schema.js';
import type { ApplyResult, Inventory } from './inventory.js';

/**
 * A move (docs/design/inventory.md): `quantity` of an item from one of a
 * Kindled's places to another, as one change set with reason `move`, so the
 * ledger shows both sides. The API allows the pack and the store both ways
 * and a basket to the store; `apply` judges the rest (pack-full,
 * stack-limit, insufficient).
 */

export interface MoveArgs {
  kindledId: string;
  itemId: string;
  from: Place;
  to: Place;
  quantity: number;
}

export type MoveResult = ApplyResult | { ok: false; error: 'bad-request'; message: string };

export async function moveItems(inventory: Inventory, args: MoveArgs): Promise<MoveResult> {
  const { kindledId, itemId, from, to, quantity } = args;
  if (!isItemId(itemId)) return { ok: false, error: 'bad-request', message: 'No such item.' };
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    return { ok: false, error: 'bad-request', message: 'Malformed request.' };
  if (!canMove(from, to))
    return {
      ok: false,
      error: 'wrong-place',
      message: `Nothing moves from the ${from} to the ${to}.`,
    };
  return inventory.apply(
    [
      { kindledId, itemId, place: from, delta: -quantity },
      { kindledId, itemId, place: to, delta: quantity },
    ],
    InventoryReason.Move,
  );
}

/**
 * Whether a Kindled can reach the holding store right now. The store is only
 * reachable on the holding, and in M2 there is nowhere else a Kindled can be
 * (the M1 run is a client-side test), so it is always true. Voyages (M3)
 * make it real: a Kindled at sea or on another Shard moves nothing to or
 * from the store.
 */
// Every Kindled is on its holding in M2; the Kindled is here for M3 to look at.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- M3 reads where the Kindled is
export function canReachStore(_kindled: Pick<KindledRow, 'id'>): boolean {
  return true;
}
