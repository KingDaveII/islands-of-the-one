import { eq, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { players, type Player } from './schema.js';

/** Create the player if missing, otherwise bump last_seen_at. */
export async function upsertPlayer(db: Database, name: string): Promise<Player> {
  const [row] = await db
    .insert(players)
    .values({ name })
    .onConflictDoUpdate({ target: players.name, set: { lastSeenAt: sql`now()` } })
    .returning();
  if (!row) throw new Error(`failed to upsert player ${name}`);
  return row;
}

export async function findPlayerByName(db: Database, name: string): Promise<Player | undefined> {
  const [row] = await db.select().from(players).where(eq(players.name, name)).limit(1);
  return row;
}
