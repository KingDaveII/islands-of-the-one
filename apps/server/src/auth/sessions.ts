import { createHash, randomBytes } from 'node:crypto';
import { SESSION_COOKIE } from '@iot/shared';
import { and, eq, lte } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { accounts, sessions, type Account } from '../db/schema.js';

/**
 * Sessions (docs/design/accounts.md): a random 32-byte token in an httpOnly
 * cookie; the database keeps only its SHA-256, so a leaked table logs nobody
 * in. Expiry slides: a session used within 30 days lives another 30.
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sliding expiry is written back at most this often per session (fewer writes on busy sessions). */
export const SESSION_REFRESH_MS = 60 * 1000;

/** base64url of 32 bytes. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type Clock = () => Date;

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isTokenShaped(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/** Start a session for an account; returns the token for the cookie. */
export async function createSession(db: Database, accountId: string, now: Date): Promise<string> {
  const token = newToken();
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    accountId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return token;
}

export interface ResolvedSession {
  account: Account;
  /** The expiry was pushed forward: send the cookie again so it slides too. */
  refreshed: boolean;
}

/** The account behind a token, sliding its expiry; null when unknown or expired (an expired row is deleted). */
export async function resolveSession(
  db: Database,
  token: unknown,
  now: Date,
): Promise<ResolvedSession | null> {
  if (!isTokenShaped(token)) return null;
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ session: sessions, account: accounts })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  if (!row) return null;
  if (row.session.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }
  if (now.getTime() - row.session.lastSeenAt.getTime() < SESSION_REFRESH_MS)
    return { account: row.account, refreshed: false };
  await db
    .update(sessions)
    .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
    .where(eq(sessions.tokenHash, tokenHash));
  return { account: row.account, refreshed: true };
}

export async function deleteSession(db: Database, token: unknown): Promise<void> {
  if (!isTokenShaped(token)) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Drop an account's expired sessions (on login, so rows don't pile up). */
export async function purgeExpiredSessions(
  db: Database,
  accountId: string,
  now: Date,
): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.accountId, accountId), lte(sessions.expiresAt, now)));
}

/** The session token in a raw Cookie header, if any. */
export function tokenFromCookieHeader(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    if (part.slice(0, at).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(at + 1).trim();
    return isTokenShaped(value) ? value : undefined;
  }
  return undefined;
}

/**
 * The account behind a raw Cookie header: for Colyseus `onAuth` (its context
 * carries the upgrade request's headers), so rooms for shared spaces can
 * require a logged-in account later, e.g.
 * `accountFromCookieHeader(db, context.headers.get('cookie'))`.
 */
export async function accountFromCookieHeader(
  db: Database,
  header: string | null | undefined,
  now: Date = new Date(),
): Promise<Account | null> {
  return (await resolveSession(db, tokenFromCookieHeader(header), now))?.account ?? null;
}

/**
 * The Set-Cookie value for a session: httpOnly (scripts never see it),
 * SameSite=Lax, path /, Secure outside local dev, and a Max-Age that slides
 * with the session.
 */
export function sessionCookie(token: string, secure: boolean): string {
  return cookie(token, Math.floor(SESSION_TTL_MS / 1000), secure);
}

/** The Set-Cookie value that removes the session cookie. */
export function clearedSessionCookie(secure: boolean): string {
  return cookie('', 0, secure);
}

function cookie(value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
