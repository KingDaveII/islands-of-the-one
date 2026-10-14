import rateLimit from '@fastify/rate-limit';
import {
  API_PREFIX,
  ApiErrorCode,
  ApiRoute,
  DEFAULT_CLAY_TONE,
  isClayTone,
  isCreateKindledRequest,
  isLoginRequest,
  isRegisterRequest,
  isRemembrance,
  validateKindledName,
  validatePassword,
  validateUsername,
  WRONG_CREDENTIALS,
  type AccountView,
  type ApiErrorBody,
  type KindledResponse,
  type KindledView,
  type MeResponse,
} from '@iot/shared';
import { eq, sql } from 'drizzle-orm';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import {
  clearedSessionCookie,
  createSession,
  deleteSession,
  purgeExpiredSessions,
  resolveSession,
  sessionCookie,
  tokenFromCookieHeader,
  type Clock,
} from '../auth/sessions.js';
import { LoginThrottle, type LoginThrottleOptions } from '../auth/throttle.js';
import type { Database } from '../db/client.js';
import { accounts, kindled, type Account, type KindledRow } from '../db/schema.js';

/**
 * The HTTP JSON API under /api (docs/design/accounts.md). Every route, body
 * and error code comes from @iot/shared; every body goes through a shared
 * guard and validator before it is used. Mutating routes need a JSON body
 * and an Origin matching the Host (same-origin only: a cross-site form or
 * fetch can't log anyone in or out or create anything).
 */

export interface RateWindow {
  max: number;
  timeWindowMs: number;
}

export interface ApiOptions {
  db: Database;
  /** Mark the session cookie Secure (everywhere but local dev). */
  secureCookies: boolean;
  now: Clock;
  rateLimit: { register: RateWindow; login: RateWindow };
  /** The per-username login throttle (beside the per-IP limits). */
  loginThrottle: LoginThrottleOptions;
}

export const DEFAULT_RATE_LIMITS: ApiOptions['rateLimit'] = {
  login: { max: 10, timeWindowMs: 60_000 },
  register: { max: 10, timeWindowMs: 60 * 60_000 },
};

/** Request bodies are a few short strings. */
const BODY_LIMIT = 4096;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const path = (route: string): string => route.slice(API_PREFIX.length);

function fail(reply: FastifyReply, status: number, error: ApiErrorCode, message: string) {
  const body: ApiErrorBody = { error, message };
  return reply.code(status).send(body);
}

function accountView(a: Account): AccountView {
  return { username: a.username, createdAt: a.createdAt.toISOString() };
}

function kindledView(k: KindledRow): KindledView {
  if (!isRemembrance(k.remembrance) || !isClayTone(k.clayTone))
    throw new Error(`kindled ${k.id}: unknown remembrance or clay tone`);
  return {
    name: k.name,
    remembrance: k.remembrance,
    clayTone: k.clayTone,
    createdAt: k.createdAt.toISOString(),
  };
}

/** Postgres unique_violation, through Drizzle's error wrapping. */
function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 5 && typeof e === 'object' && e !== null; depth++) {
    if ((e as { code?: unknown }).code === '23505') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** The request's Origin names the host it was sent to (the page and the API share one origin). */
export function sameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export async function apiRoutes(app: FastifyInstance, opts: ApiOptions): Promise<void> {
  const { db, now } = opts;
  const throttle = new LoginThrottle(opts.loginThrottle);

  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: ctx.statusCode,
      error: ApiErrorCode.RateLimited,
      message: 'Too many tries. Wait a little and try again.',
    }),
  });

  app.addHook('onRequest', async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    if (SAFE_METHODS.has(req.method)) return;
    if (!sameOrigin(req.headers.origin, req.headers.host))
      return fail(reply, 403, ApiErrorCode.Forbidden, 'Cross-origin request refused.');
    const media = req.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    if (media !== 'application/json')
      return fail(reply, 415, ApiErrorCode.UnsupportedMediaType, 'Send JSON.');
  });

  app.setErrorHandler((err: FastifyError & { error?: unknown }, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status === 429) return fail(reply, 429, ApiErrorCode.RateLimited, err.message);
    if (status === 415) return fail(reply, 415, ApiErrorCode.UnsupportedMediaType, 'Send JSON.');
    if (status >= 400 && status < 500)
      return fail(reply, status, ApiErrorCode.BadRequest, 'Malformed request.');
    req.log.error(err);
    return fail(reply, 500, ApiErrorCode.Internal, 'Something went wrong.');
  });

  app.setNotFoundHandler((_req, reply) =>
    fail(reply, 404, ApiErrorCode.NotFound, 'No such route.'),
  );

  const setSession = (reply: FastifyReply, token: string): void => {
    void reply.header('set-cookie', sessionCookie(token, opts.secureCookies));
  };

  /** The signed-in account, sliding the session (and its cookie) forward; null clears a stale cookie. */
  const signedIn = async (req: FastifyRequest, reply: FastifyReply): Promise<Account | null> => {
    const token = tokenFromCookieHeader(req.headers.cookie);
    const session = await resolveSession(db, token, now());
    if (!session) {
      if (token !== undefined)
        void reply.header('set-cookie', clearedSessionCookie(opts.secureCookies));
      return null;
    }
    if (session.refreshed && token !== undefined) setSession(reply, token);
    return session.account;
  };

  const findKindled = async (accountId: string): Promise<KindledRow | undefined> => {
    const [row] = await db.select().from(kindled).where(eq(kindled.accountId, accountId)).limit(1);
    return row;
  };

  const me = async (account: Account): Promise<MeResponse> => {
    const k = await findKindled(account.id);
    return { account: accountView(account), kindled: k ? kindledView(k) : null };
  };

  const findAccount = async (username: string): Promise<Account | undefined> => {
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(sql`lower(${accounts.username})`, username))
      .limit(1);
    return row;
  };

  const limit = (w: RateWindow) => ({ rateLimit: { max: w.max, timeWindow: w.timeWindowMs } });

  app.post(
    path(ApiRoute.Register),
    { bodyLimit: BODY_LIMIT, config: limit(opts.rateLimit.register) },
    async (req, reply) => {
      if (!isRegisterRequest(req.body))
        return fail(reply, 400, ApiErrorCode.BadRequest, 'Malformed request.');
      const username = validateUsername(req.body.username);
      if (!username.ok) return fail(reply, 400, ApiErrorCode.InvalidUsername, username.message);
      const password = validatePassword(req.body.password);
      if (!password.ok) return fail(reply, 400, ApiErrorCode.InvalidPassword, password.message);
      const taken = (): FastifyReply =>
        fail(reply, 409, ApiErrorCode.UsernameTaken, 'That username is taken.');
      if (await findAccount(username.value)) return taken();

      const passwordHash = await hashPassword(password.value);
      const at = now();
      let account: Account | undefined;
      try {
        [account] = await db
          .insert(accounts)
          .values({ username: username.value, passwordHash, createdAt: at, lastLoginAt: at })
          .returning();
      } catch (err) {
        if (isUniqueViolation(err)) return taken();
        throw err;
      }
      if (!account) throw new Error('account insert returned nothing');
      setSession(reply, await createSession(db, account.id, at));
      const body: MeResponse = { account: accountView(account), kindled: null };
      return reply.code(201).send(body);
    },
  );

  app.post(
    path(ApiRoute.Login),
    { bodyLimit: BODY_LIMIT, config: limit(opts.rateLimit.login) },
    async (req, reply) => {
      if (!isLoginRequest(req.body))
        return fail(reply, 400, ApiErrorCode.BadRequest, 'Malformed request.');
      const username = validateUsername(req.body.username);
      const password = validatePassword(req.body.password);
      const at = now();
      const key = username.ok ? username.value : null;
      // A username locked by the throttle is refused without looking at the password, so
      // guesses can't be confirmed while it lasts; the same dummy verification keeps the timing.
      const locked = key !== null && throttle.isLocked(key, at.getTime());
      const account = username.ok && !locked ? await findAccount(username.value) : undefined;
      // Always one argon2 verification (a dummy one for an unknown username): same time, same answer.
      const verified = await verifyPassword(
        account?.passwordHash,
        password.ok ? password.value : '',
      );
      if (!account || !password.ok || !verified) {
        if (key !== null && !locked) throttle.fail(key, at.getTime());
        return fail(reply, 401, ApiErrorCode.WrongCredentials, WRONG_CREDENTIALS);
      }
      throttle.succeed(account.username);

      await deleteSession(db, tokenFromCookieHeader(req.headers.cookie));
      await purgeExpiredSessions(db, account.id, at);
      await db.update(accounts).set({ lastLoginAt: at }).where(eq(accounts.id, account.id));
      setSession(reply, await createSession(db, account.id, at));
      return reply.send(await me(account));
    },
  );

  app.post(path(ApiRoute.Logout), { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    await deleteSession(db, tokenFromCookieHeader(req.headers.cookie));
    return reply.header('set-cookie', clearedSessionCookie(opts.secureCookies)).code(204).send();
  });

  app.get(path(ApiRoute.Me), async (req, reply) => {
    const account = await signedIn(req, reply);
    if (!account) return fail(reply, 401, ApiErrorCode.NotSignedIn, 'Not signed in.');
    return reply.send(await me(account));
  });

  app.post(path(ApiRoute.Kindled), { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    const account = await signedIn(req, reply);
    if (!account) return fail(reply, 401, ApiErrorCode.NotSignedIn, 'Not signed in.');
    if (!isCreateKindledRequest(req.body))
      return fail(reply, 400, ApiErrorCode.BadRequest, 'Malformed request.');
    const name = validateKindledName(req.body.name);
    if (!name.ok) return fail(reply, 400, ApiErrorCode.NameRefused, name.message);
    const exists = (): FastifyReply =>
      fail(reply, 409, ApiErrorCode.KindledExists, 'This account already has a Kindled.');
    if (await findKindled(account.id)) return exists();

    let row: KindledRow | undefined;
    try {
      [row] = await db
        .insert(kindled)
        .values({
          accountId: account.id,
          name: name.name,
          remembrance: req.body.remembrance,
          clayTone: req.body.clayTone ?? DEFAULT_CLAY_TONE,
          createdAt: now(),
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) return exists();
      throw err;
    }
    if (!row) throw new Error('kindled insert returned nothing');
    const body: KindledResponse = { kindled: kindledView(row) };
    return reply.code(201).send(body);
  });
}
