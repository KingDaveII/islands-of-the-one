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
 * What each Kindled holds, by place (M2 Task 3a): one row per Kindled, item
 * and place (`purse`, `pack`, `store` or `basket:<stationId>`; the shared
 * place guard), quantity never below zero. Pack slots are derived from the
 * counts, never stored. Room is left for tier, rarity and Virtue columns
 * later (new nullable columns, expand-only): rows have their own id, so
 * items that differ by those can get a wider unique key beside this one.
 */
export const itemStacks = pgTable(
  'item_stacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    /** An id from data/items.json. */
    itemId: text('item_id').notNull(),
    /** A Place (packages/shared/src/places.ts). */
    place: text('place').notNull(),
    quantity: bigint('quantity', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('item_stacks_kindled_item_place_unique').on(t.kindledId, t.itemId, t.place),
    check('item_stacks_quantity_non_negative', sql`${t.quantity} >= 0`),
  ],
);

/**
 * Retired (M2 Task 3a): Task 2's one balance per Kindled and item, copied
 * into item_stacks by migration 0003 (currency to the purse, the rest to the
 * store). No code reads or writes it any more. It stays here so drizzle-kit
 * does not generate a DROP: migrations are expand-only, and staging rolls
 * code back but not migrations (a rollback to Task 2 would read this stale
 * copy; acceptable on staging, which holds no real players). A later
 * contract migration drops it.
 */
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
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
    /**
     * The place the change happened in (M2 Task 3a). Null on rows from before
     * places existed: Task 2's single balance, whose balance_after was the
     * Kindled's whole count of the item.
     */
    place: text('place'),
    /** Never 0. */
    delta: bigint('delta', { mode: 'number' }).notNull(),
    /** The balance of that place after the change. */
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
    /**
     * A ref names one change set, in which each (Kindled, item, place) appears
     * once. This replaces Task 2's (ref, kindled, item) index, which would
     * refuse a valid move (the same item in two places under one ref); old
     * rows (place null) can't collide with new ones under the same ref since
     * a ref applies once.
     */
    uniqueIndex('item_ledger_ref_place_unique')
      .on(t.ref, t.kindledId, t.itemId, t.place)
      .where(sql`${t.ref} is not null`),
    check('item_ledger_delta_non_zero', sql`${t.delta} <> 0`),
    check('item_ledger_balance_non_negative', sql`${t.balanceAfter} >= 0`),
  ],
);
