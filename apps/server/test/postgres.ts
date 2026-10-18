import { sql } from 'drizzle-orm';
import pg from 'pg';
import { createDb, type DbHandle } from '../src/db/client.js';

/**
 * The one throwaway Postgres the race tests share (TEST_DATABASE_URL, a
 * database whose name contains "test"; CI's service, cloud-setup's
 * `game_test`). Vitest runs test files in parallel, and each file wipes and
 * migrates the database, so two files on it at once would pull the tables
 * from under each other: a session-level advisory lock, held on its own
 * connection for the file's whole run, puts them in a line.
 */
const LOCK_KEY = 0x1071;

export interface TestPostgres {
  handle: DbHandle;
  /** Closes the database and lets the next file in. */
  release(): Promise<void>;
}

export async function openTestPostgres(url: string): Promise<TestPostgres> {
  if (!/test/i.test(new URL(url).pathname))
    throw new Error(`refusing to wipe ${new URL(url).pathname}: its name must contain "test"`);
  const lock = new pg.Client({ connectionString: url });
  await lock.connect();
  await lock.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  const handle = await createDb({ url });
  await handle.db.execute(sql`drop schema if exists drizzle cascade`);
  await handle.db.execute(sql`drop schema if exists public cascade`);
  await handle.db.execute(sql`create schema public`);
  await handle.migrate();
  return {
    handle,
    async release() {
      await handle.close();
      await lock.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
      await lock.end();
    },
  };
}
