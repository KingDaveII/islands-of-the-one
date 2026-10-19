import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { createInventory } from '../src/inventory/index.js';

const { accounts } = schema;

/**
 * Migration 0003 (M2 Task 3a) copies Task 2's `items` rows into
 * `item_stacks`: currency to the purse, everything else to the store. This
 * test migrates to 0002, seeds `items` the way Task 2's code did, then
 * applies the rest. It is the one test outside the inventory module that
 * may name the retired table in SQL (inventory-boundary.test.ts exempts it).
 */
describe('migration 0003: items into places', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let upTo0002: string;

  beforeAll(async () => {
    // A migrations folder holding only 0000-0002 (the journal cut after idx 2).
    upTo0002 = mkdtempSync(join(tmpdir(), 'iot-migrations-'));
    mkdirSync(join(upTo0002, 'meta'));
    const journal = JSON.parse(
      readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
    ) as {
      entries: { idx: number; tag: string }[];
    };
    journal.entries = journal.entries.filter((e) => e.idx <= 2);
    writeFileSync(join(upTo0002, 'meta', '_journal.json'), JSON.stringify(journal));
    for (const e of journal.entries)
      writeFileSync(
        join(upTo0002, `${e.tag}.sql`),
        readFileSync(join(MIGRATIONS_DIR, `${e.tag}.sql`)),
      );
    client = new PGlite();
    await client.waitReady;
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: upTo0002 });
  });
  afterAll(async () => {
    await client.close();
    rmSync(upTo0002, { recursive: true, force: true });
  });

  it('puts currency in the purse and the rest in the store, then the module reads them', async () => {
    const [account] = await db
      .insert(accounts)
      .values({ username: 'old', passwordHash: 'x' })
      .returning();
    // Raw SQL: the schema object names columns later migrations add (run_weapon, 0010), which this database lacks.
    const inserted = await db.execute<{ id: string }>(
      sql`insert into kindled (account_id, name, remembrance, clay_tone) values (${account?.id ?? ''}, 'Old Tally', 'clay', 'clay-pale') returning id`,
    );
    const id = inserted.rows[0]?.id ?? '';
    // Task 2's rows: one balance per item, and ledger rows without a place.
    await db.execute(sql`insert into items (kindled_id, item_id, quantity) values
      (${id}, 'sealed-gin', 120), (${id}, 'black-stone', 30), (${id}, 'grey-seeds', 0)`);
    await db.execute(sql`insert into item_ledger (kindled_id, item_id, delta, balance_after, reason, ref, telling_id) values
      (${id}, 'sealed-gin', 120, 120, 'admin', 'grant:1', 'telling-1'), (${id}, 'black-stone', 30, 30, 'admin', null, 'telling-1')`);

    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

    const inv = createInventory(db);
    expect(await inv.view(id)).toEqual({
      purse: [{ itemId: 'sealed-gin', quantity: 120 }],
      pack: [],
      store: [{ itemId: 'black-stone', quantity: 30 }],
      baskets: {},
    });
    const ledger = await inv.ledger(id);
    expect(ledger.map((r) => r.place)).toEqual([null, null]);
    // The old copy stays as it was (retired, dropped by a later contract migration).
    const old: unknown = await db.execute(sql`select count(*)::int as n from items`);
    expect((old as { rows: { n: number }[] }).rows[0]?.n).toBe(3);
    // New changes go to places and get ledger rows with one; a ref reused from before is a duplicate.
    const again = await inv.apply(
      [{ kindledId: id, itemId: 'sealed-gin', place: 'purse', delta: 5 }],
      'grant',
      { ref: 'grant:1' },
    );
    expect(again).toMatchObject({ ok: true, duplicate: true });
    const fresh = await inv.apply(
      [{ kindledId: id, itemId: 'black-stone', place: 'pack', delta: 5 }],
      'grant',
    );
    expect(fresh).toMatchObject({ ok: true, entries: [{ place: 'pack', balanceAfter: 5 }] });
    expect(await inv.view(id)).toMatchObject({ pack: [{ itemId: 'black-stone', quantity: 5 }] });
  });
});
