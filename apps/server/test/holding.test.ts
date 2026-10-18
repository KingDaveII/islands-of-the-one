import {
  ApiRoute,
  HOLDING_LAYOUT_ID,
  isHoldingResponse,
  OFFLINE_CAP_MS,
  SESSION_COOKIE,
  skillProgress,
  type HoldingResponse,
} from '@iot/shared';
import { eq } from 'drizzle-orm';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, holdingActivity, kindled, skillXp } from '../src/db/schema.js';
import { createHolding, fitsInStore, moveAway, parseAwayArgs, settleMath, settleRef, type Holding } from '../src/holding/index.js';
import { createInventory, type Inventory } from '../src/inventory/index.js';

/**
 * The holding's active action on in-memory PGlite (docs/design/holding.md):
 * the settle math (a partial cycle, many cycles, exactly the cap, lost time
 * past it never paid, a switch settling the old station, a stop), XP and
 * level-ups, take-all moving only what fits, the API's guards and error
 * codes, the migration and the away hook. The races run on a real Postgres
 * in holding.postgres.test.ts.
 */
const T0 = Date.parse('2026-10-17T12:00:00Z');
const at = (ms: number): Date => new Date(T0 + ms);
const SEC = 1000;
const HOUR = 60 * 60 * SEC;
const HOST = 'game.test';
const ORIGIN = `https://${HOST}`;

let handle: DbHandle;
let inv: Inventory;
let holding: Holding;
let n = 0;

async function newKindled(username = `holder${++n}`): Promise<string> {
  const [account] = await handle.db.insert(accounts).values({ username, passwordHash: 'x' }).returning();
  if (!account) throw new Error('no account');
  const [k] = await handle.db
    .insert(kindled)
    .values({ accountId: account.id, name: 'Iltani', remembrance: 'tide', clayTone: 'clay-pale' })
    .returning();
  if (!k) throw new Error('no kindled');
  return k.id;
}

const basket = (r: HoldingResponse, station: string, itemId: string): number =>
  r.baskets[station]?.find((e) => e.itemId === itemId)?.quantity ?? 0;
const value = (r: Awaited<ReturnType<Holding['view']>>): HoldingResponse => {
  if (!r.ok) throw new Error(r.message);
  return r.value;
};

beforeAll(async () => {
  handle = await createDb();
  await handle.migrate();
  inv = createInventory(handle.db);
  holding = createHolding(handle.db, inv);
});
afterAll(async () => {
  await handle.close();
});

describe('migration 0004', () => {
  it('creates holding_activity and skill_xp, empty', async () => {
    await expect(handle.db.select().from(holdingActivity).limit(1)).resolves.toEqual([]);
    await expect(handle.db.select().from(skillXp).limit(1)).resolves.toEqual([]);
  });
});

describe('the settle', () => {
  it('answers the layout, every basket, no action and level 1 skills for a fresh Kindled', async () => {
    const k = await newKindled();
    const r = value(await holding.view(k, at(0)));
    expect(isHoldingResponse(r)).toBe(true);
    expect(r).toEqual({
      layoutId: HOLDING_LAYOUT_ID,
      baskets: { 'writ-post': [], 'holding-store': [], 'weapon-rack': [], 'twisted-trees': [], 'stone-outcrop': [] },
      activity: null,
      now: at(0).toISOString(),
      skills: {
        woodcutting: { xp: 0, level: 1, into: 0, toNext: 40 },
        mining: { xp: 0, level: 1, into: 0, toNext: 40 },
        farming: { xp: 0, level: 1, into: 0, toNext: 40 },
      },
    });
  });

  it('credits nothing for a partial cycle, then whole cycles only, into the basket and the skill', async () => {
    const k = await newKindled();
    const started = value(await holding.work(k, 'twisted-trees', at(0)));
    expect(started.activity).toEqual({ stationId: 'twisted-trees', startedAt: at(0).toISOString(), cycleMs: 4000 });
    const partial = value(await holding.view(k, at(3 * SEC)));
    expect(basket(partial, 'twisted-trees', 'twisted-log')).toBe(0);
    expect(partial.skills.woodcutting.xp).toBe(0);
    const two = value(await holding.view(k, at(9 * SEC)));
    expect(basket(two, 'twisted-trees', 'twisted-log')).toBe(2);
    expect(two.skills.woodcutting).toEqual({ xp: 8, level: 1, into: 8, toNext: 32 });
    expect(two.activity?.startedAt).toBe(at(0).toISOString());
    const many = value(await holding.view(k, at(100 * SEC)));
    expect(basket(many, 'twisted-trees', 'twisted-log')).toBe(25);
    expect(many.skills.woodcutting).toEqual(skillProgress(100));
    // The ledger: gather rows with the stretch's ref, each paying the cycles since the last.
    const ledger = await inv.ledger(k);
    expect(ledger.map((e) => [e.reason, e.place, e.delta, e.ref])).toEqual([
      ['gather', 'basket:twisted-trees', 2, settleRef(k, at(0), 0, 2)],
      ['gather', 'basket:twisted-trees', 23, settleRef(k, at(0), 2, 25)],
    ]);
    const [row] = await handle.db.select().from(holdingActivity).where(eq(holdingActivity.kindledId, k));
    expect(row).toMatchObject({ stationId: 'twisted-trees', creditedCycles: 25, startedAt: at(0), lastSeenAt: at(100 * SEC) });
  });

  it('pays exactly 48 h away in full, and restarts the clock after 60 h so the lost 12 h are never paid', async () => {
    const k = await newKindled();
    await holding.work(k, 'stone-outcrop', at(0));
    const cap = value(await holding.view(k, at(OFFLINE_CAP_MS)));
    expect(basket(cap, 'stone-outcrop', 'black-stone')).toBe(OFFLINE_CAP_MS / 6000);
    expect(cap.activity?.startedAt).toBe(at(0).toISOString());
    // Away another 60 h: the next 48 h pay, the 12 h past the cap are lost and the cycle clock starts afresh.
    const away = value(await holding.view(k, at(OFFLINE_CAP_MS + 60 * HOUR)));
    expect(basket(away, 'stone-outcrop', 'black-stone')).toBe((2 * OFFLINE_CAP_MS) / 6000);
    expect(away.activity?.startedAt).toBe(at(OFFLINE_CAP_MS + 60 * HOUR).toISOString());
    const [row] = await handle.db.select().from(holdingActivity).where(eq(holdingActivity.kindledId, k));
    expect(row?.creditedCycles).toBe(0);
    // Ten seconds on: one more stone, counted from the restart, not from the lost time.
    const on = value(await holding.view(k, at(OFFLINE_CAP_MS + 60 * HOUR + 10 * SEC)));
    expect(basket(on, 'stone-outcrop', 'black-stone')).toBe((2 * OFFLINE_CAP_MS) / 6000 + 1);
    expect(on.skills.mining.xp).toBe(((2 * OFFLINE_CAP_MS) / 6000 + 1) * 6);
  });

  it('settles the old station before a switch, and a stop settles then clears', async () => {
    const k = await newKindled();
    await holding.work(k, 'twisted-trees', at(0));
    const switched = value(await holding.work(k, 'stone-outcrop', at(10 * SEC)));
    expect(basket(switched, 'twisted-trees', 'twisted-log')).toBe(2);
    expect(switched.skills.woodcutting.xp).toBe(8);
    expect(switched.activity).toEqual({ stationId: 'stone-outcrop', startedAt: at(10 * SEC).toISOString(), cycleMs: 6000 });
    const later = value(await holding.view(k, at(22 * SEC)));
    expect(basket(later, 'stone-outcrop', 'black-stone')).toBe(2);
    expect(basket(later, 'twisted-trees', 'twisted-log')).toBe(2);
    const stopped = value(await holding.stop(k, at(31 * SEC)));
    expect(basket(stopped, 'stone-outcrop', 'black-stone')).toBe(3);
    expect(stopped.activity).toBeNull();
    const idle = value(await holding.view(k, at(500 * SEC)));
    expect(basket(idle, 'stone-outcrop', 'black-stone')).toBe(3);
    expect(idle.activity).toBeNull();
    // Stopping with nothing running is fine.
    expect(value(await holding.stop(k, at(600 * SEC))).activity).toBeNull();
  });

  it('levels the skill up on the curve', async () => {
    const k = await newKindled();
    await holding.work(k, 'twisted-trees', at(0));
    expect(value(await holding.view(k, at(36 * SEC))).skills.woodcutting).toEqual({ xp: 36, level: 1, into: 36, toNext: 4 });
    expect(value(await holding.view(k, at(40 * SEC))).skills.woodcutting).toEqual({ xp: 40, level: 2, into: 0, toNext: 1103 });
    expect(value(await holding.view(k, at(44 * SEC))).skills.woodcutting).toEqual({ xp: 44, level: 2, into: 4, toNext: 1099 });
    const [row] = await handle.db.select().from(skillXp).where(eq(skillXp.kindledId, k));
    expect(row).toMatchObject({ skill: 'woodcutting', xp: 44 });
  });

  it('the math: cycles by the end, the due ones past the credited, lost time past the horizon', () => {
    const row = { startedAt: at(0), creditedCycles: 2, lastSeenAt: at(0) };
    expect(settleMath(row, 4000, at(9 * SEC), OFFLINE_CAP_MS)).toEqual({ end: at(9 * SEC), cycles: 2, due: 0, lost: false });
    expect(settleMath(row, 4000, at(13 * SEC), OFFLINE_CAP_MS)).toEqual({ end: at(13 * SEC), cycles: 3, due: 1, lost: false });
    expect(settleMath(row, 4000, at(OFFLINE_CAP_MS), OFFLINE_CAP_MS).lost).toBe(false);
    expect(settleMath(row, 4000, at(OFFLINE_CAP_MS + 1), OFFLINE_CAP_MS)).toMatchObject({ end: at(OFFLINE_CAP_MS), lost: true });
    expect(fitsInStore('twisted-log', 9995, 10)).toBe(4);
    expect(fitsInStore('twisted-log', 9999, 10)).toBe(0);
    expect(fitsInStore('twisted-log', 0, 10)).toBe(10);
  });
});

describe('take-all', () => {
  it('moves the basket into the store, only what fits, and says what stayed', async () => {
    const k = await newKindled();
    await inv.apply([{ kindledId: k, itemId: 'twisted-log', place: 'store', delta: 9995 }], 'admin');
    await holding.work(k, 'twisted-trees', at(0));
    const r = value(await holding.takeAll(k, 'twisted-trees', at(40 * SEC)));
    expect(r.take).toEqual({
      stationId: 'twisted-trees',
      moved: [{ itemId: 'twisted-log', quantity: 4 }],
      left: [{ itemId: 'twisted-log', quantity: 6 }],
    });
    expect(basket(r, 'twisted-trees', 'twisted-log')).toBe(6);
    expect(await inv.view(k)).toMatchObject({ store: [{ itemId: 'twisted-log', quantity: 9999 }] });
    // A full store moves nothing; an empty basket moves nothing; the post has no basket.
    const full = value(await holding.takeAll(k, 'twisted-trees', at(40 * SEC)));
    expect(full.take).toEqual({ stationId: 'twisted-trees', moved: [], left: [{ itemId: 'twisted-log', quantity: 6 }] });
    const empty = value(await holding.takeAll(k, 'stone-outcrop', at(40 * SEC)));
    expect(empty.take).toEqual({ stationId: 'stone-outcrop', moved: [], left: [] });
    expect(value(await holding.takeAll(k, 'writ-post', at(40 * SEC))).take?.moved).toEqual([]);
    // Room in the store again: the rest goes, as a move in the ledger.
    await inv.apply([{ kindledId: k, itemId: 'twisted-log', place: 'store', delta: -100 }], 'admin');
    const rest = value(await holding.takeAll(k, 'twisted-trees', at(40 * SEC)));
    expect(rest.take).toEqual({ stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 6 }], left: [] });
    expect((await inv.ledger(k)).filter((e) => e.reason === 'move').map((e) => [e.place, e.delta])).toEqual([
      ['basket:twisted-trees', -4],
      ['store', 4],
      ['basket:twisted-trees', -6],
      ['store', 6],
    ]);
  });

  it('refuses a station not on the holding, and work at the post', async () => {
    const k = await newKindled();
    expect(await holding.takeAll(k, 'field', at(0))).toEqual({ ok: false, error: 'unknown-station', message: 'No station field on this holding.' });
    expect(await holding.work(k, 'field', at(0))).toMatchObject({ ok: false, error: 'unknown-station' });
    expect(await holding.work(k, 'writ-post', at(0))).toEqual({ ok: false, error: 'no-action', message: 'Nothing to work at the Writ post.' });
    expect(await holding.view('00000000-0000-0000-0000-000000000000', at(0))).toMatchObject({ ok: false, error: 'unknown-kindled' });
  });
});

describe('the away hook', () => {
  it('moves the active action back, so the next request settles it as time away', async () => {
    const k = await newKindled('awayone');
    await holding.work(k, 'twisted-trees', at(0));
    expect(parseAwayArgs(['awayone', '60'])).toEqual({ ok: true, args: { username: 'awayone', hours: 60 } });
    expect(parseAwayArgs(['awayone'])).toMatchObject({ ok: false });
    expect(parseAwayArgs(['awayone', '-1'])).toMatchObject({ ok: false });
    expect(await moveAway(handle.db, { username: 'nobody', hours: 1 })).toEqual({ ok: false, message: 'no Kindled for username nobody' });
    const moved = await moveAway(handle.db, { username: 'awayone', hours: 60 });
    expect(moved).toMatchObject({ ok: true, stationId: 'twisted-trees', startedAt: at(-60 * HOUR), lastSeenAt: at(-60 * HOUR) });
    const r = value(await holding.view(k, at(0)));
    expect(basket(r, 'twisted-trees', 'twisted-log')).toBe(OFFLINE_CAP_MS / 4000);
    expect(r.activity?.startedAt).toBe(at(0).toISOString());
    await holding.stop(k, at(0));
    expect(await moveAway(handle.db, { username: 'awayone', hours: 1 })).toEqual({ ok: false, message: 'awayone is not working a station' });
  });
});

describe('the holding API', () => {
  let app: App;
  const clock = { t: T0 };
  let cookie: string;
  let noKindled: string;

  const call = (url: string, { method = 'POST', body, auth = cookie }: { method?: 'GET' | 'POST'; body?: unknown; auth?: string } = {}) => {
    const opts: InjectOptions = {
      method,
      url,
      headers: {
        host: HOST,
        ...(method === 'POST' ? { origin: ORIGIN, 'content-type': 'application/json' } : {}),
        ...(auth ? { cookie: auth } : {}),
      },
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
    const reg = await call(ApiRoute.Register, { body: { username: 'apiholder', password: 'correct horse' }, auth: '' });
    cookie = sessionFrom(reg);
    expect((await call(ApiRoute.Kindled, { body: { name: 'Iltani', remembrance: 'tide' } })).statusCode).toBe(201);
    const other = await call(ApiRoute.Register, { body: { username: 'nokindled', password: 'correct horse' }, auth: '' });
    noKindled = sessionFrom(other);
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET settles and answers the holding; every route needs a session and a Kindled', async () => {
    const res = await call(ApiRoute.Holding, { method: 'GET' });
    expect(res.statusCode).toBe(200);
    const body: unknown = res.json();
    expect(isHoldingResponse(body)).toBe(true);
    expect(body).toMatchObject({ layoutId: HOLDING_LAYOUT_ID, activity: null, now: new Date(clock.t).toISOString() });
    expect((await call(ApiRoute.Holding, { method: 'GET', auth: '' })).statusCode).toBe(401);
    expect((await call(ApiRoute.Holding, { method: 'GET', auth: noKindled })).json()).toMatchObject({ error: 'no-kindled' });
    for (const route of [ApiRoute.HoldingWork, ApiRoute.HoldingStop, ApiRoute.HoldingTake]) {
      expect((await call(route, { body: { stationId: 'twisted-trees' }, auth: '' })).statusCode).toBe(401);
      expect((await call(route, { body: { stationId: 'twisted-trees' }, auth: noKindled })).statusCode).toBe(404);
    }
  });

  it('refuses unknown fields and stations, and work at the post', async () => {
    for (const route of [ApiRoute.HoldingWork, ApiRoute.HoldingTake]) {
      expect((await call(route, { body: { stationId: 'twisted-trees', extra: 1 } })).json()).toMatchObject({ error: 'bad-request' });
      expect((await call(route, { body: {} })).statusCode).toBe(400);
      expect((await call(route, { body: { stationId: 'field' } })).json()).toEqual({
        error: 'unknown-station',
        message: 'No station field on this holding.',
      });
    }
    expect((await call(ApiRoute.HoldingWork, { body: { stationId: 'writ-post' } })).json()).toEqual({
      error: 'no-action',
      message: 'Nothing to work at the Writ post.',
    });
    expect((await call(ApiRoute.HoldingStop, { body: { stationId: 'twisted-trees' } })).json()).toMatchObject({ error: 'bad-request' });
    // Cross-origin: refused like every mutating route.
    const cross = await app.http.inject({
      method: 'POST',
      url: ApiRoute.HoldingWork,
      headers: { host: HOST, origin: 'https://evil.test', 'content-type': 'application/json', cookie },
      payload: JSON.stringify({ stationId: 'twisted-trees' }),
    });
    expect(cross.statusCode).toBe(403);
  });

  it('works, takes and stops through the routes, each answering the holding', async () => {
    const work = await call(ApiRoute.HoldingWork, { body: { stationId: 'twisted-trees' } });
    expect(work.statusCode).toBe(200);
    expect(work.json<HoldingResponse>().activity?.stationId).toBe('twisted-trees');
    clock.t += 13 * SEC;
    const take = await call(ApiRoute.HoldingTake, { body: { stationId: 'twisted-trees' } });
    expect(take.statusCode).toBe(200);
    const taken = take.json<HoldingResponse>();
    expect(isHoldingResponse(taken)).toBe(true);
    expect(taken.take).toEqual({ stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 3 }], left: [] });
    expect(taken.baskets['twisted-trees']).toEqual([]);
    expect((await call(ApiRoute.Inventory, { method: 'GET' })).json()).toMatchObject({ store: [{ itemId: 'twisted-log', quantity: 3 }] });
    const stop = await call(ApiRoute.HoldingStop, { body: {} });
    expect(stop.statusCode).toBe(200);
    expect(stop.json<HoldingResponse>().activity).toBeNull();
    expect(stop.json<HoldingResponse>().skills.woodcutting.xp).toBe(12);
  });
});
