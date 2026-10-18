import { pressedEmptyAt, validateUsername } from '@iot/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { accounts, kindled, writs, type WritRow } from '../db/schema.js';

/**
 * The playtest Writ hook (docs/design/holding.md "The Writ"): sets a
 * Kindled's Writ charge and certification directly, so a lit, flickering,
 * dark or fading Writ can be seen without waiting days. OPERATIONS only, on
 * the host; nothing in the game calls it, and it writes nothing but
 * `empty_at` and `certified` (the row is pressed when the Kindled has none
 * yet).
 */
export const WRIT_SET_USAGE =
  'usage: writ:set <username> [--charge-hours N] [--dark-hours N] [--certified on|off]   (charge: empty N h from now; dark: empty N h ago; at least one option)';

export interface WritSetArgs {
  username: string;
  /** Hours from now until the charge runs out (0: dark from now). */
  chargeHours?: number;
  /** Hours since the charge ran out. */
  darkHours?: number;
  certified?: boolean;
}

export function parseWritSetArgs(argv: readonly string[]): { ok: true; args: WritSetArgs } | { ok: false; message: string } {
  const rest = argv.filter((a) => a !== '--');
  const [rawUsername, ...options] = rest;
  if (rawUsername === undefined) return { ok: false, message: WRIT_SET_USAGE };
  const username = validateUsername(rawUsername);
  if (!username.ok) return { ok: false, message: `bad username: ${username.message}` };
  const args: WritSetArgs = { username: username.value };
  for (let i = 0; i < options.length; i += 2) {
    const flag = options[i] ?? '';
    const value = options[i + 1];
    if (value === undefined) return { ok: false, message: `${flag} needs a value\n${WRIT_SET_USAGE}` };
    if (flag === '--charge-hours' || flag === '--dark-hours') {
      const hours = Number(value);
      if (!Number.isFinite(hours) || hours < 0) return { ok: false, message: `${flag} must be a non-negative number: ${value}` };
      if (flag === '--charge-hours') args.chargeHours = hours;
      else args.darkHours = hours;
    } else if (flag === '--certified') {
      if (value !== 'on' && value !== 'off') return { ok: false, message: `--certified must be on or off: ${value}` };
      args.certified = value === 'on';
    } else return { ok: false, message: `unknown option ${flag}\n${WRIT_SET_USAGE}` };
  }
  if (args.chargeHours !== undefined && args.darkHours !== undefined)
    return { ok: false, message: 'give --charge-hours or --dark-hours, not both' };
  if (args.chargeHours === undefined && args.darkHours === undefined && args.certified === undefined)
    return { ok: false, message: WRIT_SET_USAGE };
  return { ok: true, args };
}

export type WritSetResult = { ok: true; writ: WritRow } | { ok: false; message: string };

export async function setWrit(db: Database, args: WritSetArgs, now: Date = new Date()): Promise<WritSetResult> {
  const [row] = await db
    .select({ kindledId: kindled.id })
    .from(accounts)
    .innerJoin(kindled, eq(kindled.accountId, accounts.id))
    .where(eq(sql`lower(${accounts.username})`, args.username.toLowerCase()))
    .limit(1);
  if (!row) return { ok: false, message: `no Kindled for username ${args.username}` };
  const set: Partial<Pick<WritRow, 'emptyAt' | 'certified'>> = {};
  const hour = 60 * 60 * 1000;
  if (args.chargeHours !== undefined) set.emptyAt = new Date(now.getTime() + Math.round(args.chargeHours * hour));
  if (args.darkHours !== undefined) set.emptyAt = new Date(now.getTime() - Math.round(args.darkHours * hour));
  if (args.certified !== undefined) set.certified = args.certified;
  const [writ] = await db
    .insert(writs)
    .values({ kindledId: row.kindledId, emptyAt: new Date(pressedEmptyAt(now.getTime())), createdAt: now, ...set })
    .onConflictDoUpdate({ target: writs.kindledId, set })
    .returning();
  if (!writ) throw new Error('writ upsert returned nothing');
  return { ok: true, writ };
}
