import { ApiRoute, AWAY_CARD_MIN_MS, InventoryReason, isHoldingResponse, OFFLINE_CAP_MS, SESSION_COOKIE, type HoldingResponse } from '@iot/shared';
import { eq } from 'drizzle-orm';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, awayCards, kindled } from '../src/db/schema.js';
import { createHolding, isAbsence, levelsGained, mergeAway, moveAway, sumMade, type Holding } from '../src/holding/index.js';
import { createInventory, type Inventory } from '../src/inventory/index.js';

/**
 * The While you were away card on in-memory PGlite (docs/design/holding.md
 * "Sleep, the away card and toasts", M2 Task 7): an absence under 30 min
 * writes no card and 30 min exactly writes one; the active action's and the
 * cycles' credits land per place; a level-up across the absence; two
 * absences merge; away/seen deletes only on a matching `to` and a merged
 * row survives; an inventory route's settle records the card and the next
 * holding answer carries it; the route's guards and codes; migration 0009.
 */
const T0 = Date.parse('2026-10-17T12:00:00Z');
const at = (ms: number): Date => new Date(T0 + ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const HOST = 'game.test';
const ORIGIN = `https://${HOST}`;

let handle: DbHandle;
let inv: Inventory;
let holding: Holding;
let n = 0;

async function newKindled(username = `away${++n}`): Promise<string> {
  const [account] = await handle.db.insert(accounts).values({ username, passwordHash: 'x' }).returning();
  if (!account) throw new Error('no account');
  const [k] = await handle.db.insert(kindled).values({ accountId: account.id, name: 'Iltani', remembrance: 'tide', clayTone: 'clay-pale' }).returning();
  if (!k) throw new Error('no kindled');
  return k.id;
}

const value = (r: Awaited<ReturnType<Holding['view']>>): HoldingResponse => {
  if (!r.ok) throw new Error(r.message);
  return r.value;
};
const row = async (k: string) => (await handle.db.select().from(awayCards).where(eq(awayCards.kindledId, k)))[0];

beforeAll(async () => {
  handle = await createDb();
  await handle.migrate();
  inv = createInventory(handle.db);
  holding = createHolding(handle.db, inv);
});
afterAll(async () => {
  await handle.close();
});

describe('migration 0009', () => {
  it('creates away_cards, empty', async () => {
    await expect(handle.db.select().from(awayCards).limit(1)).resolves.toEqual([]);
  });
});

describe('the pure parts', () => {
  it('an absence is 30 min or more since the last heartbeat; a Kindled never seen has none', () => {
    expect(AWAY_CARD_MIN_MS).toBe(30 * MIN);
    expect(isAbsence(null, at(0))).toBe(false);
    expect(isAbsence(at(-29 * MIN), at(0))).toBe(false);
    expect(isAbsence(at(-30 * MIN), at(0))).toBe(true);
    expect(isAbsence(at(-HOUR), at(0), 2 * HOUR)).toBe(false);
  });

  it('sums credits per place and drops zero counts; levels gained are the skills whose level rose', () => {
    expect(
      sumMade([
        { place: 'twisted-trees', itemId: 'twisted-log', quantity: 3 },
        { place: 'plot-1', itemId: 'pale-grain', quantity: 0 },
        { place: 'twisted-trees', itemId: 'twisted-log', quantity: 2 },
      ]),
    ).toEqual({ 'twisted-trees': { itemId: 'twisted-log', quantity: 5 } });
    expect(levelsGained({ woodcutting: 10 }, { woodcutting: 50, mining: 39 })).toEqual({ woodcutting: { from: 1, to: 2 } });
    expect(levelsGained({}, { farming: 40 })).toEqual({ farming: { from: 1, to: 2 } });
    expect(levelsGained({ mining: 100 }, { mining: 100 })).toEqual({});
  });

  it('merges two absences: the earlier from, the later to, counts summed per place, each skill from its earliest to its latest', () => {
    const a = { fromAt: at(-10 * HOUR), toAt: at(-8 * HOUR), made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 6 } }, levels: { woodcutting: { from: 1, to: 2 } } };
    const b = { fromAt: at(-3 * HOUR), toAt: at(0), made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 9 }, 'plot-1': { itemId: 'pale-grain', quantity: 12 } }, levels: { woodcutting: { from: 2, to: 4 }, mining: { from: 1, to: 2 } } };
    expect(mergeAway(a, b)).toEqual({
      fromAt: at(-10 * HOUR),
      toAt: at(0),
      made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 15 }, 'plot-1': { itemId: 'pale-grain', quantity: 12 } },
      levels: { woodcutting: { from: 1, to: 4 }, mining: { from: 1, to: 2 } },
    });
    // The order of the arguments doesn't matter for the times.
    expect(mergeAway(b, a)).toMatchObject({ fromAt: at(-10 * HOUR), toAt: at(0) });
  });
});

describe('the settle and the card', () => {
  it('writes no card for an absence under 30 min, and one for 30 min exactly', async () => {
    const k = await newKindled();
    value(await holding.view(k, at(0)));
    value(await holding.view(k, at(29 * MIN)));
    expect(await row(k)).toBeUndefined();
    const r = value(await holding.view(k, at(59 * MIN)));
    // The trees' trickle (one log every 20 min from the first settle) dropped its second log in the stretch.
    const made = { 'twisted-trees': { itemId: 'twisted-log', quantity: 1 } };
    expect(await row(k)).toMatchObject({ kindledId: k, fromAt: at(29 * MIN), toAt: at(59 * MIN), made, levels: {} });
    expect(r.away).toEqual({ from: at(29 * MIN).toISOString(), to: at(59 * MIN).toISOString(), made, levels: {}, writ: r.writ });
    expect(isHoldingResponse(r)).toBe(true);
  });

  it("lands the active action's credit and the cycles' per place, and a level gained across the absence", async () => {
    const k = await newKindled();
    value(await holding.work(k, 'twisted-trees', at(0)));
    // 5 h away at the trees: 4500 cycles by hand (4 s each, 1 log) and 15 by the trickle (one every 20 min), one basket.
    const r = value(await holding.view(k, at(5 * HOUR)));
    const logs = (5 * HOUR) / 4000 + 15;
    expect(r.baskets['twisted-trees']).toEqual([{ itemId: 'twisted-log', quantity: logs }]);
    expect(r.skills.woodcutting.level).toBe(7);
    expect(r.away).toEqual({
      from: at(0).toISOString(),
      to: at(5 * HOUR).toISOString(),
      made: { 'twisted-trees': { itemId: 'twisted-log', quantity: logs } },
      levels: { woodcutting: { from: 1, to: 7 } },
      writ: r.writ,
    });
  });

  it("records the cycles' credit at a place the action never worked (the trees' trickle while idle)", async () => {
    const k = await newKindled();
    value(await holding.view(k, at(0)));
    const r = value(await holding.view(k, at(2 * HOUR)));
    expect(r.away?.made).toEqual({ 'twisted-trees': { itemId: 'twisted-log', quantity: 6 } });
    expect(r.away?.levels).toEqual({});
  });

  it('merges a second absence into a card never dismissed, and the Writ line reads the Writ now', async () => {
    const k = await newKindled();
    value(await holding.work(k, 'twisted-trees', at(0)));
    value(await holding.view(k, at(HOUR)));
    value(await holding.view(k, at(HOUR + 10 * MIN)));
    const r = value(await holding.view(k, at(3 * HOUR)));
    // The 10 min heartbeat between the two absences is no absence: its 150 cycles are in the basket, not the card.
    const logs = (3 * HOUR) / 4000 + 9 - 150;
    expect(r.baskets['twisted-trees']).toEqual([{ itemId: 'twisted-log', quantity: logs + 150 }]);
    expect(r.away).toEqual({
      from: at(0).toISOString(),
      to: at(3 * HOUR).toISOString(),
      made: { 'twisted-trees': { itemId: 'twisted-log', quantity: logs } },
      levels: { woodcutting: { from: 1, to: r.skills.woodcutting.level } },
      writ: r.writ,
    });
    // The first stretch alone levelled the skill; the merge keeps the earliest from and the latest to.
    expect(r.skills.woodcutting.level).toBeGreaterThan(2);
  });

  it('away/seen deletes the row only on a matching to; a row merged after the card was drawn survives', async () => {
    const k = await newKindled();
    value(await holding.view(k, at(0)));
    const first = value(await holding.view(k, at(HOUR)));
    expect(first.away?.to).toBe(at(HOUR).toISOString());
    // A stale to: nothing goes.
    expect(await holding.awaySeen(k, at(0))).toBe(false);
    expect(await row(k)).toBeDefined();
    // Another absence merges in before the dismissal lands: the card's to moved on, so the dismissal misses.
    value(await holding.view(k, at(2 * HOUR)));
    expect(await holding.awaySeen(k, at(HOUR))).toBe(false);
    const again = value(await holding.view(k, at(2 * HOUR + MIN)));
    expect(again.away).toMatchObject({ from: at(0).toISOString(), to: at(2 * HOUR).toISOString() });
    // The matching to: gone, and the next answer carries none.
    expect(await holding.awaySeen(k, at(2 * HOUR))).toBe(true);
    expect(await row(k)).toBeUndefined();
    expect(value(await holding.view(k, at(2 * HOUR + 2 * MIN))).away).toBeNull();
  });

  it('the away hook reports the card, and the capped stretch sums what the cap paid', async () => {
    const k = await newKindled('awaycard');
    value(await holding.work(k, 'twisted-trees', at(0)));
    expect((await moveAway(handle.db, { username: 'awaycard', hours: 60 })).ok).toBe(true);
    const r = value(await holding.view(k, at(0)));
    expect(r.away?.made).toEqual({ 'twisted-trees': { itemId: 'twisted-log', quantity: OFFLINE_CAP_MS / 4000 + 24 * 6 } });
    const moved = await moveAway(handle.db, { username: 'awaycard', hours: 1 });
    expect(moved.ok && moved.card?.toAt).toEqual(at(0));
  });
});

describe('the routes', () => {
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
    const reg = await call(ApiRoute.Register, { body: { username: 'awayapi', password: 'correct horse' }, auth: '' });
    cookie = sessionFrom(reg);
    expect((await call(ApiRoute.Kindled, { body: { name: 'Iltani', remembrance: 'tide' } })).statusCode).toBe(201);
    const other = await call(ApiRoute.Register, { body: { username: 'awaynokindled', password: 'correct horse' }, auth: '' });
    noKindled = sessionFrom(other);
  });
  afterAll(async () => {
    await app.close();
  });

  it("an inventory route's settle records the card, and the next holding answer carries it", async () => {
    clock.t = T0;
    expect((await call(ApiRoute.Holding, { method: 'GET' })).json()).toMatchObject({ away: null });
    // A log in the basket, so the move route has something to settle round (and the trickle, 3 logs over the hour).
    clock.t = T0 + HOUR;
    const invRes = await call(ApiRoute.Inventory, { method: 'GET' });
    expect(invRes.statusCode).toBe(200);
    expect(invRes.json()).toMatchObject({ baskets: { 'twisted-trees': [{ itemId: 'twisted-log', quantity: 3 }] } });
    const r = (await call(ApiRoute.Holding, { method: 'GET' })).json<HoldingResponse>();
    expect(r.away).toMatchObject({ from: at(0).toISOString(), to: at(HOUR).toISOString(), made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 3 } }, levels: {} });
    // The move route settles too: an absence through it lands in the card as well.
    clock.t = T0 + 2 * HOUR;
    const moved = await call(ApiRoute.InventoryMove, { body: { itemId: 'twisted-log', from: 'store', to: 'pack', quantity: 1 } });
    expect(moved.statusCode).toBe(409);
    expect((await call(ApiRoute.Holding, { method: 'GET' })).json()).toMatchObject({ away: { from: at(0).toISOString(), to: at(2 * HOUR).toISOString(), made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 6 } } } });
  });

  it('away/seen: 204 on a matching to and on a stale one (nothing goes), with the guards and codes of a mutating route', async () => {
    const stale = await call(ApiRoute.HoldingAwaySeen, { body: { to: at(HOUR).toISOString() } });
    expect(stale.statusCode).toBe(204);
    expect((await call(ApiRoute.Holding, { method: 'GET' })).json()).toMatchObject({ away: { to: at(2 * HOUR).toISOString() } });
    const seen = await call(ApiRoute.HoldingAwaySeen, { body: { to: at(2 * HOUR).toISOString() } });
    expect(seen.statusCode).toBe(204);
    expect(seen.body).toBe('');
    expect((await call(ApiRoute.Holding, { method: 'GET' })).json()).toMatchObject({ away: null });
    // The guards: the body's shape, the session, the Kindled, the origin, the media type.
    expect((await call(ApiRoute.HoldingAwaySeen, { body: {} })).json()).toMatchObject({ error: 'bad-request' });
    expect((await call(ApiRoute.HoldingAwaySeen, { body: { to: 'now' } })).statusCode).toBe(400);
    expect((await call(ApiRoute.HoldingAwaySeen, { body: { to: at(0).toISOString(), extra: 1 } })).statusCode).toBe(400);
    expect((await call(ApiRoute.HoldingAwaySeen, { body: { to: at(0).toISOString() }, auth: '' })).statusCode).toBe(401);
    expect((await call(ApiRoute.HoldingAwaySeen, { body: { to: at(0).toISOString() }, auth: noKindled })).json()).toMatchObject({ error: 'no-kindled' });
    const cross = await app.http.inject({
      method: 'POST',
      url: ApiRoute.HoldingAwaySeen,
      headers: { host: HOST, origin: 'https://evil.test', 'content-type': 'application/json', cookie },
      payload: JSON.stringify({ to: at(0).toISOString() }),
    });
    expect(cross.statusCode).toBe(403);
    const form = await app.http.inject({
      method: 'POST',
      url: ApiRoute.HoldingAwaySeen,
      headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', cookie },
      payload: 'to=now',
    });
    expect(form.statusCode).toBe(415);
  });

  it('the card moves no items: the ledger holds the gather and harvest rows only', async () => {
    const [k] = await handle.db.select({ id: kindled.id }).from(kindled).innerJoin(accounts, eq(kindled.accountId, accounts.id)).where(eq(accounts.username, 'awayapi'));
    if (!k) throw new Error('no kindled');
    const reasons = new Set((await inv.ledger(k.id)).map((e) => e.reason));
    expect([...reasons].every((r) => r === InventoryReason.Harvest || r === InventoryReason.Gather)).toBe(true);
  });
});
