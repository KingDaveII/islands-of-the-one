import { validateUsername } from '@iot/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { accounts, basketCycles, holdingActivity, kindled, writs } from '../db/schema.js';

/**
 * The playtest "away" hook (docs/design/holding.md): moves a Kindled's clocks
 * back in time, as if it had been away that long: the active action's
 * `started_at` and `last_seen_at`, the holding-wide last heartbeat on the
 * Writ row and every basket cycle's `cycled_until` (M2 Task 5), so the next
 * holding request settles the stretch as offline time. OPERATIONS only, on
 * the host; there is no player-facing way to do this, and it writes nothing
 * but those times.
 */
export const AWAY_USAGE = 'usage: holding:away <username> <hours>   (hours: a positive number; moves the active action and the basket cycles back that far)';

export interface AwayArgs {
  username: string;
  hours: number;
}

export function parseAwayArgs(argv: readonly string[]): { ok: true; args: AwayArgs } | { ok: false; message: string } {
  const rest = argv.filter((a) => a !== '--');
  if (rest.length !== 2) return { ok: false, message: AWAY_USAGE };
  const [rawUsername = '', rawHours = ''] = rest;
  const username = validateUsername(rawUsername);
  if (!username.ok) return { ok: false, message: `bad username: ${username.message}` };
  const hours = Number(rawHours);
  if (!Number.isFinite(hours) || hours <= 0) return { ok: false, message: `hours must be a positive number: ${rawHours}` };
  return { ok: true, args: { username: username.value, hours } };
}

export type AwayResult =
  | {
      ok: true;
      /** The active action moved, or null while idle. */
      activity: { stationId: string; startedAt: Date; lastSeenAt: Date } | null;
      /** The holding-wide last heartbeat after the move, or null for a Kindled never seen on the holding. */
      lastSeenAt: Date | null;
      /** The basket cycle clocks moved, by station. */
      cycles: Record<string, Date>;
    }
  | { ok: false; message: string };

export async function moveAway(db: Database, { username, hours }: AwayArgs): Promise<AwayResult> {
  const [row] = await db
    .select({ kindledId: kindled.id })
    .from(accounts)
    .innerJoin(kindled, eq(kindled.accountId, accounts.id))
    .where(eq(sql`lower(${accounts.username})`, username.toLowerCase()))
    .limit(1);
  if (!row) return { ok: false, message: `no Kindled for username ${username}` };
  const ms = Math.round(hours * 60 * 60 * 1000);
  const back = (column: unknown) => sql`${column} - make_interval(secs => ${ms / 1000})`;
  return db.transaction(async (tx) => {
    const [activity] = await tx
      .update(holdingActivity)
      .set({ startedAt: back(holdingActivity.startedAt), lastSeenAt: back(holdingActivity.lastSeenAt) })
      .where(eq(holdingActivity.kindledId, row.kindledId))
      .returning();
    const [writ] = await tx
      .update(writs)
      .set({ lastSeenAt: back(writs.lastSeenAt) })
      .where(eq(writs.kindledId, row.kindledId))
      .returning({ lastSeenAt: writs.lastSeenAt });
    const clocks = await tx
      .update(basketCycles)
      .set({ cycledUntil: back(basketCycles.cycledUntil) })
      .where(eq(basketCycles.kindledId, row.kindledId))
      .returning({ stationId: basketCycles.stationId, cycledUntil: basketCycles.cycledUntil });
    if (!activity && !writ) return { ok: false, message: `${username} has not been on the holding yet` };
    return {
      ok: true,
      activity: activity ? { stationId: activity.stationId, startedAt: activity.startedAt, lastSeenAt: activity.lastSeenAt } : null,
      lastSeenAt: writ?.lastSeenAt ?? null,
      cycles: Object.fromEntries(clocks.map((c) => [c.stationId, c.cycledUntil])),
    };
  });
}
