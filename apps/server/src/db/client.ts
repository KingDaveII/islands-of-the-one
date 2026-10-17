import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema.js';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
/** A transaction of `Database` (what `db.transaction` hands its callback); inventory.apply can run inside one. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DbHandle {
  db: Database;
  kind: 'postgres' | 'pglite';
  migrate(): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

/** Works from both src/db (tsx, vitest) and dist/db (node). */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

export interface DbOptions {
  /** Postgres URL. When omitted, PGlite is used. */
  url?: string | undefined;
  /** PGlite data directory. When omitted, PGlite runs in memory. */
  pgliteDir?: string | undefined;
}

export async function createDb(options: DbOptions = {}): Promise<DbHandle> {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url });
    const db = drizzleNodePg(pool, { schema });
    return {
      db,
      kind: 'postgres',
      migrate: () => migrateNodePg(db, { migrationsFolder: MIGRATIONS_DIR }),
      ping: async () => {
        await db.execute(sql`select 1`);
      },
      close: () => pool.end(),
    };
  }

  const client = options.pgliteDir ? new PGlite(options.pgliteDir) : new PGlite();
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  return {
    db,
    kind: 'pglite',
    migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS_DIR }),
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => client.close(),
  };
}
