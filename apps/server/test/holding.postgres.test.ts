import { HOUR_MS } from '@iot/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestPostgres, type TestPostgres } from './postgres.js';
import type { DbHandle } from '../src/db/client.js';
import { accounts, kindled } from '../src/db/schema.js';
import { createHolding, type Holding } from '../src/holding/index.js';
import { createInventory, type Inventory } from '../src/inventory/index.js';

/**
 * The holding's settle under real concurrency (docs/design/holding.md).
 * PGlite is one connection, so only a real Postgres shows the locks at work:
 * many settles racing for the same Kindled credit each cycle once, and a
 * take-all racing a settle keeps the basket's totals. Needs
 * TEST_DATABASE_URL like inventory.postgres.test.ts (CI provides one).
 */
const url = process.env.TEST_DATABASE_URL;
const RACERS = 16;
const T0 = Date.parse('2026-10-17T12:00:00Z');
const at = (ms: number): Date => new Date(T0 + ms);

if (process.env.CI && !url) throw new Error('CI must set TEST_DATABASE_URL (a Postgres service)');

describe.runIf(url)('the holding settle on Postgres', () => {
  let db: TestPostgres;
  let handle: DbHandle;
  let inv: Inventory;
  let holding: Holding;
  let n = 0;

  beforeAll(async () => {
    if (!url) return;
    db = await openTestPostgres(url);
    handle = db.handle;
    inv = createInventory(handle.db);
    holding = createHolding(handle.db, inv);
  });
  afterAll(async () => {
    await db.release();
  });

  async function newKindled(): Promise<string> {
    const [account] = await handle.db.insert(accounts).values({ username: `holder${++n}`, passwordHash: 'x' }).returning();
    if (!account) throw new Error('no account');
    const [k] = await handle.db
      .insert(kindled)
      .values({ accountId: account.id, name: 'Kesh', remembrance: 'ash', clayTone: 'clay-red' })
      .returning();
    if (!k) throw new Error('no kindled');
    return k.id;
  }

  const race = <T>(count: number, call: (i: number) => Promise<T>) => Promise.all(Array.from({ length: count }, (_, i) => call(i)));

  /** The ledger is one unbroken chain of balances per item and place. */
  async function expectChains(kindledId: string): Promise<void> {
    const last = new Map<string, number>();
    for (const row of await inv.ledger(kindledId)) {
      const key = `${row.itemId}/${row.place ?? ''}`;
      expect(row.balanceAfter - row.delta).toBe(last.get(key) ?? 0);
      last.set(key, row.balanceAfter);
    }
  }

  it('credits each cycle once when settles race for the same Kindled', async () => {
    const k = await newKindled();
    await holding.work(k, 'twisted-trees', at(0));
    const results = await race(RACERS, () => holding.view(k, at(40_000)));
    expect(results.every((r) => r.ok)).toBe(true);
    const r = results[0];
    if (!r?.ok) throw new Error('no answer');
    expect(r.value.baskets['twisted-trees']).toEqual([{ itemId: 'twisted-log', quantity: 10 }]);
    expect(r.value.skills.woodcutting.xp).toBe(40);
    const gathered = (await inv.ledger(k)).filter((e) => e.reason === 'gather');
    expect(gathered.reduce((s, e) => s + e.delta, 0)).toBe(10);
    await expectChains(k);
  });

  it("keeps the basket's totals when a take-all races a settle", async () => {
    const k = await newKindled();
    await holding.work(k, 'twisted-trees', at(0));
    await holding.view(k, at(20_000));
    const results = await race(RACERS, (i) =>
      i % 2 === 0 ? holding.takeAll(k, 'twisted-trees', at(40_000)) : holding.view(k, at(40_000)),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    const view = await inv.view(k);
    const inBasket = view.baskets['twisted-trees']?.[0]?.quantity ?? 0;
    const inStore = view.store.find((e) => e.itemId === 'twisted-log')?.quantity ?? 0;
    expect(inBasket + inStore).toBe(10);
    expect(inStore).toBeGreaterThanOrEqual(5);
    await expectChains(k);
  });

  it('two feeds racing on one Writ never overfill it, and the totals hold', async () => {
    const k = await newKindled();
    await holding.name(k, 'Black Rock', at(0));
    await inv.apply(
      [
        { kindledId: k, itemId: 'wild-sliver', place: 'store', delta: 4 },
        { kindledId: k, itemId: 'wild-sliver', place: 'pack', delta: 4 },
      ],
      'admin',
    );
    // Eight racers each feeding two slivers on a Writ pressed to 48 h: 48 + 96 = 144 h, so exactly one
    // two-sliver feed lands (the rest refuse: full), and no feed is counted without its items.
    const results = await race(8, () => holding.feed(k, 'wild-sliver', 2, at(0)));
    const landed = results.filter((r) => r.ok);
    expect(landed).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === 'full')).toBe(true);
    const r = landed[0];
    if (!r?.ok) throw new Error('no answer');
    expect(r.value.writ.chargeMs).toBe(144 * HOUR_MS);
    const view = await inv.view(k);
    const inStore = view.store.find((e) => e.itemId === 'wild-sliver')?.quantity ?? 0;
    const inPack = view.pack.find((e) => e.itemId === 'wild-sliver')?.quantity ?? 0;
    expect(inStore + inPack).toBe(6);
    expect(inStore).toBe(2); // the store first
    const feeds = (await inv.ledger(k)).filter((e) => e.reason === 'feed-writ');
    expect(feeds.reduce((s, e) => s + e.delta, 0)).toBe(-2);
    await expectChains(k);
    // Two days on, 96 h left: racing single slivers and Fills, exactly one sliver lands (144 h again).
    const more = await race(RACERS, (i) => (i % 2 === 0 ? holding.feed(k, 'wild-sliver', 1, at(48 * HOUR_MS)) : holding.fill(k, at(48 * HOUR_MS))));
    expect(more.filter((x) => x.ok)).toHaveLength(1);
    const final = await holding.view(k, at(48 * HOUR_MS));
    if (!final.ok) throw new Error(final.message);
    expect(final.value.writ.chargeMs).toBe(144 * HOUR_MS);
    const after = await inv.view(k);
    expect((after.store.find((e) => e.itemId === 'wild-sliver')?.quantity ?? 0) + (after.pack.find((e) => e.itemId === 'wild-sliver')?.quantity ?? 0)).toBe(5);
    await expectChains(k);
  });
});
