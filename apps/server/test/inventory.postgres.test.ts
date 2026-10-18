import { PACK_SLOTS, type Place } from '@iot/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestPostgres, type TestPostgres } from './postgres.js';
import type { DbHandle } from '../src/db/client.js';
import { accounts, kindled } from '../src/db/schema.js';
import {
  createInventory,
  moveItems,
  type ApplyResult,
  type Inventory,
} from '../src/inventory/index.js';

/**
 * inventory.apply under real concurrency (docs/design/inventory.md). PGlite is
 * a single connection, so only a real Postgres shows what the locks do:
 * many connections racing on one row, a trade racing its reverse (the fixed
 * lock order means no deadlock), moves racing between the pack and the
 * store, two moves racing for the pack's last slots, and the same ref sent
 * twice at once.
 *
 * Needs TEST_DATABASE_URL: a throwaway database (its name must contain
 * "test"), wiped and migrated here. CI provides one (a Postgres service in
 * .github/workflows/ci.yml) and fails without it; elsewhere the suite only
 * runs when it is set (scripts/cloud-setup.sh sets it for Claude Code on the web).
 */
const url = process.env.TEST_DATABASE_URL;
const RACERS = 24;

if (process.env.CI && !url) throw new Error('CI must set TEST_DATABASE_URL (a Postgres service)');

const change = (kindledId: string, itemId: string, place: Place, delta: number) => ({
  kindledId,
  itemId,
  place,
  delta,
});

describe.runIf(url)('inventory.apply on Postgres', () => {
  let db: TestPostgres;
  let handle: DbHandle;
  let inv: Inventory;
  let n = 0;

  beforeAll(async () => {
    if (!url) return;
    db = await openTestPostgres(url);
    handle = db.handle;
    inv = createInventory(handle.db);
  });
  afterAll(async () => {
    await db.release();
  });

  async function newKindled(): Promise<string> {
    const [account] = await handle.db
      .insert(accounts)
      .values({ username: `racer${++n}`, passwordHash: 'x' })
      .returning();
    if (!account) throw new Error('no account');
    const [k] = await handle.db
      .insert(kindled)
      .values({ accountId: account.id, name: 'Kesh', remembrance: 'ash', clayTone: 'clay-red' })
      .returning();
    if (!k) throw new Error('no kindled');
    return k.id;
  }

  const balance = async (kindledId: string, itemId: string, place: Place): Promise<number> =>
    (await inv.holdings(kindledId)).find((h) => h.itemId === itemId && h.place === place)
      ?.quantity ?? 0;

  const race = <T>(count: number, call: (i: number) => Promise<T>) =>
    Promise.all(Array.from({ length: count }, (_, i) => call(i)));

  /** Each Kindled's ledger is one unbroken chain of balances per item and place. */
  async function expectChains(kindledId: string): Promise<void> {
    const last = new Map<string, number>();
    for (const row of await inv.ledger(kindledId)) {
      const key = `${row.itemId}/${row.place ?? ''}`;
      expect(row.balanceAfter - row.delta).toBe(last.get(key) ?? 0);
      last.set(key, row.balanceAfter);
    }
  }

  it('runs on more than one connection at once', async () => {
    // Without this the races below could pass by queuing on one connection, like PGlite.
    await Promise.all(
      Array.from({ length: 4 }, () => handle.db.execute(sql`select pg_sleep(0.05)`)),
    );
    // The node-postgres driver answers execute() with a pg QueryResult.
    const result: unknown = await handle.db.execute(
      sql`select count(*)::int as n from pg_stat_activity where datname = current_database()`,
    );
    expect((result as { rows: { n: number }[] }).rows[0]?.n).toBeGreaterThan(1);
  });

  it('serializes credits racing on a row that does not exist yet', async () => {
    const k = await newKindled();
    const results = await race(RACERS, () =>
      inv.apply([change(k, 'sealed-gin', 'purse', 1)], 'gather'),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await balance(k, 'sealed-gin', 'purse')).toBe(RACERS);
    const after = (await inv.ledger(k)).map((r) => r.balanceAfter);
    expect(after).toEqual(Array.from({ length: RACERS }, (_, i) => i + 1));
  });

  it('never lets racing debits overdraw', async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'wild-sliver', 'store', 10)], 'grant');
    const results = await race(RACERS, () =>
      inv.apply([change(k, 'wild-sliver', 'store', -1)], 'feed-writ'),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(results.filter((r) => !r.ok && r.error === 'insufficient')).toHaveLength(RACERS - 10);
    expect(await balance(k, 'wild-sliver', 'store')).toBe(0);
  });

  it('runs trades and their reverses at once without deadlock, conserving totals', async () => {
    const a = await newKindled();
    const b = await newKindled();
    await inv.apply(
      [
        change(a, 'sealed-gin', 'purse', 1000),
        change(a, 'black-stone', 'store', 1000),
        change(b, 'sealed-gin', 'purse', 1000),
        change(b, 'black-stone', 'store', 1000),
      ],
      'grant',
    );
    // Even i: A pays B gin for stone; odd i: B pays A. Each lists its own side first,
    // so without the fixed lock order these would take their locks in opposite orders.
    const results: ApplyResult[] = await race(RACERS * 2, (i) => {
      const [from, to] = i % 2 === 0 ? [a, b] : [b, a];
      return inv.apply(
        [
          change(from, 'sealed-gin', 'purse', -(i + 1)),
          change(from, 'black-stone', 'store', i + 1),
          change(to, 'sealed-gin', 'purse', i + 1),
          change(to, 'black-stone', 'store', -(i + 1)),
        ],
        'trade',
        { ref: `trade:${i}` },
      );
    });
    expect(results.every((r) => r.ok && !r.duplicate)).toBe(true);
    expect(
      (await balance(a, 'sealed-gin', 'purse')) + (await balance(b, 'sealed-gin', 'purse')),
    ).toBe(2000);
    expect(
      (await balance(a, 'black-stone', 'store')) + (await balance(b, 'black-stone', 'store')),
    ).toBe(2000);
    for (const k of [a, b]) await expectChains(k);
  });

  it('runs moves racing between the pack and the store without deadlock, keeping the total', async () => {
    const k = await newKindled();
    await inv.apply(
      [change(k, 'black-stone', 'store', 500), change(k, 'black-stone', 'pack', 500)],
      'grant',
    );
    // Even i: store to pack; odd i: pack to store. Each lists its source first, so the two
    // directions name the same two rows in opposite orders.
    const results = await race(RACERS * 2, (i) =>
      moveItems(inv, {
        kindledId: k,
        itemId: 'black-stone',
        from: i % 2 === 0 ? 'store' : 'pack',
        to: i % 2 === 0 ? 'pack' : 'store',
        quantity: (i % 7) + 1,
      }),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(
      (await balance(k, 'black-stone', 'store')) + (await balance(k, 'black-stone', 'pack')),
    ).toBe(1000);
    await expectChains(k);
  });

  it('lets exactly one of two moves win the last slots of the pack', async () => {
    // 20 slots: stone fills 18 (900), grain the 19th; one slot is left. Logs (50 of them, one
    // slot) and seeds (1, one slot) each fit alone, not together.
    const fill = async (): Promise<string> => {
      const k = await newKindled();
      await inv.apply(
        [
          change(k, 'black-stone', 'pack', 900),
          change(k, 'pale-grain', 'pack', 1),
          change(k, 'twisted-log', 'store', 50),
          change(k, 'grey-seeds', 'store', 1),
        ],
        'grant',
      );
      return k;
    };
    const kindleds = await Promise.all(Array.from({ length: 8 }, fill));
    const outcomes = await Promise.all(
      kindleds.map((k) =>
        Promise.all([
          moveItems(inv, {
            kindledId: k,
            itemId: 'twisted-log',
            from: 'store',
            to: 'pack',
            quantity: 50,
          }),
          moveItems(inv, {
            kindledId: k,
            itemId: 'grey-seeds',
            from: 'store',
            to: 'pack',
            quantity: 1,
          }),
        ]),
      ),
    );
    for (const [i, [logs, seeds]] of outcomes.entries()) {
      const k = kindleds[i] ?? '';
      expect([logs.ok, seeds.ok].filter(Boolean), `kindled ${i}`).toHaveLength(1);
      const lost = logs.ok ? seeds : logs;
      expect(lost).toMatchObject({ ok: false, error: 'pack-full' });
      const view = await inv.view(k);
      expect(view.pack.reduce((n, s) => n + Math.ceil(s.quantity / 50), 0)).toBe(PACK_SLOTS);
      await expectChains(k);
    }
  });

  it('applies the same ref once when it is sent many times at once', async () => {
    const k = await newKindled();
    await inv.apply([change(k, 'deep-glass', 'store', 1)], 'grant');
    const results = await race(RACERS, () =>
      inv.apply([change(k, 'deep-glass', 'store', -1)], 'feed-writ', { ref: 'writ:once' }),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect(await balance(k, 'deep-glass', 'store')).toBe(0);
    expect(await inv.ledger(k)).toHaveLength(2);
  });
});
