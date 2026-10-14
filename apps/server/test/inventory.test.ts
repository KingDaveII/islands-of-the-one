import {
  ApiRoute,
  CURRENT_TELLING,
  isInventoryResponse,
  SESSION_COOKIE,
  type InventoryReason,
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
  parseGrantArgs,
  type Inventory,
} from '../src/inventory/index.js';

/**
 * inventory.apply on in-memory PGlite (docs/design/inventory.md). PGlite is
 * one connection: its transactions run one after another, so the
 * "concurrent" test here checks that interleaved calls queue up and stay
 * consistent, not real row locking. inventory.postgres.test.ts runs the
 * same races on a real Postgres (TEST_DATABASE_URL).
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

const balance = async (kindledId: string, itemId: string): Promise<number> =>
  (await inv.holdings(kindledId)).find((h) => h.itemId === itemId)?.quantity ?? 0;

beforeAll(async () => {
  handle = await createDb();
  await handle.migrate();
  inv = createInventory(handle.db);
});
afterAll(async () => {
  await handle.close();
});

describe('inventory.apply', () => {
  it('applies changes and writes one ledger row per change', async () => {
    const k = await newKindled();
    const first = await inv.apply(
      [
        { kindledId: k, itemId: 'sealed-gin', delta: 30 },
        { kindledId: k, itemId: 'twisted-log', delta: 5 },
      ],
      'grant',
    );
    expect(first).toMatchObject({ ok: true, duplicate: false });
    const second = await inv.apply([{ kindledId: k, itemId: 'sealed-gin', delta: -12 }], 'craft');
    expect(second.ok).toBe(true);

    expect(await inv.holdings(k)).toEqual([
      { itemId: 'sealed-gin', quantity: 18 },
      { itemId: 'twisted-log', quantity: 5 },
    ]);
    const ledger = await inv.ledger(k);
    expect(ledger).toMatchObject([
      { itemId: 'sealed-gin', delta: 30, balanceAfter: 30, reason: 'grant', ref: null },
      { itemId: 'twisted-log', delta: 5, balanceAfter: 5, reason: 'grant' },
      { itemId: 'sealed-gin', delta: -12, balanceAfter: 18, reason: 'craft' },
    ]);
    for (const row of ledger) {
      expect(row.tellingId).toBe(CURRENT_TELLING);
      expect(row.createdAt).toBeInstanceOf(Date);
    }
  });

  it('stamps the Telling it was created with', async () => {
    const k = await newKindled();
    const other = createInventory(handle.db, { telling: 'telling-2' });
    await other.apply([{ kindledId: k, itemId: 'pale-grain', delta: 1 }], 'harvest');
    expect((await inv.ledger(k))[0]?.tellingId).toBe('telling-2');
  });

  it('refuses the whole set when any balance would go below zero', async () => {
    const k = await newKindled();
    await inv.apply([{ kindledId: k, itemId: 'black-stone', delta: 10 }], 'gather');
    const result = await inv.apply(
      [
        { kindledId: k, itemId: 'black-stone', delta: -4 },
        { kindledId: k, itemId: 'wild-sliver', delta: 2 },
        { kindledId: k, itemId: 'grey-seeds', delta: -1 },
      ],
      'craft',
    );
    expect(result).toMatchObject({
      ok: false,
      error: 'insufficient',
      change: { itemId: 'grey-seeds', delta: -1 },
    });
    expect(await inv.holdings(k)).toEqual([{ itemId: 'black-stone', quantity: 10 }]);
    expect(await inv.ledger(k)).toHaveLength(1);
  });

  it('refuses a balance past the stack limit; currency has none', async () => {
    const k = await newKindled();
    expect(
      (await inv.apply([{ kindledId: k, itemId: 'twisted-log', delta: 9999 }], 'admin')).ok,
    ).toBe(true);
    const over = await inv.apply(
      [
        { kindledId: k, itemId: 'sealed-gin', delta: 5 },
        { kindledId: k, itemId: 'twisted-log', delta: 1 },
      ],
      'gather',
    );
    expect(over).toMatchObject({
      ok: false,
      error: 'stack-limit',
      change: { itemId: 'twisted-log' },
    });
    expect(await balance(k, 'sealed-gin')).toBe(0);
    const lots = 2 ** 40;
    expect(
      (await inv.apply([{ kindledId: k, itemId: 'sealed-gin', delta: lots }], 'admin')).ok,
    ).toBe(true);
    expect(await balance(k, 'sealed-gin')).toBe(lots);
  });

  it('applies a change set with a ref once', async () => {
    const k = await newKindled();
    const changes = [{ kindledId: k, itemId: 'deep-glass', delta: 3 }];
    const first = await inv.apply(changes, 'harvest', 'harvest:field:42');
    const again = await inv.apply(changes, 'harvest', 'harvest:field:42');
    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(again.ok && first.ok && again.entries).toEqual(first.ok && first.entries);
    expect(await balance(k, 'deep-glass')).toBe(3);
    expect(await inv.ledger(k)).toHaveLength(1);
    // A refused set leaves its ref free.
    const refused = await inv.apply(
      [{ kindledId: k, itemId: 'deep-glass', delta: -9 }],
      'feed-writ',
      'writ:7',
    );
    expect(refused.ok).toBe(false);
    await inv.apply([{ kindledId: k, itemId: 'deep-glass', delta: -1 }], 'feed-writ', 'writ:7');
    expect(await balance(k, 'deep-glass')).toBe(2);
  });

  it('moves items between two Kindleds in one transaction (a trade)', async () => {
    const a = await newKindled();
    const b = await newKindled();
    await inv.apply(
      [
        { kindledId: a, itemId: 'sealed-gin', delta: 20 },
        { kindledId: b, itemId: 'glass-chip', delta: 4 },
      ],
      'grant',
    );
    const trade = [
      { kindledId: a, itemId: 'sealed-gin', delta: -16 },
      { kindledId: b, itemId: 'sealed-gin', delta: 16 },
      { kindledId: b, itemId: 'glass-chip', delta: -4 },
      { kindledId: a, itemId: 'glass-chip', delta: 4 },
    ];
    expect((await inv.apply(trade, 'trade', 'trade:1')).ok).toBe(true);
    expect(await inv.holdings(a)).toEqual([
      { itemId: 'sealed-gin', quantity: 4 },
      { itemId: 'glass-chip', quantity: 4 },
    ]);
    expect(await inv.holdings(b)).toEqual([{ itemId: 'sealed-gin', quantity: 16 }]);
    // B can't pay twice: the whole trade is refused, A keeps everything.
    const again = await inv.apply(trade, 'trade', 'trade:2');
    expect(again).toMatchObject({ ok: false, error: 'insufficient' });
    expect(await balance(a, 'sealed-gin')).toBe(4);
  });

  it('queues interleaved calls on one row and keeps every balance', async () => {
    const k = await newKindled();
    await Promise.all(
      Array.from({ length: 25 }, () =>
        inv.apply([{ kindledId: k, itemId: 'wild-sliver', delta: 1 }], 'gather'),
      ),
    );
    const debits = await Promise.all(
      Array.from({ length: 30 }, () =>
        inv.apply([{ kindledId: k, itemId: 'wild-sliver', delta: -1 }], 'feed-writ'),
      ),
    );
    expect(debits.filter((r) => r.ok)).toHaveLength(25);
    expect(debits.filter((r) => !r.ok && r.error === 'insufficient')).toHaveLength(5);
    expect(await balance(k, 'wild-sliver')).toBe(0);
    const after = (await inv.ledger(k)).map((r) => r.balanceAfter);
    expect(after).toEqual([
      ...Array.from({ length: 25 }, (_, i) => i + 1),
      ...Array.from({ length: 25 }, (_, i) => 24 - i),
    ]);
  });

  it('refuses an unknown Kindled', async () => {
    const result = await inv.apply(
      [{ kindledId: '00000000-0000-4000-8000-000000000000', itemId: 'sealed-gin', delta: 1 }],
      'grant',
    );
    expect(result).toMatchObject({ ok: false, error: 'unknown-kindled' });
  });

  it('throws on malformed calls', async () => {
    const k = await newKindled();
    const bad: [Parameters<Inventory['apply']>[0], string, string?][] = [
      [[], 'grant'],
      [[{ kindledId: k, itemId: 'sealed-gin', delta: 1 }], 'theft'],
      [[{ kindledId: k, itemId: 'gold', delta: 1 }], 'grant'],
      [[{ kindledId: k, itemId: 'sealed-gin', delta: 0 }], 'grant'],
      [[{ kindledId: k, itemId: 'sealed-gin', delta: 1.5 }], 'grant'],
      [[{ kindledId: 'nobody', itemId: 'sealed-gin', delta: 1 }], 'grant'],
      [
        [
          { kindledId: k, itemId: 'sealed-gin', delta: 1 },
          { kindledId: k, itemId: 'sealed-gin', delta: 2 },
        ],
        'grant',
      ],
      [[{ kindledId: k, itemId: 'sealed-gin', delta: 1 }], 'grant', ''],
    ];
    for (const [changes, reason, ref] of bad)
      // 'theft' is deliberately not an InventoryReason: apply checks at run time too.
      await expect(inv.apply(changes, reason as InventoryReason, ref)).rejects.toBeInstanceOf(
        InventoryInputError,
      );
    expect(await inv.ledger(k)).toEqual([]);
  });

  it('cascades with the Kindled', async () => {
    const k = await newKindled('gone');
    await inv.apply([{ kindledId: k, itemId: 'sealed-gin', delta: 1 }], 'grant');
    await handle.db.delete(accounts).where(eq(accounts.username, 'gone'));
    expect(await inv.holdings(k)).toEqual([]);
    expect(await inv.ledger(k)).toEqual([]);
  });
});

describe('inv:grant', () => {
  it('parses its arguments', () => {
    expect(parseGrantArgs(['Alice', 'sealed-gin', '10'])).toEqual({
      ok: true,
      args: { username: 'alice', itemId: 'sealed-gin', quantity: 10 },
    });
    expect(parseGrantArgs(['--', 'alice', 'black-stone', '-3'])).toMatchObject({
      ok: true,
      args: { quantity: -3 },
    });
    for (const argv of [
      [],
      ['alice', 'sealed-gin'],
      ['alice', 'gold', '1'],
      ['alice', 'sealed-gin', '0'],
      ['alice', 'sealed-gin', '1.5'],
      ['alice', 'sealed-gin', 'ten'],
      ['a', 'sealed-gin', '1'],
    ])
      expect(parseGrantArgs(argv).ok, argv.join(' ')).toBe(false);
  });

  it('grants by username through apply, with reason admin', async () => {
    const k = await newKindled('granted');
    const args = { username: 'granted', itemId: 'pale-grain', quantity: 40 };
    const result = await grantByUsername(handle.db, inv, args);
    expect(result).toMatchObject({ ok: true, entry: { balanceAfter: 40, reason: 'admin' } });
    expect(await balance(k, 'pale-grain')).toBe(40);
    const take = await grantByUsername(handle.db, inv, { ...args, quantity: -50 });
    expect(take).toMatchObject({ ok: false });
    expect(await grantByUsername(handle.db, inv, { ...args, username: 'nobody' })).toMatchObject({
      ok: false,
      message: 'no Kindled for username nobody',
    });
  });
});

describe('GET /api/inventory', () => {
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

  it("answers the signed-in Kindled's items, from the cookie only", async () => {
    expect((await get()).json()).toMatchObject({ error: 'not-signed-in' });

    const reg = await post(ApiRoute.Register, { username: 'holder', password: 'correct horse' });
    const setCookie = reg.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0] ?? '';
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    const none = await get(cookie);
    expect(none.statusCode).toBe(404);
    expect(none.json()).toMatchObject({ error: 'no-kindled' });

    await post(ApiRoute.Kindled, { name: 'Iltani', remembrance: 'tide' }, cookie);
    const empty = await get(cookie);
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ items: [] });

    const local = createInventory(db.db);
    await grantByUsername(db.db, local, { username: 'holder', itemId: 'twisted-log', quantity: 5 });
    await grantByUsername(db.db, local, { username: 'holder', itemId: 'sealed-gin', quantity: 12 });
    await grantByUsername(db.db, local, { username: 'holder', itemId: 'grey-seeds', quantity: 2 });
    await grantByUsername(db.db, local, { username: 'holder', itemId: 'grey-seeds', quantity: -2 });
    const res = await get(cookie);
    expect(res.headers['cache-control']).toBe('no-store');
    const body: unknown = res.json();
    expect(isInventoryResponse(body)).toBe(true);
    // items.json order; items at 0 are left out.
    expect(body).toEqual({
      items: [
        { item: 'sealed-gin', quantity: 12 },
        { item: 'twisted-log', quantity: 5 },
      ],
    });
  });
});
