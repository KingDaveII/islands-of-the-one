import {
  ApiRoute,
  defaultTuning,
  InventoryReason,
  isHoldingResponse,
  kitRef,
  RACK_TEXT,
  SESSION_COOKIE,
  WEAPON_IDS,
  weaponCanFight,
  type HoldingResponse,
} from '@iot/shared';
import { isWeaponAvailable, type Tuning } from '@iot/sim';
import { eq } from 'drizzle-orm';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, kindled } from '../src/db/schema.js';
import { createHolding, giveKit, rackViewOf, weaponReady, type Holding } from '../src/holding/index.js';
import { createInventory, type Inventory } from '../src/inventory/index.js';

/**
 * The weapon rack on in-memory PGlite (docs/design/holding.md "The weapon
 * rack", M2 Task 8): the kit given once by the first holding request and
 * never again (nor with the scaffold off), `inventory.apply` refusing a
 * weapon off the rack, a material on it and a second Hookblade, the choice
 * (ok, not-owned, not-ready, bad-request, the guards) and its resolution
 * when null, migration 0010, and the inventory view without weapons. The
 * race of two first requests runs on a real Postgres in
 * holding.postgres.test.ts.
 */
const T0 = Date.parse('2026-10-19T12:00:00Z');
const at = (ms: number): Date => new Date(T0 + ms);
const HOST = 'game.test';
const ORIGIN = `https://${HOST}`;

let handle: DbHandle;
let inv: Inventory;
let holding: Holding;
let n = 0;

async function newKindled(username = `racker${++n}`): Promise<string> {
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
const runWeaponOf = async (k: string): Promise<string | null> => (await handle.db.select({ runWeapon: kindled.runWeapon }).from(kindled).where(eq(kindled.id, k)))[0]?.runWeapon ?? null;

beforeAll(async () => {
  handle = await createDb();
  await handle.migrate();
  inv = createInventory(handle.db);
  holding = createHolding(handle.db, inv);
});
afterAll(async () => {
  await handle.close();
});

describe('migration 0010', () => {
  it('adds kindled.run_weapon, null for every Kindled', async () => {
    const k = await newKindled();
    expect(await runWeaponOf(k)).toBeNull();
    const [row] = await handle.db.select().from(kindled).where(eq(kindled.id, k));
    expect(row).toMatchObject({ runWeapon: null });
  });
});

describe('the kit', () => {
  it('the first holding request gives the Hookblade onto the rack, reason kit, once; repeats give nothing more', async () => {
    const k = await newKindled();
    expect(await inv.holdings(k)).toEqual([]);
    const first = value(await holding.view(k, at(0)));
    expect(first.rack).toEqual({ weapons: [{ itemId: 'hookblade', ready: true }], chosen: 'hookblade' });
    expect(await inv.holdings(k)).toEqual([{ itemId: 'hookblade', place: 'rack', quantity: 1 }]);
    const ledger = await inv.ledger(k);
    expect(ledger.map((e) => [e.reason, e.itemId, e.place, e.delta, e.balanceAfter, e.ref])).toEqual([
      [InventoryReason.Kit, 'hookblade', 'rack', 1, 1, kitRef(k, 'hookblade')],
    ]);
    // Again, and after work: nothing more.
    value(await holding.view(k, at(1000)));
    value(await holding.work(k, 'twisted-trees', at(2000)));
    value(await holding.view(k, at(10_000)));
    expect((await inv.ledger(k)).filter((e) => e.reason === 'kit')).toHaveLength(1);
    expect(await inv.holdings(k)).toContainEqual({ itemId: 'hookblade', place: 'rack', quantity: 1 });
    // The ref holds even if the weapon were somehow gone: a second give is a duplicate, not a second Hookblade.
    await handle.db.transaction(async (tx) => {
      expect(await giveKit(tx, inv, k, [])).toBe(false);
    });
    expect((await inv.ledger(k)).filter((e) => e.reason === 'kit')).toHaveLength(1);
  });

  it('gives nothing with the scaffold off, and nothing to a Kindled who already owns a weapon', async () => {
    const k = await newKindled();
    await handle.db.transaction(async (tx) => {
      expect(await giveKit(tx, inv, k, [], false)).toBe(false);
    });
    expect(await inv.holdings(k)).toEqual([]);
    // A Kindled with the Sling alone (granted, as the wreck will) is not given the kit.
    const granted = await inv.apply([{ kindledId: k, itemId: 'sling', place: 'rack', delta: 1 }], InventoryReason.Admin);
    expect(granted.ok).toBe(true);
    const r = value(await holding.view(k, at(0)));
    expect(r.rack).toEqual({ weapons: [{ itemId: 'sling', ready: false }], chosen: null });
    expect((await inv.ledger(k)).filter((e) => e.reason === 'kit')).toEqual([]);
  });

  it('the readiness the server judges by is the sim\'s, and agrees with the shared static mirror for every weapon', () => {
    for (const id of WEAPON_IDS) {
      expect(weaponReady(id), id).toBe(isWeaponAvailable(defaultTuning as Tuning, id));
      expect(weaponReady(id), id).toBe(weaponCanFight(id));
    }
    expect(WEAPON_IDS.map(weaponReady)).toEqual([true, false, false]);
  });
});

describe('inventory.apply and the rack', () => {
  it('refuses a weapon anywhere but the rack, anything else on the rack (wrong-place), and a second of one weapon (stack-limit)', async () => {
    const k = await newKindled();
    value(await holding.view(k, at(0)));
    for (const place of ['pack', 'store', 'purse', 'basket:twisted-trees'] as const) {
      const r = await inv.apply([{ kindledId: k, itemId: 'hookblade', place, delta: 1 }], InventoryReason.Admin);
      expect(r).toMatchObject({ ok: false, error: 'wrong-place', message: `hookblade is a weapon: it hangs on the rack, not in the ${place}.` });
    }
    for (const itemId of ['twisted-log', 'wild-sliver', 'sealed-gin']) {
      const r = await inv.apply([{ kindledId: k, itemId, place: 'rack', delta: 1 }], InventoryReason.Admin);
      expect(r).toMatchObject({ ok: false, error: 'wrong-place' });
    }
    expect(await inv.apply([{ kindledId: k, itemId: 'twisted-log', place: 'rack', delta: 1 }], InventoryReason.Admin)).toMatchObject({
      message: "twisted-log can't hang on the rack: only a weapon can.",
    });
    const second = await inv.apply([{ kindledId: k, itemId: 'hookblade', place: 'rack', delta: 1 }], InventoryReason.Admin);
    expect(second).toMatchObject({ ok: false, error: 'stack-limit', message: 'Hookblade: already on the rack.' });
    // Nothing changed: one Hookblade, one ledger row.
    expect(await inv.holdings(k)).toEqual([{ itemId: 'hookblade', place: 'rack', quantity: 1 }]);
    expect(await inv.ledger(k)).toHaveLength(1);
    // A second weapon of another kind hangs beside it, in roster order in the answer.
    expect((await inv.apply([{ kindledId: k, itemId: 'keelmaul', place: 'rack', delta: 1 }], InventoryReason.Admin)).ok).toBe(true);
    expect(value(await holding.view(k, at(1))).rack.weapons).toEqual([
      { itemId: 'hookblade', ready: true },
      { itemId: 'keelmaul', ready: false },
    ]);
  });

  it('the inventory view leaves the rack out: weapons never show in the panes, the holdings still list them', async () => {
    const k = await newKindled();
    value(await holding.view(k, at(0)));
    expect(await inv.view(k)).toEqual({ purse: [], pack: [], store: [], baskets: {} });
    expect(await inv.holdings(k)).toEqual([{ itemId: 'hookblade', place: 'rack', quantity: 1 }]);
    expect(rackViewOf(await inv.holdings(k), null)).toEqual({ weapons: [{ itemId: 'hookblade', ready: true }], chosen: 'hookblade' });
  });
});

describe('the choice', () => {
  it('chooses an owned weapon that can fight; refuses one not on the rack (not-owned) and one the sim can\'t run (not-ready); nothing is written then', async () => {
    const k = await newKindled();
    const ok = await holding.chooseWeapon(k, 'hookblade', at(0));
    expect(value(ok).rack).toEqual({ weapons: [{ itemId: 'hookblade', ready: true }], chosen: 'hookblade' });
    expect(await runWeaponOf(k)).toBe('hookblade');
    expect(await holding.chooseWeapon(k, 'keelmaul', at(1))).toEqual({ ok: false, error: 'not-owned', message: RACK_TEXT.NOT_OWNED });
    expect(await holding.chooseWeapon(k, 'banana', at(1))).toEqual({ ok: false, error: 'not-owned', message: RACK_TEXT.NOT_OWNED });
    expect(await holding.chooseWeapon(k, 'twisted-log', at(1))).toEqual({ ok: false, error: 'not-owned', message: RACK_TEXT.NOT_OWNED });
    expect((await inv.apply([{ kindledId: k, itemId: 'sling', place: 'rack', delta: 1 }], InventoryReason.Admin)).ok).toBe(true);
    expect(await holding.chooseWeapon(k, 'sling', at(2))).toEqual({ ok: false, error: 'not-ready', message: RACK_TEXT.NOT_READY });
    expect(await runWeaponOf(k)).toBe('hookblade');
    expect(value(await holding.view(k, at(3))).rack).toEqual({
      weapons: [
        { itemId: 'hookblade', ready: true },
        { itemId: 'sling', ready: false },
      ],
      chosen: 'hookblade',
    });
  });

  it('resolves a null or stale choice to the first weapon in roster order that is owned and can fight', async () => {
    const k = await newKindled();
    expect(await runWeaponOf(k)).toBeNull();
    expect(value(await holding.view(k, at(0))).rack.chosen).toBe('hookblade');
    // A stored choice the Kindled doesn't own (or that can't fight) resolves the same way, and stays stored.
    await handle.db.update(kindled).set({ runWeapon: 'keelmaul' }).where(eq(kindled.id, k));
    expect(value(await holding.view(k, at(1))).rack.chosen).toBe('hookblade');
    expect(await runWeaponOf(k)).toBe('keelmaul');
    await handle.db.update(kindled).set({ runWeapon: 'sling' }).where(eq(kindled.id, k));
    expect((await inv.apply([{ kindledId: k, itemId: 'sling', place: 'rack', delta: 1 }], InventoryReason.Admin)).ok).toBe(true);
    expect(value(await holding.view(k, at(2))).rack.chosen).toBe('hookblade');
  });
});

describe('the rack API', () => {
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
    const reg = await call(ApiRoute.Register, { body: { username: 'rackapi', password: 'correct horse' }, auth: '' });
    cookie = sessionFrom(reg);
    expect((await call(ApiRoute.Kindled, { body: { name: 'Iltani', remembrance: 'tide' } })).statusCode).toBe(201);
    const other = await call(ApiRoute.Register, { body: { username: 'racknone', password: 'correct horse' }, auth: '' });
    noKindled = sessionFrom(other);
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/holding carries the rack with the kit from the first request; GET /api/inventory shows no weapon', async () => {
    const res = await call(ApiRoute.Holding, { method: 'GET' });
    expect(res.statusCode).toBe(200);
    const body: unknown = res.json();
    expect(isHoldingResponse(body)).toBe(true);
    expect(body).toMatchObject({ rack: { weapons: [{ itemId: 'hookblade', ready: true }], chosen: 'hookblade' } });
    expect((await call(ApiRoute.Inventory, { method: 'GET' })).json()).toEqual({ purse: [], pack: [], store: [], baskets: {} });
  });

  it('POST /api/holding/rack/choose: ok answers the holding; not-owned and not-ready are 409; the body is guarded like every mutating route', async () => {
    const ok = await call(ApiRoute.RackChoose, { body: { weaponId: 'hookblade' } });
    expect(ok.statusCode).toBe(200);
    const body: unknown = ok.json();
    expect(isHoldingResponse(body)).toBe(true);
    expect(body).toMatchObject({ rack: { chosen: 'hookblade' } });
    const notOwned = await call(ApiRoute.RackChoose, { body: { weaponId: 'keelmaul' } });
    expect(notOwned.statusCode).toBe(409);
    expect(notOwned.json()).toEqual({ error: 'not-owned', message: RACK_TEXT.NOT_OWNED });
    // The Sling on the rack (as the wreck will hang it): owned, but the sim can't run it.
    const [k] = await handle.db.select({ id: kindled.id }).from(kindled).innerJoin(accounts, eq(kindled.accountId, accounts.id)).where(eq(accounts.username, 'rackapi'));
    if (!k) throw new Error('no kindled');
    expect((await inv.apply([{ kindledId: k.id, itemId: 'sling', place: 'rack', delta: 1 }], InventoryReason.Admin)).ok).toBe(true);
    const notReady = await call(ApiRoute.RackChoose, { body: { weaponId: 'sling' } });
    expect(notReady.statusCode).toBe(409);
    expect(notReady.json()).toEqual({ error: 'not-ready', message: RACK_TEXT.NOT_READY });
    // bad-request: the shape only.
    for (const body of [{}, { weaponId: 1 }, { weaponId: 'hookblade', extra: 1 }, { itemId: 'hookblade' }, []]) {
      const res = await call(ApiRoute.RackChoose, { body });
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.json()).toMatchObject({ error: 'bad-request' });
    }
    // A session and a Kindled; the same origin; JSON.
    expect((await call(ApiRoute.RackChoose, { body: { weaponId: 'hookblade' }, auth: '' })).statusCode).toBe(401);
    expect((await call(ApiRoute.RackChoose, { body: { weaponId: 'hookblade' }, auth: noKindled })).statusCode).toBe(404);
    const cross = await app.http.inject({
      method: 'POST',
      url: ApiRoute.RackChoose,
      headers: { host: HOST, origin: 'https://evil.test', 'content-type': 'application/json', cookie },
      payload: JSON.stringify({ weaponId: 'hookblade' }),
    });
    expect(cross.statusCode).toBe(403);
    const notJson = await app.http.inject({
      method: 'POST',
      url: ApiRoute.RackChoose,
      headers: { host: HOST, origin: ORIGIN, 'content-type': 'text/plain', cookie },
      payload: 'weaponId=hookblade',
    });
    expect(notJson.statusCode).toBe(415);
    // The choice stood through the refusals.
    expect((await call(ApiRoute.Holding, { method: 'GET' })).json()).toMatchObject({ rack: { chosen: 'hookblade' } });
  });
});
