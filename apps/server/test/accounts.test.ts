import {
  ApiRoute,
  isMeResponse,
  lettersFromPositions,
  NAME_NOT_DRAWABLE,
  KINDLED_NAME_REFUSED,
  NAME_REFUSED,
  SESSION_COOKIE,
  WRONG_CREDENTIALS,
  type MeResponse,
} from '@iot/shared';
import { eq } from 'drizzle-orm';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App, type AppOptions } from '../src/app.js';
import {
  accountFromCookieHeader,
  hashToken,
  SESSION_REFRESH_MS,
  SESSION_TTL_MS,
} from '../src/auth/sessions.js';
import { createDb } from '../src/db/client.js';
import { accounts, sessions } from '../src/db/schema.js';

const HOST = 'game.test';
const ORIGIN = `https://${HOST}`;
const DAY = 24 * 60 * 60 * 1000;

/** Banned words are built from alphabet positions, never spelled out (names.test.ts scans every file). */
const latin = (positions: number[]): string =>
  positions.map((p) => String.fromCharCode(97 + p)).join('');

/** A server on in-memory PGlite with a clock the tests move. */
async function setup(options: Partial<AppOptions> = {}) {
  const db = await createDb();
  await db.migrate();
  const clock = { t: Date.parse('2026-10-14T12:00:00Z') };
  const app = await createApp({ db, now: () => new Date(clock.t), ...options });
  return { db, app, clock };
}

interface Call {
  method?: 'GET' | 'POST';
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
}

function call(app: App, url: string, { method = 'POST', body, cookie, headers = {} }: Call = {}) {
  const opts: InjectOptions = {
    method,
    url,
    headers: {
      host: HOST,
      ...(method === 'POST' ? { origin: ORIGIN, 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
  };
  if (method === 'POST') opts.payload = JSON.stringify(body ?? {});
  return app.http.inject(opts);
}

/** The session cookie a response sets, as "name=value" for the next request. */
function sessionFrom(res: LightMyRequestResponse): string {
  const header = setCookie(res);
  const pair = header?.split(';')[0];
  if (!pair?.startsWith(`${SESSION_COOKIE}=`))
    throw new Error(`no session cookie: ${header ?? ''}`);
  return pair;
}

function setCookie(res: LightMyRequestResponse): string | undefined {
  const h = res.headers['set-cookie'];
  return Array.isArray(h) ? h[0] : h;
}

const register = (app: App, username: string, password = 'correct horse') =>
  call(app, ApiRoute.Register, { body: { username, password } });
const login = (app: App, username: string, password = 'correct horse') =>
  call(app, ApiRoute.Login, { body: { username, password } });
const me = (app: App, cookie?: string) =>
  call(app, ApiRoute.Me, { method: 'GET', ...(cookie ? { cookie } : {}) });

describe('accounts API', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let app: App;

  beforeAll(async () => {
    // Every request here comes from one address; the limits get their own test below.
    const open = { max: 10_000, timeWindowMs: 60_000 };
    ctx = await setup({ rateLimit: { login: open, register: open } });
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
    await ctx.db.close();
  });

  it('registers, reads /me, logs out and logs back in', async () => {
    const reg = await register(app, 'Mira_01');
    expect(reg.statusCode).toBe(201);
    const body: unknown = reg.json();
    expect(isMeResponse(body)).toBe(true);
    expect(body).toMatchObject({ account: { username: 'mira_01' }, kindled: null });
    const cookie = sessionFrom(reg);

    const who = await me(app, cookie);
    expect(who.statusCode).toBe(200);
    expect(who.json<MeResponse>().account.username).toBe('mira_01');
    expect(who.headers['cache-control']).toBe('no-store');

    const out = await call(app, ApiRoute.Logout, { cookie });
    expect(out.statusCode).toBe(204);
    expect(setCookie(out)).toMatch(new RegExp(`^${SESSION_COOKIE}=; Max-Age=0`));
    // The row is gone: the old cookie no longer works.
    expect((await me(app, cookie)).statusCode).toBe(401);

    const back = await login(app, 'MIRA_01');
    expect(back.statusCode).toBe(200);
    expect(back.json<MeResponse>().account.username).toBe('mira_01');
    expect((await me(app, sessionFrom(back))).statusCode).toBe(200);
  });

  it('stores an argon2id hash and only the SHA-256 of the session token', async () => {
    const res = await register(app, 'hashcheck');
    const token = sessionFrom(res).split('=')[1] ?? '';
    const [account] = await ctx.db.db
      .select()
      .from(accounts)
      .where(eq(accounts.username, 'hashcheck'));
    expect(account?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    const rows = await ctx.db.db
      .select()
      .from(sessions)
      .where(eq(sessions.accountId, account?.id ?? ''));
    expect(rows.map((r) => r.tokenHash)).toEqual([hashToken(token)]);
    expect(rows[0]?.tokenHash).not.toContain(token);
  });

  it('sets the cookie httpOnly, SameSite=Lax, path /, 30 days, not Secure in local dev', async () => {
    const res = await register(app, 'cookies');
    const header = setCookie(res) ?? '';
    const [pair, ...attrs] = header.split('; ');
    expect(pair).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43}$`));
    expect(attrs.sort()).toEqual(
      ['HttpOnly', `Max-Age=${SESSION_TTL_MS / 1000}`, 'Path=/', 'SameSite=Lax'].sort(),
    );
  });

  it('refuses duplicate usernames in any case', async () => {
    expect((await register(app, 'twin')).statusCode).toBe(201);
    for (const name of ['twin', 'TWIN', 'Twin', ' twin ']) {
      const res = await register(app, name);
      expect(res.statusCode, name).toBe(409);
      expect(res.json()).toEqual({ error: 'username-taken', message: 'That username is taken.' });
    }
  });

  it('answers a wrong password and an unknown username the same way', async () => {
    await register(app, 'guarded');
    const wrong = await login(app, 'guarded', 'not the password');
    const unknown = await login(app, 'nobody-here', 'correct horse');
    const malformed = await login(app, 'no spaces allowed', 'short');
    for (const res of [wrong, unknown, malformed]) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'wrong-credentials', message: WRONG_CREDENTIALS });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('validates usernames and passwords on register', async () => {
    const cases: [unknown, number, string][] = [
      [{ username: 'ab', password: 'correct horse' }, 400, 'invalid-username'],
      [{ username: 'a'.repeat(21), password: 'correct horse' }, 400, 'invalid-username'],
      [{ username: 'dot.ted', password: 'correct horse' }, 400, 'invalid-username'],
      [
        { username: latin([24, 0, 7, 22, 4, 7]), password: 'correct horse' },
        400,
        'invalid-username',
      ],
      [{ username: 'shortpw', password: '1234567' }, 400, 'invalid-password'],
      [{ username: 'longpw', password: 'p'.repeat(129) }, 400, 'invalid-password'],
      [{ username: 'extra', password: 'correct horse', admin: true }, 400, 'bad-request'],
      [{ username: 7, password: 'correct horse' }, 400, 'bad-request'],
      [['extra', 'correct horse'], 400, 'bad-request'],
    ];
    for (const [body, status, error] of cases) {
      const res = await call(app, ApiRoute.Register, { body });
      expect(res.statusCode, JSON.stringify(body)).toBe(status);
      expect(res.json<{ error: string }>().error).toBe(error);
    }
    const accepted = await register(app, 'p'.repeat(20), 'p'.repeat(128));
    expect(accepted.statusCode).toBe(201);
  });

  it('rejects malformed JSON, other content types and oversized bodies', async () => {
    const raw = (payload: string, contentType = 'application/json') =>
      app.http.inject({
        method: 'POST',
        url: ApiRoute.Register,
        headers: { host: HOST, origin: ORIGIN, 'content-type': contentType },
        payload,
      });
    const broken = await raw('{"username": ');
    expect(broken.statusCode).toBe(400);
    expect(broken.json()).toMatchObject({ error: 'bad-request' });

    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
      const res = await raw('username=a&password=b', type);
      expect(res.statusCode, type).toBe(415);
      expect(res.json()).toMatchObject({ error: 'unsupported-media-type' });
    }
    const big = await raw(JSON.stringify({ username: 'big', password: 'x'.repeat(10_000) }));
    expect(big.statusCode).toBe(413);
    expect(big.json()).toMatchObject({ error: 'bad-request' });
  });

  it('refuses mutating requests without an Origin matching the host', async () => {
    const body = { username: 'origin', password: 'correct horse' };
    const cases: Record<string, string>[] = [
      { origin: 'https://evil.example' },
      { origin: 'null' },
      { origin: `https://${HOST}.evil.example` },
      { origin: 'not a url' },
    ];
    for (const headers of cases) {
      const res = await call(app, ApiRoute.Register, { body, headers });
      expect(res.statusCode, headers.origin).toBe(403);
      expect(res.json()).toMatchObject({ error: 'forbidden' });
    }
    const noOrigin = await app.http.inject({
      method: 'POST',
      url: ApiRoute.Register,
      headers: { host: HOST, 'content-type': 'application/json' },
      payload: JSON.stringify(body),
    });
    expect(noOrigin.statusCode).toBe(403);
    // The local dev proxy (Vite on :5173 forwards /api with its own Host).
    const dev = await call(app, ApiRoute.Register, {
      body,
      headers: { host: 'localhost:5173', origin: 'http://localhost:5173' },
    });
    expect(dev.statusCode).toBe(201);
  });

  it('answers /me without a session, with a garbage cookie and on unknown routes', async () => {
    expect((await me(app)).statusCode).toBe(401);
    expect((await me(app)).json()).toEqual({ error: 'not-signed-in', message: 'Not signed in.' });
    expect((await me(app, `${SESSION_COOKIE}=garbage`)).statusCode).toBe(401);
    const forged = await me(app, `${SESSION_COOKIE}=${'A'.repeat(43)}`);
    expect(forged.statusCode).toBe(401);
    // A stale cookie is cleared.
    expect(setCookie(forged)).toMatch(new RegExp(`^${SESSION_COOKIE}=; Max-Age=0`));
    const missing = await call(app, '/api/nope', { method: 'GET' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: 'not-found' });
  });

  it('expires sessions after 30 days unused, and slides them while in use', async () => {
    const cookie = sessionFrom(await register(app, 'slider'));
    // Used every 20 days: still alive after 60.
    for (let i = 0; i < 3; i++) {
      ctx.clock.t += 20 * DAY;
      const res = await me(app, cookie);
      expect(res.statusCode, `day ${(i + 1) * 20}`).toBe(200);
      // The cookie slides with the row.
      expect(sessionFrom(res)).toBe(cookie);
    }
    // Within a minute of the last refresh: no write, no new cookie.
    ctx.clock.t += SESSION_REFRESH_MS / 2;
    expect((await me(app, cookie)).headers['set-cookie']).toBeUndefined();

    ctx.clock.t += 30 * DAY;
    const expired = await me(app, cookie);
    expect(expired.statusCode).toBe(401);
    // The expired row is deleted.
    const token = cookie.split('=')[1] ?? '';
    expect(
      await ctx.db.db
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, hashToken(token))),
    ).toEqual([]);
  });

  it('resolves a session from a raw cookie header (for Colyseus onAuth)', async () => {
    const cookie = sessionFrom(await register(app, 'roomauth'));
    const now = new Date(ctx.clock.t);
    const account = await accountFromCookieHeader(ctx.db.db, `theme=dark; ${cookie}; x=1`, now);
    expect(account?.username).toBe('roomauth');
    expect(await accountFromCookieHeader(ctx.db.db, undefined, now)).toBeNull();
    expect(await accountFromCookieHeader(ctx.db.db, 'theme=dark', now)).toBeNull();
    expect(
      await accountFromCookieHeader(ctx.db.db, cookie, new Date(ctx.clock.t + SESSION_TTL_MS)),
    ).toBeNull();
  });

  describe('POST /api/kindled', () => {
    const create = (cookie: string | undefined, body: unknown) =>
      call(app, ApiRoute.Kindled, { body, ...(cookie ? { cookie } : {}) });

    it('needs a session', async () => {
      const res = await create(undefined, { name: 'Mira', remembrance: 'ash' });
      expect(res.statusCode).toBe(401);
    });

    it('creates the Kindled once; /me returns it', async () => {
      const cookie = sessionFrom(await register(app, 'maker'));
      const res = await create(cookie, {
        name: '  Mira   of the  Shore ',
        remembrance: 'tide',
        clayTone: 'clay-red',
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        kindled: { name: 'Mira of the Shore', remembrance: 'tide', clayTone: 'clay-red' },
      });
      const who = (await me(app, cookie)).json<MeResponse>();
      expect(who.kindled).toMatchObject({ name: 'Mira of the Shore', remembrance: 'tide' });

      const again = await create(cookie, { name: 'Other', remembrance: 'ash' });
      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({ error: 'kindled-exists' });
      // A second session on the same account can't make another either.
      const second = sessionFrom(await login(app, 'maker'));
      expect((await create(second, { name: 'Third', remembrance: 'wing' })).statusCode).toBe(409);
      // Two at once: exactly one wins.
      const cookie2 = sessionFrom(await register(app, 'racer'));
      const results = await Promise.all(
        ['One', 'Two', 'Three'].map((name) => create(cookie2, { name, remembrance: 'clay' })),
      );
      expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409, 409]);
    });

    it('defaults the clay tone to grey-ochre', async () => {
      const cookie = sessionFrom(await register(app, 'defaults'));
      const res = await create(cookie, { name: 'Ash', remembrance: 'ash' });
      expect(res.json()).toMatchObject({ kindled: { clayTone: 'clay-grey-ochre' } });
    });

    it('rejects unknown Remembrances, tones and extra fields', async () => {
      const cookie = sessionFrom(await register(app, 'picky'));
      for (const body of [
        { name: 'Mira', remembrance: 'stone' },
        { name: 'Mira', remembrance: 'ash', clayTone: 'blue' },
        { name: 'Mira', remembrance: 'ash', level: 50 },
        { name: 'Mira' },
        { name: 5, remembrance: 'ash' },
      ]) {
        const res = await create(cookie, body);
        expect(res.statusCode, JSON.stringify(body)).toBe(400);
        expect(res.json()).toMatchObject({ error: 'bad-request' });
      }
    });

    it("refuses a name with LORE's line (code name-refused), not the Writ's, and makes nothing", async () => {
      const cookie = sessionFrom(await register(app, 'lorename'));
      const res = await create(cookie, { name: 'A', remembrance: 'tide', clayTone: 'clay-red' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'name-refused', message: "That name won't hold. Try another." });
      expect(KINDLED_NAME_REFUSED).toBe("That name won't hold. Try another.");
      expect(KINDLED_NAME_REFUSED).not.toBe(NAME_REFUSED);
      // The account still has no Kindled: the next good name makes it.
      const ok = await create(cookie, { name: 'Iltani', remembrance: 'tide', clayTone: 'clay-red' });
      expect(ok.statusCode).toBe(201);
      expect(ok.json()).toMatchObject({ kindled: { name: 'Iltani', remembrance: 'tide', clayTone: 'clay-red' } });
    });

    it('validates the name: length, combining characters, control characters, drawable letters, the filter', async () => {
      const refused = [
        'M',
        '   ',
        'x'.repeat(25),
        'Mi\u0000ra',
        'Mi\u0007ra',
        'Mira\u202eevil',
        '!!',
        latin([24, 0, 7, 22, 4, 7]),
        `Sir ${latin([9, 4, 7, 14, 21, 0, 7]).toUpperCase()}`,
        lettersFromPositions([9, 4, 5, 4]),
        Array.from(lettersFromPositions([0, 3, 13, 9])).join('\u05b8 '),
      ];
      const notDrawable = [
        '\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd', // Hebrew, right to left
        '\u0645\u0631\u064a\u0645', // Arabic
        'Mira \u05de\u05d9\u05e8\u05d4',
        `Z${'\u0301'.repeat(6)}algo`,
        'Nguy\u1ec5n',
      ];
      const cookie = sessionFrom(await register(app, 'namer'));
      for (const [names, message] of [
        [refused, KINDLED_NAME_REFUSED],
        [notDrawable, NAME_NOT_DRAWABLE],
      ] as const) {
        for (const name of names) {
          const res = await create(cookie, { name, remembrance: 'clay' });
          expect(res.statusCode, JSON.stringify(name)).toBe(400);
          expect(res.json(), JSON.stringify(name)).toEqual({ error: 'name-refused', message });
        }
      }
      const accepted: [string, string][] = [
        ['Zoe\u0301', 'Zo\u00e9'],
        ['e\u0301'.repeat(24), '\u00e9'.repeat(24)],
        ['J\u00fcrgen \u00d1\u00fa\u00f1ez', 'J\u00fcrgen \u00d1\u00fa\u00f1ez'],
        ['Mira\tof\nAsh', 'Mira of Ash'],
      ];
      for (const [i, [name, stored]] of accepted.entries()) {
        const c = sessionFrom(await register(app, `namer${i}`));
        const res = await create(c, { name, remembrance: 'wing' });
        expect(res.statusCode, JSON.stringify(name)).toBe(201);
        expect(res.json()).toMatchObject({ kindled: { name: stored } });
      }
    });
  });
});

describe('accounts API in production', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeAll(async () => {
    ctx = await setup({
      secureCookies: true,
      trustProxy: 'loopback',
      rateLimit: {
        login: { max: 3, timeWindowMs: 60_000 },
        register: { max: 2, timeWindowMs: 60_000 },
      },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.close();
  });

  it('marks the cookie Secure', async () => {
    const res = await register(ctx.app, 'secure');
    expect(setCookie(res)?.split('; ')).toContain('Secure');
    const out = await call(ctx.app, ApiRoute.Logout, { cookie: sessionFrom(res) });
    expect(setCookie(out)?.split('; ')).toContain('Secure');
  });

  it('rate-limits login and register per client address', async () => {
    const from = (ip: string) => ({ 'x-forwarded-for': ip });
    const tryLogin = (ip: string) =>
      call(ctx.app, ApiRoute.Login, {
        body: { username: 'secure', password: 'wrong password' },
        headers: from(ip),
      });
    for (let i = 0; i < 3; i++) expect((await tryLogin('203.0.113.1')).statusCode).toBe(401);
    const limited = await tryLogin('203.0.113.1');
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: 'rate-limited' });
    expect(limited.headers['retry-after']).toBeDefined();
    // Another address (behind the trusted proxy) has its own budget.
    expect((await tryLogin('203.0.113.2')).statusCode).toBe(401);

    const tryRegister = (name: string) =>
      call(ctx.app, ApiRoute.Register, {
        body: { username: name, password: 'correct horse' },
        headers: from('203.0.113.3'),
      });
    expect((await tryRegister('first')).statusCode).toBe(201);
    expect((await tryRegister('second')).statusCode).toBe(201);
    expect((await tryRegister('third')).statusCode).toBe(429);
  });
});

describe('per-username login throttle', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  const open = { max: 10_000, timeWindowMs: 60_000 };

  beforeAll(async () => {
    ctx = await setup({
      trustProxy: 'loopback',
      rateLimit: { login: open, register: open },
      loginThrottle: { maxFailures: 3, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.close();
  });

  /** A login from its own client address (the per-IP limit never sees two from one). */
  let ip = 0;
  const attempt = (username: string, password: string) =>
    call(ctx.app, ApiRoute.Login, {
      body: { username, password },
      headers: { 'x-forwarded-for': `198.51.100.${++ip}` },
    });

  it('refuses a username after 3 failures from different addresses, even with the right password', async () => {
    await register(ctx.app, 'target');
    await register(ctx.app, 'bystander');
    for (let i = 0; i < 3; i++)
      expect((await attempt('target', `guess number ${i}`)).statusCode).toBe(401);
    const locked = await attempt('TARGET', 'correct horse');
    expect(locked.statusCode).toBe(401);
    expect(locked.json()).toEqual({ error: 'wrong-credentials', message: WRONG_CREDENTIALS });
    expect(locked.headers['set-cookie']).toBeUndefined();
    // Other accounts are unaffected.
    expect((await attempt('bystander', 'correct horse')).statusCode).toBe(200);

    // 15 minutes later the lock is over.
    ctx.clock.t += 15 * 60_000;
    expect((await attempt('target', 'correct horse')).statusCode).toBe(200);
  });

  it('a success clears the count; unknown usernames lock the same way', async () => {
    await register(ctx.app, 'forgetful');
    for (let i = 0; i < 2; i++) await attempt('forgetful', 'wrong password');
    expect((await attempt('forgetful', 'correct horse')).statusCode).toBe(200);
    for (let i = 0; i < 2; i++) await attempt('forgetful', 'wrong password');
    expect((await attempt('forgetful', 'correct horse')).statusCode).toBe(200);

    for (let i = 0; i < 4; i++) {
      const res = await attempt('nobody-at-all', 'whatever goes');
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'wrong-credentials', message: WRONG_CREDENTIALS });
    }
  });
});
