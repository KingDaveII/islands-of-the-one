import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type DbHandle } from '../src/db/client.js';
import { findPlayerByName, upsertPlayer } from '../src/db/players.js';

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

  it('creates and re-reads a player', async () => {
    const created = await upsertPlayer(handle.db, 'alice');
    expect(created.level).toBe(1);

    const again = await upsertPlayer(handle.db, 'alice');
    expect(again.id).toBe(created.id);

    const found = await findPlayerByName(handle.db, 'alice');
    expect(found?.id).toBe(created.id);
    expect(await findPlayerByName(handle.db, 'bob')).toBeUndefined();
  });
});
