import {
  ApiRoute,
  CURRENT_TELLING,
  isInventoryResponse,
  PACK_SLOTS,
  SESSION_COOKIE,
  type InventoryReason,
  type Place,
} from '@iot/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, kindled } from '../src/db/schema.js';
import {
  createInventory,
  grantByUsername,
  InventoryInputError,
  moveItems,
  parseGrantArgs,
  type Inventory,
} from '../src/inventory/index.js';

/**
 * inventory.apply with places, on in-memory PGlite (docs/design/inventory.md).
 * PGlite is one connection: its transactions run one after another, so the
 * "concurrent" test here checks that interleaved calls queue up and stay
 * consistent, not real row locking. inventory.postgres.test.ts runs the
 * races on a real Postgres (TEST_DATABASE_URL).
 */

let handle: DbHandle;
let inv: Inventory;
let n = 0;

async function newKindled(username = `kindled${++n}`): Promise<string> {
  const [account] = await handle.db
    .insert(accounts)
    .values({ username, passwordHash: 'x' })
    .returning();
  if (!account) throw new Error('no account');
  const [k] = await handle.db
    .insert(kindled)
    .values({ accountId: account.id, name: 'Tally', remembrance: 'clay', clayTone: 'clay-pale' })
    .returning();
  if (!k) throw new Error('no kindled');
  return k.id;
}

const balance = async (kindledId: string, itemId: string, place: Place): Promise<number> =>
  (await inv.holdings(kindledId)).find((h) => h.itemId === itemId && h.place === place)?.quantity ??
  0;

const change = (kindledId: string, itemId: string, place: Place, delta: number) => ({
  kindledId,
  itemId,
  place,
  delta,
});

beforeAll(async () => {
  handle = await createDb();
  await handle.migrate();
  inv = createInventory(handle.db);
});
afterAll(async () => {
  await handle.close();
});

describe('inventory.apply', () => {
  it('applies changes by place and writes one ledger row per change', async () => {
    const k = await newKindled();
    const first = await inv.apply(
      [change(k, 'sealed-gin', 'purse', 30), change(k, 'twisted-log', 'store', 5)],
      'grant',
    );
    expect(first).toMatchObject({ ok: true, duplicate: false });
    const second = await inv.apply([change(k, 'sealed-gin', 'purse', -12)], 'craft');
    expect(second.ok).toBe(true);

    expect(await inv.holdings(k)).toEqual([
      { itemId: 'sealed-gin', place: 'purse', quantity: 18 },
      { itemId: 'twisted-log', place: 'store', quantity: 5 },
    ]);
    expect(await inv.view(k)).toEqual({
      purse: [{ itemId: 'sealed-gin', quantity: 18 }],
      pack: [],
      store: [{ itemId: 'twisted-log', quantity: 5 }],
      baskets: {},
    });
    const ledger = await inv.ledger(k);
    expect(ledger).toMatchObject([
      {
        itemId: 'sealed-gin',
        place: 'purse',
        delta: 30,
        balanceAfter: 30,
        reason: 'grant',
        ref: null,
      },
      { itemId: 'twisted-log', place: 'store', delta: 5, balanceAfter: 5, reason: 'grant' },
      { itemId: 'sealed-gin', place: 'purse', delta: -12, balanceAfter: 18, reason: 'craft' },
    ]);
    for (const row of ledger) {
      expect(row.tellingId).toBe(CURRENT_TELLING);
      expect(row.createdAt).toBeInstanceOf(Date);
    }
  });

  it('keeps the same item apart by place, and orders the view by items.json then place', async () => {
    const k = await newKindled();
    await inv.apply(
      [
        change(k, 'pale-grain', 'basket:field', 7),
        change(k, 'pale-grain', 'pack', 3),
        change(k, 'black-stone', 'store', 10),
        change(k, 'pale-grain', 'store', 100),
        change(k, 'black-stone', 'basket:quarry', 2),
        change(k, 'sealed-gin', 'purse', 1),
      ],
      'grant',
    );
    expect(await inv.holdings(k)).toEqual([
      { itemId: 'sealed-gin', place: 'purse', quantity: 1 },
      { itemId: 'black-stone', place: 'store', quantity: 10 },
      { itemId: 'black-stone', place: 'basket:quarry', quantity: 2 },
      { itemId: 'pale-grain', place: 'pack', quantity: 3 },
      { itemId: 'pale-grain', place: 'store', quantity: 100 },
      { itemId: 'pale-grain', place: 'basket:field', quantity: 7 },
    ]);
    expect(await inv.view(k)).toEqual({
      purse: [{ itemId: 'sealed-gin', quantity: 1 }],
      pack: [{ itemId: 'pale-grain', quantity: 3 }],
      store: [
        { itemId: 'black-stone', quantity: 10 },
        { itemId: 'pale-grain', quantity: 100 },
      ],
      baskets: {
        quarry: [{ itemId: 'black-stone', quantity: 2 }],
        field: [{ itemId: 'pale-grain', quantity: 7 }],
      },
    });
  });

  it('stamps the Telling it was created with', async () => {
    const k = await newKindled();
    const other = createInventory(handle.db, { telling: 'telling-2' });
    await other.apply([change(k, 'pale-grain', 'basket:field', 1)], 'harvest');
    expect((await inv.ledger(k))[0]?.tellingId).toBe('telling-2');
  });

  it('refuses the whole set when any balance would go below zero (insufficient)', async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'black-stone', 'store', 10)], 'gather');
    const result = await inv.apply(
      [
        change(k, 'black-stone', 'store', -4),
        change(k, 'wild-sliver', 'pack', 2),
        change(k, 'black-stone', 'pack', -1),
      ],
      'craft',
    );
    expect(result).toMatchObject({
      ok: false,
      error: 'insufficient',
      change: { itemId: 'black-stone', place: 'pack', delta: -1 },
    });
    expect(await inv.holdings(k)).toEqual([
      { itemId: 'black-stone', place: 'store', quantity: 10 },
    ]);
    expect(await inv.ledger(k)).toHaveLength(1);
  });

  it('refuses currency outside the purse and anything else in it (wrong-place), touching nothing', async () => {
    const k = await newKindled();
    for (const place of ['pack', 'store', 'basket:field'] as const) {
      expect(await inv.apply([change(k, 'sealed-gin', place, 5)], 'grant')).toMatchObject({
        ok: false,
        error: 'wrong-place',
        change: { itemId: 'sealed-gin', place },
      });
    }
    expect(
      await inv.apply(
        [change(k, 'sealed-gin', 'purse', 5), change(k, 'twisted-log', 'purse', 1)],
        'grant',
      ),
    ).toMatchObject({ ok: false, error: 'wrong-place', change: { itemId: 'twisted-log' } });
    expect(await inv.holdings(k)).toEqual([]);
    expect(await inv.ledger(k)).toEqual([]);
  });

  it('refuses a store stack over its store limit (stack-limit); the purse has none', async () => {
    const k = await newKindled();
    expect((await inv.apply([change(k, 'twisted-log', 'store', 9999)], 'admin')).ok).toBe(true);
    const over = await inv.apply(
      [change(k, 'sealed-gin', 'purse', 5), change(k, 'twisted-log', 'store', 1)],
      'gather',
    );
    expect(over).toMatchObject({
      ok: false,
      error: 'stack-limit',
      message: 'Store: Twisted log full (9999).',
      change: { itemId: 'twisted-log', place: 'store' },
    });
    expect(await balance(k, 'sealed-gin', 'purse')).toBe(0);
    // Sparkglass has no store limit: as unlimited as its stack limit.
    expect((await inv.apply([change(k, 'wild-sliver', 'store', 2 ** 40)], 'admin')).ok).toBe(true);
    const lots = 2 ** 40;
    expect((await inv.apply([change(k, 'sealed-gin', 'purse', lots)], 'admin')).ok).toBe(true);
    expect(await balance(k, 'sealed-gin', 'purse')).toBe(lots);
    // A basket holds a material past the store limit (3b decides what a basket holds).
    expect(
      (await inv.apply([change(k, 'twisted-log', 'basket:lodge', 10_000)], 'harvest')).ok,
    ).toBe(true);
  });

  it("refuses what would go over the pack's slots (pack-full), counting every stack in it", async () => {
    const k = await newKindled();
    // 19 slots: 18 of stone (900 = 18 × 50) and one of 1 grain.
    expect(
      (
        await inv.apply(
          [change(k, 'black-stone', 'pack', 900), change(k, 'pale-grain', 'pack', 1)],
          'grant',
        )
      ).ok,
    ).toBe(true);
    // 49 more grain fill that slot: still 19.
    expect((await inv.apply([change(k, 'pale-grain', 'pack', 49)], 'grant')).ok).toBe(true);
    // One more grain opens the 20th slot: exactly full.
    expect((await inv.apply([change(k, 'pale-grain', 'pack', 1)], 'grant')).ok).toBe(true);
    // A new item needs a 21st slot: refused, as part of any set.
    const full = await inv.apply(
      [change(k, 'sealed-gin', 'purse', 1), change(k, 'wild-sliver', 'pack', 1)],
      'gather',
    );
    expect(full).toMatchObject({
      ok: false,
      error: 'pack-full',
      message: `Pack full: ${PACK_SLOTS + 1} slots of ${PACK_SLOTS}.`,
      change: { itemId: 'wild-sliver', place: 'pack', delta: 1 },
    });
    expect(await balance(k, 'sealed-gin', 'purse')).toBe(0);
    // Taking out of a full pack always goes; so does a set that frees a slot and fills it.
    expect((await inv.apply([change(k, 'black-stone', 'pack', -50)], 'craft')).ok).toBe(true);
    expect(
      (
        await inv.apply(
          [change(k, 'wild-sliver', 'pack', 99), change(k, 'black-stone', 'pack', -50)],
          'gather',
        )
      ).ok,
    ).toBe(true);
    expect((await inv.apply([change(k, 'wild-sliver', 'pack', 1)], 'gather')).ok).toBe(true);
    expect((await inv.apply([change(k, 'deep-glass', 'pack', 1)], 'gather')).ok).toBe(false);
    // The store doesn't count slots.
    expect((await inv.apply([change(k, 'deep-glass', 'store', 1)], 'gather')).ok).toBe(true);
  });

  it('applies a change set with a ref once, the same item in two places included', async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'deep-glass', 'store', 3)], 'grant');
    const changes = [change(k, 'deep-glass', 'store', -2), change(k, 'deep-glass', 'pack', 2)];
    const first = await inv.apply(changes, 'move', { ref: 'move:1' });
    const again = await inv.apply(changes, 'move', { ref: 'move:1' });
    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(again.ok && first.ok && again.entries).toEqual(first.ok && first.entries);
    expect(await balance(k, 'deep-glass', 'store')).toBe(1);
    expect(await balance(k, 'deep-glass', 'pack')).toBe(2);
    expect(await inv.ledger(k)).toHaveLength(3);
    // A refused set leaves its ref free.
    const refused = await inv.apply([change(k, 'deep-glass', 'pack', -9)], 'feed-writ', {
      ref: 'writ:7',
    });
    expect(refused.ok).toBe(false);
    await inv.apply([change(k, 'deep-glass', 'pack', -1)], 'feed-writ', { ref: 'writ:7' });
    expect(await balance(k, 'deep-glass', 'pack')).toBe(1);
  });

  it('moves items between two Kindleds in one transaction (a trade)', async () => {
    const a = await newKindled();
    const b = await newKindled();
    await inv.apply(
      [change(a, 'sealed-gin', 'purse', 20), change(b, 'glass-chip', 'store', 4)],
      'grant',
    );
    const trade = [
      change(a, 'sealed-gin', 'purse', -16),
      change(b, 'sealed-gin', 'purse', 16),
      change(b, 'glass-chip', 'store', -4),
      change(a, 'glass-chip', 'store', 4),
    ];
    expect((await inv.apply(trade, 'trade', { ref: 'trade:1' })).ok).toBe(true);
    expect(await inv.holdings(a)).toEqual([
      { itemId: 'sealed-gin', place: 'purse', quantity: 4 },
      { itemId: 'glass-chip', place: 'store', quantity: 4 },
    ]);
    expect(await inv.holdings(b)).toEqual([{ itemId: 'sealed-gin', place: 'purse', quantity: 16 }]);
    // B can't pay twice: the whole trade is refused, A keeps everything.
    const again = await inv.apply(trade, 'trade', { ref: 'trade:2' });
    expect(again).toMatchObject({ ok: false, error: 'insufficient' });
    expect(await balance(a, 'sealed-gin', 'purse')).toBe(4);
  });

  it("runs inside a caller's transaction as a savepoint", async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'grey-seeds', 'store', 10)], 'grant');
    // The caller commits: the items and its own write land together.
    await handle.db.transaction(async (tx) => {
      const result = await inv.apply([change(k, 'grey-seeds', 'store', -3)], 'craft', { tx });
      expect(result.ok).toBe(true);
      await tx.update(kindled).set({ name: 'Tally the Sower' }).where(eq(kindled.id, k));
    });
    expect(await balance(k, 'grey-seeds', 'store')).toBe(7);
    // A refusal leaves the caller's transaction usable; the caller decides what to do.
    await handle.db.transaction(async (tx) => {
      const result = await inv.apply([change(k, 'grey-seeds', 'store', -30)], 'craft', { tx });
      expect(result).toMatchObject({ ok: false, error: 'insufficient' });
      const ok = await inv.apply([change(k, 'grey-seeds', 'store', -1)], 'craft', { tx });
      expect(ok.ok).toBe(true);
    });
    expect(await balance(k, 'grey-seeds', 'store')).toBe(6);
    // The caller rolls back: the items roll back with it, ledger rows included.
    await expect(
      handle.db.transaction(async (tx) => {
        await inv.apply([change(k, 'grey-seeds', 'store', -6)], 'craft', { tx });
        throw new Error('the action failed');
      }),
    ).rejects.toThrow('the action failed');
    expect(await balance(k, 'grey-seeds', 'store')).toBe(6);
    expect((await inv.ledger(k)).map((r) => r.delta)).toEqual([10, -3, -1]);
  });

  it('queues interleaved calls on one row and keeps every balance', async () => {
    const k = await newKindled();
    await Promise.all(
      Array.from({ length: 25 }, () => inv.apply([change(k, 'wild-sliver', 'store', 1)], 'gather')),
    );
    const debits = await Promise.all(
      Array.from({ length: 30 }, () =>
        inv.apply([change(k, 'wild-sliver', 'store', -1)], 'feed-writ'),
      ),
    );
    expect(debits.filter((r) => r.ok)).toHaveLength(25);
    expect(debits.filter((r) => !r.ok && r.error === 'insufficient')).toHaveLength(5);
    expect(await balance(k, 'wild-sliver', 'store')).toBe(0);
    const after = (await inv.ledger(k)).map((r) => r.balanceAfter);
    expect(after).toEqual([
      ...Array.from({ length: 25 }, (_, i) => i + 1),
      ...Array.from({ length: 25 }, (_, i) => 24 - i),
    ]);
  });

  it('refuses an unknown Kindled', async () => {
    const result = await inv.apply(
      [change('00000000-0000-4000-8000-000000000000', 'sealed-gin', 'purse', 1)],
      'grant',
    );
    expect(result).toMatchObject({ ok: false, error: 'unknown-kindled' });
  });

  it('throws on malformed calls', async () => {
    const k = await newKindled();
    const bad: [Parameters<Inventory['apply']>[0], string, string?][] = [
      [[], 'grant'],
      [[change(k, 'sealed-gin', 'purse', 1)], 'theft'],
      [[change(k, 'gold', 'purse', 1)], 'grant'],
      [[change(k, 'sealed-gin', 'purse', 0)], 'grant'],
      [[change(k, 'sealed-gin', 'purse', 1.5)], 'grant'],
      [[change('nobody', 'sealed-gin', 'purse', 1)], 'grant'],
      [[change(k, 'black-stone', 'bag' as Place, 1)], 'grant'],
      [[change(k, 'black-stone', 'basket:', 1)], 'grant'],
      [[change(k, 'black-stone', 'basket:Field', 1)], 'grant'],
      [[change(k, 'sealed-gin', 'purse', 1), change(k, 'sealed-gin', 'purse', 2)], 'grant'],
      [[change(k, 'sealed-gin', 'purse', 1)], 'grant', ''],
    ];
    for (const [changes, reason, ref] of bad)
      // 'theft' is deliberately not an InventoryReason: apply checks at run time too.
      await expect(
        inv.apply(changes, reason as InventoryReason, ref === undefined ? {} : { ref }),
      ).rejects.toBeInstanceOf(InventoryInputError);
    // The same item in two places is two changes, not a repeat.
    expect(
      (
        await inv.apply(
          [change(k, 'black-stone', 'pack', 1), change(k, 'black-stone', 'store', 1)],
          'grant',
        )
      ).ok,
    ).toBe(true);
    expect(await inv.ledger(k)).toHaveLength(2);
  });

  it('cascades with the Kindled', async () => {
    const k = await newKindled('gone');
    await inv.apply([change(k, 'sealed-gin', 'purse', 1)], 'grant');
    await handle.db.delete(accounts).where(eq(accounts.username, 'gone'));
    expect(await inv.holdings(k)).toEqual([]);
    expect(await inv.ledger(k)).toEqual([]);
  });
});

describe('moves', () => {
  it('moves a stack and a single item each way between the pack and the store', async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'black-stone', 'store', 120)], 'grant');
    const toPack = await moveItems(inv, {
      kindledId: k,
      itemId: 'black-stone',
      from: 'store',
      to: 'pack',
      quantity: 120,
    });
    expect(toPack).toMatchObject({ ok: true, duplicate: false });
    expect(await inv.view(k)).toMatchObject({
      pack: [{ itemId: 'black-stone', quantity: 120 }],
      store: [],
    });
    const one = await moveItems(inv, {
      kindledId: k,
      itemId: 'black-stone',
      from: 'pack',
      to: 'store',
      quantity: 1,
    });
    expect(one.ok).toBe(true);
    expect(await inv.view(k)).toMatchObject({
      pack: [{ itemId: 'black-stone', quantity: 119 }],
      store: [{ itemId: 'black-stone', quantity: 1 }],
    });
    expect(
      (
        await moveItems(inv, {
          kindledId: k,
          itemId: 'black-stone',
          from: 'store',
          to: 'pack',
          quantity: 1,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await moveItems(inv, {
          kindledId: k,
          itemId: 'black-stone',
          from: 'pack',
          to: 'store',
          quantity: 120,
        })
      ).ok,
    ).toBe(true);
    expect(await inv.view(k)).toMatchObject({
      pack: [],
      store: [{ itemId: 'black-stone', quantity: 120 }],
    });
  });

  it('writes both sides of a move to the ledger, with reason move', async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'twisted-log', 'store', 8)], 'grant');
    await moveItems(inv, {
      kindledId: k,
      itemId: 'twisted-log',
      from: 'store',
      to: 'pack',
      quantity: 5,
    });
    expect(await inv.ledger(k)).toMatchObject([
      { itemId: 'twisted-log', place: 'store', delta: 8, balanceAfter: 8, reason: 'grant' },
      { itemId: 'twisted-log', place: 'store', delta: -5, balanceAfter: 3, reason: 'move' },
      { itemId: 'twisted-log', place: 'pack', delta: 5, balanceAfter: 5, reason: 'move' },
    ]);
  });

  it('takes a basket to the store, and nothing to anywhere else', async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'pale-grain', 'basket:field', 30)], 'harvest');
    expect(
      await moveItems(inv, {
        kindledId: k,
        itemId: 'pale-grain',
        from: 'basket:field',
        to: 'store',
        quantity: 30,
      }),
    ).toMatchObject({ ok: true });
    expect(await inv.view(k)).toMatchObject({
      store: [{ itemId: 'pale-grain', quantity: 30 }],
      baskets: {},
    });
    for (const [from, to] of [
      ['store', 'basket:field'],
      ['pack', 'basket:field'],
      ['basket:field', 'pack'],
      ['purse', 'pack'],
      ['store', 'purse'],
      ['store', 'store'],
    ] as const) {
      expect(
        await moveItems(inv, { kindledId: k, itemId: 'pale-grain', from, to, quantity: 1 }),
        `${from} -> ${to}`,
      ).toMatchObject({
        ok: false,
        error: 'wrong-place',
      });
    }
    // The purse can't be named as either side even for currency: nothing moves gin.
    await inv.apply([change(k, 'sealed-gin', 'purse', 5)], 'grant');
    expect(
      await moveItems(inv, {
        kindledId: k,
        itemId: 'sealed-gin',
        from: 'purse',
        to: 'store',
        quantity: 1,
      }),
    ).toMatchObject({
      ok: false,
      error: 'wrong-place',
    });
    expect(
      await moveItems(inv, {
        kindledId: k,
        itemId: 'sealed-gin',
        from: 'store',
        to: 'pack',
        quantity: 1,
      }),
    ).toMatchObject({
      ok: false,
      error: 'wrong-place',
    });
    expect(await inv.ledger(k)).toHaveLength(4);
  });

  it('refuses what the ledger refuses: insufficient, pack-full', async () => {
    const k = await newKindled();
    await inv.apply(
      [change(k, 'black-stone', 'store', 1001), change(k, 'pale-grain', 'store', 1)],
      'grant',
    );
    expect(
      await moveItems(inv, {
        kindledId: k,
        itemId: 'black-stone',
        from: 'pack',
        to: 'store',
        quantity: 1,
      }),
    ).toMatchObject({
      ok: false,
      error: 'insufficient',
    });
    expect(
      await moveItems(inv, {
        kindledId: k,
        itemId: 'black-stone',
        from: 'store',
        to: 'pack',
        quantity: 1001,
      }),
    ).toMatchObject({
      ok: false,
      error: 'pack-full',
    });
    expect(
      (
        await moveItems(inv, {
          kindledId: k,
          itemId: 'black-stone',
          from: 'store',
          to: 'pack',
          quantity: 1000,
        })
      ).ok,
    ).toBe(true);
    expect(
      await moveItems(inv, {
        kindledId: k,
        itemId: 'pale-grain',
        from: 'store',
        to: 'pack',
        quantity: 1,
      }),
    ).toMatchObject({
      ok: false,
      error: 'pack-full',
    });
    expect(
      await moveItems(inv, {
        kindledId: k,
        itemId: 'gold',
        from: 'store',
        to: 'pack',
        quantity: 1,
      }),
    ).toMatchObject({
      ok: false,
      error: 'bad-request',
    });
  });
});

describe('inv:grant', () => {
  it('parses its arguments, with the place defaulting by kind', () => {
    expect(parseGrantArgs(['Alice', 'sealed-gin', '10'])).toEqual({
      ok: true,
      args: { username: 'alice', itemId: 'sealed-gin', quantity: 10, place: 'purse' },
    });
    expect(parseGrantArgs(['--', 'alice', 'black-stone', '-3'])).toMatchObject({
      ok: true,
      args: { quantity: -3, place: 'store' },
    });
    expect(parseGrantArgs(['alice', 'black-stone', '3', 'pack'])).toMatchObject({
      ok: true,
      args: { place: 'pack' },
    });
    expect(parseGrantArgs(['alice', 'pale-grain', '3', 'basket:field'])).toMatchObject({
      ok: true,
      args: { place: 'basket:field' },
    });
    for (const argv of [
      [],
      ['alice', 'sealed-gin'],
      ['alice', 'gold', '1'],
      ['alice', 'sealed-gin', '0'],
      ['alice', 'sealed-gin', '1.5'],
      ['alice', 'sealed-gin', 'ten'],
      ['a', 'sealed-gin', '1'],
      ['alice', 'black-stone', '1', 'bag'],
      ['alice', 'black-stone', '1', 'basket:'],
      ['alice', 'black-stone', '1', 'store', 'more'],
    ])
      expect(parseGrantArgs(argv).ok, argv.join(' ')).toBe(false);
  });

  it('grants by username through apply, with reason admin, in the place given or the default', async () => {
    const k = await newKindled('granted');
    const args = {
      username: 'granted',
      itemId: 'pale-grain',
      quantity: 40,
      place: 'store' as const,
    };
    const result = await grantByUsername(handle.db, inv, args);
    expect(result).toMatchObject({
      ok: true,
      entry: { balanceAfter: 40, reason: 'admin', place: 'store' },
    });
    expect(await balance(k, 'pale-grain', 'store')).toBe(40);
    const packed = await grantByUsername(handle.db, inv, { ...args, quantity: 3, place: 'pack' });
    expect(packed).toMatchObject({ ok: true, entry: { balanceAfter: 3, place: 'pack' } });
    expect(await balance(k, 'pale-grain', 'store')).toBe(40);
    expect(await balance(k, 'pale-grain', 'pack')).toBe(3);
    const take = await grantByUsername(handle.db, inv, { ...args, quantity: -50 });
    expect(take).toMatchObject({ ok: false });
    // Currency can't be put anywhere but the purse.
    expect(
      await grantByUsername(handle.db, inv, {
        ...args,
        itemId: 'sealed-gin',
        quantity: 5,
        place: 'store',
      }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('purse') as string });
    expect(await grantByUsername(handle.db, inv, { ...args, username: 'nobody' })).toMatchObject({
      ok: false,
      message: 'no Kindled for username nobody',
    });
  });
});

describe('the inventory API', () => {
  const HOST = 'game.test';
  let app: App;
  let db: DbHandle;

  beforeAll(async () => {
    db = await createDb();
    await db.migrate();
    app = await createApp({ db });
  });
  afterAll(async () => {
    await app.close();
    await db.close();
  });

  const post = (url: string, body: unknown, cookie?: string) =>
    app.http.inject({
      method: 'POST',
      url,
      headers: {
        host: HOST,
        origin: `https://${HOST}`,
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      payload: JSON.stringify(body),
    });
  const get = (cookie?: string) =>
    app.http.inject({
      method: 'GET',
      url: ApiRoute.Inventory,
      headers: { host: HOST, ...(cookie ? { cookie } : {}) },
    });

  let cookie = '';

  it("GET answers the signed-in Kindled's items by place, from the cookie only", async () => {
    expect((await get()).json()).toMatchObject({ error: 'not-signed-in' });

    const reg = await post(ApiRoute.Register, { username: 'holder', password: 'correct horse' });
    const setCookie = reg.headers['set-cookie'];
    cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0] ?? '';
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    const none = await get(cookie);
    expect(none.statusCode).toBe(404);
    expect(none.json()).toMatchObject({ error: 'no-kindled' });
    const noneMove = await post(
      ApiRoute.InventoryMove,
      { itemId: 'black-stone', from: 'store', to: 'pack', quantity: 1 },
      cookie,
    );
    expect(noneMove.statusCode).toBe(404);

    await post(ApiRoute.Kindled, { name: 'Iltani', remembrance: 'tide' }, cookie);
    const empty = await get(cookie);
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ purse: [], pack: [], store: [], baskets: {} });

    const local = createInventory(db.db);
    const grant = (itemId: string, quantity: number, place?: Place) =>
      grantByUsername(db.db, local, {
        username: 'holder',
        itemId,
        quantity,
        place: place ?? (itemId === 'sealed-gin' ? 'purse' : 'store'),
      });
    await grant('twisted-log', 5);
    await grant('sealed-gin', 12);
    await grant('grey-seeds', 2);
    await grant('grey-seeds', -2);
    await grant('black-stone', 60);
    await grant('pale-grain', 9, 'basket:field');
    await grant('wild-sliver', 3, 'pack');
    const res = await get(cookie);
    expect(res.headers['cache-control']).toBe('no-store');
    const body: unknown = res.json();
    expect(isInventoryResponse(body)).toBe(true);
    // items.json order in each place; items at 0 are left out.
    expect(body).toEqual({
      purse: [{ itemId: 'sealed-gin', quantity: 12 }],
      pack: [{ itemId: 'wild-sliver', quantity: 3 }],
      store: [
        { itemId: 'twisted-log', quantity: 5 },
        { itemId: 'black-stone', quantity: 60 },
      ],
      baskets: { field: [{ itemId: 'pale-grain', quantity: 9 }] },
    });
  });

  it('POST move answers the new inventory, or the reason it was refused', async () => {
    const move = (body: unknown) => post(ApiRoute.InventoryMove, body, cookie);
    const ok = await move({ itemId: 'black-stone', from: 'store', to: 'pack', quantity: 51 });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      pack: [
        { itemId: 'wild-sliver', quantity: 3 },
        { itemId: 'black-stone', quantity: 51 },
      ],
      store: [
        { itemId: 'twisted-log', quantity: 5 },
        { itemId: 'black-stone', quantity: 9 },
      ],
    });
    const back = await move({ itemId: 'black-stone', from: 'pack', to: 'store', quantity: 1 });
    expect(back.json()).toMatchObject({
      pack: [
        { itemId: 'wild-sliver', quantity: 3 },
        { itemId: 'black-stone', quantity: 50 },
      ],
    });
    const taken = await move({
      itemId: 'pale-grain',
      from: 'basket:field',
      to: 'store',
      quantity: 9,
    });
    expect(taken.statusCode).toBe(200);
    expect(taken.json()).toMatchObject({
      baskets: {},
      store: expect.arrayContaining([{ itemId: 'pale-grain', quantity: 9 }]) as unknown,
    });

    const refusals: [unknown, number, string][] = [
      [{ itemId: 'black-stone', from: 'store', to: 'pack', quantity: 100 }, 409, 'insufficient'],
      [{ itemId: 'twisted-log', from: 'pack', to: 'store', quantity: 1 }, 409, 'insufficient'],
      [{ itemId: 'sealed-gin', from: 'purse', to: 'pack', quantity: 1 }, 409, 'wrong-place'],
      [{ itemId: 'sealed-gin', from: 'store', to: 'pack', quantity: 1 }, 409, 'wrong-place'],
      [
        { itemId: 'black-stone', from: 'store', to: 'basket:field', quantity: 1 },
        409,
        'wrong-place',
      ],
      [{ itemId: 'black-stone', from: 'store', to: 'store', quantity: 1 }, 409, 'wrong-place'],
      [{ itemId: 'gold', from: 'store', to: 'pack', quantity: 1 }, 400, 'bad-request'],
      [{ itemId: 'black-stone', from: 'store', to: 'pack', quantity: 0 }, 400, 'bad-request'],
      [{ itemId: 'black-stone', from: 'store', to: 'pack', quantity: -1 }, 400, 'bad-request'],
      [{ itemId: 'black-stone', from: 'store', to: 'pack', quantity: 1.5 }, 400, 'bad-request'],
      [{ itemId: 'black-stone', from: 'store', to: 'pack', quantity: '1' }, 400, 'bad-request'],
      [{ itemId: 'black-stone', from: 'bag', to: 'pack', quantity: 1 }, 400, 'bad-request'],
      [
        { itemId: 'black-stone', from: 'store', to: 'pack', quantity: 1, all: true },
        400,
        'bad-request',
      ],
      [{ itemId: 'black-stone', from: 'store', to: 'pack' }, 400, 'bad-request'],
      ['[]', 400, 'bad-request'],
    ];
    for (const [body, status, error] of refusals) {
      const res = await move(body);
      expect(res.statusCode, JSON.stringify(body)).toBe(status);
      expect(res.json(), JSON.stringify(body)).toMatchObject({ error });
    }
    // Pack full: 950 stone (19 slots) beside the slivers (1) leave no room; the message is the toast's line.
    const admin = (itemId: string, quantity: number, place: Place) =>
      grantByUsername(db.db, createInventory(db.db), {
        username: 'holder',
        itemId,
        quantity,
        place,
      });
    expect(await admin('black-stone', 900, 'pack')).toMatchObject({ ok: true });
    const full = await move({ itemId: 'twisted-log', from: 'store', to: 'pack', quantity: 1 });
    expect(full.statusCode).toBe(409);
    expect(full.json()).toEqual({ error: 'pack-full', message: 'Pack full.' });
    // The store limit, by the route's code: 9,999 logs in the store, one more in the pack.
    expect(await admin('twisted-log', 9994, 'store')).toMatchObject({ ok: true });
    expect(
      (await move({ itemId: 'black-stone', from: 'pack', to: 'store', quantity: 50 })).statusCode,
    ).toBe(200);
    expect(await admin('twisted-log', 1, 'pack')).toMatchObject({ ok: true });
    const limit = await move({ itemId: 'twisted-log', from: 'pack', to: 'store', quantity: 1 });
    expect(limit.statusCode).toBe(409);
    expect(limit.json()).toMatchObject({
      error: 'stack-limit',
      message: 'Store: Twisted log full (9999).',
    });
    // Nothing changed through the refusals.
    expect((await get(cookie)).json()).toMatchObject({
      pack: expect.arrayContaining([{ itemId: 'twisted-log', quantity: 1 }]) as unknown,
    });

    // Like every mutating route: JSON from the same origin only, the Kindled from the cookie.
    const crossSite = await app.http.inject({
      method: 'POST',
      url: ApiRoute.InventoryMove,
      headers: {
        host: HOST,
        origin: 'https://evil.test',
        'content-type': 'application/json',
        cookie,
      },
      payload: JSON.stringify({ itemId: 'black-stone', from: 'pack', to: 'store', quantity: 1 }),
    });
    expect(crossSite.statusCode).toBe(403);
    expect(
      (
        await post(ApiRoute.InventoryMove, {
          itemId: 'black-stone',
          from: 'pack',
          to: 'store',
          quantity: 1,
        })
      ).statusCode,
    ).toBe(401);
  });
});
