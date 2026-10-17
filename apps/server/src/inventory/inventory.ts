import {
  basketStation,
  CURRENT_TELLING,
  isInventoryReason,
  isPlace,
  itemDef,
  itemOrder,
  kindFitsPlace,
  MAX_QUANTITY,
  PACK_SLOTS,
  packSlotCount,
  storeLimitOf,
  type InventoryEntry,
  type InventoryReason,
  type InventoryResponse,
  type Place,
} from '@iot/shared';
import { and, asc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { FOREIGN_KEY_VIOLATION, isUniqueViolation, pgError } from '../db/errors.js';
import { kindled } from '../db/schema.js';
import { itemLedger, itemStacks } from './tables.js';

/**
 * The inventory (docs/design/inventory.md): the one way any item or currency
 * changes hands. Every item a Kindled holds is in one place (the purse, the
 * pack, the store or a station's basket). `apply` runs a whole change set in
 * one transaction: it locks every affected Kindled, then every affected
 * stack row in a fixed order (Kindled id, item id, place), refuses the whole
 * set if any balance would go below zero, past its limit or over the pack's
 * slots, and writes one item_ledger row per change. A change set with a ref
 * applies once. It can run inside a caller's transaction (`tx`), as a
 * savepoint, so an action and its items settle together.
 */

/** One item count to change in one place: positive gives, negative takes. */
export interface ItemChange {
  kindledId: string;
  itemId: string;
  place: Place;
  delta: number;
}

export interface LedgerEntry {
  id: number;
  kindledId: string;
  itemId: string;
  /** Null on rows from before places (Task 2): the Kindled's single balance then. */
  place: string | null;
  delta: number;
  balanceAfter: number;
  reason: string;
  ref: string | null;
  tellingId: string;
  createdAt: Date;
}

/** One stack: an item's count in one place. */
export interface Holding {
  itemId: string;
  place: Place;
  quantity: number;
}

export type ApplyError =
  'insufficient' | 'stack-limit' | 'pack-full' | 'wrong-place' | 'unknown-kindled';

export type ApplyResult =
  /** duplicate: the ref was applied before; entries are that earlier application's rows. */
  | { ok: true; duplicate: boolean; entries: LedgerEntry[] }
  /** Nothing was changed. `change` is the first one refused (absent for unknown-kindled). */
  | { ok: false; error: ApplyError; message: string; change?: ItemChange };

export interface ApplyOptions {
  /** An idempotency key (1-200 characters): the set applies once per ref. */
  ref?: string;
  /** Run inside this transaction (as a savepoint) instead of one of its own. */
  tx?: Transaction;
}

/** A malformed call (unknown item, place or reason, a zero delta…): a bug in the caller, not a refusal. */
export class InventoryInputError extends Error {
  override name = 'InventoryInputError';
}

export interface Inventory {
  apply(
    changes: readonly ItemChange[],
    reason: InventoryReason,
    options?: ApplyOptions,
  ): Promise<ApplyResult>;
  /** Every stack a Kindled holds (quantity > 0), in items.json order, then purse, pack, store, baskets by station. */
  holdings(kindledId: string): Promise<Holding[]>;
  /** The same, by place: what GET /api/inventory answers. */
  view(kindledId: string): Promise<InventoryResponse>;
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

const keyOf = (kindledId: string, itemId: string, place: string): string =>
  `${kindledId}/${itemId}/${place}`;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Code-unit order, the same as Postgres's "C" collation on these ASCII ids. */
const byKey = (a: ItemChange, b: ItemChange): number =>
  cmp(a.kindledId, b.kindledId) || cmp(a.itemId, b.itemId) || cmp(a.place, b.place);

/** Display order of places: the purse, the pack, the store, then baskets by station id. */
export function placeOrder(place: Place): number {
  switch (place) {
    case 'purse':
      return 0;
    case 'pack':
      return 1;
    case 'store':
      return 2;
    default:
      return 3;
  }
}

const byDisplay = (a: Holding, b: Holding): number =>
  itemOrder(a.itemId) - itemOrder(b.itemId) ||
  cmp(a.itemId, b.itemId) ||
  placeOrder(a.place) - placeOrder(b.place) ||
  cmp(a.place, b.place);

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
    if (!isPlace(c.place)) throw new InventoryInputError(`not a place: ${String(c.place)}`);
    if (!Number.isSafeInteger(c.delta) || c.delta === 0)
      throw new InventoryInputError(`delta must be a non-zero integer: ${c.delta}`);
    const key = keyOf(kindledId, c.itemId, c.place);
    if (seen.has(key))
      throw new InventoryInputError(`${key} appears twice in one change set; merge the deltas`);
    seen.add(key);
    return { kindledId, itemId: c.itemId, place: c.place, delta: c.delta };
  });
}

/** The first change that puts a kind where it can't be: currency outside the purse, anything else in it. */
function wrongPlace(changes: readonly ItemChange[]): ItemChange | undefined {
  return changes.find((c) => {
    const def = itemDef(c.itemId);
    return def !== undefined && !kindFitsPlace(def.kind, c.place);
  });
}

export function createInventory(db: Database, options: InventoryOptions = {}): Inventory {
  const telling = options.telling ?? CURRENT_TELLING;

  const entriesForRef = (on: Database | Transaction, ref: string): Promise<LedgerEntry[]> =>
    on.select().from(itemLedger).where(eq(itemLedger.ref, ref)).orderBy(asc(itemLedger.id));

  async function apply(
    input: readonly ItemChange[],
    reason: InventoryReason,
    { ref, tx: outer }: ApplyOptions = {},
  ): Promise<ApplyResult> {
    const changes = validate(input, reason, ref);
    const misplaced = wrongPlace(changes);
    if (misplaced) {
      const def = itemDef(misplaced.itemId);
      return {
        ok: false,
        error: 'wrong-place',
        message:
          def?.kind === 'currency'
            ? `${misplaced.itemId} is currency: it lives in the purse, not the ${misplaced.place}.`
            : `${misplaced.itemId} can't be in the purse: only currency can.`,
        change: misplaced,
      };
    }
    const sorted = [...changes].sort(byKey);
    const kindledIds = [...new Set(sorted.map((c) => c.kindledId))].sort(cmp);
    // Inside a caller's transaction the set runs as a savepoint, so a refusal rolls back
    // only its own work and the caller's transaction stays usable.
    const run = outer ?? db;
    try {
      return await run.transaction(async (tx) => {
        const before = ref === undefined ? [] : await entriesForRef(tx, ref);
        if (before.length > 0) return { ok: true, duplicate: true, entries: before };

        // Lock every affected Kindled first, in id order: the pack's slot count spans rows a
        // set doesn't touch (and rows another set is creating), so two sets on one Kindled
        // must not judge the pack at once. NO KEY UPDATE, so the foreign-key checks of the
        // inserts below (KEY SHARE) never wait on it.
        const locked = await tx
          .select({ id: kindled.id })
          .from(kindled)
          .where(inArray(kindled.id, kindledIds))
          .orderBy(asc(kindled.id))
          .for('no key update');
        if (locked.length < kindledIds.length)
          throw new Refusal('unknown-kindled', 'No such Kindled.');

        // Rows a change set credits may not exist yet: create them at 0 (in key order), so
        // that every affected row can be locked. A refused set rolls them back with the rest.
        await tx
          .insert(itemStacks)
          .values(
            sorted.map((c) => ({
              kindledId: c.kindledId,
              itemId: c.itemId,
              place: c.place,
              quantity: 0,
            })),
          )
          .onConflictDoNothing({
            target: [itemStacks.kindledId, itemStacks.itemId, itemStacks.place],
          });

        // Lock every affected row in one fixed order across Kindleds (Kindled id, item id,
        // place, all in "C" order), so two change sets that touch the same rows (a trade
        // and its reverse, two moves) queue up instead of deadlocking.
        const rows = await tx
          .select({
            id: itemStacks.id,
            kindledId: itemStacks.kindledId,
            itemId: itemStacks.itemId,
            place: itemStacks.place,
            quantity: itemStacks.quantity,
          })
          .from(itemStacks)
          .where(
            or(
              ...sorted.map((c) =>
                and(
                  eq(itemStacks.kindledId, c.kindledId),
                  eq(itemStacks.itemId, c.itemId),
                  eq(itemStacks.place, c.place),
                ),
              ),
            ),
          )
          .orderBy(
            asc(itemStacks.kindledId),
            sql`${itemStacks.itemId} collate "C"`,
            sql`${itemStacks.place} collate "C"`,
          )
          .for('update');
        // Checked again under the locks: a call with the same ref may have committed while
        // this one waited, and its balances must not be judged a second time.
        if (ref !== undefined) {
          const raced = await entriesForRef(tx, ref);
          if (raced.length > 0) return { ok: true, duplicate: true, entries: raced };
        }
        const rowByKey = new Map(rows.map((r) => [keyOf(r.kindledId, r.itemId, r.place), r]));

        const after: number[] = [];
        for (const c of changes) {
          const row = rowByKey.get(keyOf(c.kindledId, c.itemId, c.place));
          if (!row)
            throw new Error(
              `item_stacks row ${keyOf(c.kindledId, c.itemId, c.place)} missing after insert`,
            );
          const balance = row.quantity + c.delta;
          if (balance < 0)
            throw new Refusal(
              'insufficient',
              `Not enough ${c.itemId} in the ${c.place}: has ${row.quantity}, needs ${-c.delta}.`,
              c,
            );
          // The purse stops at the item's stack limit, the store at its store limit (and the
          // item's), the pack at its slots (below); a basket has no limit here (3b decides).
          const def = itemDef(c.itemId);
          const limit =
            c.place === 'purse'
              ? (def?.stackLimit ?? MAX_QUANTITY)
              : c.place === 'store'
                ? Math.min(def?.stackLimit ?? MAX_QUANTITY, storeLimitOf(c.itemId))
                : MAX_QUANTITY;
          if (balance > limit)
            throw new Refusal(
              'stack-limit',
              c.place === 'store'
                ? `Store: ${def?.name ?? c.itemId} full (${limit}).`
                : `${c.itemId} would be ${balance} in the ${c.place}, over its limit of ${limit}.`,
              c,
            );
          after.push(balance);
        }

        // The pack's slots are derived from every stack in it, touched or not: for each
        // Kindled whose pack gains, count them with the new balances. Taking things out of a
        // pack that is somehow over its slots is still allowed (the count must not grow).
        for (const id of kindledIds) {
          const packChanges = changes.filter((c) => c.kindledId === id && c.place === 'pack');
          if (!packChanges.some((c) => c.delta > 0)) continue;
          const inPack = await tx
            .select({ itemId: itemStacks.itemId, quantity: itemStacks.quantity })
            .from(itemStacks)
            .where(
              and(
                eq(itemStacks.kindledId, id),
                eq(itemStacks.place, 'pack'),
                gt(itemStacks.quantity, 0),
              ),
            );
          const was = packSlotCount(inPack);
          const counts = new Map(inPack.map((s) => [s.itemId, s.quantity]));
          for (const [i, c] of changes.entries())
            if (c.kindledId === id && c.place === 'pack') counts.set(c.itemId, after[i] ?? 0);
          const now = packSlotCount(
            [...counts].map(([itemId, quantity]) => ({ itemId, quantity })),
          );
          if (now > PACK_SLOTS && now > was)
            throw new Refusal(
              'pack-full',
              `Pack full: ${now} slots of ${PACK_SLOTS}.`,
              packChanges.find((c) => c.delta > 0),
            );
        }

        for (const [i, c] of changes.entries()) {
          const row = rowByKey.get(keyOf(c.kindledId, c.itemId, c.place));
          if (!row) continue;
          await tx
            .update(itemStacks)
            .set({ quantity: after[i] ?? row.quantity, updatedAt: sql`now()` })
            .where(eq(itemStacks.id, row.id));
        }
        const entries = await tx
          .insert(itemLedger)
          .values(
            changes.map((c, i) => ({
              kindledId: c.kindledId,
              itemId: c.itemId,
              place: c.place,
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
      if (ref !== undefined && isUniqueViolation(err, 'item_ledger_ref_place_unique'))
        return { ok: true, duplicate: true, entries: await entriesForRef(run, ref) };
      if (pgError(err)?.code === FOREIGN_KEY_VIOLATION)
        return { ok: false, error: 'unknown-kindled', message: 'No such Kindled.' };
      throw err;
    }
  }

  async function holdings(kindledId: string): Promise<Holding[]> {
    const rows = await db
      .select({ itemId: itemStacks.itemId, place: itemStacks.place, quantity: itemStacks.quantity })
      .from(itemStacks)
      .where(and(eq(itemStacks.kindledId, kindledId), gt(itemStacks.quantity, 0)));
    // The guard holds for every row the module wrote; a row that fails it is left out.
    return rows
      .flatMap((r): Holding[] =>
        isPlace(r.place) ? [{ itemId: r.itemId, place: r.place, quantity: r.quantity }] : [],
      )
      .sort(byDisplay);
  }

  return {
    apply,
    holdings,

    async view(kindledId) {
      const out: InventoryResponse = { purse: [], pack: [], store: [], baskets: {} };
      for (const h of await holdings(kindledId)) {
        const entry: InventoryEntry = { itemId: h.itemId, quantity: h.quantity };
        const station = basketStation(h.place);
        if (station !== undefined) (out.baskets[station] ??= []).push(entry);
        else if (h.place === 'purse') out.purse.push(entry);
        else if (h.place === 'pack') out.pack.push(entry);
        else out.store.push(entry);
      }
      return out;
    },

    ledger: (kindledId) =>
      db
        .select()
        .from(itemLedger)
        .where(eq(itemLedger.kindledId, kindledId))
        .orderBy(asc(itemLedger.id)),
  };
}
