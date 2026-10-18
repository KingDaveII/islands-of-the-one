import {
  basketPlace,
  feedPreview,
  FILL_ITEM,
  fillPreview,
  HOLDING_LAYOUT_ID,
  holdingLayout,
  InventoryReason,
  itemDef,
  MAX_QUANTITY,
  OFFLINE_CAP_MS,
  PLOT_TEXT,
  skillProgress,
  SKILLS,
  storeLimitOf,
  toWritView,
  validateIslandName,
  writView,
  type HoldingResponse,
  type HoldingTake,
  type InventoryEntry,
  type Skill,
  type SkillView,
  type StationCycleView,
  type WritStored,
} from '@iot/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import {
  basketCycles,
  holdingActivity,
  keshGifts,
  kindled,
  skillXp,
  writs,
  type HoldingActivityRow,
  type KindledRow,
  type PlotRow,
  type WritRow,
} from '../db/schema.js';
import type { Inventory } from '../inventory/index.js';
import { cyclingStations, settleCycles } from './cycles.js';
import { giveSeeds, giveSliver, giveWord, keshViewOf, knowsKeshWord, type GiftContext } from './kesh.js';
import {
  cycleView,
  lockPlots,
  namePlotIn,
  pauseFadedPlots,
  plotBonusPermille,
  plotState,
  plotViews,
  sowPlotIn,
  workplaceOf,
  type NamePlotArgs,
  type Workplace,
} from './plots.js';
import { knownWordIds } from './words.js';
import { feedable, feedChanges, lockWrit, WRIT_ALREADY_NAMED, WRIT_INSUFFICIENT, WRIT_UNNAMED, writStored } from './writ.js';

/**
 * The holding's active action (docs/design/holding.md): one per Kindled,
 * settled on every holding request. Nothing ticks in the background: the
 * server computes what a stretch of work produced when it is next asked, in
 * one transaction with the Kindled's row, the activity row, the Writ row and
 * the plots locked, credits the yield into the station's basket through
 * `inventory.apply` (reason `gather`, inside the same transaction) and the
 * XP into `skill_xp`, and restarts the cycle clock when the time away went
 * past the cap, so lost time is never paid later. The Writ (M2 Task 4a) sets
 * the offline horizon: a dark Writ stops offline earning at the moment it
 * went dark; its row is pressed on the Kindled's first request. Naming the
 * island, feeding the Writ and Kesh's slivers (M2 Task 4b, kesh.ts) run here
 * too, under the same lock; so do the plots (M2 Task 5, plots.ts): a named
 * plot is a station of its Ground's kind with the plot's id, the basket
 * cycles (cycles.ts) settle after the active action, and the holding-wide
 * last heartbeat lives on the Writ row.
 */

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
 * heartbeat. Hands still work online at full rate and XP: dark means idling
 * stops, not that the player is locked out.
 */
export const ONLINE_GRACE_MS = 2 * 30_000;

/**
 * How far past its last heartbeat a stretch earns unattended: the full
 * offline cap while the Writ is lit or flickering at `now`; otherwise only
 * until the moment the Writ went dark, `min(cap, emptyAt − lastSeenAt)`, and
 * never less than the online grace.
 */
export function offlineHorizonMs(writ: WritStored, lastSeenAt: Date, now: Date): number {
  const { state } = writView(writ, now.getTime());
  if (state === 'lit' || state === 'flickering') return OFFLINE_CAP_MS;
  const untilDark = writ.emptyAt - lastSeenAt.getTime();
  return Math.max(ONLINE_GRACE_MS, Math.min(OFFLINE_CAP_MS, untilDark));
}

export type HoldingError =
  | 'unknown-kindled'
  | 'unknown-station'
  | 'no-action'
  | 'name-refused'
  | 'already-named'
  | 'unnamed'
  | 'not-sparkglass'
  | 'insufficient'
  | 'full'
  | 'too-much'
  | 'not-due'
  | 'pack-full'
  | 'unknown-plot'
  | 'faded'
  | 'unknown-word'
  | 'wrong-slot'
  | 'no-ground'
  | 'unchanged'
  | 'sentence-refused'
  | 'unnamed-plot'
  | 'not-sown'
  | 'already-sown';

export type HoldingResult =
  | { ok: true; value: HoldingResponse }
  | { ok: false; error: HoldingError; message: string };

export interface Holding {
  /** Settle, then answer GET /api/holding. */
  view(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then start (or switch to) working a station with an action (a named, sown plot included). */
  work(kindledId: string, stationId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then clear the action. */
  stop(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then move what fits of a station's basket into the store. */
  takeAll(kindledId: string, stationId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then name the island (once): the typed Name and its letters, heard on the server. */
  name(kindledId: string, name: unknown, now: Date): Promise<HoldingResult>;
  /** Settle, then feed `count` of an item to the Writ, from the store first, then the pack. */
  feed(kindledId: string, itemId: string, count: number, now: Date): Promise<HoldingResult>;
  /** Settle, then feed as many wild slivers as fit (never gin). */
  fill(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then take the sliver Kesh has due (his first, else this tide's): one wild sliver into the pack. */
  keshSliver(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then take Kesh's word tile (once the island has a Name, while the word isn't known). */
  keshWord(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then take Kesh's seeds (once a plot has been named, once): into the pack. */
  keshSeeds(kindledId: string, now: Date): Promise<HoldingResult>;
  /** Settle, then name a plot with a plot sentence (M2 Task 5). */
  namePlot(kindledId: string, args: NamePlotArgs, now: Date): Promise<HoldingResult>;
  /** Settle, then sow a named field with its seed (M2 Task 5). */
  sowPlot(kindledId: string, plotId: string, now: Date): Promise<HoldingResult>;
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
 * and whether `end` fell short of `now` (time beyond the horizon, lost).
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

type Refused = { refused: HoldingResult };

/** What a request's body gets: the transaction, the Kindled, the Writ row and the plot rows as they stood after the settle. */
interface Locked {
  tx: Transaction;
  k: KindledRow;
  w: WritRow;
  plots: PlotRow[];
}

export function createHolding(db: Database, inventory: Inventory): Holding {
  const layout = holdingLayout(HOLDING_LAYOUT_ID);

  /** The Kindled's row, locked for the rest of the transaction (every holding change queues behind it). */
  async function lockKindled(tx: Transaction, kindledId: string): Promise<KindledRow | undefined> {
    const [row] = await tx.select().from(kindled).where(eq(kindled.id, kindledId)).for('no key update');
    return row;
  }

  /**
   * The workplace a request may work or take from: a station of the layout,
   * or a named plot as a station of its kind. A plot's refusals: unnamed
   * (`unnamed-plot`), its line faded (`faded`: frozen with its basket); in
   * the grace (dark, not faded) work and take are allowed.
   */
  function workplace(stationId: string, rows: readonly PlotRow[], w: WritRow, now: Date): Workplace | Refused {
    const found = workplaceOf(layout, stationId, rows);
    if (!found.ok)
      return found.error === 'unknown-station' ? unknownStation(stationId) : refuse('unnamed-plot', PLOT_TEXT.UNNAMED_PLOT);
    const { place } = found;
    if (place.plot && plotState(place.plot.index, writStored(w), now.getTime()) === 'faded') return refuse('faded', PLOT_TEXT.FADED);
    return place;
  }

  /**
   * The settle, inside a transaction holding the Kindled's lock: the activity
   * row locked FOR UPDATE, the completed cycles since the last credit paid
   * into the basket and the skill, the clock restarted after lost time, the
   * heartbeat refreshed. The Writ sets the horizon. Nothing to do without a
   * row. A stretch at a plot that is no longer workable (unnamed, unsown or
   * faded, or a station that left the data) is over: the row goes.
   */
  async function settleIn(tx: Transaction, k: KindledRow, w: WritRow, rows: readonly PlotRow[], now: Date): Promise<Settlement> {
    const [row] = await tx.select().from(holdingActivity).where(eq(holdingActivity.kindledId, k.id)).for('update');
    if (!row) return { credited: 0, restarted: false };
    const place = workplace(row.stationId, rows, w, now);
    const action = 'refused' in place ? null : place.action;
    const workable = !('refused' in place) && (place.plot === null || place.plot.row.sownAt !== null);
    if (!action || !workable) {
      await tx.delete(holdingActivity).where(eq(holdingActivity.kindledId, k.id));
      return { credited: 0, restarted: true };
    }
    const horizon = offlineHorizonMs(writStored(w), row.lastSeenAt, now);
    const { cycles, due, lost } = settleMath(row, action.cycleMs, now, horizon);
    if (due > 0) {
      const ref = settleRef(k.id, row.startedAt, row.creditedCycles, cycles);
      const credit = await inventory.apply(
        [{ kindledId: k.id, itemId: action.itemId, place: basketPlace(place.id), delta: due * action.quantity }],
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
          ? // Beyond the horizon: the time from there to now is lost, so the cycle clock starts afresh.
            { startedAt: now, creditedCycles: 0, lastSeenAt: now }
          : { creditedCycles: cycles, lastSeenAt: now },
      )
      .where(eq(holdingActivity.kindledId, k.id));
    return { credited: due, restarted: lost };
  }

  /**
   * Everything a holding request settles, under the Kindled's lock: the Writ
   * row and the plot rows locked, the active action, then the basket cycles
   * from the holding-wide last heartbeat, which is then refreshed.
   */
  async function settleAll(tx: Transaction, k: KindledRow, now: Date): Promise<{ w: WritRow; plots: PlotRow[] }> {
    const w = await lockWrit(tx, k.id, now);
    const rows = await lockPlots(tx, k.id);
    await settleIn(tx, k, w, rows, now);
    await settleCycles(tx, inventory, k.id, layout, writStored(w), rows, w.lastSeenAt, now);
    await tx.update(writs).set({ lastSeenAt: now }).where(eq(writs.kindledId, k.id));
    return { w, plots: rows };
  }

  /** What Kesh's gifts need to know about the Kindled, read inside the transaction. */
  async function giftContext(tx: Transaction, k: KindledRow, w: WritRow, rows: readonly PlotRow[]): Promise<GiftContext> {
    return { named: w.name !== null, knowsWord: await knowsKeshWord(tx, k.id), plotNamed: rows.length > 0 };
  }

  /** What GET /api/holding answers, read inside the transaction after the settle (and after the body's changes). */
  async function answer(tx: Transaction, k: KindledRow, now: Date, take?: HoldingTake): Promise<HoldingResponse> {
    const view = await inventory.view(k.id, tx);
    const baskets: Record<string, InventoryEntry[]> = {};
    for (const s of layout.stations) baskets[s.id] = view.baskets[s.id] ?? [];
    for (const p of layout.plots) baskets[p.id] = view.baskets[p.id] ?? [];
    const [w] = await tx.select().from(writs).where(eq(writs.kindledId, k.id));
    if (!w) throw new Error(`writ: no row for Kindled ${k.id}`);
    const rows = await lockPlots(tx, k.id);
    const [row] = await tx.select().from(holdingActivity).where(eq(holdingActivity.kindledId, k.id));
    const found = row ? workplaceOf(layout, row.stationId, rows) : null;
    const action = found?.ok ? found.place.action : null;
    const activity = row && action ? { stationId: row.stationId, startedAt: row.startedAt.toISOString(), cycleMs: action.cycleMs } : null;
    const xpRows = await tx
      .select()
      .from(skillXp)
      .where(and(eq(skillXp.kindledId, k.id), inArray(skillXp.skill, [...SKILLS])))
      .orderBy(asc(skillXp.skill));
    const skills = {} as Record<Skill, SkillView>;
    for (const skill of SKILLS) skills[skill] = skillProgress(xpRows.find((r) => r.skill === skill)?.xp ?? 0);
    // Kesh's gifts: a Kindled without a row yet has been given nothing.
    const [gifts] = await tx.select().from(keshGifts).where(eq(keshGifts.kindledId, k.id));
    const stored = writStored(w);
    const clocks = await tx.select().from(basketCycles).where(eq(basketCycles.kindledId, k.id));
    const cycles: Record<string, StationCycleView> = {};
    for (const station of cyclingStations(layout, rows)) {
      const clock = clocks.find((c) => c.stationId === station.stationId);
      if (!clock) continue;
      const plotRow = rows.find((r) => r.plotId === station.stationId);
      const index = layout.plots.findIndex((p) => p.id === station.stationId);
      const bonus = plotRow && index >= 0 ? plotBonusPermille(plotRow, index, stored, now.getTime()) : 0;
      cycles[station.stationId] = cycleView(station.cycle, clock, bonus);
    }
    const out: HoldingResponse = {
      layoutId: layout.id,
      baskets,
      activity,
      now: now.toISOString(),
      skills,
      writ: toWritView(stored, now.getTime()),
      kesh: keshViewOf(gifts ?? { firstSliverAt: null, lastTide: null, seedsGivenAt: null }, now, await giftContext(tx, k, w, rows)),
      words: await knownWordIds(tx, k.id),
      plots: plotViews(layout, rows, stored, now.getTime()),
      cycles,
    };
    if (take) out.take = take;
    return out;
  }

  /** One holding request: the Kindled, its Writ and its plots locked, everything settled, then `body`, then the answer. */
  async function request(
    kindledId: string,
    now: Date,
    body: (locked: Locked) => Promise<HoldingTake | undefined | Refused>,
  ): Promise<HoldingResult> {
    return db.transaction(async (tx) => {
      const k = await lockKindled(tx, kindledId);
      if (!k) return { ok: false, error: 'unknown-kindled', message: 'No such Kindled.' };
      const { w, plots } = await settleAll(tx, k, now);
      const result = await body({ tx, k, w, plots });
      if (result && 'refused' in result) return result.refused;
      return { ok: true, value: await answer(tx, k, now, result) };
    });
  }

  const refuse = (error: HoldingError, message: string): Refused => ({ refused: { ok: false, error, message } });
  const unknownStation = (stationId: string): Refused => refuse('unknown-station', `No station ${stationId} on this holding.`);

  /** One feed under the locks: the preview, the items, empty_at; a relight of a faded line pauses its plots' Virtue count. */
  async function feedIn(
    { tx, k, w, plots }: Locked,
    itemId: string,
    count: number,
    now: Date,
    held?: Awaited<ReturnType<Inventory['holdings']>>,
  ): Promise<undefined | Refused> {
    if (w.name === null) return refuse('unnamed', WRIT_UNNAMED);
    const before = writStored(w);
    const preview = feedPreview(before, itemId, count, now.getTime());
    if (!preview.ok) return refuse(preview.error, preview.message);
    const stacks = held ?? (await inventory.holdings(k.id, tx));
    const changes = feedChanges(k.id, stacks, itemId, preview.count);
    if (!changes) return refuse('insufficient', WRIT_INSUFFICIENT);
    const taken = await inventory.apply(changes, InventoryReason.FeedWrit, { tx });
    if (!taken.ok) {
      if (taken.error === 'insufficient') return refuse('insufficient', WRIT_INSUFFICIENT);
      throw new Error(`feed-writ: ${taken.message}`);
    }
    // A relight from dark or fading: the plots of a faded line pause their Virtue count for the time they spent faded.
    if (before.emptyAt <= now.getTime()) await pauseFadedPlots(tx, k.id, layout, plots, before, now);
    // The first feed is remembered once (fed_at): the client plays Kesh's after-first-feeding line when it appears.
    await tx
      .update(writs)
      .set(w.fedAt === null ? { emptyAt: new Date(preview.emptyAt), fedAt: now } : { emptyAt: new Date(preview.emptyAt) })
      .where(eq(writs.kindledId, k.id));
    return undefined;
  }

  return {
    view: (kindledId, now) => request(kindledId, now, () => Promise.resolve(undefined)),

    work: (kindledId, stationId, now) =>
      request(kindledId, now, async ({ tx, k, w, plots }) => {
        const place = workplace(stationId, plots, w, now);
        if ('refused' in place) return place;
        if (!place.action) return refuse('no-action', `Nothing to work at the ${place.name}.`);
        // A field is sown once before it can be worked (GAME DESIGN).
        if (place.plot && place.plot.row.sownAt === null && place.plot.kind.sow) return refuse('not-sown', PLOT_TEXT.NOT_SOWN);
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
      request(kindledId, now, async ({ tx, k }) => {
        await tx.delete(holdingActivity).where(eq(holdingActivity.kindledId, k.id));
        return undefined;
      }),

    takeAll: (kindledId, stationId, now) =>
      request(kindledId, now, async ({ tx, k, w, plots }) => {
        const place = workplace(stationId, plots, w, now);
        if ('refused' in place) return place;
        if (!inRange(k, stationId)) return unknownStation(stationId);
        // Under the Kindled's lock no other change set runs, so what fits now still fits when the move is judged.
        const held = await inventory.holdings(k.id, tx);
        const basket = basketPlace(place.id);
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
        return { stationId: place.id, moved, left };
      }),

    // The island is named once in M2 (renaming comes later, at the Wet House). The letters are heard
    // here, never taken from the client; a refusal answers the validator's own line.
    name: (kindledId, name, now) =>
      request(kindledId, now, async ({ tx, k, w }) => {
        if (w.name !== null) return refuse('already-named', WRIT_ALREADY_NAMED);
        const checked = validateIslandName(name);
        if (!checked.ok) return refuse('name-refused', checked.message);
        await tx.update(writs).set({ name: checked.name, letters: checked.letters }).where(eq(writs.kindledId, k.id));
        return undefined;
      }),

    // Feeding (docs/design/holding.md "The Writ"): under the Kindled's and the Writ's locks, the shared
    // preview decides; the items go through inventory.apply (reason feed-writ) from the store first, then
    // the pack (the pack is what goes abroad; currency from the purse); then empty_at is written. A
    // refusal changes nothing. Fill feeds as many wild slivers as fit of what the Kindled holds, never gin.
    feed: (kindledId, itemId, count, now) => request(kindledId, now, (locked) => feedIn(locked, itemId, count, now)),

    fill: (kindledId, now) =>
      request(kindledId, now, async (locked) => {
        const { tx, k, w } = locked;
        if (w.name === null) return refuse('unnamed', WRIT_UNNAMED);
        const held = await inventory.holdings(k.id, tx);
        const have = feedable(held, FILL_ITEM);
        const preview = fillPreview(writStored(w), now.getTime());
        if (!preview.ok) return refuse(preview.error, preview.message);
        if (have === 0) return refuse('insufficient', WRIT_INSUFFICIENT);
        return feedIn(locked, FILL_ITEM, Math.min(preview.count, have), now, held);
      }),

    // Kesh's sliver (docs/design/holding.md "Kesh"): under the Kindled's lock, the gift row decides what is due;
    // a full pack refuses and the sliver stays due; the answer is the holding like every other route.
    keshSliver: (kindledId, now) =>
      request(kindledId, now, async ({ tx, k }) => {
        const given = await giveSliver(tx, inventory, k.id, now);
        return given.ok ? undefined : refuse(given.error, given.message);
      }),

    // Kesh's gifts of Task 5: the word tile once the island has a Name (knowledge, no item), the seeds once a plot
    // has been named (into the pack; a full pack keeps them due).
    keshWord: (kindledId, now) =>
      request(kindledId, now, async ({ tx, k, w, plots }) => {
        const given = await giveWord(tx, k.id, await giftContext(tx, k, w, plots), now);
        return given.ok ? undefined : refuse(given.error, given.message);
      }),

    keshSeeds: (kindledId, now) =>
      request(kindledId, now, async ({ tx, k, w, plots }) => {
        const given = await giveSeeds(tx, inventory, k.id, await giftContext(tx, k, w, plots), now);
        return given.ok ? undefined : refuse(given.error, given.message);
      }),

    // A plot's sentence (docs/design/holding.md "Plots"): plots.ts holds the refusals in the brief's order.
    namePlot: (kindledId, args, now) =>
      request(kindledId, now, async ({ tx, k, w, plots }) => {
        const named = await namePlotIn(tx, inventory, k.id, writStored(w), layout, plots, args, now);
        return named.ok ? undefined : refuse(named.error, named.message);
      }),

    sowPlot: (kindledId, plotId, now) =>
      request(kindledId, now, async ({ tx, k, w, plots }) => {
        const sown = await sowPlotIn(tx, inventory, k.id, writStored(w), layout, plots, plotId, now);
        return sown.ok ? undefined : refuse(sown.error, sown.message);
      }),

    settle: async (kindledId, now) => {
      await db.transaction(async (tx) => {
        const k = await lockKindled(tx, kindledId);
        if (!k) return;
        await settleAll(tx, k, now);
      });
    },
  };
}
