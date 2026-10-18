import { ApiRoute, BUILD_TEXT, holdingLayout, isHoldingResponse, PLOT_TEXT, SESSION_COOKIE, type HoldingResponse, type PlotPieceRequest } from '@iot/shared';
import { and, eq } from 'drizzle-orm';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, basketCycles, kindled, plotPieces, writs } from '../src/db/schema.js';
import { createHolding, learnWord, listPieces, parsePiecesArgs, setWrit, type Holding } from '../src/holding/index.js';
import { createInventory, type Inventory } from '../src/inventory/index.js';

/**
 * Build mode on in-memory PGlite (docs/design/holding.md "Build mode", M2
 * Task 6): building with every refusal in the brief's order, the cost from
 * the store with reason `build` and the pack not counting, the limit at 2,
 * `needs-line` for the threshing floor; moving free and `blocked`; taking
 * down with the refund and `store-full` refusing whole; `faded` on all
 * three; the trickle at the old speed up to a build and the new one after,
 * the partial cycle carried; the level and the pieces in the answer; a
 * Ground-changing rename's refund; the CLI; the migration; the routes'
 * guards and codes. The race runs on a real Postgres in
 * holding.postgres.test.ts.
 */
const T0 = Date.parse('2026-10-17T12:00:00Z');
const at = (ms: number): Date => new Date(T0 + ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const HOST = 'game.test';
const ORIGIN = `https://${HOST}`;
const layout = holdingLayout();

let handle: DbHandle;
let inv: Inventory;
let holding: Holding;
let n = 0;

async function newKindled(username = `builder${++n}`): Promise<{ id: string; username: string }> {
  const [account] = await handle.db.insert(accounts).values({ username, passwordHash: 'x' }).returning();
  if (!account) throw new Error('no account');
  const [k] = await handle.db.insert(kindled).values({ accountId: account.id, name: 'Iltani', remembrance: 'tide', clayTone: 'clay-pale' }).returning();
  if (!k) throw new Error('no kindled');
  return { id: k.id, username };
}

/** A named Kindled whose plot-1 is a sown field at T0, with `logs` twisted logs, `stone` black stone and `grain` pale grain in the store. */
async function fieldKindled(opts: { username?: string; chargeHours?: number; logs?: number; stone?: number; grain?: number } = {}): Promise<{ id: string; username: string }> {
  const k = await newKindled(opts.username);
  await setWrit(handle.db, { username: k.username, chargeHours: opts.chargeHours ?? 1000 }, at(0));
  value(await holding.name(k.id, 'Ash', at(0)));
  await learnWord(handle.db, k.id, 'adamah', at(0));
  value(await holding.namePlot(k.id, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(0)));
  await inv.apply([{ kindledId: k.id, itemId: 'grey-seeds', place: 'pack', delta: 1 }], 'admin');
  value(await holding.sowPlot(k.id, 'plot-1', at(0)));
  const changes = [
    { itemId: 'twisted-log', delta: opts.logs ?? 0 },
    { itemId: 'black-stone', delta: opts.stone ?? 0 },
    { itemId: 'pale-grain', delta: opts.grain ?? 0 },
  ].filter((c) => c.delta > 0);
  if (changes.length > 0) await inv.apply(changes.map((c) => ({ kindledId: k.id, itemId: c.itemId, place: 'store' as const, delta: c.delta })), 'admin');
  return k;
}

const value = (r: Awaited<ReturnType<Holding['view']>>): HoldingResponse => {
  if (!r.ok) throw new Error(r.message);
  return r.value;
};
const basket = (r: HoldingResponse, station: string, itemId: string): number => r.baskets[station]?.find((e) => e.itemId === itemId)?.quantity ?? 0;
const store = async (k: string, itemId: string): Promise<number> => (await inv.view(k)).store.find((e) => e.itemId === itemId)?.quantity ?? 0;
const channel = (over: Partial<PlotPieceRequest> = {}): PlotPieceRequest => ({ plotId: 'plot-1', pieceId: 'clay-channel', col: 7, row: 7, rotation: 0, ...over });
const jars = (over: Partial<PlotPieceRequest> = {}): PlotPieceRequest => ({ plotId: 'plot-1', pieceId: 'seed-jars', col: 11, row: 12, rotation: 0, ...over });
const rows = async (k: string) => handle.db.select().from(plotPieces).where(eq(plotPieces.kindledId, k)).orderBy(plotPieces.pieceId);
const buildLedger = async (k: string) => (await inv.ledger(k)).filter((e) => e.reason === 'build').map((e) => [e.itemId, e.place, e.delta, e.balanceAfter]);

beforeAll(async () => {
  handle = await createDb();
  await handle.migrate();
  inv = createInventory(handle.db);
  holding = createHolding(handle.db, inv);
});
afterAll(async () => {
  await handle.close();
});

describe('building', () => {
  it("refuses in the brief's order: unknown-plot, unnamed-plot, faded, unknown-piece, already-built, needs-line, limit, blocked, insufficient", async () => {
    const k = await fieldKindled({ username: 'refusals', logs: 1000, stone: 1000, grain: 100 });
    expect(await holding.buildPiece(k.id, channel({ plotId: 'plot-9' }), at(0))).toEqual({ ok: false, error: 'unknown-plot', message: PLOT_TEXT.UNKNOWN_PLOT });
    expect(await holding.buildPiece(k.id, channel({ plotId: 'plot-2' }), at(0))).toEqual({ ok: false, error: 'unnamed-plot', message: PLOT_TEXT.UNNAMED_PLOT });
    // Not in pieces.json, not available (LORE's anvil, a station to come), not this plot's kind.
    for (const pieceId of ['workbench', 'anvil', 'chopping-block'])
      expect(await holding.buildPiece(k.id, channel({ pieceId }), at(0)), pieceId).toEqual({ ok: false, error: 'unknown-piece', message: BUILD_TEXT.UNKNOWN_PIECE });
    // The threshing floor needs Writ line 2, which nobody has in M2.
    expect(await holding.buildPiece(k.id, channel({ pieceId: 'threshing-floor', col: 10, row: 10 }), at(0))).toEqual({ ok: false, error: 'needs-line', message: 'Needs Writ line 2.' });
    // Blocked: outside the plot, over the signpost, over its interact tile; the message names the first reason.
    expect(await holding.buildPiece(k.id, channel({ col: 6 }), at(0))).toEqual({ ok: false, error: 'blocked', message: BUILD_TEXT.BLOCKED_BECAUSE('outside') });
    expect(await holding.buildPiece(k.id, channel({ col: 9 }), at(0))).toEqual({ ok: false, error: 'blocked', message: BUILD_TEXT.BLOCKED_BECAUSE('on-signpost') });
    expect(await holding.buildPiece(k.id, jars({ col: 8, row: 10 }), at(0))).toEqual({ ok: false, error: 'blocked', message: BUILD_TEXT.BLOCKED_BECAUSE('on-signpost') });
    expect(await rows(k.id)).toEqual([]);
    // Built: the cost from the store, reason build; the level 2, the cycle 12 min.
    const built = value(await holding.buildPiece(k.id, channel(), at(0)));
    expect(built.plots[0]).toMatchObject({ pieces: [{ pieceId: 'clay-channel', col: 7, row: 7, rotation: 0 }], level: 2 });
    expect(built.cycles['plot-1']?.cycleMs).toBe(12 * MIN);
    expect(await store(k.id, 'twisted-log')).toBe(700);
    expect(await store(k.id, 'black-stone')).toBe(850);
    expect(await buildLedger(k.id)).toEqual([
      ['twisted-log', 'store', -300, 700],
      ['black-stone', 'store', -150, 850],
    ]);
    expect(await rows(k.id)).toMatchObject([{ kindledId: k.id, plotId: 'plot-1', pieceId: 'clay-channel', col: 7, row: 7, rotation: 0, builtAt: at(0) }]);
    // Already built: each kind stands once per plot.
    expect(await holding.buildPiece(k.id, channel({ col: 8 }), at(0))).toEqual({ ok: false, error: 'already-built', message: BUILD_TEXT.ALREADY_BUILT });
    // Overlapping the channel.
    expect(await holding.buildPiece(k.id, jars({ col: 7, row: 8 }), at(0))).toEqual({ ok: false, error: 'blocked', message: BUILD_TEXT.BLOCKED_BECAUSE('overlaps') });
    // Insufficient: the pack doesn't count (GAME DESIGN: the materials leave the store).
    await inv.apply([{ kindledId: k.id, itemId: 'pale-grain', place: 'store', delta: -100 }], 'admin');
    await inv.apply([{ kindledId: k.id, itemId: 'pale-grain', place: 'pack', delta: 100 }], 'admin');
    expect(await holding.buildPiece(k.id, jars(), at(0))).toEqual({ ok: false, error: 'insufficient', message: BUILD_TEXT.INSUFFICIENT });
    expect(await store(k.id, 'twisted-log')).toBe(700);
    await inv.apply([{ kindledId: k.id, itemId: 'pale-grain', place: 'store', delta: 40 }], 'admin');
    const two = value(await holding.buildPiece(k.id, jars(), at(MIN)));
    expect(two.plots[0]?.level).toBe(3);
    expect(two.plots[0]?.pieces.map((p) => p.pieceId)).toEqual(['clay-channel', 'seed-jars']);
    expect(two.cycles['plot-1']?.cycleMs).toBe(10 * MIN);
    // The limit: two pieces per Writ line, so a third is refused whatever it is (the floor would need line 2 anyway: that comes first).
    expect(await holding.buildPiece(k.id, channel({ pieceId: 'threshing-floor', col: 10, row: 10 }), at(MIN))).toMatchObject({ ok: false, error: 'needs-line' });
    await handle.db.update(plotPieces).set({ pieceId: 'drying-rack' }).where(and(eq(plotPieces.kindledId, k.id), eq(plotPieces.pieceId, 'seed-jars')));
    expect(await holding.buildPiece(k.id, jars(), at(MIN))).toEqual({ ok: false, error: 'limit', message: BUILD_TEXT.LIMIT });
    await handle.db.update(plotPieces).set({ pieceId: 'seed-jars' }).where(and(eq(plotPieces.kindledId, k.id), eq(plotPieces.pieceId, 'drying-rack')));
  });

  it('blocks a piece that would wall the signpost off, and refuses the lot while the plot is faded (its pieces frozen)', async () => {
    const k = await fieldKindled({ username: 'walls', chargeHours: 48, logs: 2000, stone: 2000, grain: 200 });
    // Two field pieces alone can't enclose the interact tile (its three free neighbours aren't in a line), so the Writ is given
    // its second line here (nobody has one in M2): the threshing floor east of the signpost, a channel down col 8 (rows
    // 7..10) west of it, and the jars under its interact tile at (9, 11) would wall (9, 10) off from every edge.
    await handle.db.update(writs).set({ lines: 2 }).where(eq(writs.kindledId, k.id));
    value(await holding.buildPiece(k.id, channel({ pieceId: 'threshing-floor', col: 10, row: 8 }), at(0)));
    value(await holding.buildPiece(k.id, channel({ col: 8 }), at(0)));
    expect(await holding.buildPiece(k.id, jars({ col: 9, row: 11 }), at(0))).toEqual({ ok: false, error: 'blocked', message: BUILD_TEXT.BLOCKED_BECAUSE('blocks-signpost') });
    value(await holding.buildPiece(k.id, jars({ col: 7, row: 12 }), at(0)));
    // Faded at 130 h (dark at 48, the grace 48, line 1 of two fades a day after line 2): every route refuses, the pieces stay.
    const faded = value(await holding.view(k.id, at(130 * HOUR)));
    expect(faded.plots[0]).toMatchObject({ state: 'faded', level: 4 });
    expect(faded.plots[0]?.pieces).toHaveLength(3);
    expect(await holding.buildPiece(k.id, jars({ col: 10, row: 12 }), at(130 * HOUR))).toEqual({ ok: false, error: 'faded', message: PLOT_TEXT.FADED });
    expect(await holding.movePiece(k.id, jars({ col: 11, row: 12 }), at(130 * HOUR))).toEqual({ ok: false, error: 'faded', message: PLOT_TEXT.FADED });
    expect(await holding.takeDownPiece(k.id, { plotId: 'plot-1', pieceId: 'seed-jars' }, at(130 * HOUR))).toEqual({ ok: false, error: 'faded', message: PLOT_TEXT.FADED });
    expect(await rows(k.id)).toHaveLength(3);
  });
});

describe('moving and taking down', () => {
  it('moves a standing piece for free (it does not block itself), refuses not-built and blocked', async () => {
    const k = await fieldKindled({ username: 'mover', logs: 300, stone: 150 });
    expect(await holding.movePiece(k.id, channel({ col: 8 }), at(0))).toEqual({ ok: false, error: 'not-built', message: BUILD_TEXT.NOT_BUILT });
    expect(await holding.movePiece(k.id, channel({ plotId: 'plot-2' }), at(0))).toMatchObject({ ok: false, error: 'unnamed-plot' });
    expect(await holding.movePiece(k.id, channel({ plotId: 'plot-9' }), at(0))).toMatchObject({ ok: false, error: 'unknown-plot' });
    value(await holding.buildPiece(k.id, channel(), at(0)));
    expect(await store(k.id, 'twisted-log')).toBe(0);
    const moved = value(await holding.movePiece(k.id, channel({ col: 12, row: 9, rotation: 180 }), at(MIN)));
    expect(moved.plots[0]?.pieces).toEqual([{ pieceId: 'clay-channel', col: 12, row: 9, rotation: 180 }]);
    // Free: no ledger row, the same level.
    expect((await buildLedger(k.id)).length).toBe(2);
    expect(moved.plots[0]?.level).toBe(2);
    // Onto itself, turned: free of itself; outside, or onto the signpost: blocked.
    value(await holding.movePiece(k.id, channel({ col: 7, row: 12, rotation: 90 }), at(MIN)));
    expect(await holding.movePiece(k.id, channel({ col: 10, row: 12, rotation: 90 }), at(MIN))).toEqual({ ok: false, error: 'blocked', message: BUILD_TEXT.BLOCKED_BECAUSE('outside') });
    expect(await holding.movePiece(k.id, channel({ col: 9, row: 7 }), at(MIN))).toEqual({ ok: false, error: 'blocked', message: BUILD_TEXT.BLOCKED_BECAUSE('on-signpost') });
    expect(await holding.movePiece(k.id, jars(), at(MIN))).toMatchObject({ ok: false, error: 'not-built' });
    expect((await rows(k.id))[0]).toMatchObject({ col: 7, row: 12, rotation: 90 });
  });

  it('takes a piece down with every material back into the store (reason build, positive), or refuses whole as store-full', async () => {
    const k = await fieldKindled({ username: 'downer', logs: 300, stone: 150 });
    expect(await holding.takeDownPiece(k.id, { plotId: 'plot-1', pieceId: 'clay-channel' }, at(0))).toEqual({ ok: false, error: 'not-built', message: BUILD_TEXT.NOT_BUILT });
    value(await holding.buildPiece(k.id, channel(), at(0)));
    // The store filled to the brim with stone: the refund's stone doesn't fit, so nothing comes back and the piece stays.
    await inv.apply([{ kindledId: k.id, itemId: 'black-stone', place: 'store', delta: 9900 }], 'admin');
    expect(await holding.takeDownPiece(k.id, { plotId: 'plot-1', pieceId: 'clay-channel' }, at(MIN))).toEqual({ ok: false, error: 'store-full', message: 'Store: black stones full.' });
    expect(await store(k.id, 'twisted-log')).toBe(0);
    expect(await store(k.id, 'black-stone')).toBe(9900);
    expect(await rows(k.id)).toHaveLength(1);
    await inv.apply([{ kindledId: k.id, itemId: 'black-stone', place: 'store', delta: -100 }], 'admin');
    const down = value(await holding.takeDownPiece(k.id, { plotId: 'plot-1', pieceId: 'clay-channel' }, at(2 * MIN)));
    expect(down.plots[0]).toMatchObject({ pieces: [], level: 1 });
    expect(down.cycles['plot-1']?.cycleMs).toBe(15 * MIN);
    expect(await store(k.id, 'twisted-log')).toBe(300);
    expect(await store(k.id, 'black-stone')).toBe(9950);
    expect(await buildLedger(k.id)).toEqual([
      ['twisted-log', 'store', -300, 0],
      ['black-stone', 'store', -150, 0],
      ['twisted-log', 'store', 300, 300],
      ['black-stone', 'store', 150, 9950],
    ]);
    expect(await rows(k.id)).toEqual([]);
  });
});

describe('the trickle with pieces', () => {
  it('pays the stretch before a build at the old speed and the one after at the new, the partial cycle carried on', async () => {
    const k = await fieldKindled({ username: 'trickler', logs: 300, stone: 150 });
    // 40 min at 15 min a cycle: 2 cycles paid, the clock at 30 min; the build settles that first, and leaves the clock there.
    const built = value(await holding.buildPiece(k.id, channel(), at(40 * MIN)));
    expect(basket(built, 'plot-1', 'pale-grain')).toBe(2);
    expect(built.cycles['plot-1']).toEqual({ cycleMs: 12 * MIN, cycledUntil: at(30 * MIN).toISOString(), bonusPermille: 0 });
    // The partial cycle (10 min in at the old speed) carries on at the new: the next lands 12 min after 30 min, at 42, not 45.
    expect(basket(value(await holding.view(k.id, at(41 * MIN))), 'plot-1', 'pale-grain')).toBe(2);
    expect(basket(value(await holding.view(k.id, at(42 * MIN))), 'plot-1', 'pale-grain')).toBe(3);
    // Then every 12 min: by 2 h 30 the clock has run 30 + 12 × 10 = 150 min: 10 cycles since the build, 12 in all.
    const later = value(await holding.view(k.id, at(150 * MIN)));
    expect(basket(later, 'plot-1', 'pale-grain')).toBe(12);
    expect(later.cycles['plot-1']?.cycledUntil).toBe(at(150 * MIN).toISOString());
    const [clock] = await handle.db.select().from(basketCycles).where(and(eq(basketCycles.kindledId, k.id), eq(basketCycles.stationId, 'plot-1')));
    expect(clock?.cycledUntil).toEqual(at(150 * MIN));
    // Taking the piece down: back to 15 min from where the clock stands.
    value(await holding.takeDownPiece(k.id, { plotId: 'plot-1', pieceId: 'clay-channel' }, at(150 * MIN)));
    expect(basket(value(await holding.view(k.id, at(164 * MIN))), 'plot-1', 'pale-grain')).toBe(12);
    expect(basket(value(await holding.view(k.id, at(165 * MIN))), 'plot-1', 'pale-grain')).toBe(13);
  });
});

describe('a rename that changes the Ground', () => {
  it('takes every piece down with its refund, which may overfill the store', async () => {
    const k = await fieldKindled({ username: 'regrounder', logs: 500, stone: 150, grain: 40 });
    value(await holding.buildPiece(k.id, channel(), at(0)));
    value(await holding.buildPiece(k.id, jars(), at(0)));
    expect(await store(k.id, 'twisted-log')).toBe(0);
    // M2 has one Ground, so a Ground change is only the rule: a second Ground word is faked in the row to exercise it.
    await inv.apply([{ kindledId: k.id, itemId: 'sealed-gin', place: 'purse', delta: 1 }], 'admin');
    await inv.apply([{ kindledId: k.id, itemId: 'twisted-log', place: 'store', delta: 9800 }], 'admin');
    await handle.db.execute(`update plots set ground = 'yashan' where kindled_id = '${k.id}' and plot_id = 'plot-1'`);
    const renamed = value(await holding.namePlot(k.id, { plotId: 'plot-1', ground: 'adamah', virtue: null }, at(MIN)));
    expect(renamed.plots[0]).toMatchObject({ ground: 'adamah', sownAt: null, pieces: [], level: 1 });
    // 9800 + 300 + 200: past the store's 9999, refunded anyway (nothing is ever destroyed).
    expect(await store(k.id, 'twisted-log')).toBe(10_300);
    expect(await store(k.id, 'black-stone')).toBe(150);
    expect(await store(k.id, 'pale-grain')).toBe(40);
    expect(await rows(k.id)).toEqual([]);
    expect((await inv.ledger(k.id)).filter((e) => e.reason === 'build' && e.delta > 0).map((e) => [e.itemId, e.delta])).toEqual([
      ['twisted-log', 500],
      ['black-stone', 150],
      ['pale-grain', 40],
    ]);
  });
});

describe('the CLI', () => {
  it('plots:pieces lists a plot\'s pieces and --clear takes them all down with their refunds, overfilling if it must', async () => {
    const k = await fieldKindled({ username: 'cleaner', logs: 500, stone: 150, grain: 40 });
    expect(parsePiecesArgs(['cleaner', 'plot-1'], layout)).toEqual({ ok: true, args: { username: 'cleaner', plotId: 'plot-1', clear: false } });
    expect(parsePiecesArgs(['--', 'cleaner', 'plot-1', '--clear'], layout)).toEqual({ ok: true, args: { username: 'cleaner', plotId: 'plot-1', clear: true } });
    expect(parsePiecesArgs(['cleaner'], layout)).toMatchObject({ ok: false });
    expect(parsePiecesArgs(['cleaner', 'plot-9'], layout)).toMatchObject({ ok: false, message: expect.stringContaining('unknown plot plot-9') as unknown });
    expect(parsePiecesArgs(['!!', 'plot-1'], layout)).toMatchObject({ ok: false });
    expect(await listPieces(handle.db, { username: 'nobody', plotId: 'plot-1' })).toEqual({ ok: false, message: 'no Kindled for username nobody' });
    expect(await listPieces(handle.db, { username: 'Cleaner', plotId: 'plot-1' })).toEqual({ ok: true, kindledId: k.id, pieces: [] });
    value(await holding.buildPiece(k.id, channel(), at(0)));
    value(await holding.buildPiece(k.id, jars(), at(0)));
    expect(await listPieces(handle.db, { username: 'cleaner', plotId: 'plot-1' })).toEqual({
      ok: true,
      kindledId: k.id,
      pieces: [
        { pieceId: 'clay-channel', col: 7, row: 7, rotation: 0 },
        { pieceId: 'seed-jars', col: 11, row: 12, rotation: 0 },
      ],
    });
    await inv.apply([{ kindledId: k.id, itemId: 'twisted-log', place: 'store', delta: 9999 }], 'admin');
    expect(await holding.clearPieces(k.id, 'plot-1', at(MIN))).toEqual({
      ok: true,
      value: {
        refund: [
          { itemId: 'twisted-log', quantity: 500 },
          { itemId: 'black-stone', quantity: 150 },
          { itemId: 'pale-grain', quantity: 40 },
        ],
      },
    });
    expect(await store(k.id, 'twisted-log')).toBe(10_499);
    expect(await listPieces(handle.db, { username: 'cleaner', plotId: 'plot-1' })).toMatchObject({ ok: true, pieces: [] });
    expect(await holding.clearPieces(k.id, 'plot-1', at(MIN))).toEqual({ ok: true, value: { refund: [] } });
    expect(await holding.clearPieces(k.id, 'plot-9', at(MIN))).toMatchObject({ ok: false, error: 'unknown-plot' });
  });
});

describe('the build routes', () => {
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
    const reg = await call(ApiRoute.Register, { body: { username: 'buildapi', password: 'correct horse' }, auth: '' });
    cookie = sessionFrom(reg);
    expect((await call(ApiRoute.Kindled, { body: { name: 'Iltani', remembrance: 'tide' } })).statusCode).toBe(201);
  });
  afterAll(async () => {
    await app.close();
  });

  it('guards every body, needs a session, and answers the codes', async () => {
    for (const route of [ApiRoute.PlotsBuild, ApiRoute.PlotsMove, ApiRoute.PlotsTakeDown])
      expect((await call(route, { body: {}, auth: '' })).statusCode).toBe(401);
    const body = channel();
    for (const bad of [{}, { ...body, rotation: 45 }, { ...body, col: -1 }, { ...body, more: 1 }, { plotId: 'plot-1', pieceId: 'clay-channel' }])
      for (const route of [ApiRoute.PlotsBuild, ApiRoute.PlotsMove])
        expect((await call(route, { body: bad })).json(), `${route} ${JSON.stringify(bad)}`).toMatchObject({ error: 'bad-request' });
    for (const bad of [{}, { plotId: 'plot-1' }, { plotId: 'plot-1', pieceId: 'clay-channel', col: 1 }])
      expect((await call(ApiRoute.PlotsTakeDown, { body: bad })).json(), JSON.stringify(bad)).toMatchObject({ error: 'bad-request' });
    // Unnamed: the plot has no word (the island has no Name either, but the plot is judged first here).
    expect((await call(ApiRoute.PlotsBuild, { body })).statusCode).toBe(409);
    expect((await call(ApiRoute.PlotsBuild, { body: { ...body, plotId: 'plot-9' } })).statusCode).toBe(400);
    // The island named, the word learned, the plot named and sown through the routes; the materials by the grant.
    expect((await call(ApiRoute.WritName, { body: { name: 'Black Rock' } })).statusCode).toBe(200);
    expect((await call(ApiRoute.KeshWord, { body: {} })).statusCode).toBe(200);
    expect((await call(ApiRoute.PlotsName, { body: { plotId: 'plot-1', ground: 'adamah', virtue: null } })).statusCode).toBe(200);
    expect((await call(ApiRoute.KeshSeeds, { body: {} })).statusCode).toBe(200);
    expect((await call(ApiRoute.PlotsSow, { body: { plotId: 'plot-1' } })).statusCode).toBe(200);
    const [k] = await handle.db.select({ id: kindled.id }).from(kindled).innerJoin(accounts, eq(kindled.accountId, accounts.id)).where(eq(accounts.username, 'buildapi'));
    if (!k) throw new Error('no Kindled');
    const codes: [string, unknown, number, string][] = [
      [ApiRoute.PlotsBuild, { ...body, pieceId: 'anvil' }, 400, 'unknown-piece'],
      [ApiRoute.PlotsBuild, { ...body, pieceId: 'threshing-floor', col: 10, row: 10 }, 409, 'needs-line'],
      [ApiRoute.PlotsBuild, { ...body, col: 9 }, 400, 'blocked'],
      [ApiRoute.PlotsBuild, body, 409, 'insufficient'],
      [ApiRoute.PlotsMove, body, 409, 'not-built'],
      [ApiRoute.PlotsTakeDown, { plotId: 'plot-1', pieceId: 'clay-channel' }, 409, 'not-built'],
    ];
    for (const [route, b, status, error] of codes) {
      const res = await call(route, { body: b });
      expect(res.statusCode, error).toBe(status);
      expect(res.json()).toMatchObject({ error });
    }
    await inv.apply(
      [
        { kindledId: k.id, itemId: 'twisted-log', place: 'store', delta: 300 },
        { kindledId: k.id, itemId: 'black-stone', place: 'store', delta: 150 },
      ],
      'admin',
    );
    const built = await call(ApiRoute.PlotsBuild, { body });
    expect(built.statusCode).toBe(200);
    const builtBody = built.json<HoldingResponse>();
    expect(isHoldingResponse(builtBody)).toBe(true);
    expect(builtBody.plots[0]).toMatchObject({ level: 2, pieces: [{ pieceId: 'clay-channel', col: 7, row: 7, rotation: 0 }] });
    expect((await call(ApiRoute.PlotsBuild, { body })).json()).toMatchObject({ error: 'already-built' });
    expect((await call(ApiRoute.Inventory, { method: 'GET' })).json()).toMatchObject({ store: [] });
    const moved = await call(ApiRoute.PlotsMove, { body: { ...body, col: 12, rotation: 180 } });
    expect(moved.statusCode).toBe(200);
    expect(moved.json<HoldingResponse>().plots[0]?.pieces).toEqual([{ pieceId: 'clay-channel', col: 12, row: 7, rotation: 180 }]);
    await inv.apply([{ kindledId: k.id, itemId: 'black-stone', place: 'store', delta: 9900 }], 'admin');
    const full = await call(ApiRoute.PlotsTakeDown, { body: { plotId: 'plot-1', pieceId: 'clay-channel' } });
    expect(full.statusCode).toBe(409);
    expect(full.json()).toEqual({ error: 'store-full', message: 'Store: black stones full.' });
    await inv.apply([{ kindledId: k.id, itemId: 'black-stone', place: 'store', delta: -9900 }], 'admin');
    const down = await call(ApiRoute.PlotsTakeDown, { body: { plotId: 'plot-1', pieceId: 'clay-channel' } });
    expect(down.statusCode).toBe(200);
    expect(down.json<HoldingResponse>().plots[0]).toMatchObject({ level: 1, pieces: [] });
    expect((await call(ApiRoute.Inventory, { method: 'GET' })).json()).toMatchObject({
      store: [
        { itemId: 'twisted-log', quantity: 300 },
        { itemId: 'black-stone', quantity: 150 },
      ],
    });
    // Cross-origin: refused like every mutating route.
    const cross = await app.http.inject({
      method: 'POST',
      url: ApiRoute.PlotsBuild,
      headers: { host: HOST, origin: 'https://evil.test', 'content-type': 'application/json', cookie },
      payload: JSON.stringify(body),
    });
    expect(cross.statusCode).toBe(403);
  });
});
