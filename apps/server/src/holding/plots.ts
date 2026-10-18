import {
  cycleLengthMs,
  InventoryReason,
  layoutPlot,
  PLOT_TEXT,
  plotKindDef,
  plotLevel,
  plotLine,
  plotSentenceSafe,
  RENAME_COST_GIN,
  RENAME_COST_ITEM,
  stationDef,
  wordDef,
  writView,
  yieldBonusPermille,
  type HoldingLayout,
  type PlotKindDef,
  type PlotView,
  type StationAction,
  type StationCycle,
  type StationCycleView,
  type WordDef,
  type WritLine,
  type WritLineState,
  type WritStored,
} from '@iot/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Transaction } from '../db/client.js';
import { basketCycles, plots, type BasketCycleRow, type PlotRow } from '../db/schema.js';
import type { Inventory } from '../inventory/index.js';
import { knownWordIds } from './words.js';
import { feedChanges } from './writ.js';

/**
 * Plots and plot sentences on the server (docs/design/holding.md "Plots",
 * M2 Task 5): the `plots` rows (one per named plot, read and written only
 * here under the Kindled's lock), a plot as a workplace (a station of its
 * Ground's kind with the plot's id), naming with every refusal in the
 * brief's order, sowing, the plots on the wire, and the paused day count
 * when a feed relights a faded line. Pure where it can be: the rules are
 * @iot/shared's (`plotSentenceSafe`, `plotLine`, `yieldBonusPermille`).
 */

/** A place of the holding a request can work or take from: a station of stations.json, or a named plot as a station of its kind. */
export interface Workplace {
  id: string;
  name: string;
  action: StationAction | null;
  cycle: StationCycle | null;
  /** The plot behind a plot's workplace: its row, its kind and its index in the layout; null for a station. */
  plot: { row: PlotRow; kind: PlotKindDef; index: number } | null;
}

export type WorkplaceLookup = { ok: true; place: Workplace } | { ok: false; error: 'unknown-station' | 'unnamed-plot' };

/** The Kindled's plot rows, locked FOR UPDATE for the rest of the transaction, by plot id. Call under the Kindled's own lock. */
export async function lockPlots(tx: Transaction, kindledId: string): Promise<PlotRow[]> {
  return tx.select().from(plots).where(eq(plots.kindledId, kindledId)).orderBy(asc(plots.plotId)).for('update');
}

/** The plot kind a row's Ground builds (a row always has a Ground of words.json; a word that left the data has no kind). */
export function plotKindOf(row: Pick<PlotRow, 'ground'>): PlotKindDef | undefined {
  const builds = wordDef(row.ground)?.builds;
  return builds === null || builds === undefined ? undefined : plotKindDef(builds);
}

/**
 * The workplace a station id names: a station of the layout, or a plot of
 * the layout with a name (`unnamed-plot` without one); anything else is
 * `unknown-station`.
 */
export function workplaceOf(layout: HoldingLayout, stationId: string, rows: readonly PlotRow[]): WorkplaceLookup {
  if (layout.stations.some((s) => s.id === stationId)) {
    const def = stationDef(stationId);
    if (!def) return { ok: false, error: 'unknown-station' };
    return { ok: true, place: { id: def.id, name: def.name, action: def.action, cycle: def.cycle, plot: null } };
  }
  const index = layout.plots.findIndex((p) => p.id === stationId);
  if (index < 0) return { ok: false, error: 'unknown-station' };
  const row = rows.find((r) => r.plotId === stationId);
  const kind = row ? plotKindOf(row) : undefined;
  if (!row || !kind) return { ok: false, error: 'unnamed-plot' };
  return { ok: true, place: { id: stationId, name: kind.name, action: kind.action, cycle: kind.cycle, plot: { row, kind, index } } };
}

/** The Writ line a plot (by its layout index) hangs on at `now`, or undefined for a line the Writ lacks. */
export function plotWritLine(index: number, writ: WritStored, now: number): WritLine | undefined {
  return writView(writ, now).lines[plotLine(index) - 1];
}

/** A plot's state from its Writ line: a plot on a line the Writ lacks is faded. */
export function plotState(index: number, writ: WritStored, now: number): WritLineState {
  return plotWritLine(index, writ, now)?.state ?? 'faded';
}

/** The Virtue's effect on a plot, from its row. */
export function plotEffect(row: Pick<PlotRow, 'virtue'>): WordDef['effect'] {
  return row.virtue === null ? null : (wordDef(row.virtue)?.effect ?? null);
}

/**
 * The Virtue's bonus shown for a plot at `now`: the days kept so far; while
 * the plot is faded it holds still at the moment the line faded.
 */
export function plotBonusPermille(row: Pick<PlotRow, 'virtue' | 'virtueSetAt' | 'virtuePausedMs'>, index: number, writ: WritStored, now: number): number {
  const line = plotWritLine(index, writ, now);
  const at = line?.state === 'faded' ? Math.min(now, line.fadesAt) : now;
  return yieldBonusPermille(plotEffect(row), row.virtueSetAt?.getTime() ?? null, row.virtuePausedMs, at);
}

/** The plots on the wire: one per layout plot, in order. */
export function plotViews(layout: HoldingLayout, rows: readonly PlotRow[], writ: WritStored, now: number): PlotView[] {
  return layout.plots.map((p, index) => {
    const row = rows.find((r) => r.plotId === p.id);
    const state = plotState(index, writ, now);
    if (!row) return { id: p.id, ground: null, virtue: null, namedAt: null, virtueSetAt: null, sownAt: null, kind: null, level: plotLevel(), state };
    return {
      id: p.id,
      ground: row.ground,
      virtue: row.virtue,
      namedAt: row.namedAt.toISOString(),
      virtueSetAt: row.virtueSetAt?.toISOString() ?? null,
      sownAt: row.sownAt?.toISOString() ?? null,
      kind: plotKindOf(row)?.id ?? row.ground,
      level: plotLevel(),
      state,
    };
  });
}

/** A station's cycle on the wire, from its clock row and the Virtue's bonus at `now` (0 for a station without a Virtue). */
export function cycleView(cycle: StationCycle, clock: Pick<BasketCycleRow, 'cycledUntil'>, bonusPermille: number): StationCycleView {
  return { cycleMs: cycleLengthMs(cycle), cycledUntil: clock.cycledUntil.toISOString(), bonusPermille };
}

export type PlotError =
  | 'unknown-plot'
  | 'unnamed'
  | 'faded'
  | 'unknown-word'
  | 'wrong-slot'
  | 'no-ground'
  | 'unchanged'
  | 'sentence-refused'
  | 'insufficient'
  | 'unnamed-plot'
  | 'already-sown';

export type PlotResult = { ok: true } | { ok: false; error: PlotError; message: string };

const refuse = (error: PlotError, message: string): PlotResult => ({ ok: false, error, message });

export interface NamePlotArgs {
  plotId: string;
  ground: string | null;
  virtue: string | null;
}

/**
 * Names a plot with a plot sentence, under the Kindled's and the Writ's locks
 * after the settle. The refusals in the brief's order: `unknown-plot`;
 * `unnamed` (the island has no Name: plots appear only once it does);
 * `faded` (the plot's line); `unknown-word` (not in words.json, or not
 * known); `wrong-slot`; `no-ground`; `unchanged`; `sentence-refused` (the
 * ordinary filter across the divider, both orders); `insufficient` (a rename
 * without the gin). The first naming is free; any later change costs
 * `RENAME_COST_GIN` from the purse (reason `name-plot`) and restarts the
 * Virtue's count. A change of Ground clears the sowing.
 */
export async function namePlotIn(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  writ: WritStored,
  layout: HoldingLayout,
  rows: readonly PlotRow[],
  args: NamePlotArgs,
  now: Date,
): Promise<PlotResult> {
  const index = layout.plots.findIndex((p) => p.id === args.plotId);
  if (index < 0 || !layoutPlot(layout, args.plotId)) return refuse('unknown-plot', PLOT_TEXT.UNKNOWN_PLOT);
  if (writ.name === null) return refuse('unnamed', PLOT_TEXT.UNNAMED);
  if (plotState(index, writ, now.getTime()) === 'faded') return refuse('faded', PLOT_TEXT.FADED);
  const known = await knownWordIds(tx, kindledId);
  const lookup = (id: string | null): WordDef | null | 'unknown' => {
    if (id === null) return null;
    const def = wordDef(id);
    return def && known.includes(id) ? def : 'unknown';
  };
  const ground = lookup(args.ground);
  const virtue = lookup(args.virtue);
  if (ground === 'unknown' || virtue === 'unknown') return refuse('unknown-word', PLOT_TEXT.UNKNOWN_WORD);
  if ((ground && ground.slot !== 'ground') || (virtue && virtue.slot !== 'virtue')) return refuse('wrong-slot', PLOT_TEXT.WRONG_SLOT);
  if (!ground) return refuse('no-ground', PLOT_TEXT.NO_GROUND);
  const existing = rows.find((r) => r.plotId === args.plotId);
  if (existing && existing.ground === ground.id && existing.virtue === (virtue?.id ?? null)) return refuse('unchanged', PLOT_TEXT.UNCHANGED);
  const safe = plotSentenceSafe(ground, virtue);
  if (!safe.ok) return refuse('sentence-refused', PLOT_TEXT.SENTENCE_REFUSED);
  if (existing) {
    const paid = await inventory.apply(
      [{ kindledId, itemId: RENAME_COST_ITEM, place: 'purse', delta: -RENAME_COST_GIN }],
      InventoryReason.NamePlot,
      { tx },
    );
    if (!paid.ok) {
      if (paid.error === 'insufficient') return refuse('insufficient', PLOT_TEXT.INSUFFICIENT);
      throw new Error(`name-plot: ${paid.message}`);
    }
    // Any change to either tile restarts the Virtue's count; a new Ground needs sowing again.
    await tx
      .update(plots)
      .set({
        ground: ground.id,
        virtue: virtue?.id ?? null,
        virtueSetAt: virtue ? now : null,
        virtuePausedMs: 0,
        ...(existing.ground === ground.id ? {} : { sownAt: null }),
      })
      .where(and(eq(plots.kindledId, kindledId), eq(plots.plotId, args.plotId)));
    return { ok: true };
  }
  await tx.insert(plots).values({
    kindledId,
    plotId: args.plotId,
    ground: ground.id,
    virtue: virtue?.id ?? null,
    namedAt: now,
    virtueSetAt: virtue ? now : null,
    virtuePausedMs: 0,
    sownAt: null,
  });
  return { ok: true };
}

/**
 * Sows a named plot (GAME DESIGN: "A new field is sown once before it cycles
 * or can be worked"): its kind's seed from the store first, then the pack
 * (reason `sow`), `sown_at` set and the plot's cycle clock started at now.
 * Refusals: `unknown-plot`, `unnamed-plot`, `faded`, `already-sown` (a kind
 * that needs no sowing counts as sown), `insufficient`.
 */
export async function sowPlotIn(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  writ: WritStored,
  layout: HoldingLayout,
  rows: readonly PlotRow[],
  plotId: string,
  now: Date,
): Promise<PlotResult> {
  const index = layout.plots.findIndex((p) => p.id === plotId);
  if (index < 0) return refuse('unknown-plot', PLOT_TEXT.UNKNOWN_PLOT);
  const row = rows.find((r) => r.plotId === plotId);
  const kind = row ? plotKindOf(row) : undefined;
  if (!row || !kind) return refuse('unnamed-plot', PLOT_TEXT.UNNAMED_PLOT);
  if (plotState(index, writ, now.getTime()) === 'faded') return refuse('faded', PLOT_TEXT.FADED);
  if (row.sownAt !== null || !kind.sow) return refuse('already-sown', PLOT_TEXT.ALREADY_SOWN);
  const held = await inventory.holdings(kindledId, tx);
  const changes = feedChanges(kindledId, held, kind.sow.itemId, kind.sow.quantity);
  if (!changes) return refuse('insufficient', PLOT_TEXT.INSUFFICIENT);
  const taken = await inventory.apply(changes, InventoryReason.Sow, { tx });
  if (!taken.ok) {
    if (taken.error === 'insufficient') return refuse('insufficient', PLOT_TEXT.INSUFFICIENT);
    throw new Error(`sow: ${taken.message}`);
  }
  await tx.update(plots).set({ sownAt: now }).where(and(eq(plots.kindledId, kindledId), eq(plots.plotId, plotId)));
  // The cycle clock starts now: nothing is paid for the time before the sowing.
  await tx
    .insert(basketCycles)
    .values({ kindledId, stationId: plotId, cycledUntil: now, carryPermille: 0 })
    .onConflictDoUpdate({ target: [basketCycles.kindledId, basketCycles.stationId], set: { cycledUntil: now, carryPermille: 0 } });
  return { ok: true };
}

/**
 * When a feed relights a faded line (GAME DESIGN: the Virtue's count "pauses
 * while the plot is faded"): every plot of that line with a Virtue gets the
 * faded span, from the moment the line faded to the relight, added to
 * `virtue_paused_ms`, in the feed's transaction. `before` is the Writ as it
 * stood before the feed.
 */
export async function pauseFadedPlots(
  tx: Transaction,
  kindledId: string,
  layout: HoldingLayout,
  rows: readonly PlotRow[],
  before: WritStored,
  now: Date,
): Promise<void> {
  const lines = writView(before, now.getTime()).lines;
  for (const [index, p] of layout.plots.entries()) {
    const row = rows.find((r) => r.plotId === p.id);
    if (!row || row.virtue === null) continue;
    const line = lines[plotLine(index) - 1];
    if (!line || line.state !== 'faded') continue;
    const faded = Math.max(0, now.getTime() - line.fadesAt);
    if (faded === 0) continue;
    await tx
      .update(plots)
      .set({ virtuePausedMs: sql`${plots.virtuePausedMs} + ${faded}` })
      .where(and(eq(plots.kindledId, kindledId), eq(plots.plotId, p.id)));
  }
}
