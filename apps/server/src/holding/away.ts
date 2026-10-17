import { validateUsername } from '@iot/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { accounts, holdingActivity, kindled } from '../db/schema.js';

/**
 * The playtest "away" hook (docs/design/holding.md): moves a Kindled's active
 * action back in time, as if it had been away that long (`started_at` and
 * `last_seen_at` both shifted), so the next holding request settles the
 * stretch as offline time. OPERATIONS only, on the host; there is no
 * player-facing way to do this, and it writes nothing but the two times.
 */
export const AWAY_USAGE = 'usage: holding:away <username> <hours>   (hours: a positive number; moves the active action back that far)';

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

export type AwayResult = { ok: true; stationId: string; startedAt: Date; lastSeenAt: Date } | { ok: false; message: string };

export async function moveAway(db: Database, { username, hours }: AwayArgs): Promise<AwayResult> {
  const [row] = await db
    .select({ kindledId: kindled.id })
    .from(accounts)
    .innerJoin(kindled, eq(kindled.accountId, accounts.id))
    .where(eq(sql`lower(${accounts.username})`, username.toLowerCase()))
    .limit(1);
  if (!row) return { ok: false, message: `no Kindled for username ${username}` };
  const ms = Math.round(hours * 60 * 60 * 1000);
  const [updated] = await db
    .update(holdingActivity)
    .set({
      startedAt: sql`${holdingActivity.startedAt} - make_interval(secs => ${ms / 1000})`,
      lastSeenAt: sql`${holdingActivity.lastSeenAt} - make_interval(secs => ${ms / 1000})`,
    })
    .where(eq(holdingActivity.kindledId, row.kindledId))
    .returning();
  if (!updated) return { ok: false, message: `${username} is not working a station` };
  return { ok: true, stationId: updated.stationId, startedAt: updated.startedAt, lastSeenAt: updated.lastSeenAt };
}
