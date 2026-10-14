import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, kindled } from '../src/db/schema.js';
import { createInventory, type ApplyResult, type Inventory } from '../src/inventory/index.js';

/**
 * inventory.apply under real concurrency (docs/design/inventory.md). PGlite is
 * a single connection, so only a real Postgres shows what the row locks do:
 * many connections racing on one row, a trade racing its reverse (the fixed
 * lock order means no deadlock), and the same ref sent twice at once.
 *
 * Needs TEST_DATABASE_URL: a throwaway database (its name must contain
 * "test"), wiped and migrated here. CI provides one (a Postgres service in
 * .github/workflows/ci.yml) and fails without it; elsewhere the suite only
 * runs when it is set (scripts/cloud-setup.sh sets it for Claude Code on the web).
 */
const url = process.env.TEST_DATABASE_URL;
const RACERS = 24;

if (process.env.CI && !url) throw new Error('CI must set TEST_DATABASE_URL (a Postgres service)');

describe.runIf(url)('inventory.apply on Postgres', () => {
  let handle: DbHandle;
  let inv: Inventory;
  let n = 0;

  beforeAll(async () => {
    if (!url) return;
    if (!/test/i.test(new URL(url).pathname))
      throw new Error(`refusing to wipe ${new URL(url).pathname}: its name must contain "test"`);
    handle = await createDb({ url });
    await handle.db.execute(sql`drop schema if exists drizzle cascade`);
    await handle.db.execute(sql`drop schema if exists public cascade`);
    await handle.db.execute(sql`create schema public`);
    await handle.migrate();
    inv = createInventory(handle.db);
  });
  afterAll(async () => {
    await handle.close();
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

  const balance = async (kindledId: string, itemId: string): Promise<number> =>
    (await inv.holdings(kindledId)).find((h) => h.itemId === itemId)?.quantity ?? 0;

  const race = (count: number, call: (i: number) => Promise<ApplyResult>) =>
    Promise.all(Array.from({ length: count }, (_, i) => call(i)));

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
      inv.apply([{ kindledId: k, itemId: 'sealed-gin', delta: 1 }], 'gather'),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await balance(k, 'sealed-gin')).toBe(RACERS);
    const after = (await inv.ledger(k)).map((r) => r.balanceAfter);
    expect(after).toEqual(Array.from({ length: RACERS }, (_, i) => i + 1));
  });

  it('never lets racing debits overdraw', async () => {
    const k = await newKindled();
    await inv.apply([{ kindledId: k, itemId: 'wild-sliver', delta: 10 }], 'grant');
    const results = await race(RACERS, () =>
      inv.apply([{ kindledId: k, itemId: 'wild-sliver', delta: -1 }], 'feed-writ'),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(results.filter((r) => !r.ok && r.error === 'insufficient')).toHaveLength(RACERS - 10);
    expect(await balance(k, 'wild-sliver')).toBe(0);
  });

  it('runs trades and their reverses at once without deadlock, conserving totals', async () => {
    const a = await newKindled();
    const b = await newKindled();
    await inv.apply(
      [
        { kindledId: a, itemId: 'sealed-gin', delta: 1000 },
        { kindledId: a, itemId: 'black-stone', delta: 1000 },
        { kindledId: b, itemId: 'sealed-gin', delta: 1000 },
        { kindledId: b, itemId: 'black-stone', delta: 1000 },
      ],
      'grant',
    );
    // Even i: A pays B gin for stone; odd i: B pays A. Each lists its own side first,
    // so without the fixed lock order these would take their row locks in opposite orders.
    const results = await race(RACERS * 2, (i) => {
      const [from, to] = i % 2 === 0 ? [a, b] : [b, a];
      return inv.apply(
        [
          { kindledId: from, itemId: 'sealed-gin', delta: -(i + 1) },
          { kindledId: from, itemId: 'black-stone', delta: i + 1 },
          { kindledId: to, itemId: 'sealed-gin', delta: i + 1 },
          { kindledId: to, itemId: 'black-stone', delta: -(i + 1) },
        ],
        'trade',
        `trade:${i}`,
      );
    });
    expect(results.every((r) => r.ok && !r.duplicate)).toBe(true);
    for (const item of ['sealed-gin', 'black-stone'])
      expect((await balance(a, item)) + (await balance(b, item))).toBe(2000);
    // Each Kindled's ledger is one unbroken chain of balances per item.
    for (const k of [a, b]) {
      const last = new Map<string, number>();
      for (const row of await inv.ledger(k)) {
        expect(row.balanceAfter - row.delta).toBe(last.get(row.itemId) ?? 0);
        last.set(row.itemId, row.balanceAfter);
      }
    }
  });

  it('applies the same ref once when it is sent many times at once', async () => {
    const k = await newKindled();
    await inv.apply([{ kindledId: k, itemId: 'deep-glass', delta: 1 }], 'grant');
    const results = await race(RACERS, () =>
      inv.apply([{ kindledId: k, itemId: 'deep-glass', delta: -1 }], 'feed-writ', 'writ:once'),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect(await balance(k, 'deep-glass')).toBe(0);
    expect(await inv.ledger(k)).toHaveLength(2);
  });
});
