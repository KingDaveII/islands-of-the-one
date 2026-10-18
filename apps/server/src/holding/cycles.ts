import {
  basketPlace,
  creditCycles,
  cycleBonuses,
  cycleLengthMs,
  InventoryReason,
  OFFLINE_CAP_MS,
  stationDef,
  type HoldingLayout,
  type StandingPiece,
  type StationCycle,
  type WritStored,
} from '@iot/shared';
import { and, eq } from 'drizzle-orm';
import type { Transaction } from '../db/client.js';
import { basketCycles, type BasketCycleRow, type PlotPieceRow, type PlotRow } from '../db/schema.js';
import type { Inventory } from '../inventory/index.js';
import { piecesOfPlot } from './pieces.js';
import { plotEffect, plotKindOf } from './plots.js';

/**
 * The basket cycles (docs/design/holding.md "Plots" §4, M2 Task 5): the
 * passive trickle a station with a `cycle` makes on its own while the Writ
 * has charge (GAME DESIGN's "one mechanism"). Settled in the holding
 * request's transaction after the active action, under the same locks: for
 * every station with a cycle, `end = min(now, lastSeen + cap, emptyAt)`, the
 * whole cycles from `cycled_until` to `end` are credited into the station's
 * basket through `inventory.apply` (reason `harvest`, one ref per stretch so
 * it pays once), with ישן's bonus per cycle and the remainder carried in
 * permille, and the clock moves on by those cycles, or to now when the Writ
 * went dark or the cap bit (the lost time and the partial cycle are never
 * paid later). No XP. A faded plot is settled the same way: its `end` is at
 * most the moment the Writ went dark, so nothing dark is ever paid, and its
 * clock stands at now for the relight. A plot's cycle runs at the speed its
 * standing pieces give (M2 Task 6, `cycleLengthMs`): a settle pays the
 * cycles up to now at the speed the pieces had, and a build after it leaves
 * `cycled_until` where it stands, so the partial cycle carries on at the new
 * speed.
 */

/** The idempotency ref of one settle's harvest: the Kindled, the station and the stretch of cycles it pays (ms since the epoch). */
export function cycleRef(kindledId: string, stationId: string, fromMs: number, toMs: number): string {
  return `cycle:${kindledId}:${stationId}:${fromMs}-${toMs}`;
}

/**
 * The end of the stretch cycles can run to: now, the offline cap past the
 * holding-wide last heartbeat (now when there is none yet), or the moment the
 * Writ goes dark, whichever is first.
 */
export function cycleEnd(writ: Pick<WritStored, 'emptyAt'>, lastSeen: Date | null, now: Date, capMs: number = OFFLINE_CAP_MS): number {
  return Math.min(now.getTime(), (lastSeen ?? now).getTime() + capMs, writ.emptyAt);
}

/**
 * The whole cycles a clock standing at `cycledUntil` completes by `end`, never
 * negative; where the clock stands after: `cycledUntil + n × cycleMs`, or
 * `now` when `end` fell short of it (lost time).
 */
export function cycleMath(cycledUntil: number, cycleMs: number, end: number, now: number): { n: number; to: number; next: number } {
  const n = Math.max(0, Math.floor((end - cycledUntil) / cycleMs));
  const to = cycledUntil + n * cycleMs;
  return { n, to, next: end < now ? now : to };
}

/** A station with a cycle and what settles it: the yield per cycle and the Virtue's terms (none for a station of stations.json). */
export interface CyclingStation {
  stationId: string;
  cycle: StationCycle;
  /** Items per cycle: the cycle's quantity (a basket fills one item at a time; GAME DESIGN 2026-10-18). */
  yield: number;
  virtue: { effect: NonNullable<ReturnType<typeof plotEffect>>; setAt: number | null; pausedMs: number } | null;
  /** The pieces standing in the plot (none for a station of stations.json): they set the cycle's speed. */
  pieces: StandingPiece[];
}

/** The stations of a Kindled with a cycle to settle: the layout's stations with one (the trees), and its sown plots whose kind has one. */
export function cyclingStations(layout: HoldingLayout, rows: readonly PlotRow[], pieceRows: readonly PlotPieceRow[] = []): CyclingStation[] {
  const out: CyclingStation[] = [];
  for (const s of layout.stations) {
    const cycle = stationDef(s.id)?.cycle;
    if (cycle) out.push({ stationId: s.id, cycle, yield: cycle.quantity, virtue: null, pieces: [] });
  }
  for (const p of layout.plots) {
    const row = rows.find((r) => r.plotId === p.id);
    const cycle = row ? plotKindOf(row)?.cycle : undefined;
    if (!row || !cycle || row.sownAt === null) continue;
    const effect = plotEffect(row);
    out.push({
      stationId: p.id,
      cycle,
      yield: cycle.quantity,
      virtue: effect ? { effect, setAt: row.virtueSetAt?.getTime() ?? null, pausedMs: row.virtuePausedMs } : null,
      pieces: piecesOfPlot(pieceRows, p.id),
    });
  }
  return out;
}

/** The clock row of a station, created standing at `now` when there is none (the trees' first settle; nothing is paid for the time before), locked FOR UPDATE. */
export async function lockCycle(tx: Transaction, kindledId: string, stationId: string, now: Date): Promise<BasketCycleRow> {
  await tx.insert(basketCycles).values({ kindledId, stationId, cycledUntil: now, carryPermille: 0 }).onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(basketCycles)
    .where(and(eq(basketCycles.kindledId, kindledId), eq(basketCycles.stationId, stationId)))
    .for('update');
  if (!row) throw new Error(`cycles: no clock for ${stationId} of Kindled ${kindledId}`);
  return row;
}

/** What a settle of the cycles credited, by station (tests and the away card later). */
export type CycleSettlement = Record<string, number>;

/** Settles every cycling station of a Kindled (see the module comment). Call under the Kindled's, the Writ's and the plots' locks. */
export async function settleCycles(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  layout: HoldingLayout,
  writ: WritStored,
  rows: readonly PlotRow[],
  lastSeen: Date | null,
  now: Date,
  pieceRows: readonly PlotPieceRow[] = [],
): Promise<CycleSettlement> {
  const credited: CycleSettlement = {};
  const end = cycleEnd(writ, lastSeen, now);
  for (const station of cyclingStations(layout, rows, pieceRows)) {
    const clock = await lockCycle(tx, kindledId, station.stationId, now);
    const cycleMs = cycleLengthMs(station.cycle, station.pieces);
    const from = clock.cycledUntil.getTime();
    const { n, to, next } = cycleMath(from, cycleMs, end, now.getTime());
    let carry = clock.carryPermille;
    if (n > 0) {
      const bonuses = station.virtue
        ? cycleBonuses(n, from, cycleMs, station.virtue.effect, station.virtue.setAt, station.virtue.pausedMs)
        : cycleBonuses(n, from, cycleMs, null, null);
      const credit = creditCycles(station.yield, carry, bonuses);
      carry = credit.carry;
      if (credit.credited > 0) {
        const result = await inventory.apply(
          [{ kindledId, itemId: station.cycle.itemId, place: basketPlace(station.stationId), delta: credit.credited }],
          InventoryReason.Harvest,
          { ref: cycleRef(kindledId, station.stationId, from, to), tx },
        );
        // A basket has no limit, so the one refusal left is a Kindled that is gone; the settle has nothing to credit then.
        if (!result.ok) throw new Error(`harvest: ${result.message}`);
        if (!result.duplicate) credited[station.stationId] = credit.credited;
      }
    }
    if (next !== from || carry !== clock.carryPermille)
      await tx
        .update(basketCycles)
        .set({ cycledUntil: new Date(next), carryPermille: carry })
        .where(and(eq(basketCycles.kindledId, kindledId), eq(basketCycles.stationId, station.stationId)));
  }
  return credited;
}
