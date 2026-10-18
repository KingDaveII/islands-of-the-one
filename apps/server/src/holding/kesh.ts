import { InventoryReason, keshData, M2_SCAFFOLD, nextFullOfTide, tideIndex, validateUsername, type KeshDue, type KeshView } from '@iot/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { accounts, keshGifts, kindled, type KeshGiftRow } from '../db/schema.js';
import type { Inventory } from '../inventory/index.js';
import { knowsWord, learnWord } from './words.js';

/**
 * Kesh's slivers (docs/design/holding.md "Kesh", M2 Task 4b; GAME DESIGN:
 * M2's only Sparkglass): his first sliver, once per Kindled, and one more
 * each tide while `m2Scaffold` is on (M3 turns it off when caves and wrecks
 * give glass). The `kesh_gifts` row is read and written only here, under
 * the Kindled's lock the holding's requests take; the sliver itself goes
 * through `inventory.apply` with reason `gift`, one `wild-sliver` into the
 * pack. The first sliver doesn't use up the tide's: a player who gets the
 * first today can get the tide's too (GAME DESIGN wants a Writ to go dark
 * two days after the first sliver unless fed, and the tide's sliver is the
 * M2 way to keep it fed).
 */

/** What Kesh gives: one wild sliver, into the pack. */
export const KESH_GIFT_ITEM = 'wild-sliver';
export const KESH_GIFT_PLACE = 'pack';

/** The refusals. */
export const KESH_NOT_DUE = 'Nothing due from Kesh.';
export const KESH_PACK_FULL = 'Pack full.';

/**
 * The Kindled's gift row, created empty when there is none, locked FOR
 * UPDATE for the rest of the transaction. Call under the Kindled's own lock.
 */
export async function lockGifts(tx: Transaction, kindledId: string): Promise<KeshGiftRow> {
  await tx.insert(keshGifts).values({ kindledId }).onConflictDoNothing();
  const [row] = await tx.select().from(keshGifts).where(eq(keshGifts.kindledId, kindledId)).for('update');
  if (!row) throw new Error(`kesh: no gift row for Kindled ${kindledId}`);
  return row;
}

/**
 * Which sliver is due at `now`, from the row: the first while it hasn't
 * been given; else this tide's while `m2Scaffold` is on and `last_tide`
 * isn't the current tide; else none. Pure.
 */
export function keshDue(row: Pick<KeshGiftRow, 'firstSliverAt' | 'lastTide'>, now: Date, scaffold: boolean = M2_SCAFFOLD): KeshDue | null {
  if (row.firstSliverAt === null) return 'first';
  if (scaffold && row.lastTide !== tideIndex(now)) return 'tide';
  return null;
}

/**
 * What Kesh's gifts of Task 5 need to know: whether the island has a Name
 * and the Kindled knows his word (the tile is due after the Name, while it
 * doesn't), and whether a plot has been named (the seeds are due then).
 */
export interface GiftContext {
  named: boolean;
  knowsWord: boolean;
  plotNamed: boolean;
}

/** Whether the word tile is due: the island has a Name and the Kindled doesn't know the word yet (a tile given by the CLI counts as known). */
export function wordDue(ctx: Pick<GiftContext, 'named' | 'knowsWord'>): boolean {
  return ctx.named && !ctx.knowsWord;
}

/** Whether the seeds are due: a plot has been named and they haven't been given. */
export function seedsDue(row: Pick<KeshGiftRow, 'seedsGivenAt'>, ctx: Pick<GiftContext, 'plotNamed'>): boolean {
  return ctx.plotNamed && row.seedsGivenAt === null;
}

/** Kesh in the holding answer: what has been given, what is due (the sliver, the tile, the seeds), when the next tide begins. */
export function keshViewOf(
  row: Pick<KeshGiftRow, 'firstSliverAt' | 'lastTide' | 'seedsGivenAt'>,
  now: Date,
  ctx: GiftContext,
  scaffold: boolean = M2_SCAFFOLD,
): KeshView {
  return {
    firstGiven: row.firstSliverAt !== null,
    due: keshDue(row, now, scaffold),
    nextTideAt: nextFullOfTide(now).toISOString(),
    wordDue: wordDue(ctx),
    seedsDue: seedsDue(row, ctx),
  };
}

export type GiveResult = { ok: true; due: KeshDue } | { ok: false; error: 'not-due' | 'pack-full'; message: string };

/**
 * Gives the sliver that is due, under the Kindled's lock: the first sets
 * `first_sliver_at`, the tide's sets `last_tide`. A full pack refuses with
 * `pack-full` and changes nothing, so the sliver stays due.
 */
export async function giveSliver(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  now: Date,
  scaffold: boolean = M2_SCAFFOLD,
): Promise<GiveResult> {
  const row = await lockGifts(tx, kindledId);
  const due = keshDue(row, now, scaffold);
  if (due === null) return { ok: false, error: 'not-due', message: KESH_NOT_DUE };
  const given = await inventory.apply([{ kindledId, itemId: KESH_GIFT_ITEM, place: KESH_GIFT_PLACE, delta: 1 }], InventoryReason.Gift, { tx });
  if (!given.ok) {
    if (given.error === 'pack-full') return { ok: false, error: 'pack-full', message: KESH_PACK_FULL };
    throw new Error(`kesh: ${given.message}`);
  }
  await tx
    .update(keshGifts)
    .set(due === 'first' ? { firstSliverAt: now } : { lastTide: tideIndex(now) })
    .where(eq(keshGifts.kindledId, kindledId));
  return { ok: true, due };
}

export type GiftResult = { ok: true } | { ok: false; error: 'not-due' | 'pack-full'; message: string };

/**
 * Gives the word tile (Task 5), under the Kindled's lock: `gifts.word` of
 * kesh.json into `known_words`, once the island has a Name and while the
 * Kindled doesn't know it; `word_given_at` is set. Otherwise `not-due`.
 */
export async function giveWord(tx: Transaction, kindledId: string, ctx: Pick<GiftContext, 'named' | 'knowsWord'>, now: Date): Promise<GiftResult> {
  await lockGifts(tx, kindledId);
  if (!wordDue(ctx)) return { ok: false, error: 'not-due', message: KESH_NOT_DUE };
  await learnWord(tx, kindledId, keshData.gifts.word, now);
  await tx.update(keshGifts).set({ wordGivenAt: now }).where(eq(keshGifts.kindledId, kindledId));
  return { ok: true };
}

/**
 * Gives the seeds (Task 5), under the Kindled's lock: `gifts.seeds` of
 * kesh.json into the pack through `inventory.apply` (reason `gift`), once a
 * plot has been named and once; `seeds_given_at` is set. A full pack refuses
 * with `pack-full` and changes nothing, so they stay due.
 */
export async function giveSeeds(tx: Transaction, inventory: Inventory, kindledId: string, ctx: Pick<GiftContext, 'plotNamed'>, now: Date): Promise<GiftResult> {
  const row = await lockGifts(tx, kindledId);
  if (!seedsDue(row, ctx)) return { ok: false, error: 'not-due', message: KESH_NOT_DUE };
  const { itemId, quantity } = keshData.gifts.seeds;
  const given = await inventory.apply([{ kindledId, itemId, place: KESH_GIFT_PLACE, delta: quantity }], InventoryReason.Gift, { tx });
  if (!given.ok) {
    if (given.error === 'pack-full') return { ok: false, error: 'pack-full', message: KESH_PACK_FULL };
    throw new Error(`kesh: ${given.message}`);
  }
  await tx.update(keshGifts).set({ seedsGivenAt: now }).where(eq(keshGifts.kindledId, kindledId));
  return { ok: true };
}

/** Whether the Kindled knows Kesh's word, for the gift context. */
export function knowsKeshWord(tx: Transaction, kindledId: string): Promise<boolean> {
  return knowsWord(tx, kindledId, keshData.gifts.word);
}

/** The playtest reset (`kesh:reset <username>`): clears every gift column (the slivers', the tile's and the seeds'), so the first sliver can be seen again. */
export const KESH_RESET_USAGE = 'usage: kesh:reset <username>';

export function parseKeshResetArgs(argv: readonly string[]): { ok: true; username: string } | { ok: false; message: string } {
  const rest = argv.filter((a) => a !== '--');
  const [rawUsername] = rest;
  if (rawUsername === undefined || rest.length !== 1) return { ok: false, message: KESH_RESET_USAGE };
  const username = validateUsername(rawUsername);
  if (!username.ok) return { ok: false, message: `bad username: ${username.message}` };
  return { ok: true, username: username.value };
}

export type KeshResetResult = { ok: true; row: KeshGiftRow } | { ok: false; message: string };

export async function resetKesh(db: Database, username: string): Promise<KeshResetResult> {
  const [k] = await db
    .select({ kindledId: kindled.id })
    .from(accounts)
    .innerJoin(kindled, eq(kindled.accountId, accounts.id))
    .where(eq(sql`lower(${accounts.username})`, username.toLowerCase()))
    .limit(1);
  if (!k) return { ok: false, message: `no Kindled for username ${username}` };
  const cleared = { firstSliverAt: null, lastTide: null, wordGivenAt: null, seedsGivenAt: null };
  const [row] = await db
    .insert(keshGifts)
    .values({ kindledId: k.kindledId, ...cleared })
    .onConflictDoUpdate({ target: keshGifts.kindledId, set: cleared })
    .returning();
  if (!row) throw new Error('kesh_gifts upsert returned nothing');
  return { ok: true, row };
}
