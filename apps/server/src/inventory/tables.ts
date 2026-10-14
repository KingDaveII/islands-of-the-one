import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { kindled } from '../db/schema.js';

/**
 * The item tables (docs/design/inventory.md). Only the inventory module may
 * import this file (ESLint no-restricted-imports, and test/inventory-
 * boundary.test.ts): every item or currency change goes through
 * inventory.apply(), which writes item_ledger in the same transaction.
 * drizzle-kit reads it beside db/schema.ts (drizzle.config.ts).
 */

/**
 * What each Kindled holds: one row per Kindled and item, quantity never below
 * zero. Room is left for tier, rarity and Virtue columns later (new nullable
 * columns, expand-only): rows have their own id, so items that differ by
 * those can get a wider unique key beside this one.
 */
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    /** An id from data/items.json. */
    itemId: text('item_id').notNull(),
    quantity: bigint('quantity', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('items_kindled_item_unique').on(t.kindledId, t.itemId),
    check('items_quantity_non_negative', sql`${t.quantity} >= 0`),
  ],
);

/** One row per change, written in the same transaction as the change: the history of every item. */
export const itemLedger = pgTable(
  'item_ledger',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    /** Never 0. */
    delta: bigint('delta', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    /** An InventoryReason (packages/shared/src/items.ts). */
    reason: text('reason').notNull(),
    /** The caller's idempotency key: a change set with a ref applies once. */
    ref: text('ref'),
    /** The Telling the change happened in (data/telling.json). */
    tellingId: text('telling_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('item_ledger_kindled_idx').on(t.kindledId, t.id),
    uniqueIndex('item_ledger_ref_unique')
      .on(t.ref, t.kindledId, t.itemId)
      .where(sql`${t.ref} is not null`),
    check('item_ledger_delta_non_zero', sql`${t.delta} <> 0`),
    check('item_ledger_balance_non_negative', sql`${t.balanceAfter} >= 0`),
  ],
);
