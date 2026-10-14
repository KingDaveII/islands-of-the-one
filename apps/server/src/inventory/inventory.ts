import {
  CURRENT_TELLING,
  isInventoryReason,
  itemDef,
  itemOrder,
  MAX_QUANTITY,
  type InventoryReason,
} from '@iot/shared';
import { and, asc, eq, gt, or, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { FOREIGN_KEY_VIOLATION, isUniqueViolation, pgError } from '../db/errors.js';
import { itemLedger, items } from './tables.js';

/**
 * The inventory (docs/design/inventory.md): the one way any item or currency
 * changes hands. `apply` runs a whole change set in one transaction: it locks
 * every affected row in a fixed order (Kindled id, then item id), refuses the
 * whole set if any balance would go below zero or past its stack limit, and
 * writes one item_ledger row per change. A change set with a ref applies once.
 */

/** One item count to move: positive gives, negative takes. */
export interface ItemChange {
  kindledId: string;
  itemId: string;
  delta: number;
}

export interface LedgerEntry {
  id: number;
  kindledId: string;
  itemId: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  ref: string | null;
  tellingId: string;
  createdAt: Date;
}

export interface Holding {
  itemId: string;
  quantity: number;
}

export type ApplyError = 'insufficient' | 'stack-limit' | 'unknown-kindled';

export type ApplyResult =
  /** duplicate: the ref was applied before; entries are that earlier application's rows. */
  | { ok: true; duplicate: boolean; entries: LedgerEntry[] }
  /** Nothing was changed. `change` is the first one refused (absent for unknown-kindled). */
  | { ok: false; error: ApplyError; message: string; change?: ItemChange };

/** A malformed call (unknown item or reason, a zero delta…): a bug in the caller, not a refusal. */
export class InventoryInputError extends Error {
  override name = 'InventoryInputError';
}

export interface Inventory {
  apply(
    changes: readonly ItemChange[],
    reason: InventoryReason,
    ref?: string,
  ): Promise<ApplyResult>;
  /** What a Kindled holds (quantity > 0), in items.json order. */
  holdings(kindledId: string): Promise<Holding[]>;
  /** A Kindled's ledger rows, oldest first. */
  ledger(kindledId: string): Promise<LedgerEntry[]>;
}

export interface InventoryOptions {
  /** The Telling stamped on ledger rows (default: data/telling.json's current one). */
  telling?: string;
}

/** Longest idempotency ref. */
export const MAX_REF_LENGTH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Refuses the change set from inside the transaction, which rolls it back. */
class Refusal extends Error {
  constructor(
    readonly error: ApplyError,
    message: string,
    readonly change?: ItemChange,
  ) {
    super(message);
  }
}

const keyOf = (kindledId: string, itemId: string): string => `${kindledId}/${itemId}`;

/** Code-unit order, the same as Postgres's "C" collation on these ASCII ids. */
const byKey = (a: ItemChange, b: ItemChange): number =>
  a.kindledId < b.kindledId
    ? -1
    : a.kindledId > b.kindledId
      ? 1
      : a.itemId < b.itemId
        ? -1
        : a.itemId > b.itemId
          ? 1
          : 0;

/** Check a change set's shape; returns it with Kindled ids lowercased (as Postgres prints uuids). */
function validate(
  changes: readonly ItemChange[],
  reason: string,
  ref: string | undefined,
): ItemChange[] {
  if (!isInventoryReason(reason)) throw new InventoryInputError(`unknown reason: ${reason}`);
  if (ref !== undefined && (ref.length === 0 || ref.length > MAX_REF_LENGTH))
    throw new InventoryInputError(`ref must be 1-${MAX_REF_LENGTH} characters`);
  if (changes.length === 0) throw new InventoryInputError('no changes');
  const seen = new Set<string>();
  return changes.map((c) => {
    const kindledId = c.kindledId.toLowerCase();
    if (!UUID.test(kindledId)) throw new InventoryInputError(`not a Kindled id: ${c.kindledId}`);
    if (!itemDef(c.itemId)) throw new InventoryInputError(`unknown item: ${c.itemId}`);
    if (!Number.isSafeInteger(c.delta) || c.delta === 0)
      throw new InventoryInputError(`delta must be a non-zero integer: ${c.delta}`);
    const key = keyOf(kindledId, c.itemId);
    if (seen.has(key))
      throw new InventoryInputError(`${key} appears twice in one change set; merge the deltas`);
    seen.add(key);
    return { kindledId, itemId: c.itemId, delta: c.delta };
  });
}

export function createInventory(db: Database, options: InventoryOptions = {}): Inventory {
  const telling = options.telling ?? CURRENT_TELLING;

  const entriesForRef = (ref: string): Promise<LedgerEntry[]> =>
    db.select().from(itemLedger).where(eq(itemLedger.ref, ref)).orderBy(asc(itemLedger.id));

  async function apply(
    input: readonly ItemChange[],
    reason: InventoryReason,
    ref?: string,
  ): Promise<ApplyResult> {
    const changes = validate(input, reason, ref);
    const sorted = [...changes].sort(byKey);
    try {
      return await db.transaction(async (tx) => {
        const earlier = async (): Promise<LedgerEntry[]> =>
          ref === undefined
            ? []
            : tx
                .select()
                .from(itemLedger)
                .where(eq(itemLedger.ref, ref))
                .orderBy(asc(itemLedger.id));
        const before = await earlier();
        if (before.length > 0) return { ok: true, duplicate: true, entries: before };

        // Rows a change set credits may not exist yet: create them at 0 (in key order), so
        // that every affected row can be locked. A refused set rolls them back with the rest.
        await tx
          .insert(items)
          .values(sorted.map((c) => ({ kindledId: c.kindledId, itemId: c.itemId, quantity: 0 })))
          .onConflictDoNothing({ target: [items.kindledId, items.itemId] });

        // Lock every affected row in one fixed order across Kindleds, so two change sets that
        // touch the same rows (a trade and its reverse) queue up instead of deadlocking.
        const rows = await tx
          .select({
            id: items.id,
            kindledId: items.kindledId,
            itemId: items.itemId,
            quantity: items.quantity,
          })
          .from(items)
          .where(
            or(
              ...sorted.map((c) =>
                and(eq(items.kindledId, c.kindledId), eq(items.itemId, c.itemId)),
              ),
            ),
          )
          .orderBy(asc(items.kindledId), sql`${items.itemId} collate "C"`)
          .for('update');
        // Checked again under the locks: a call with the same ref may have committed while
        // this one waited, and its balances must not be judged a second time.
        const raced = await earlier();
        if (raced.length > 0) return { ok: true, duplicate: true, entries: raced };
        const rowByKey = new Map(rows.map((r) => [keyOf(r.kindledId, r.itemId), r]));

        const after: number[] = [];
        for (const c of changes) {
          const row = rowByKey.get(keyOf(c.kindledId, c.itemId));
          if (!row)
            throw new Error(`items row ${keyOf(c.kindledId, c.itemId)} missing after insert`);
          const balance = row.quantity + c.delta;
          if (balance < 0)
            throw new Refusal(
              'insufficient',
              `Not enough ${c.itemId}: has ${row.quantity}, needs ${-c.delta}.`,
              c,
            );
          const limit = itemDef(c.itemId)?.stackLimit ?? MAX_QUANTITY;
          if (balance > limit)
            throw new Refusal(
              'stack-limit',
              `${c.itemId} would be ${balance}, over its limit of ${limit}.`,
              c,
            );
          after.push(balance);
        }

        for (const [i, c] of changes.entries()) {
          const row = rowByKey.get(keyOf(c.kindledId, c.itemId));
          if (!row) continue;
          await tx
            .update(items)
            .set({ quantity: after[i] ?? row.quantity, updatedAt: sql`now()` })
            .where(eq(items.id, row.id));
        }
        const entries = await tx
          .insert(itemLedger)
          .values(
            changes.map((c, i) => ({
              kindledId: c.kindledId,
              itemId: c.itemId,
              delta: c.delta,
              balanceAfter: after[i] ?? 0,
              reason,
              ref: ref ?? null,
              tellingId: telling,
            })),
          )
          .returning();
        return { ok: true, duplicate: false, entries: entries.sort((a, b) => a.id - b.id) };
      });
    } catch (err) {
      if (err instanceof Refusal) {
        const refused: ApplyResult = { ok: false, error: err.error, message: err.message };
        if (err.change) refused.change = err.change;
        return refused;
      }
      // The same ref applied by a concurrent call that committed first.
      if (ref !== undefined && isUniqueViolation(err, 'item_ledger_ref_unique'))
        return { ok: true, duplicate: true, entries: await entriesForRef(ref) };
      if (pgError(err)?.code === FOREIGN_KEY_VIOLATION)
        return { ok: false, error: 'unknown-kindled', message: 'No such Kindled.' };
      throw err;
    }
  }

  return {
    apply,

    async holdings(kindledId) {
      const rows = await db
        .select({ itemId: items.itemId, quantity: items.quantity })
        .from(items)
        .where(and(eq(items.kindledId, kindledId), gt(items.quantity, 0)));
      return rows.sort(
        (a, b) => itemOrder(a.itemId) - itemOrder(b.itemId) || (a.itemId < b.itemId ? -1 : 1),
      );
    },

    ledger: (kindledId) =>
      db
        .select()
        .from(itemLedger)
        .where(eq(itemLedger.kindledId, kindledId))
        .orderBy(asc(itemLedger.id)),
  };
}
