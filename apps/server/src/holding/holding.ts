import {
  basketPlace,
  HOLDING_LAYOUT_ID,
  holdingLayout,
  InventoryReason,
  itemDef,
  MAX_QUANTITY,
  OFFLINE_CAP_MS,
  skillProgress,
  SKILLS,
  stationDef,
  storeLimitOf,
  type HoldingResponse,
  type HoldingTake,
  type InventoryEntry,
  type Skill,
  type SkillView,
  type StationDef,
} from '@iot/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { holdingActivity, kindled, skillXp, type HoldingActivityRow, type KindledRow } from '../db/schema.js';
import type { Inventory } from '../inventory/index.js';

/**
 * The holding's active action (docs/design/holding.md): one per Kindled,
 * settled on every holding request. Nothing ticks in the background: the
 * server computes what a stretch of work produced when it is next asked, in
 * one transaction with the Kindled's row and the activity row locked, credits
 * the yield into the station's basket through `inventory.apply` (reason
 * `gather`, inside the same transaction) and the XP into `skill_xp`, and
 * restarts the cycle clock when the time away went past the cap, so lost
 * time is never paid later.
 */

/**
 * Whether a Kindled's stations keep earning while it is away. A Writ that is
 * dark (Task 4) stops offline earning; today every Writ counts as lit.
 */
// The Kindled is here for Task 4 to read its Writ.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Task 4 reads the Writ
export function offlineAllowed(_kindled: Pick<KindledRow, 'id'>): boolean {
  return true;
}

/**
 * Whether a Kindled stands close enough to a station to work it or take from
 * it. Positions on the holding are the client's (M2 holdings are private and
 * nothing of value depends on where you stand), so the server only checks
 * that the station exists in the layout; visits (later) make this real.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- visits read where the Kindled is
export function inRange(_kindled: Pick<KindledRow, 'id'>, _stationId: string): boolean {
  return true;
}

/**
 * While a Writ is dark a stretch still counts the heartbeat's own gap, so
 * online play never loses a partial cycle to a 30 s heartbeat: twice the
 * heartbeat.
 */
export const ONLINE_GRACE_MS = 2 * 30_000;

export type HoldingError = 'unknown-kindled' | 'unknown-station' | 'no-action';

export type HoldingResult =
  | { ok: true; value: HoldingResponse }
  | { ok: false; error: HoldingError; message: string };

export interface Holding {
  /** Settle, then answer GET /api/holding. */
  view(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then start (or switch to) working a station with an action. */
  work(kindledId: string, stationId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then clear the action. */
  stop(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then move what fits of a station's basket into the store. */
  takeAll(kindledId: string, stationId: string, now: Date): Promise<HoldingResult>;
  /** Settle alone (tests and the API's inventory routes). */
  settle(kindledId: string, now: Date): Promise<void>;
}

/** What a settle credited: the cycles paid this time, and whether the clock restarted after a capped stretch. */
export interface Settlement {
  credited: number;
  restarted: boolean;
}

/**
 * The cycles a stretch of work completed by `end`, minus those already paid,
 * and whether `end` fell short of `now` (time beyond the cap, lost).
 */
export function settleMath(
  row: Pick<HoldingActivityRow, 'startedAt' | 'creditedCycles' | 'lastSeenAt'>,
  cycleMs: number,
  now: Date,
  horizonMs: number,
): { end: Date; cycles: number; due: number; lost: boolean } {
  const end = new Date(Math.min(now.getTime(), row.lastSeenAt.getTime() + horizonMs));
  const cycles = Math.max(0, Math.floor((end.getTime() - row.startedAt.getTime()) / cycleMs));
  return { end, cycles, due: Math.max(0, cycles - row.creditedCycles), lost: end.getTime() < now.getTime() };
}

/** The idempotency ref of one settle's credit: the stretch (Kindled, start) and the cycles it pays. */
export function settleRef(kindledId: string, startedAt: Date, from: number, to: number): string {
  return `act:${kindledId}:${startedAt.getTime()}:${from}-${to}`;
}

/** How many of a basket's stack fit in the store beside what is already there. */
export function fitsInStore(itemId: string, inStore: number, inBasket: number): number {
  const def = itemDef(itemId);
  const limit = Math.min(def?.stackLimit ?? MAX_QUANTITY, storeLimitOf(itemId));
  return Math.max(0, Math.min(inBasket, limit - inStore));
}

export function createHolding(db: Database, inventory: Inventory): Holding {
  const layout = holdingLayout(HOLDING_LAYOUT_ID);

  /** The station a request names, when it is in the layout. */
  const stationIn = (stationId: string): StationDef | undefined =>
    layout.stations.some((s) => s.id === stationId) ? stationDef(stationId) : undefined;

  /** The Kindled's row, locked for the rest of the transaction (every holding change queues behind it). */
  async function lockKindled(tx: Transaction, kindledId: string): Promise<KindledRow | undefined> {
    const [row] = await tx.select().from(kindled).where(eq(kindled.id, kindledId)).for('no key update');
    return row;
  }

  /**
   * The settle, inside a transaction holding the Kindled's lock: the activity
   * row locked FOR UPDATE, the completed cycles since the last credit paid
   * into the basket and the skill, the clock restarted after lost time, the
   * heartbeat refreshed. Nothing to do without a row.
   */
  async function settleIn(tx: Transaction, k: KindledRow, now: Date): Promise<Settlement> {
    const [row] = await tx.select().from(holdingActivity).where(eq(holdingActivity.kindledId, k.id)).for('update');
    if (!row) return { credited: 0, restarted: false };
    const station = stationDef(row.stationId);
    const action = station?.action;
    if (!action) {
      // A station that left the data (never today): the stretch is over.
      await tx.delete(holdingActivity).where(eq(holdingActivity.kindledId, k.id));
      return { credited: 0, restarted: true };
    }
    const horizon = offlineAllowed(k) ? OFFLINE_CAP_MS : ONLINE_GRACE_MS;
    const { cycles, due, lost } = settleMath(row, action.cycleMs, now, horizon);
    if (due > 0) {
      const ref = settleRef(k.id, row.startedAt, row.creditedCycles, cycles);
      const credit = await inventory.apply(
        [{ kindledId: k.id, itemId: action.itemId, place: basketPlace(station.id), delta: due * action.quantity }],
        InventoryReason.Gather,
        { ref, tx },
      );
      // A basket has no limit, so the one refusal left is a Kindled that is gone; the settle has nothing to credit then.
      if (!credit.ok) throw new Error(`settle: ${credit.message}`);
      await tx
        .insert(skillXp)
        .values({ kindledId: k.id, skill: action.skill, xp: due * action.xp })
        .onConflictDoUpdate({
          target: [skillXp.kindledId, skillXp.skill],
          set: { xp: sql`${skillXp.xp} + ${due * action.xp}` },
        });
    }
    await tx
      .update(holdingActivity)
      .set(
        lost
          ? // Beyond the cap: the time from the cap to now is lost, so the cycle clock starts afresh.
            { startedAt: now, creditedCycles: 0, lastSeenAt: now }
          : { creditedCycles: cycles, lastSeenAt: now },
      )
      .where(eq(holdingActivity.kindledId, k.id));
    return { credited: due, restarted: lost };
  }

  /** What GET /api/holding answers, read inside the transaction after the settle. */
  async function answer(tx: Transaction, k: KindledRow, now: Date, take?: HoldingTake): Promise<HoldingResponse> {
    const view = await inventory.view(k.id, tx);
    const baskets: Record<string, InventoryEntry[]> = {};
    for (const s of layout.stations) baskets[s.id] = view.baskets[s.id] ?? [];
    const [row] = await tx.select().from(holdingActivity).where(eq(holdingActivity.kindledId, k.id));
    const action = row ? stationDef(row.stationId)?.action : undefined;
    const activity = row && action ? { stationId: row.stationId, startedAt: row.startedAt.toISOString(), cycleMs: action.cycleMs } : null;
    const rows = await tx
      .select()
      .from(skillXp)
      .where(and(eq(skillXp.kindledId, k.id), inArray(skillXp.skill, [...SKILLS])))
      .orderBy(asc(skillXp.skill));
    const skills = {} as Record<Skill, SkillView>;
    for (const skill of SKILLS) skills[skill] = skillProgress(rows.find((r) => r.skill === skill)?.xp ?? 0);
    const out: HoldingResponse = { layoutId: layout.id, baskets, activity, now: now.toISOString(), skills };
    if (take) out.take = take;
    return out;
  }

  /** One holding request: the Kindled locked, the action settled, then `body`, then the answer. */
  async function request(
    kindledId: string,
    now: Date,
    body: (tx: Transaction, k: KindledRow) => Promise<HoldingTake | undefined | { refused: HoldingResult }>,
  ): Promise<HoldingResult> {
    return db.transaction(async (tx) => {
      const k = await lockKindled(tx, kindledId);
      if (!k) return { ok: false, error: 'unknown-kindled', message: 'No such Kindled.' };
      await settleIn(tx, k, now);
      const result = await body(tx, k);
      if (result && 'refused' in result) return result.refused;
      return { ok: true, value: await answer(tx, k, now, result) };
    });
  }

  const unknownStation = (stationId: string): { refused: HoldingResult } => ({
    refused: { ok: false, error: 'unknown-station', message: `No station ${stationId} on this holding.` },
  });

  return {
    view: (kindledId, now) => request(kindledId, now, () => Promise.resolve(undefined)),

    work: (kindledId, stationId, now) =>
      request(kindledId, now, async (tx, k) => {
        const station = stationIn(stationId);
        if (!station) return unknownStation(stationId);
        if (!station.action) return { refused: { ok: false, error: 'no-action', message: `Nothing to work at the ${station.name}.` } };
        if (!inRange(k, stationId)) return unknownStation(stationId);
        // The old stretch was settled above; this one starts now.
        await tx
          .insert(holdingActivity)
          .values({ kindledId: k.id, stationId, startedAt: now, creditedCycles: 0, lastSeenAt: now })
          .onConflictDoUpdate({
            target: holdingActivity.kindledId,
            set: { stationId, startedAt: now, creditedCycles: 0, lastSeenAt: now },
          });
        return undefined;
      }),

    stop: (kindledId, now) =>
      request(kindledId, now, async (tx, k) => {
        await tx.delete(holdingActivity).where(eq(holdingActivity.kindledId, k.id));
        return undefined;
      }),

    takeAll: (kindledId, stationId, now) =>
      request(kindledId, now, async (tx, k) => {
        const station = stationIn(stationId);
        if (!station) return unknownStation(stationId);
        if (!inRange(k, stationId)) return unknownStation(stationId);
        // Under the Kindled's lock no other change set runs, so what fits now still fits when the move is judged.
        const held = await inventory.holdings(k.id, tx);
        const basket = basketPlace(station.id);
        const moved: InventoryEntry[] = [];
        const left: InventoryEntry[] = [];
        for (const h of held.filter((x) => x.place === basket)) {
          const inStore = held.find((x) => x.place === 'store' && x.itemId === h.itemId)?.quantity ?? 0;
          const fits = fitsInStore(h.itemId, inStore, h.quantity);
          if (fits > 0) {
            const result = await inventory.apply(
              [
                { kindledId: k.id, itemId: h.itemId, place: basket, delta: -fits },
                { kindledId: k.id, itemId: h.itemId, place: 'store', delta: fits },
              ],
              InventoryReason.Move,
              { tx },
            );
            if (!result.ok) throw new Error(`take-all: ${result.message}`);
            moved.push({ itemId: h.itemId, quantity: fits });
          }
          if (h.quantity - fits > 0) left.push({ itemId: h.itemId, quantity: h.quantity - fits });
        }
        return { stationId: station.id, moved, left };
      }),

    settle: async (kindledId, now) => {
      await db.transaction(async (tx) => {
        const k = await lockKindled(tx, kindledId);
        if (k) await settleIn(tx, k, now);
      });
    },
  };
}
