import { ApiRoute, DAY_MS, isHoldingResponse, PLOT_TEXT, SESSION_COOKIE, type HoldingResponse } from '@iot/shared';
import { and, eq } from 'drizzle-orm';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, basketCycles, keshGifts, kindled, knownWords, plots } from '../src/db/schema.js';
import {
  createHolding,
  cycleEnd,
  cycleMath,
  cycleRef,
  forgetWord,
  grantWord,
  KESH_NOT_DUE,
  KESH_PACK_FULL,
  learnWord,
  moveAway,
  parseWordsArgs,
  resetKesh,
  setWrit,
  type Holding,
} from '../src/holding/index.js';
import { createInventory, type Inventory } from '../src/inventory/index.js';

/**
 * Plots, plot sentences, sowing and the basket cycles on in-memory PGlite
 * (docs/design/holding.md "Plots", M2 Task 5): Kesh's word and seeds, naming
 * with every refusal, the free first naming and the paid rename, sowing, work
 * and take at a field, the field's and the trees' trickle in every case the
 * brief lists, ישן's bonus with the faded span paused, the away hook moving
 * the cycles, the words CLIs and the routes' guards and codes. The races run
 * on a real Postgres in holding.postgres.test.ts.
 */
const T0 = Date.parse('2026-10-17T12:00:00Z');
const at = (ms: number): Date => new Date(T0 + ms);
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const HOST = 'game.test';
const ORIGIN = `https://${HOST}`;

let handle: DbHandle;
let inv: Inventory;
let holding: Holding;
let n = 0;

async function newKindled(username = `plotter${++n}`): Promise<{ id: string; username: string }> {
  const [account] = await handle.db.insert(accounts).values({ username, passwordHash: 'x' }).returning();
  if (!account) throw new Error('no account');
  const [k] = await handle.db
    .insert(kindled)
    .values({ accountId: account.id, name: 'Iltani', remembrance: 'tide', clayTone: 'clay-pale' })
    .returning();
  if (!k) throw new Error('no kindled');
  return { id: k.id, username };
}

/** A Kindled with a Name, a Writ lit for weeks and Kesh's word, at T0. */
async function namedKindled(username?: string, chargeHours = 1000): Promise<string> {
  const k = await newKindled(username);
  await setWrit(handle.db, { username: k.username, chargeHours }, at(0));
  const named = await holding.name(k.id, 'Ash', at(0));
  if (!named.ok) throw new Error(named.message);
  await learnWord(handle.db, k.id, 'adamah', at(0));
  return k.id;
}

/** A named Kindled whose plot-1 is a sown field, at T0. */
async function fieldKindled(username?: string, chargeHours = 1000, virtue: string | null = null): Promise<string> {
  const k = await namedKindled(username, chargeHours);
  if (virtue) await learnWord(handle.db, k, virtue, at(0));
  value(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue }, at(0)));
  await inv.apply([{ kindledId: k, itemId: 'grey-seeds', place: 'pack', delta: 1 }], 'admin');
  value(await holding.sowPlot(k, 'plot-1', at(0)));
  return k;
}

const basket = (r: HoldingResponse, station: string, itemId: string): number =>
  r.baskets[station]?.find((e) => e.itemId === itemId)?.quantity ?? 0;
const value = (r: Awaited<ReturnType<Holding['view']>>): HoldingResponse => {
  if (!r.ok) throw new Error(r.message);
  return r.value;
};
const plotRow = async (k: string, plotId: string) => {
  const [row] = await handle.db.select().from(plots).where(and(eq(plots.kindledId, k), eq(plots.plotId, plotId)));
  return row;
};
const purse = async (k: string): Promise<number> => (await inv.view(k)).purse.find((e) => e.itemId === 'sealed-gin')?.quantity ?? 0;

beforeAll(async () => {
  handle = await createDb();
  await handle.migrate();
  inv = createInventory(handle.db);
  holding = createHolding(handle.db, inv);
});
afterAll(async () => {
  await handle.close();
});

describe("Kesh's word and seeds", () => {
  it('the word: not due before the Name; once after it, into known_words, never twice; a word learned by the CLI is not due either', async () => {
    const { id: k } = await newKindled();
    expect(value(await holding.view(k, at(0))).kesh).toMatchObject({ wordDue: false, seedsDue: false });
    expect(await holding.keshWord(k, at(0))).toEqual({ ok: false, error: 'not-due', message: KESH_NOT_DUE });
    value(await holding.name(k, 'Ash', at(0)));
    expect(value(await holding.view(k, at(0))).kesh).toMatchObject({ wordDue: true, seedsDue: false });
    const given = value(await holding.keshWord(k, at(HOUR)));
    expect(given.words).toEqual(['adamah']);
    expect(given.kesh).toMatchObject({ wordDue: false });
    const [row] = await handle.db.select().from(keshGifts).where(eq(keshGifts.kindledId, k));
    expect(row).toMatchObject({ wordGivenAt: at(HOUR), seedsGivenAt: null });
    expect(await handle.db.select().from(knownWords).where(eq(knownWords.kindledId, k))).toEqual([{ kindledId: k, wordId: 'adamah', learnedAt: at(HOUR) }]);
    expect(await holding.keshWord(k, at(2 * HOUR))).toMatchObject({ ok: false, error: 'not-due' });
    // Knowledge, not an item: nothing of it in the ledger (the trees' trickle and the kit of M2 Task 8 are the only rows).
    expect((await inv.ledger(k)).filter((e) => e.reason !== 'harvest' && e.reason !== 'kit')).toEqual([]);
    // A Kindled who learned the word by the CLI: the tile isn't due.
    const other = await newKindled('cliword');
    value(await holding.name(other.id, 'Tide', at(0)));
    await grantWord(handle.db, { username: 'cliword', wordId: 'adamah' }, at(0));
    expect(value(await holding.view(other.id, at(0))).kesh.wordDue).toBe(false);
    expect(await holding.keshWord(other.id, at(0))).toMatchObject({ ok: false, error: 'not-due' });
  });

  it('the seeds: due once a plot has been named, 4 grey seeds into the pack with reason gift, once; a full pack keeps them due', async () => {
    const k = await namedKindled();
    expect(value(await holding.view(k, at(0))).kesh.seedsDue).toBe(false);
    expect(await holding.keshSeeds(k, at(0))).toEqual({ ok: false, error: 'not-due', message: KESH_NOT_DUE });
    value(await holding.namePlot(k, { plotId: 'plot-2', ground: 'adamah', virtue: null }, at(0)));
    expect(value(await holding.view(k, at(0))).kesh.seedsDue).toBe(true);
    // A full pack: refused, still due.
    await inv.apply([{ kindledId: k, itemId: 'black-stone', place: 'pack', delta: 1000 }], 'admin');
    expect(await holding.keshSeeds(k, at(0))).toEqual({ ok: false, error: 'pack-full', message: KESH_PACK_FULL });
    expect(value(await holding.view(k, at(0))).kesh.seedsDue).toBe(true);
    await inv.apply([{ kindledId: k, itemId: 'black-stone', place: 'pack', delta: -50 }], 'admin');
    const given = value(await holding.keshSeeds(k, at(HOUR)));
    expect(given.kesh.seedsDue).toBe(false);
    expect((await inv.view(k)).pack).toEqual(expect.arrayContaining([{ itemId: 'grey-seeds', quantity: 4 }]) as unknown);
    expect((await inv.ledger(k)).filter((e) => e.reason === 'gift').map((e) => [e.itemId, e.place, e.delta])).toEqual([['grey-seeds', 'pack', 4]]);
    const [row] = await handle.db.select().from(keshGifts).where(eq(keshGifts.kindledId, k));
    expect(row?.seedsGivenAt).toEqual(at(HOUR));
    expect(await holding.keshSeeds(k, at(2 * HOUR))).toMatchObject({ ok: false, error: 'not-due' });
  });

  it('kesh:reset clears the tile and the seeds too; the word stays known, so the tile is not due again until it is forgotten', async () => {
    const k = await newKindled('resetwords');
    value(await holding.name(k.id, 'Ash', at(0)));
    value(await holding.keshWord(k.id, at(0)));
    value(await holding.namePlot(k.id, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(0)));
    value(await holding.keshSeeds(k.id, at(0)));
    expect(await resetKesh(handle.db, 'resetwords')).toMatchObject({ ok: true, row: { wordGivenAt: null, seedsGivenAt: null, firstSliverAt: null, lastTide: null } });
    expect(value(await holding.view(k.id, at(0))).kesh).toMatchObject({ wordDue: false, seedsDue: true, due: 'first' });
    await forgetWord(handle.db, { username: 'resetwords', wordId: 'adamah' });
    expect(value(await holding.view(k.id, at(0))).kesh.wordDue).toBe(true);
  });
});

describe('the words CLIs', () => {
  it('words:grant teaches a word and words:forget takes it back; both say what changed', async () => {
    const k = await newKindled('wordy');
    expect(parseWordsArgs(['wordy', 'yashan'])).toEqual({ ok: true, args: { username: 'wordy', wordId: 'yashan' } });
    expect(parseWordsArgs(['wordy'])).toMatchObject({ ok: false });
    expect(parseWordsArgs(['wordy', 'shalom'])).toMatchObject({ ok: false, message: expect.stringContaining('unknown word shalom') as unknown });
    expect(parseWordsArgs(['!!', 'yashan'])).toMatchObject({ ok: false });
    expect(await grantWord(handle.db, { username: 'nobody', wordId: 'yashan' })).toEqual({ ok: false, message: 'no Kindled for username nobody' });
    expect(await grantWord(handle.db, { username: 'Wordy', wordId: 'yashan' }, at(0))).toEqual({ ok: true, kindledId: k.id, known: ['yashan'], changed: true });
    expect(await grantWord(handle.db, { username: 'wordy', wordId: 'yashan' }, at(0))).toEqual({ ok: true, kindledId: k.id, known: ['yashan'], changed: false });
    expect(await grantWord(handle.db, { username: 'wordy', wordId: 'adamah' }, at(0))).toMatchObject({ ok: true, known: ['adamah', 'yashan'] });
    expect(value(await holding.view(k.id, at(0))).words).toEqual(['adamah', 'yashan']);
    expect(await forgetWord(handle.db, { username: 'wordy', wordId: 'yashan' })).toEqual({ ok: true, kindledId: k.id, known: ['adamah'], changed: true });
    expect(await forgetWord(handle.db, { username: 'wordy', wordId: 'yashan' })).toMatchObject({ ok: true, changed: false });
    expect(await forgetWord(handle.db, { username: 'nobody', wordId: 'yashan' })).toMatchObject({ ok: false });
  });
});

describe('naming a plot', () => {
  it("refuses in the brief's order: unknown-plot, unnamed, faded, unknown-word, wrong-slot, no-ground, unchanged, insufficient", async () => {
    const fresh = await newKindled('plotless');
    expect(await holding.namePlot(fresh.id, { plotId: 'plot-9', ground: 'adamah', virtue: null }, at(0))).toEqual({ ok: false, error: 'unknown-plot', message: PLOT_TEXT.UNKNOWN_PLOT });
    expect(await holding.namePlot(fresh.id, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(0))).toEqual({ ok: false, error: 'unnamed', message: PLOT_TEXT.UNNAMED });
    const k = await namedKindled('plotfade');
    // Faded: dark for 100 h is past the 48 h grace.
    await setWrit(handle.db, { username: 'plotfade', darkHours: 100 }, at(0));
    expect(value(await holding.view(k, at(0))).plots[0]).toMatchObject({ id: 'plot-1', state: 'faded' });
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(0))).toEqual({ ok: false, error: 'faded', message: PLOT_TEXT.FADED });
    await setWrit(handle.db, { username: 'plotfade', chargeHours: 1000 }, at(0));
    // Words: not in words.json, or not known (ישן is nobody's in M2 without the CLI).
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: 'shalom', virtue: null }, at(0))).toEqual({ ok: false, error: 'unknown-word', message: PLOT_TEXT.UNKNOWN_WORD });
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: 'yashan' }, at(0))).toEqual({ ok: false, error: 'unknown-word', message: PLOT_TEXT.UNKNOWN_WORD });
    await learnWord(handle.db, k, 'yashan', at(0));
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: 'yashan', virtue: null }, at(0))).toEqual({ ok: false, error: 'wrong-slot', message: "That's a Virtue, not a Ground." });
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: 'adamah' }, at(0))).toEqual({ ok: false, error: 'wrong-slot', message: "That's a Ground, not a Virtue." });
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: null, virtue: 'yashan' }, at(0))).toEqual({ ok: false, error: 'no-ground', message: PLOT_TEXT.NO_GROUND });
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: null, virtue: null }, at(0))).toEqual({ ok: false, error: 'no-ground', message: PLOT_TEXT.NO_GROUND });
    // Nothing was stored by a refusal.
    expect(await plotRow(k, 'plot-1')).toBeUndefined();
    // The first naming is free; the same sentence again is unchanged, at no cost; a change without the gin is insufficient.
    const named = value(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(HOUR)));
    expect(named.plots[0]).toEqual({
      id: 'plot-1',
      ground: 'adamah',
      virtue: null,
      namedAt: at(HOUR).toISOString(),
      virtueSetAt: null,
      sownAt: null,
      kind: 'field',
      pieces: [],
      level: 1,
      state: 'lit',
    });
    expect(await purse(k)).toBe(0);
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(2 * HOUR))).toEqual({ ok: false, error: 'unchanged', message: PLOT_TEXT.UNCHANGED });
    expect(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: 'yashan' }, at(2 * HOUR))).toEqual({ ok: false, error: 'insufficient', message: PLOT_TEXT.INSUFFICIENT });
    expect((await plotRow(k, 'plot-1'))?.virtue).toBeNull();
    expect((await inv.ledger(k)).filter((e) => e.reason === 'name-plot')).toEqual([]);
  });

  it('a rename costs 1 sealed gin from the purse (reason name-plot) and any change to either tile restarts the day count', async () => {
    const k = await namedKindled();
    await learnWord(handle.db, k, 'yashan', at(0));
    await inv.apply([{ kindledId: k, itemId: 'sealed-gin', place: 'purse', delta: 3 }], 'admin');
    value(await holding.namePlot(k, { plotId: 'plot-3', ground: 'adamah', virtue: 'yashan' }, at(0)));
    expect(await plotRow(k, 'plot-3')).toMatchObject({ ground: 'adamah', virtue: 'yashan', namedAt: at(0), virtueSetAt: at(0), virtuePausedMs: 0, sownAt: null });
    expect(await purse(k)).toBe(3);
    // Clearing the Virtue: paid, the count gone.
    const cleared = value(await holding.namePlot(k, { plotId: 'plot-3', ground: 'adamah', virtue: null }, at(DAY_MS)));
    expect(cleared.plots[2]).toMatchObject({ virtue: null, virtueSetAt: null, namedAt: at(0).toISOString() });
    expect(await purse(k)).toBe(2);
    // Filling it again: paid, the count from now.
    value(await holding.namePlot(k, { plotId: 'plot-3', ground: 'adamah', virtue: 'yashan' }, at(2 * DAY_MS)));
    expect(await plotRow(k, 'plot-3')).toMatchObject({ virtueSetAt: at(2 * DAY_MS), virtuePausedMs: 0 });
    expect(await purse(k)).toBe(1);
    expect((await inv.ledger(k)).filter((e) => e.reason === 'name-plot').map((e) => [e.itemId, e.place, e.delta, e.balanceAfter])).toEqual([
      ['sealed-gin', 'purse', -1, 2],
      ['sealed-gin', 'purse', -1, 1],
    ]);
    // Confirming the same sentence is not a rename: unchanged, and the gin stays.
    expect(await holding.namePlot(k, { plotId: 'plot-3', ground: 'adamah', virtue: 'yashan' }, at(3 * DAY_MS))).toMatchObject({ ok: false, error: 'unchanged' });
    expect(await purse(k)).toBe(1);
    // The plot's basket belongs to the plot: a rename never loses what it holds (seeded here by the admin grant).
    await inv.apply([{ kindledId: k, itemId: 'pale-grain', place: 'basket:plot-3', delta: 5 }], 'admin');
    value(await holding.namePlot(k, { plotId: 'plot-3', ground: 'adamah', virtue: null }, at(4 * DAY_MS)));
    expect(basket(value(await holding.view(k, at(4 * DAY_MS))), 'plot-3', 'pale-grain')).toBe(5);
    expect(await purse(k)).toBe(0);
  });
});

describe('sowing', () => {
  it('takes 1 grey seed from the store first, then the pack, reason sow; starts the cycle clock; every refusal', async () => {
    const k = await namedKindled('sower');
    expect(await holding.sowPlot(k, 'plot-9', at(0))).toEqual({ ok: false, error: 'unknown-plot', message: PLOT_TEXT.UNKNOWN_PLOT });
    expect(await holding.sowPlot(k, 'plot-1', at(0))).toEqual({ ok: false, error: 'unnamed-plot', message: PLOT_TEXT.UNNAMED_PLOT });
    value(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(0)));
    // Unsown: no cycle, and no work.
    const unsown = value(await holding.view(k, at(0)));
    expect(unsown.plots[0]?.sownAt).toBeNull();
    expect(unsown.cycles['plot-1']).toBeUndefined();
    expect(await holding.work(k, 'plot-1', at(0))).toEqual({ ok: false, error: 'not-sown', message: PLOT_TEXT.NOT_SOWN });
    expect(await holding.sowPlot(k, 'plot-1', at(0))).toEqual({ ok: false, error: 'insufficient', message: PLOT_TEXT.INSUFFICIENT });
    await inv.apply(
      [
        { kindledId: k, itemId: 'grey-seeds', place: 'store', delta: 1 },
        { kindledId: k, itemId: 'grey-seeds', place: 'pack', delta: 1 },
      ],
      'admin',
    );
    const sown = value(await holding.sowPlot(k, 'plot-1', at(HOUR)));
    expect(sown.plots[0]?.sownAt).toBe(at(HOUR).toISOString());
    expect(sown.cycles['plot-1']).toEqual({ cycleMs: 15 * MIN, cycledUntil: at(HOUR).toISOString(), bonusPermille: 0 });
    expect(await inv.view(k)).toMatchObject({ store: [], pack: [{ itemId: 'grey-seeds', quantity: 1 }] });
    expect((await inv.ledger(k)).filter((e) => e.reason === 'sow').map((e) => [e.itemId, e.place, e.delta])).toEqual([['grey-seeds', 'store', -1]]);
    expect(await holding.sowPlot(k, 'plot-1', at(HOUR))).toEqual({ ok: false, error: 'already-sown', message: PLOT_TEXT.ALREADY_SOWN });
    // Faded: frozen.
    value(await holding.namePlot(k, { plotId: 'plot-2', ground: 'adamah', virtue: null }, at(HOUR)));
    await setWrit(handle.db, { username: 'sower', darkHours: 100 }, at(HOUR));
    expect(await holding.sowPlot(k, 'plot-2', at(HOUR))).toEqual({ ok: false, error: 'faded', message: PLOT_TEXT.FADED });
  });

  it('a rename that keeps the Ground keeps the sowing', async () => {
    const k = await fieldKindled();
    await learnWord(handle.db, k, 'yashan', at(0));
    await inv.apply([{ kindledId: k, itemId: 'sealed-gin', place: 'purse', delta: 1 }], 'admin');
    const renamed = value(await holding.namePlot(k, { plotId: 'plot-1', ground: 'adamah', virtue: 'yashan' }, at(HOUR)));
    expect(renamed.plots[0]).toMatchObject({ ground: 'adamah', virtue: 'yashan', sownAt: at(0).toISOString() });
    expect(renamed.cycles['plot-1']).toMatchObject({ cycledUntil: at(HOUR).toISOString() });
  });
});

describe('work and take at a field', () => {
  it('farms 1 pale grain every 20 s for 20 Farming XP into the plot\'s basket; take all moves it to the store', async () => {
    const k = await fieldKindled();
    value(await holding.work(k, 'plot-1', at(0)));
    const r = value(await holding.view(k, at(65 * SEC)));
    expect(r.activity).toEqual({ stationId: 'plot-1', startedAt: at(0).toISOString(), cycleMs: 20_000 });
    expect(basket(r, 'plot-1', 'pale-grain')).toBe(3);
    expect(r.skills.farming).toMatchObject({ xp: 60, level: 2 });
    const taken = value(await holding.takeAll(k, 'plot-1', at(65 * SEC)));
    expect(taken.take).toEqual({ stationId: 'plot-1', moved: [{ itemId: 'pale-grain', quantity: 3 }], left: [] });
    expect((await inv.view(k)).store).toEqual(expect.arrayContaining([{ itemId: 'pale-grain', quantity: 3 }]) as unknown);
    expect((await inv.ledger(k)).filter((e) => e.reason === 'gather').map((e) => e.place)).toEqual(['basket:plot-1']);
  });

  it('refuses an unnamed plot, an unsown field and a faded plot; the grace (dark, not faded) allows work and take', async () => {
    const k = await fieldKindled('fieldfade', 48);
    expect(await holding.work(k, 'plot-2', at(0))).toEqual({ ok: false, error: 'unnamed-plot', message: PLOT_TEXT.UNNAMED_PLOT });
    expect(await holding.takeAll(k, 'plot-2', at(0))).toEqual({ ok: false, error: 'unnamed-plot', message: PLOT_TEXT.UNNAMED_PLOT });
    value(await holding.namePlot(k, { plotId: 'plot-2', ground: 'adamah', virtue: null }, at(0)));
    expect(await holding.work(k, 'plot-2', at(0))).toMatchObject({ ok: false, error: 'not-sown' });
    expect(value(await holding.takeAll(k, 'plot-2', at(0))).take).toEqual({ stationId: 'plot-2', moved: [], left: [] });
    // Dark at 48 h (the grace): still workable.
    const dark = value(await holding.work(k, 'plot-1', at(50 * HOUR)));
    expect(dark.writ.state).toBe('dark');
    expect(dark.plots[0]?.state).toBe('dark');
    expect(dark.activity?.stationId).toBe('plot-1');
    // Two cycles of the hands, over the 192 the trickle made while the Writ was lit.
    expect(basket(value(await holding.view(k, at(50 * HOUR + 40 * SEC))), 'plot-1', 'pale-grain')).toBe(192 + 2);
    // Faded at 96 h: frozen, and the stretch there is over.
    const faded = value(await holding.view(k, at(100 * HOUR)));
    expect(faded.plots[0]?.state).toBe('faded');
    expect(faded.activity).toBeNull();
    expect(await holding.work(k, 'plot-1', at(100 * HOUR))).toEqual({ ok: false, error: 'faded', message: PLOT_TEXT.FADED });
    expect(await holding.takeAll(k, 'plot-1', at(100 * HOUR))).toEqual({ ok: false, error: 'faded', message: PLOT_TEXT.FADED });
    expect(basket(faded, 'plot-1', 'pale-grain')).toBe(192 + 2);
  });
});

describe("the field's trickle", () => {
  it('15 min gives 1; 48 h away gives 192 and no more; the partial cycle after the cap is never paid', async () => {
    const k = await fieldKindled();
    expect(basket(value(await holding.view(k, at(15 * MIN - 1))), 'plot-1', 'pale-grain')).toBe(0);
    const one = value(await holding.view(k, at(15 * MIN)));
    expect(basket(one, 'plot-1', 'pale-grain')).toBe(1);
    expect(one.cycles['plot-1']).toMatchObject({ cycledUntil: at(15 * MIN).toISOString() });
    expect(one.skills.farming.xp).toBe(0);
    // Away 60 h from the last heartbeat (15 min): the cap pays 48 h, 192 cycles, and the clock restarts at now.
    const away = value(await holding.view(k, at(15 * MIN + 60 * HOUR)));
    expect(basket(away, 'plot-1', 'pale-grain')).toBe(1 + 192);
    expect(away.cycles['plot-1']?.cycledUntil).toBe(at(15 * MIN + 60 * HOUR).toISOString());
    expect(basket(value(await holding.view(k, at(15 * MIN + 60 * HOUR + 14 * MIN))), 'plot-1', 'pale-grain')).toBe(193);
    expect(basket(value(await holding.view(k, at(15 * MIN + 60 * HOUR + 15 * MIN))), 'plot-1', 'pale-grain')).toBe(194);
    // The ledger: harvest rows, each paying one stretch once, no XP anywhere.
    const harvests = (await inv.ledger(k)).filter((e) => e.reason === 'harvest' && e.place === 'basket:plot-1');
    expect(harvests.map((e) => e.delta)).toEqual([1, 192, 1]);
    expect(harvests[1]?.ref).toBe(cycleRef(k, 'plot-1', T0 + 15 * MIN, T0 + 15 * MIN + 48 * HOUR));
    expect(value(await holding.view(k, at(100 * HOUR))).skills.farming.xp).toBe(0);
  });

  it('pays up to emptyAt when the Writ goes dark mid-stretch; a relight starts a fresh clock with the dark time unpaid', async () => {
    const k = await fieldKindled('darkfield', 24);
    // Lit for 24 h from T0, away 30 h: 96 cycles, the clock at now.
    const dark = value(await holding.view(k, at(30 * HOUR)));
    expect(dark.writ.state).toBe('dark');
    expect(basket(dark, 'plot-1', 'pale-grain')).toBe(96);
    expect(dark.cycles['plot-1']?.cycledUntil).toBe(at(30 * HOUR).toISOString());
    // Nothing more while dark, however long.
    expect(basket(value(await holding.view(k, at(40 * HOUR))), 'plot-1', 'pale-grain')).toBe(96);
    // A relight at 40 h: the next cycle lands 15 min after it; the 16 dark hours are never paid.
    await inv.apply([{ kindledId: k, itemId: 'wild-sliver', place: 'store', delta: 1 }], 'admin');
    const relit = value(await holding.feed(k, 'wild-sliver', 1, at(40 * HOUR)));
    expect(relit.writ.state).toBe('lit');
    expect(relit.cycles['plot-1']?.cycledUntil).toBe(at(40 * HOUR).toISOString());
    expect(basket(value(await holding.view(k, at(40 * HOUR + 14 * MIN))), 'plot-1', 'pale-grain')).toBe(96);
    expect(basket(value(await holding.view(k, at(40 * HOUR + 15 * MIN))), 'plot-1', 'pale-grain')).toBe(97);
  });

  it('online for 3 days with the Writ lit pays every cycle, and a stretch pays once', async () => {
    const k = await fieldKindled();
    for (let h = 1; h <= 72; h++) value(await holding.view(k, at(h * HOUR)));
    const r = value(await holding.view(k, at(72 * HOUR)));
    expect(basket(r, 'plot-1', 'pale-grain')).toBe(288);
    expect(r.skills.farming.xp).toBe(0);
    const harvests = (await inv.ledger(k)).filter((e) => e.reason === 'harvest' && e.place === 'basket:plot-1');
    expect(harvests).toHaveLength(72);
    expect(harvests.every((e) => e.delta === 4)).toBe(true);
    // The same ref again is a duplicate: applied once.
    const again = await inv.apply([{ kindledId: k, itemId: 'pale-grain', place: 'basket:plot-1', delta: 4 }], 'harvest', { ref: harvests[0]?.ref ?? '' });
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(basket(value(await holding.view(k, at(72 * HOUR))), 'plot-1', 'pale-grain')).toBe(288);
  });

  it('the math: the end, the whole cycles and where the clock stands', () => {
    const writ = { emptyAt: T0 + 100 * HOUR };
    expect(cycleEnd(writ, at(0), at(10 * HOUR))).toBe(T0 + 10 * HOUR);
    expect(cycleEnd(writ, at(0), at(60 * HOUR))).toBe(T0 + 48 * HOUR);
    expect(cycleEnd({ emptyAt: T0 + 5 * HOUR }, at(0), at(10 * HOUR))).toBe(T0 + 5 * HOUR);
    expect(cycleEnd(writ, null, at(10 * HOUR))).toBe(T0 + 10 * HOUR);
    expect(cycleMath(T0, 15 * MIN, T0 + 50 * MIN, T0 + 50 * MIN)).toEqual({ n: 3, to: T0 + 45 * MIN, next: T0 + 45 * MIN });
    expect(cycleMath(T0, 15 * MIN, T0 + 50 * MIN, T0 + 70 * MIN)).toEqual({ n: 3, to: T0 + 45 * MIN, next: T0 + 70 * MIN });
    expect(cycleMath(T0 + HOUR, 15 * MIN, T0, T0 + 2 * HOUR)).toEqual({ n: 0, to: T0 + HOUR, next: T0 + 2 * HOUR });
  });
});

describe("the trees' trickle", () => {
  it("fills the trees' basket one log every 20 min (six trees at 2 h each), from the first settle on; the outcrop gets none", async () => {
    const k = await namedKindled();
    const start = value(await holding.view(k, at(0)));
    expect(start.cycles).toEqual({ 'twisted-trees': { cycleMs: 20 * MIN, cycledUntil: at(0).toISOString(), bonusPermille: 0 } });
    expect(basket(value(await holding.view(k, at(20 * MIN - 1))), 'twisted-trees', 'twisted-log')).toBe(0);
    expect(basket(value(await holding.view(k, at(20 * MIN))), 'twisted-trees', 'twisted-log')).toBe(1);
    const two = value(await holding.view(k, at(2 * HOUR)));
    expect(basket(two, 'twisted-trees', 'twisted-log')).toBe(6);
    expect(basket(two, 'stone-outcrop', 'black-stone')).toBe(0);
    expect(two.cycles['stone-outcrop']).toBeUndefined();
    expect(two.skills.woodcutting.xp).toBe(0);
    // 48 h away: 144 cycles, 144 logs, as the brief's shot.
    expect(basket(value(await holding.view(k, at(50 * HOUR))), 'twisted-trees', 'twisted-log')).toBe(6 + 144);
    const harvests = (await inv.ledger(k)).filter((e) => e.reason === 'harvest');
    expect(harvests.map((e) => [e.place, e.delta])).toEqual([
      ['basket:twisted-trees', 1],
      ['basket:twisted-trees', 5],
      ['basket:twisted-trees', 144],
    ]);
  });
});

describe("ישן's bonus on the trickle", () => {
  it('raises each cycle by the whole days kept, carries the remainder, and holds and pauses while the plot is faded', async () => {
    const k = await fieldKindled('yashan', 1000, 'yashan');
    // Day 1: 95 cycles at 0 and the one ending at 24 h at +1%: 96 grain, 10 carried.
    const day1 = value(await holding.view(k, at(24 * HOUR)));
    expect(basket(day1, 'plot-1', 'pale-grain')).toBe(96);
    expect(day1.cycles['plot-1']?.bonusPermille).toBe(10);
    const [clock1] = await handle.db.select().from(basketCycles).where(and(eq(basketCycles.kindledId, k), eq(basketCycles.stationId, 'plot-1')));
    expect(clock1?.carryPermille).toBe(10);
    // Day 2: 95 at +1%, one at +2%: 96,970 + 10 = 96,980: 96 grain, 980 carried.
    const day2 = value(await holding.view(k, at(48 * HOUR)));
    expect(basket(day2, 'plot-1', 'pale-grain')).toBe(192);
    const [clock2] = await handle.db.select().from(basketCycles).where(and(eq(basketCycles.kindledId, k), eq(basketCycles.stationId, 'plot-1')));
    expect(clock2?.carryPermille).toBe(980);
    // Day 3: 95 at +2%, one at +3%: 97,930 + 980 = 98,910: 98 grain, 910 carried. The hands' action is untouched by it.
    const day3 = value(await holding.view(k, at(72 * HOUR)));
    expect(basket(day3, 'plot-1', 'pale-grain')).toBe(290);
    expect(day3.cycles['plot-1']?.bonusPermille).toBe(30);
    expect(day3.skills.farming.xp).toBe(0);
  });

  it('the faded span is added at the relight, so the shown bonus holds still while faded and the count pauses', async () => {
    // Pressed to 48 h: dark at 48 h, faded at 96 h.
    const k = await fieldKindled('yashanfade', 48, 'yashan');
    const faded = value(await holding.view(k, at(100 * HOUR)));
    expect(faded.plots[0]?.state).toBe('faded');
    // Held at the moment the line faded: 4 whole days.
    expect(faded.cycles['plot-1']?.bonusPermille).toBe(40);
    expect(basket(faded, 'plot-1', 'pale-grain')).toBe(192);
    expect(value(await holding.view(k, at(130 * HOUR))).cycles['plot-1']?.bonusPermille).toBe(40);
    // The relight at 130 h adds the 34 faded hours; the count goes on from there: 130 − 34 = 96 h kept, 4 days.
    await inv.apply([{ kindledId: k, itemId: 'wild-sliver', place: 'store', delta: 1 }], 'admin');
    const relit = value(await holding.feed(k, 'wild-sliver', 1, at(130 * HOUR)));
    expect(relit.plots[0]?.state).toBe('lit');
    expect(relit.cycles['plot-1']?.bonusPermille).toBe(40);
    expect((await plotRow(k, 'plot-1'))?.virtuePausedMs).toBe(34 * HOUR);
    // The next cycle pays at +4%: 1040 permille on the 980 carried from the two lit days makes 2 grain.
    expect(basket(value(await holding.view(k, at(130 * HOUR + 15 * MIN))), 'plot-1', 'pale-grain')).toBe(192 + 2);
    // A day on it is 5.
    expect(value(await holding.view(k, at(154 * HOUR))).cycles['plot-1']?.bonusPermille).toBe(50);
    expect((await plotRow(k, 'plot-1'))?.virtuePausedMs).toBe(34 * HOUR);
  });
});

describe('the away hook and the cycles', () => {
  it("moves a sown field's clock back, so the next request pays the stretch", async () => {
    const k = await fieldKindled('awayfield');
    const moved = await moveAway(handle.db, { username: 'awayfield', hours: 48 });
    expect(moved).toMatchObject({ ok: true, activity: null, lastSeenAt: at(-48 * HOUR), cycles: { 'plot-1': at(-48 * HOUR), 'twisted-trees': at(-48 * HOUR) } });
    const r = value(await holding.view(k, at(0)));
    expect(basket(r, 'plot-1', 'pale-grain')).toBe(192);
    expect(basket(r, 'twisted-trees', 'twisted-log')).toBe(144);
  });
});

describe('the plot routes', () => {
  let app: App;
  const clock = { t: T0 };
  let cookie: string;

  const call = (url: string, { method = 'POST', body, auth = cookie }: { method?: 'GET' | 'POST'; body?: unknown; auth?: string } = {}) => {
    const opts: InjectOptions = {
      method,
      url,
      headers: { host: HOST, ...(method === 'POST' ? { origin: ORIGIN, 'content-type': 'application/json' } : {}), ...(auth ? { cookie: auth } : {}) },
    };
    if (method === 'POST') opts.payload = JSON.stringify(body ?? {});
    return app.http.inject(opts);
  };
  const sessionFrom = (res: LightMyRequestResponse): string => {
    const h = res.headers['set-cookie'];
    const pair = (Array.isArray(h) ? h[0] : h)?.split(';')[0];
    if (!pair?.startsWith(`${SESSION_COOKIE}=`)) throw new Error('no session cookie');
    return pair;
  };

  beforeAll(async () => {
    app = await createApp({ db: handle, now: () => new Date(clock.t) });
    const reg = await call(ApiRoute.Register, { body: { username: 'plotapi', password: 'correct horse' }, auth: '' });
    cookie = sessionFrom(reg);
    expect((await call(ApiRoute.Kindled, { body: { name: 'Iltani', remembrance: 'tide' } })).statusCode).toBe(201);
  });
  afterAll(async () => {
    await app.close();
  });

  it('guards every body, needs a session, and answers the codes: the word, the seeds, naming and sowing', async () => {
    for (const route of [ApiRoute.KeshWord, ApiRoute.KeshSeeds, ApiRoute.PlotsName, ApiRoute.PlotsSow])
      expect((await call(route, { body: {}, auth: '' })).statusCode).toBe(401);
    for (const bad of [{ word: 'adamah' }, []]) expect((await call(ApiRoute.KeshWord, { body: bad })).json()).toMatchObject({ error: 'bad-request' });
    for (const bad of [{ plotId: 'plot-1' }, { plotId: 'plot-1', ground: 'adamah' }, { plotId: 1, ground: 'adamah', virtue: null }, { plotId: 'plot-1', ground: 'adamah', virtue: null, more: 1 }])
      expect((await call(ApiRoute.PlotsName, { body: bad })).json(), JSON.stringify(bad)).toMatchObject({ error: 'bad-request' });
    for (const bad of [{}, { plotId: 1 }, { plotId: 'plot-1', seeds: 1 }])
      expect((await call(ApiRoute.PlotsSow, { body: bad })).json(), JSON.stringify(bad)).toMatchObject({ error: 'bad-request' });
    // Before the Name: the word isn't due, and a plot can't be named.
    expect((await call(ApiRoute.KeshWord, { body: {} })).statusCode).toBe(409);
    const unnamed = await call(ApiRoute.PlotsName, { body: { plotId: 'plot-1', ground: 'adamah', virtue: null } });
    expect(unnamed.statusCode).toBe(409);
    expect(unnamed.json()).toEqual({ error: 'unnamed', message: PLOT_TEXT.UNNAMED });
    expect((await call(ApiRoute.WritName, { body: { name: 'Black Rock' } })).statusCode).toBe(200);
    // The word: given once, then not-due.
    const word = await call(ApiRoute.KeshWord, { body: {} });
    expect(word.statusCode).toBe(200);
    const wordBody = word.json<HoldingResponse>();
    expect(isHoldingResponse(wordBody)).toBe(true);
    expect(wordBody.words).toEqual(['adamah']);
    expect(wordBody.kesh).toMatchObject({ wordDue: false, seedsDue: false });
    expect((await call(ApiRoute.KeshWord, { body: {} })).json()).toEqual({ error: 'not-due', message: KESH_NOT_DUE });
    // Naming: the codes and their statuses.
    const codes: [unknown, number, string][] = [
      [{ plotId: 'plot-9', ground: 'adamah', virtue: null }, 400, 'unknown-plot'],
      [{ plotId: 'plot-1', ground: 'shalom', virtue: null }, 400, 'unknown-word'],
      [{ plotId: 'plot-1', ground: null, virtue: null }, 400, 'no-ground'],
    ];
    for (const [body, status, error] of codes) {
      const res = await call(ApiRoute.PlotsName, { body });
      expect(res.statusCode, error).toBe(status);
      expect(res.json()).toMatchObject({ error });
    }
    const named = await call(ApiRoute.PlotsName, { body: { plotId: 'plot-1', ground: 'adamah', virtue: null } });
    expect(named.statusCode).toBe(200);
    const namedBody = named.json<HoldingResponse>();
    expect(isHoldingResponse(namedBody)).toBe(true);
    expect(namedBody.plots[0]).toMatchObject({ id: 'plot-1', ground: 'adamah', kind: 'field', sownAt: null });
    expect(namedBody.kesh.seedsDue).toBe(true);
    expect((await call(ApiRoute.PlotsName, { body: { plotId: 'plot-1', ground: 'adamah', virtue: null } })).statusCode).toBe(409);
    expect((await call(ApiRoute.PlotsName, { body: { plotId: 'plot-1', ground: 'adamah', virtue: 'yashan' } })).json()).toMatchObject({ error: 'unknown-word' });
    // Work before sowing: not-sown; sowing without a seed: insufficient; the seeds from Kesh, then sown.
    expect((await call(ApiRoute.HoldingWork, { body: { stationId: 'plot-1' } })).json()).toEqual({ error: 'not-sown', message: PLOT_TEXT.NOT_SOWN });
    expect((await call(ApiRoute.HoldingWork, { body: { stationId: 'plot-2' } })).json()).toEqual({ error: 'unnamed-plot', message: PLOT_TEXT.UNNAMED_PLOT });
    expect((await call(ApiRoute.PlotsSow, { body: { plotId: 'plot-1' } })).json()).toEqual({ error: 'insufficient', message: PLOT_TEXT.INSUFFICIENT });
    const seeds = await call(ApiRoute.KeshSeeds, { body: {} });
    expect(seeds.statusCode).toBe(200);
    expect(seeds.json<HoldingResponse>().kesh.seedsDue).toBe(false);
    expect((await call(ApiRoute.KeshSeeds, { body: {} })).statusCode).toBe(409);
    const sown = await call(ApiRoute.PlotsSow, { body: { plotId: 'plot-1' } });
    expect(sown.statusCode).toBe(200);
    expect(sown.json<HoldingResponse>().plots[0]?.sownAt).toBe(new Date(clock.t).toISOString());
    expect((await call(ApiRoute.PlotsSow, { body: { plotId: 'plot-1' } })).json()).toEqual({ error: 'already-sown', message: PLOT_TEXT.ALREADY_SOWN });
    expect((await call(ApiRoute.PlotsSow, { body: { plotId: 'plot-2' } })).statusCode).toBe(409);
    expect((await call(ApiRoute.Inventory, { method: 'GET' })).json()).toMatchObject({ pack: [{ itemId: 'grey-seeds', quantity: 3 }] });
    // Working the field through the route.
    expect((await call(ApiRoute.HoldingWork, { body: { stationId: 'plot-1' } })).json<HoldingResponse>().activity?.stationId).toBe('plot-1');
    clock.t += 20 * SEC;
    const worked = (await call(ApiRoute.Holding, { method: 'GET' })).json<HoldingResponse>();
    expect(worked.baskets['plot-1']).toEqual([{ itemId: 'pale-grain', quantity: 1 }]);
    expect(worked.skills.farming.xp).toBe(20);
    // Cross-origin: refused like every mutating route.
    const cross = await app.http.inject({
      method: 'POST',
      url: ApiRoute.PlotsName,
      headers: { host: HOST, origin: 'https://evil.test', 'content-type': 'application/json', cookie },
      payload: JSON.stringify({ plotId: 'plot-2', ground: 'adamah', virtue: null }),
    });
    expect(cross.statusCode).toBe(403);
  });
});
