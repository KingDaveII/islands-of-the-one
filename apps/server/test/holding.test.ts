import {
  ApiRoute,
  HOLDING_LAYOUT_ID,
  isHoldingResponse,
  nextFullOfTide,
  tideIndex,
  NAME_NOT_DRAWABLE,
  NAME_REFUSED,
  pressedWrit,
  OFFLINE_CAP_MS,
  SESSION_COOKIE,
  skillProgress,
  toWritView,
  WRIT_TOO_MUCH_EVER,
  WRIT_TOO_MUCH_NOW,
  type HoldingResponse,
} from '@iot/shared';
import { eq } from 'drizzle-orm';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { accounts, holdingActivity, keshGifts, kindled, skillXp, writs } from '../src/db/schema.js';
import {
  createHolding,
  feedChanges,
  fitsInStore,
  giveSliver,
  KESH_NOT_DUE,
  KESH_PACK_FULL,
  keshDue,
  keshViewOf,
  moveAway,
  parseKeshResetArgs,
  resetKesh,
  offlineHorizonMs,
  ONLINE_GRACE_MS,
  parseAwayArgs,
  parseWritSetArgs,
  settleMath,
  settleRef,
  setWrit,
  WRIT_ALREADY_NAMED,
  WRIT_INSUFFICIENT,
  WRIT_UNNAMED,
  type Holding,
} from '../src/holding/index.js';
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

describe('migrations 0004, 0005 and 0006', () => {
  it('create holding_activity, skill_xp, writs and kesh_gifts, empty', async () => {
    await expect(handle.db.select().from(holdingActivity).limit(1)).resolves.toEqual([]);
    await expect(handle.db.select().from(skillXp).limit(1)).resolves.toEqual([]);
    await expect(handle.db.select().from(writs).limit(1)).resolves.toEqual([]);
    await expect(handle.db.select().from(keshGifts).limit(1)).resolves.toEqual([]);
  });

  it('an existing Kindled gets its Writ pressed on its first holding request: two days of charge', async () => {
    const k = await newKindled();
    await expect(handle.db.select().from(writs).where(eq(writs.kindledId, k))).resolves.toEqual([]);
    const r = value(await holding.view(k, at(0)));
    expect(r.writ).toEqual(toWritView(pressedWrit(T0), T0));
    expect(r.writ).toMatchObject({ state: 'lit', words: 'about two days', emptyAt: at(48 * HOUR).toISOString() });
    const [row] = await handle.db.select().from(writs).where(eq(writs.kindledId, k));
    expect(row).toMatchObject({ kindledId: k, name: null, letters: null, certified: false, emptyAt: at(48 * HOUR), lines: 1, createdAt: at(0), fedAt: null });
    // Once only: the next request finds it, draining from the pressing; never fed, it goes dark after two days.
    expect(value(await holding.view(k, at(30 * HOUR))).writ.state).toBe('flickering');
    expect(value(await holding.view(k, at(49 * HOUR))).writ).toMatchObject({ state: 'dark', emptyAt: at(48 * HOUR).toISOString() });
    await expect(handle.db.select().from(writs).where(eq(writs.kindledId, k))).resolves.toHaveLength(1);
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
      writ: toWritView(pressedWrit(T0), T0),
      kesh: { firstGiven: false, due: 'first', nextTideAt: at(6 * HOUR).toISOString() },
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
    // A Writ lit for the whole test: a pressed one would go dark at 48 h and stop the offline earning.
    const k = await newKindled('capone');
    await setWrit(handle.db, { username: 'capone', chargeHours: 1000 }, at(0));
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

describe('the settle and the Writ', () => {
  it('the horizon: the full cap while lit or flickering; until the dark moment otherwise, never under the online grace', () => {
    const lit = { ...pressedWrit(T0), name: 'Ash', letters: 'אש' };
    expect(offlineHorizonMs(lit, at(0), at(10 * HOUR))).toBe(OFFLINE_CAP_MS);
    expect(offlineHorizonMs({ ...lit, emptyAt: T0 + 100 * HOUR }, at(0), at(10 * HOUR))).toBe(OFFLINE_CAP_MS);
    expect(offlineHorizonMs({ ...lit, emptyAt: T0 + 100 * HOUR }, at(0), at(90 * HOUR))).toBe(OFFLINE_CAP_MS); // flickering
    // Dark at now, lit at the last heartbeat: until it went dark.
    expect(offlineHorizonMs({ ...lit, emptyAt: T0 + 10 * HOUR }, at(0), at(20 * HOUR))).toBe(10 * HOUR);
    expect(offlineHorizonMs({ ...lit, emptyAt: T0 + 60 * HOUR }, at(0), at(70 * HOUR))).toBe(OFFLINE_CAP_MS);
    // Dark the whole stretch: the online grace, so hands still work online.
    expect(offlineHorizonMs({ ...lit, emptyAt: T0 - 10 * HOUR }, at(0), at(20 * HOUR))).toBe(ONLINE_GRACE_MS);
    expect(offlineHorizonMs({ ...lit, emptyAt: T0 + 10_000 }, at(0), at(20 * HOUR))).toBe(ONLINE_GRACE_MS);
  });

  it('a stretch crossing the dark moment: paid up to emptyAt, nothing after while away, paid again for heartbeat-covered online time', async () => {
    const k = await newKindled('darkone');
    await holding.view(k, at(0));
    await holding.name(k, 'Ash', at(0));
    // Pressed at 0: empty at 48 h.
    expect(value(await holding.view(k, at(0))).writ).toMatchObject({ state: 'lit', emptyAt: at(48 * HOUR).toISOString(), words: 'about two days' });
    await holding.work(k, 'twisted-trees', at(0));
    // Away 60 h: the Writ went dark at 48 h, so only 48 h of cycles pay (the cap would have paid the same here)...
    const away = value(await holding.view(k, at(60 * HOUR)));
    expect(basket(away, 'twisted-trees', 'twisted-log')).toBe((48 * HOUR) / 4000);
    expect(away.writ.state).toBe('dark');
    expect(away.activity?.startedAt).toBe(at(60 * HOUR).toISOString());
    // ...and a shorter stretch shows the dark moment itself: lit for 10 h of a 30 h absence pays 10 h.
    const k2 = await newKindled('darktwo');
    await holding.view(k2, at(0));
    await holding.name(k2, 'Tide', at(0));
    await holding.work(k2, 'twisted-trees', at(38 * HOUR));
    const crossed = value(await holding.view(k2, at(68 * HOUR)));
    expect(basket(crossed, 'twisted-trees', 'twisted-log')).toBe((10 * HOUR) / 4000);
    expect(crossed.writ).toMatchObject({ state: 'dark', darkSince: at(48 * HOUR).toISOString() });
    // Nothing more while away and dark: the clock restarted at the last request, and a dark stretch earns only
    // the online grace past its heartbeat (60 s, fifteen cycles), never the twelve hours...
    const still = value(await holding.view(k2, at(80 * HOUR)));
    expect(basket(still, 'twisted-trees', 'twisted-log')).toBe((10 * HOUR) / 4000 + 15);
    // ...but heartbeat-covered online time pays at full rate: 30 s later, seven more cycles.
    const online = value(await holding.view(k2, at(80 * HOUR + 30_000)));
    expect(basket(online, 'twisted-trees', 'twisted-log')).toBe((10 * HOUR) / 4000 + 15 + 7);
    expect(online.skills.woodcutting.xp).toBe(((10 * HOUR) / 4000 + 15 + 7) * 4);
    // Fading, the same: hands work online (the grace, then every heartbeat), nothing unattended.
    const fading = value(await holding.view(k2, at(200 * HOUR)));
    expect(fading.writ.state).toBe('fading');
    expect(basket(fading, 'twisted-trees', 'twisted-log')).toBe((10 * HOUR) / 4000 + 15 + 7 + 15);
    expect(basket(value(await holding.view(k2, at(200 * HOUR + 4000))), 'twisted-trees', 'twisted-log')).toBe((10 * HOUR) / 4000 + 15 + 7 + 15 + 1);
  });
});

describe('naming the island', () => {
  it('accepts a typed Name, hears its letters on the server, and refuses a second naming', async () => {
    const k = await newKindled();
    const r = value(await holding.name(k, 'Black Rock', at(0)));
    expect(r.writ).toMatchObject({ name: 'Black Rock', letters: 'בלק רוק', state: 'lit', certified: false, emptyAt: at(48 * HOUR).toISOString(), lineCount: 1 });
    const [row] = await handle.db.select().from(writs).where(eq(writs.kindledId, k));
    expect(row).toMatchObject({ name: 'Black Rock', letters: 'בלק רוק' });
    expect(await holding.name(k, 'Ash', at(1))).toEqual({ ok: false, error: 'already-named', message: WRIT_ALREADY_NAMED });
    expect(value(await holding.view(k, at(2))).writ.name).toBe('Black Rock');
  });

  it('refuses by the typed text, by the letters, and keeps the not-drawable line; a refusal changes nothing', async () => {
    const k = await newKindled();
    expect(await holding.name(k, 'A', at(0))).toEqual({ ok: false, error: 'name-refused', message: NAME_REFUSED });
    expect(await holding.name(k, 'adni', at(0))).toEqual({ ok: false, error: 'name-refused', message: NAME_REFUSED });
    expect(await holding.name(k, 'אמת', at(0))).toEqual({ ok: false, error: 'name-refused', message: NAME_NOT_DRAWABLE });
    expect(await holding.name(k, 42, at(0))).toMatchObject({ ok: false, error: 'name-refused' });
    expect(value(await holding.view(k, at(0))).writ.name).toBeNull();
  });
});

describe('feeding the Writ', () => {
  /** A named Kindled whose Writ was pressed at 0 (empty at 48 h). */
  async function namedKindled(username?: string): Promise<string> {
    const k = await newKindled(username);
    await holding.name(k, 'Ash', at(0));
    return k;
  }

  it('waits for the Name', async () => {
    const k = await newKindled();
    await inv.apply([{ kindledId: k, itemId: 'wild-sliver', place: 'store', delta: 1 }], 'admin');
    expect(await holding.feed(k, 'wild-sliver', 1, at(0))).toEqual({ ok: false, error: 'unnamed', message: WRIT_UNNAMED });
    expect(await inv.view(k)).toMatchObject({ store: [{ itemId: 'wild-sliver', quantity: 1 }] });
  });

  it('takes from the store first, then the pack, writes the ledger and empty_at; every refusal changes nothing', async () => {
    const k = await namedKindled();
    await inv.apply(
      [
        { kindledId: k, itemId: 'wild-sliver', place: 'store', delta: 1 },
        { kindledId: k, itemId: 'wild-sliver', place: 'pack', delta: 2 },
        { kindledId: k, itemId: 'twisted-log', place: 'store', delta: 5 },
      ],
      'admin',
    );
    expect(await holding.feed(k, 'twisted-log', 1, at(0))).toEqual({ ok: false, error: 'not-sparkglass', message: 'The Writ only takes Sparkglass.' });
    expect(await holding.feed(k, 'deep-glass', 1, at(0))).toEqual({ ok: false, error: 'too-much', message: WRIT_TOO_MUCH_EVER });
    // A humming glass fits only an empty Writ; this one holds its pressed two days.
    expect(await holding.feed(k, 'glass-chip', 1, at(0))).toEqual({ ok: false, error: 'too-much', message: WRIT_TOO_MUCH_NOW });
    expect(await holding.feed(k, 'wild-sliver', 3, at(0))).toEqual({ ok: false, error: 'too-much', message: WRIT_TOO_MUCH_NOW });
    expect(await inv.ledger(k)).toHaveLength(3);
    // Two slivers: one from the store, one from the pack, as one change set; 48 + 96 = 144 h.
    const fed = value(await holding.feed(k, 'wild-sliver', 2, at(0)));
    expect(fed.writ).toMatchObject({ state: 'lit', emptyAt: at(144 * HOUR).toISOString(), chargeMs: 144 * HOUR, words: 'about six days', fedAt: at(0).toISOString() });
    expect(await inv.view(k)).toMatchObject({ store: [{ itemId: 'twisted-log', quantity: 5 }], pack: [{ itemId: 'wild-sliver', quantity: 1 }] });
    const feeds = (await inv.ledger(k)).filter((e) => e.reason === 'feed-writ');
    expect(feeds.map((e) => [e.itemId, e.place, e.delta, e.balanceAfter])).toEqual([
      ['wild-sliver', 'store', -1, 0],
      ['wild-sliver', 'pack', -1, 1],
    ]);
    // Full now: "Full.", and the ledger unchanged.
    expect(await holding.feed(k, 'wild-sliver', 1, at(1 * HOUR))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    expect(await holding.fill(k, at(1 * HOUR))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    expect((await inv.ledger(k)).filter((e) => e.reason === 'feed-writ')).toHaveLength(2);
    // Two hours under full a sliver still doesn't fit: full, nothing taken.
    expect(await holding.feed(k, 'wild-sliver', 1, at(2 * HOUR))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    // Not enough across both places (one sliver left in the pack): refused, nothing taken.
    expect(await holding.feed(k, 'wild-sliver', 2, at(100 * HOUR))).toEqual({ ok: false, error: 'insufficient', message: WRIT_INSUFFICIENT });
    expect(await inv.view(k)).toMatchObject({ pack: [{ itemId: 'wild-sliver', quantity: 1 }] });
    // Currency comes from the purse: 44 h left at 100 h, plus 48.
    await inv.apply([{ kindledId: k, itemId: 'sealed-gin', place: 'purse', delta: 2 }], 'admin');
    // fed_at is set by the first feed only: the gin feed at 100 h leaves it at 0.
    expect(value(await holding.feed(k, 'sealed-gin', 1, at(100 * HOUR))).writ).toMatchObject({ emptyAt: at(192 * HOUR).toISOString(), fedAt: at(0).toISOString() });
    expect(await inv.view(k)).toMatchObject({ purse: [{ itemId: 'sealed-gin', quantity: 1 }] });
    expect((await inv.ledger(k)).filter((e) => e.reason === 'feed-writ')).toHaveLength(3);
    expect(feedChanges(k, [{ itemId: 'wild-sliver', place: 'store', quantity: 1 }, { itemId: 'wild-sliver', place: 'pack', quantity: 2 }], 'wild-sliver', 2)).toEqual([
      { kindledId: k, itemId: 'wild-sliver', place: 'store', delta: -1 },
      { kindledId: k, itemId: 'wild-sliver', place: 'pack', delta: -1 },
    ]);
    expect(feedChanges(k, [], 'wild-sliver', 1)).toBeNull();
  });

  it('Fill feeds as many wild slivers as fit of what the Kindled holds, never gin', async () => {
    const k = await namedKindled();
    // Unnamed first: Fill waits for the Name too.
    const unnamed = await newKindled();
    expect(await holding.fill(unnamed, at(0))).toEqual({ ok: false, error: 'unnamed', message: WRIT_UNNAMED });
    // Pressed to 48 h, two more fit; only one in the pack, and gin in the purse that Fill never touches.
    await inv.apply(
      [
        { kindledId: k, itemId: 'wild-sliver', place: 'pack', delta: 1 },
        { kindledId: k, itemId: 'sealed-gin', place: 'purse', delta: 5 },
      ],
      'admin',
    );
    expect(value(await holding.fill(k, at(0))).writ).toMatchObject({ emptyAt: at(96 * HOUR).toISOString() });
    expect(await inv.view(k)).toMatchObject({ pack: [], purse: [{ itemId: 'sealed-gin', quantity: 5 }] });
    expect(await holding.fill(k, at(0))).toEqual({ ok: false, error: 'insufficient', message: WRIT_INSUFFICIENT });
    await inv.apply([{ kindledId: k, itemId: 'wild-sliver', place: 'store', delta: 5 }], 'admin');
    expect(value(await holding.fill(k, at(0))).writ).toMatchObject({ emptyAt: at(144 * HOUR).toISOString() });
    expect(await inv.view(k)).toMatchObject({ store: [{ itemId: 'wild-sliver', quantity: 4 }], purse: [{ itemId: 'sealed-gin', quantity: 5 }] });
    expect(await holding.fill(k, at(0))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    // At 100 h (44 h left) two more slivers fit (140 h), one at a time.
    expect(value(await holding.fill(k, at(100 * HOUR))).writ).toMatchObject({ emptyAt: at(240 * HOUR).toISOString() });
    expect(await inv.view(k)).toMatchObject({ store: [{ itemId: 'wild-sliver', quantity: 2 }] });
  });

  it('relights a dark Writ from now, and the lines come back', async () => {
    const k = await namedKindled();
    await inv.apply([{ kindledId: k, itemId: 'wild-sliver', place: 'store', delta: 2 }], 'admin');
    const dark = value(await holding.view(k, at(60 * HOUR)));
    expect(dark.writ).toMatchObject({ state: 'dark', darkSince: at(48 * HOUR).toISOString(), lines: [{ line: 1, plots: 4, state: 'dark' }] });
    const relit = value(await holding.feed(k, 'wild-sliver', 1, at(60 * HOUR)));
    expect(relit.writ).toMatchObject({ state: 'lit', emptyAt: at(108 * HOUR).toISOString(), darkSince: null, lines: [{ line: 1, state: 'lit' }] });
    // Fading too (past the grace): from now.
    const faded = value(await holding.view(k, at(300 * HOUR)));
    expect(faded.writ).toMatchObject({ state: 'fading', lines: [{ line: 1, state: 'faded' }] });
    await inv.apply([{ kindledId: k, itemId: 'glass-chip', place: 'store', delta: 1 }], 'admin');
    expect(value(await holding.feed(k, 'glass-chip', 1, at(300 * HOUR))).writ).toMatchObject({ state: 'lit', emptyAt: at(444 * HOUR).toISOString(), words: 'about six days' });
  });
});

describe('the Writ hook (writ:set)', () => {
  it('parses its options', () => {
    expect(parseWritSetArgs(['writone', '--charge-hours', '10'])).toEqual({ ok: true, args: { username: 'writone', chargeHours: 10 } });
    expect(parseWritSetArgs(['writone', '--dark-hours', '5', '--certified', 'on'])).toEqual({ ok: true, args: { username: 'writone', darkHours: 5, certified: true } });
    expect(parseWritSetArgs(['writone', '--certified', 'off'])).toEqual({ ok: true, args: { username: 'writone', certified: false } });
    for (const bad of [[], ['writone'], ['writone', '--charge-hours'], ['writone', '--charge-hours', '-1'], ['writone', '--certified', 'yes'], ['writone', '--charge-hours', '1', '--dark-hours', '1'], ['writone', '--what', '1'], ['!!', '--charge-hours', '1']])
      expect(parseWritSetArgs(bad), bad.join(' ')).toMatchObject({ ok: false });
  });

  it('sets the charge, the dark time and the certification, creating the row when there is none', async () => {
    const k = await newKindled('writone');
    expect(await setWrit(handle.db, { username: 'nobody', chargeHours: 1 }, at(0))).toEqual({ ok: false, message: 'no Kindled for username nobody' });
    const pressed = await setWrit(handle.db, { username: 'writone', certified: true }, at(0));
    expect(pressed).toMatchObject({ ok: true, writ: { kindledId: k, emptyAt: at(48 * HOUR), certified: true, name: null } });
    const lit = await setWrit(handle.db, { username: 'writone', chargeHours: 100, certified: false }, at(0));
    expect(lit).toMatchObject({ ok: true, writ: { kindledId: k, emptyAt: at(100 * HOUR), certified: false, name: null } });
    expect(value(await holding.view(k, at(0))).writ).toMatchObject({ state: 'lit', chargeMs: 100 * HOUR });
    await setWrit(handle.db, { username: 'writone', chargeHours: 10 }, at(0));
    expect(value(await holding.view(k, at(0))).writ.state).toBe('flickering');
    await setWrit(handle.db, { username: 'writone', darkHours: 10, certified: true }, at(0));
    expect(value(await holding.view(k, at(0))).writ).toMatchObject({ state: 'dark', certified: true, darkSince: at(-10 * HOUR).toISOString() });
    await setWrit(handle.db, { username: 'writone', darkHours: 50 }, at(0));
    expect(value(await holding.view(k, at(0))).writ).toMatchObject({ state: 'fading', certified: true });
    // The Name is untouched.
    await holding.name(k, 'Ash', at(0));
    await setWrit(handle.db, { username: 'writone', certified: false }, at(0));
    expect(value(await holding.view(k, at(0))).writ).toMatchObject({ name: 'Ash', certified: false, state: 'fading' });
  });
});


describe("Kesh's slivers", () => {
  const pack = async (k: string): Promise<number> => (await inv.view(k)).pack.find((e) => e.itemId === 'wild-sliver')?.quantity ?? 0;
  const gifts = (k: string) => inv.ledger(k).then((rows) => rows.filter((e) => e.reason === 'gift'));
  /** The full of the tide after T0 (14:00 Berlin time): 20:00 that evening, 6 h on. */
  const FULL = 6 * HOUR;

  it('the first sliver: once, into the pack, ledger reason gift; then not-due with the scaffold off', async () => {
    const k = await newKindled();
    expect(value(await holding.view(k, at(0))).kesh).toEqual({ firstGiven: false, due: 'first', nextTideAt: at(FULL).toISOString() });
    const r = value(await holding.keshSliver(k, at(0)));
    expect(r.kesh).toMatchObject({ firstGiven: true });
    expect(await pack(k)).toBe(1);
    expect((await gifts(k)).map((e) => [e.itemId, e.place, e.delta, e.balanceAfter])).toEqual([['wild-sliver', 'pack', 1, 1]]);
    const [row] = await handle.db.select().from(keshGifts).where(eq(keshGifts.kindledId, k));
    expect(row).toEqual({ kindledId: k, firstSliverAt: at(0), lastTide: null });
    // Never a second first; with the scaffold off nothing else is due either.
    expect(keshDue({ firstSliverAt: at(0), lastTide: null }, at(0), false)).toBeNull();
    expect(keshDue({ firstSliverAt: null, lastTide: null }, at(0), false)).toBe('first');
    await handle.db.transaction(async (tx) => {
      expect(await giveSliver(tx, inv, k, at(0), false)).toEqual({ ok: false, error: 'not-due', message: KESH_NOT_DUE });
    });
    expect(await pack(k)).toBe(1);
  });

  it("the tide's sliver: once per tide, again the next tide; the first doesn't use up the tide's", async () => {
    const k = await newKindled();
    // The first and the tide's on the same day.
    value(await holding.keshSliver(k, at(0)));
    expect(value(await holding.view(k, at(0))).kesh).toEqual({ firstGiven: true, due: 'tide', nextTideAt: at(FULL).toISOString() });
    const tide = value(await holding.keshSliver(k, at(HOUR)));
    expect(tide.kesh).toEqual({ firstGiven: true, due: null, nextTideAt: at(FULL).toISOString() });
    expect(await pack(k)).toBe(2);
    const [row] = await handle.db.select().from(keshGifts).where(eq(keshGifts.kindledId, k));
    expect(row).toEqual({ kindledId: k, firstSliverAt: at(0), lastTide: tideIndex(at(HOUR)) });
    // Not due again this tide, right up to the full.
    expect(await holding.keshSliver(k, at(2 * HOUR))).toEqual({ ok: false, error: 'not-due', message: KESH_NOT_DUE });
    expect(await holding.keshSliver(k, at(FULL - 1000))).toEqual({ ok: false, error: 'not-due', message: KESH_NOT_DUE });
    expect(await pack(k)).toBe(2);
    // The next tide begins at the full: one more, and the next full moves a day on.
    expect(value(await holding.view(k, at(FULL))).kesh).toEqual({ firstGiven: true, due: 'tide', nextTideAt: at(FULL + 24 * HOUR).toISOString() });
    expect(value(await holding.keshSliver(k, at(FULL))).kesh.due).toBeNull();
    expect(await pack(k)).toBe(3);
    expect(await holding.keshSliver(k, at(FULL + 23 * HOUR))).toMatchObject({ ok: false, error: 'not-due' });
    // A tide skipped is not paid later: two tides on, one sliver.
    expect(value(await holding.keshSliver(k, at(FULL + 3 * 24 * HOUR))).kesh.due).toBeNull();
    expect(await holding.keshSliver(k, at(FULL + 3 * 24 * HOUR + HOUR))).toMatchObject({ ok: false, error: 'not-due' });
    expect(await pack(k)).toBe(4);
    expect(await gifts(k)).toHaveLength(4);
    expect(keshViewOf({ firstSliverAt: at(0), lastTide: tideIndex(at(0)) }, at(0))).toEqual({ firstGiven: true, due: null, nextTideAt: nextFullOfTide(at(0)).toISOString() });
    expect(keshViewOf({ firstSliverAt: at(0), lastTide: tideIndex(at(0)) }, at(0), false)).toMatchObject({ due: null });
    expect(keshViewOf({ firstSliverAt: at(0), lastTide: tideIndex(at(0)) - 1 }, at(0))).toMatchObject({ due: 'tide' });
  });

  it('a full pack refuses with pack-full and the sliver stays due', async () => {
    const k = await newKindled();
    // 20 slots of material fill the pack.
    await inv.apply([{ kindledId: k, itemId: 'black-stone', place: 'pack', delta: 1000 }], 'admin');
    expect(await holding.keshSliver(k, at(0))).toEqual({ ok: false, error: 'pack-full', message: KESH_PACK_FULL });
    expect(value(await holding.view(k, at(0))).kesh).toMatchObject({ firstGiven: false, due: 'first' });
    expect(await gifts(k)).toEqual([]);
    const [row] = await handle.db.select().from(keshGifts).where(eq(keshGifts.kindledId, k));
    expect(row).toEqual({ kindledId: k, firstSliverAt: null, lastTide: null });
    // Room again (a slot freed): given.
    await inv.apply([{ kindledId: k, itemId: 'black-stone', place: 'pack', delta: -50 }], 'admin');
    expect(value(await holding.keshSliver(k, at(0))).kesh).toMatchObject({ firstGiven: true, due: 'tide' });
    expect(await pack(k)).toBe(1);
  });

  it('kesh:reset clears both columns, so the first sliver is due again', async () => {
    const k = await newKindled('keshreset');
    value(await holding.keshSliver(k, at(0)));
    value(await holding.keshSliver(k, at(0)));
    expect(value(await holding.view(k, at(0))).kesh).toMatchObject({ firstGiven: true, due: null });
    expect(parseKeshResetArgs(['--', 'keshreset'])).toEqual({ ok: true, username: 'keshreset' });
    expect(parseKeshResetArgs([])).toMatchObject({ ok: false });
    expect(parseKeshResetArgs(['keshreset', 'more'])).toMatchObject({ ok: false });
    expect(parseKeshResetArgs(['no spaces allowed'])).toMatchObject({ ok: false });
    expect(await resetKesh(handle.db, 'nobody')).toEqual({ ok: false, message: 'no Kindled for username nobody' });
    expect(await resetKesh(handle.db, 'KeshReset')).toEqual({ ok: true, row: { kindledId: k, firstSliverAt: null, lastTide: null } });
    expect(value(await holding.view(k, at(0))).kesh).toMatchObject({ firstGiven: false, due: 'first' });
    expect(value(await holding.keshSliver(k, at(0))).kesh).toMatchObject({ firstGiven: true, due: 'tide' });
    expect(await pack(k)).toBe(3);
    // A Kindled with no row yet: the reset makes one.
    const fresh = await newKindled('keshfresh');
    expect(await resetKesh(handle.db, 'keshfresh')).toEqual({ ok: true, row: { kindledId: fresh, firstSliverAt: null, lastTide: null } });
  });

  it('fed_at is set by the first feed only', async () => {
    const k = await newKindled();
    await holding.name(k, 'Ash', at(0));
    await inv.apply([{ kindledId: k, itemId: 'wild-sliver', place: 'pack', delta: 2 }], 'admin');
    expect(value(await holding.view(k, at(0))).writ.fedAt).toBeNull();
    expect(value(await holding.feed(k, 'wild-sliver', 1, at(HOUR))).writ.fedAt).toBe(at(HOUR).toISOString());
    expect(value(await holding.feed(k, 'wild-sliver', 1, at(2 * HOUR))).writ.fedAt).toBe(at(HOUR).toISOString());
    const [row] = await handle.db.select().from(writs).where(eq(writs.kindledId, k));
    expect(row?.fedAt).toEqual(at(HOUR));
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
    for (const route of [ApiRoute.HoldingWork, ApiRoute.HoldingStop, ApiRoute.HoldingTake, ApiRoute.WritName, ApiRoute.WritFeed, ApiRoute.KeshSliver]) {
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

  it('names the island and feeds the Writ through the routes, with their guards and error codes', async () => {
    expect((await call(ApiRoute.WritName, { body: { name: 'Ash', extra: 1 } })).json()).toMatchObject({ error: 'bad-request' });
    expect((await call(ApiRoute.WritName, { body: {} })).statusCode).toBe(400);
    expect((await call(ApiRoute.WritName, { body: { name: 'A' } })).json()).toEqual({ error: 'name-refused', message: NAME_REFUSED });
    expect((await call(ApiRoute.WritName, { body: { name: 'אמת' } })).json()).toEqual({ error: 'name-refused', message: NAME_NOT_DRAWABLE });
    // Feeding waits for the Name.
    expect((await call(ApiRoute.WritFeed, { body: { itemId: 'wild-sliver', count: 1 } })).json()).toEqual({ error: 'unnamed', message: WRIT_UNNAMED });
    const named = await call(ApiRoute.WritName, { body: { name: 'Black Rock' } });
    expect(named.statusCode).toBe(200);
    const body = named.json<HoldingResponse>();
    expect(isHoldingResponse(body)).toBe(true);
    expect(body.writ).toMatchObject({ name: 'Black Rock', letters: 'בלק רוק', state: 'lit' });
    expect((await call(ApiRoute.WritName, { body: { name: 'Ash' } })).json()).toEqual({ error: 'already-named', message: WRIT_ALREADY_NAMED });
    // The feed's guards: counts are positive integers, fill is true, nothing else.
    for (const bad of [{ itemId: 'wild-sliver' }, { itemId: 'wild-sliver', count: 0 }, { itemId: 'wild-sliver', count: 1.5 }, { fill: false }, { itemId: 'wild-sliver', fill: true }, { itemId: 'wild-sliver', count: 1, fill: true }, { itemId: 'wild-sliver', count: 1, extra: 1 }])
      expect((await call(ApiRoute.WritFeed, { body: bad })).json(), JSON.stringify(bad)).toMatchObject({ error: 'bad-request' });
    expect((await call(ApiRoute.WritFeed, { body: { itemId: 'twisted-log', count: 1 } })).json()).toMatchObject({ error: 'not-sparkglass' });
    expect((await call(ApiRoute.WritFeed, { body: { itemId: 'wild-sliver', count: 1 } })).json()).toEqual({ error: 'insufficient', message: WRIT_INSUFFICIENT });
    const [k] = await handle.db.select({ id: kindled.id }).from(kindled).innerJoin(accounts, eq(kindled.accountId, accounts.id)).where(eq(accounts.username, 'apiholder'));
    if (!k) throw new Error('no api Kindled');
    await inv.apply([{ kindledId: k.id, itemId: 'wild-sliver', place: 'store', delta: 4 }, { kindledId: k.id, itemId: 'deep-glass', place: 'store', delta: 1 }], 'admin');
    // The Writ was pressed when the first holding request ran, at T0; the clock is 13 s on.
    const pressedAt = T0;
    const fed = await call(ApiRoute.WritFeed, { body: { itemId: 'wild-sliver', count: 1 } });
    expect(fed.statusCode).toBe(200);
    expect(fed.json<HoldingResponse>().writ).toMatchObject({ state: 'lit', emptyAt: new Date(pressedAt + 96 * HOUR).toISOString(), words: 'about four days' });
    expect((await call(ApiRoute.WritFeed, { body: { itemId: 'deep-glass', count: 1 } })).json()).toEqual({ error: 'too-much', message: WRIT_TOO_MUCH_EVER });
    expect((await call(ApiRoute.WritFeed, { body: { itemId: 'wild-sliver', count: 2 } })).json()).toEqual({ error: 'too-much', message: WRIT_TOO_MUCH_NOW });
    const filled = await call(ApiRoute.WritFeed, { body: { fill: true } });
    expect(filled.json<HoldingResponse>().writ).toMatchObject({ emptyAt: new Date(pressedAt + 144 * HOUR).toISOString(), words: 'about six days' });
    expect((await call(ApiRoute.WritFeed, { body: { itemId: 'wild-sliver', count: 1 } })).json()).toEqual({ error: 'full', message: 'Full.' });
    expect((await call(ApiRoute.WritFeed, { body: { itemId: 'wild-sliver', count: 1 } })).statusCode).toBe(409);
    expect((await call(ApiRoute.WritFeed, { body: { fill: true } })).statusCode).toBe(409);
    expect((await call(ApiRoute.Inventory, { method: 'GET' })).json()).toMatchObject({
      store: expect.arrayContaining([{ itemId: 'wild-sliver', quantity: 2 }, { itemId: 'deep-glass', quantity: 1 }]) as unknown,
    });
  });

  it("asks Kesh for his sliver through the route, with its guard and codes; the holding answer carries kesh", async () => {
    for (const bad of [{ sliver: 1 }, { due: 'first' }, []])
      expect((await call(ApiRoute.KeshSliver, { body: bad })).json(), JSON.stringify(bad)).toMatchObject({ error: 'bad-request' });
    const before = (await call(ApiRoute.Holding, { method: 'GET' })).json<HoldingResponse>();
    expect(before.kesh).toEqual({ firstGiven: false, due: 'first', nextTideAt: nextFullOfTide(clock.t).toISOString() });
    const first = await call(ApiRoute.KeshSliver, { body: {} });
    expect(first.statusCode).toBe(200);
    const body = first.json<HoldingResponse>();
    expect(isHoldingResponse(body)).toBe(true);
    expect(body.kesh).toMatchObject({ firstGiven: true, due: 'tide' });
    expect((await call(ApiRoute.Inventory, { method: 'GET' })).json()).toMatchObject({ pack: [{ itemId: 'wild-sliver', quantity: 1 }] });
    const tide = await call(ApiRoute.KeshSliver, { body: {} });
    expect(tide.statusCode).toBe(200);
    expect(tide.json<HoldingResponse>().kesh).toMatchObject({ firstGiven: true, due: null });
    const none = await call(ApiRoute.KeshSliver, { body: {} });
    expect(none.statusCode).toBe(409);
    expect(none.json()).toEqual({ error: 'not-due', message: KESH_NOT_DUE });
    // The next tide, with the pack full: "Pack full.", and still due.
    clock.t += 24 * HOUR;
    const [k] = await handle.db.select({ id: kindled.id }).from(kindled).innerJoin(accounts, eq(kindled.accountId, accounts.id)).where(eq(accounts.username, 'apiholder'));
    if (!k) throw new Error('no api Kindled');
    // 19 slots of stone and the slivers' slot filled to its 99: a sliver more would need a 21st slot.
    await inv.apply([{ kindledId: k.id, itemId: 'black-stone', place: 'pack', delta: 950 }, { kindledId: k.id, itemId: 'wild-sliver', place: 'pack', delta: 97 }], 'admin');
    const full = await call(ApiRoute.KeshSliver, { body: {} });
    expect(full.statusCode).toBe(409);
    expect(full.json()).toEqual({ error: 'pack-full', message: 'Pack full.' });
    expect((await call(ApiRoute.Holding, { method: 'GET' })).json<HoldingResponse>().kesh).toMatchObject({ due: 'tide' });
  });
});
