import { AWAY_CARD_MIN_MS, isSkill, levelFromXp, SKILLS, type AwayCard, type AwayLevel, type InventoryEntry, type Skill } from '@iot/shared';
import { and, eq } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { awayCards, skillXp, type AwayCardRow } from '../db/schema.js';

/**
 * The While you were away card on the server (docs/design/holding.md "Sleep,
 * the away card and toasts", M2 Task 7). The settle (holding.ts) finds the
 * absence, `now − writs.last_seen_at` before the heartbeat refreshes it,
 * and when it is `awayCardMinMs` or more records what the stretch made:
 * what each place credited into its basket (the active action's due cycles
 * and the basket cycles, summed per place) and the skills whose level rose
 * (`levelFromXp` on the XP read before and after the settle). One row per
 * Kindled in `away_cards`; a row still there when another absence is
 * recorded merges with it (the earlier `from_at`, the later `to_at`, `made`
 * summed per place, `levels` keeping the earliest `from` and the latest
 * `to`). The card moves no items. POST /api/holding/away/seen deletes the
 * row only while its `to_at` still equals the `to` the client saw, so an
 * absence merged in after the card was drawn survives the dismissal.
 */

/** What a place credited into its basket over the absence, by station or plot id. */
export type AwayMade = Record<string, InventoryEntry>;
/** The skills whose level rose over the absence. */
export type AwayLevels = Partial<Record<Skill, AwayLevel>>;

/** One absence as the settle records it. */
export interface AwayRecord {
  fromAt: Date;
  toAt: Date;
  made: AwayMade;
  levels: AwayLevels;
}

/** One credit a settle reports: a place, the item and how many landed in its basket. */
export interface AwayCredit {
  place: string;
  itemId: string;
  quantity: number;
}

/** Whether the gap between the holding-wide last heartbeat and now is an absence the card sums up (never for a Kindled never seen). */
export function isAbsence(lastSeenAt: Date | null, now: Date, minMs: number = AWAY_CARD_MIN_MS): boolean {
  return lastSeenAt !== null && now.getTime() - lastSeenAt.getTime() >= minMs;
}

/** The credits summed per place (counts of 0 dropped). A place yields one kind of item in M2; a later credit of another kind replaces the earlier. */
export function sumMade(credits: readonly AwayCredit[]): AwayMade {
  const made: AwayMade = {};
  for (const c of credits) {
    if (c.quantity <= 0) continue;
    const have = made[c.place];
    made[c.place] = have && have.itemId === c.itemId ? { itemId: c.itemId, quantity: have.quantity + c.quantity } : { itemId: c.itemId, quantity: c.quantity };
  }
  return made;
}

/** The skills whose level rose between two XP readings (by skill), from the level before to the level after. */
export function levelsGained(before: Partial<Record<Skill, number>>, after: Partial<Record<Skill, number>>): AwayLevels {
  const levels: AwayLevels = {};
  for (const skill of SKILLS) {
    const from = levelFromXp(before[skill] ?? 0);
    const to = levelFromXp(after[skill] ?? 0);
    if (to > from) levels[skill] = { from, to };
  }
  return levels;
}

/** Two absences as one: the earlier start, the later end, the counts summed per place, each skill from its earliest level to its latest. */
export function mergeAway(earlier: AwayRecord, later: AwayRecord): AwayRecord {
  const made = sumMade([
    ...Object.entries(earlier.made).map(([place, e]) => ({ place, ...e })),
    ...Object.entries(later.made).map(([place, e]) => ({ place, ...e })),
  ]);
  const levels: AwayLevels = { ...earlier.levels };
  for (const skill of SKILLS) {
    const a = earlier.levels[skill];
    const b = later.levels[skill];
    if (!b) continue;
    levels[skill] = a ? { from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) } : b;
  }
  return {
    fromAt: earlier.fromAt.getTime() <= later.fromAt.getTime() ? earlier.fromAt : later.fromAt,
    toAt: earlier.toAt.getTime() >= later.toAt.getTime() ? earlier.toAt : later.toAt,
    made,
    levels,
  };
}

/** The Kindled's XP by skill, as the settle reads it before and after (0 without a row). */
export async function readXp(tx: Transaction, kindledId: string): Promise<Partial<Record<Skill, number>>> {
  const rows = await tx.select({ skill: skillXp.skill, xp: skillXp.xp }).from(skillXp).where(eq(skillXp.kindledId, kindledId));
  const out: Partial<Record<Skill, number>> = {};
  for (const r of rows) if (isSkill(r.skill)) out[r.skill] = r.xp;
  return out;
}

/** The row as a record (the jsonb columns read back; an unknown skill in `levels` is dropped). */
export function recordOf(row: AwayCardRow): AwayRecord {
  const levels: AwayLevels = {};
  for (const [skill, level] of Object.entries(row.levels)) if (isSkill(skill)) levels[skill] = level;
  return { fromAt: row.fromAt, toAt: row.toAt, made: row.made, levels };
}

/** Writes an absence: a new row, or the merge with the row still waiting. Call under the Kindled's lock. */
export async function recordAway(tx: Transaction, kindledId: string, record: AwayRecord): Promise<AwayRecord> {
  const [existing] = await tx.select().from(awayCards).where(eq(awayCards.kindledId, kindledId)).for('update');
  const next = existing ? mergeAway(recordOf(existing), record) : record;
  await tx
    .insert(awayCards)
    .values({ kindledId, fromAt: next.fromAt, toAt: next.toAt, made: next.made, levels: next.levels })
    .onConflictDoUpdate({ target: awayCards.kindledId, set: { fromAt: next.fromAt, toAt: next.toAt, made: next.made, levels: next.levels } });
  return next;
}

/** The card waiting for a Kindled, if any. */
export async function awayCardOf(db: Database | Transaction, kindledId: string): Promise<AwayCardRow | undefined> {
  const [row] = await db.select().from(awayCards).where(eq(awayCards.kindledId, kindledId));
  return row;
}

/** The row on the wire (the card's Writ line reads the answer's own Writ view). */
export function awayCardView(row: AwayCardRow): AwayCard {
  const record = recordOf(row);
  return { from: record.fromAt.toISOString(), to: record.toAt.toISOString(), made: record.made, levels: record.levels };
}

/** Dismisses the card: the row goes only while its `to_at` still equals `to`. Whether a row went. */
export async function clearAway(db: Database | Transaction, kindledId: string, to: Date): Promise<boolean> {
  const gone = await db
    .delete(awayCards)
    .where(and(eq(awayCards.kindledId, kindledId), eq(awayCards.toAt, to)))
    .returning({ kindledId: awayCards.kindledId });
  return gone.length > 0;
}
