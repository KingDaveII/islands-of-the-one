import { itemDef, pressedEmptyAt, type Place, type WritStored } from '@iot/shared';
import { eq } from 'drizzle-orm';
import type { Transaction } from '../db/client.js';
import { writs, type WritRow } from '../db/schema.js';
import type { Holding as Stack, ItemChange } from '../inventory/index.js';

/**
 * The Writ's row (docs/design/holding.md "The Writ"): one per Kindled in the
 * `writs` table, created on the Kindled's first holding request, read and
 * written only by the holding module (holding.ts names it and feeds it under
 * the Kindled's lock; writ-set.ts is the playtest CLI). The math is shared
 * (`writView`, `feedPreview` in @iot/shared); this file is the row and the
 * change set a feed takes.
 */

/** The row as the shared math reads it. */
export function writStored(row: WritRow): WritStored {
  return {
    name: row.name,
    letters: row.letters,
    certified: row.certified,
    emptyAt: row.emptyAt.getTime(),
    lineCount: row.lines,
  };
}

/**
 * The Kindled's Writ row, pressed when there is none yet (so every existing
 * Kindled gets one on first use): unnamed, uncertified, one line, with
 * `pressChargeHours` of charge from `now`. Locked FOR UPDATE for the rest of
 * the transaction. Call under the Kindled's own lock.
 */
export async function lockWrit(tx: Transaction, kindledId: string, now: Date): Promise<WritRow> {
  await tx
    .insert(writs)
    .values({ kindledId, emptyAt: new Date(pressedEmptyAt(now.getTime())), createdAt: now })
    .onConflictDoNothing();
  const [row] = await tx.select().from(writs).where(eq(writs.kindledId, kindledId)).for('update');
  if (!row) throw new Error(`writ: no row for Kindled ${kindledId}`);
  return row;
}

/** Where a feed is taken from, in order: the store first, then the pack (the pack is what goes abroad); currency from the purse. */
export function feedPlaces(itemId: string): readonly Place[] {
  return itemDef(itemId)?.kind === 'currency' ? ['purse'] : ['store', 'pack'];
}

/** How many of an item the Kindled can feed: what the feed's places hold together. */
export function feedable(held: readonly Stack[], itemId: string): number {
  return feedPlaces(itemId).reduce((n, place) => n + (held.find((h) => h.place === place && h.itemId === itemId)?.quantity ?? 0), 0);
}

/**
 * The change set that takes `count` of an item for a feed, from the store
 * first, then the pack (currency from the purse), or null when the Kindled
 * doesn't hold that many across them. Pure: the caller holds the locks.
 */
export function feedChanges(kindledId: string, held: readonly Stack[], itemId: string, count: number): ItemChange[] | null {
  const changes: ItemChange[] = [];
  let left = count;
  for (const place of feedPlaces(itemId)) {
    if (left === 0) break;
    const have = held.find((h) => h.place === place && h.itemId === itemId)?.quantity ?? 0;
    const take = Math.min(have, left);
    if (take > 0) {
      changes.push({ kindledId, itemId, place, delta: -take });
      left -= take;
    }
  }
  return left > 0 ? null : changes;
}

/** The refusals the holding answers around the Writ (the book's "Full." is in @iot/shared). */
export const WRIT_UNNAMED = 'Name the island first.';
export const WRIT_ALREADY_NAMED = 'The island has its Name.';
export const WRIT_INSUFFICIENT = 'Not that many there.';
