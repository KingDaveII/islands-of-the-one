import { getTableName } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, kindled, sessions } from '../src/db/schema.js';

describe('database (PGlite)', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = await createDb();
    await handle.migrate();
  });

  afterAll(async () => {
    await handle.close();
  });

  it('applies migrations idempotently', async () => {
    await expect(handle.migrate()).resolves.toBeUndefined();
  });

  it('creates the account tables', async () => {
    for (const table of [accounts, sessions, kindled]) {
      await expect(handle.db.select().from(table).limit(1)).resolves.toEqual([]);
    }
    expect(getTableName(accounts)).toBe('accounts');
  });

  it('keeps usernames unique in any case', async () => {
    await handle.db.insert(accounts).values({ username: 'mira', passwordHash: 'x' });
    await expect(
      handle.db.insert(accounts).values({ username: 'MIRA', passwordHash: 'x' }),
    ).rejects.toThrow();
  });
});
