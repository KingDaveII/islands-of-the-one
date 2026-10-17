import { isClayTone, isRemembrance, type Remembrance } from './accounts.js';
import type { ClayTone } from './sprites.js';

/**
 * The HTTP JSON API (docs/design/accounts.md): routes, request and response
 * bodies, and their guards. The holding talks to the server through these;
 * Colyseus rooms stay for shared spaces. Both sides import everything from
 * here; apps never spell a route or an error code themselves.
 */

export const ApiRoute = {
  Register: '/api/register',
  Login: '/api/login',
  Logout: '/api/logout',
  Me: '/api/me',
  Kindled: '/api/kindled',
  Inventory: '/api/inventory',
} as const;
export type ApiRoute = (typeof ApiRoute)[keyof typeof ApiRoute];

/** Every API route lives under this prefix (the dev proxy and Caddy route it to the server). */
export const API_PREFIX = '/api';

/** The server's liveness route, outside the prefix (Caddy and the dev proxy send it to the server too). */
export const HEALTH_ROUTE = '/health';

/** What GET /health answers when the server is up: among the rest, its build (the deploy's commit SHA, `dev` locally). */
export interface HealthResponse {
  status: 'ok';
  version: string;
}

/** The httpOnly session cookie; the client never reads it, the server and room auth do. */
export const SESSION_COOKIE = 'iot_session';

/** Machine-readable error codes; `message` is the player-facing text. */
export const ApiErrorCode = {
  BadRequest: 'bad-request',
  InvalidUsername: 'invalid-username',
  InvalidPassword: 'invalid-password',
  UsernameTaken: 'username-taken',
  WrongCredentials: 'wrong-credentials',
  NotSignedIn: 'not-signed-in',
  NameRefused: 'name-refused',
  KindledExists: 'kindled-exists',
  NoKindled: 'no-kindled',
  RateLimited: 'rate-limited',
  Forbidden: 'forbidden',
  UnsupportedMediaType: 'unsupported-media-type',
  NotFound: 'not-found',
  Internal: 'internal',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
}

/** The player-facing line for a failed login, whichever part was wrong. */
export const WRONG_CREDENTIALS = 'Wrong username or password.';

// Requests (client -> server). Guards check the shape only; the account
// validators (accounts.ts) then check and normalize the values.

export interface CredentialsRequest {
  username: string;
  password: string;
}
export type RegisterRequest = CredentialsRequest;
export type LoginRequest = CredentialsRequest;

export interface CreateKindledRequest {
  name: string;
  remembrance: Remembrance;
  /** Defaults to creationData.defaultClayTone. */
  clayTone?: ClayTone;
}

// Responses (server -> client).

export interface AccountView {
  username: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface KindledView {
  name: string;
  remembrance: Remembrance;
  clayTone: ClayTone;
  /** ISO 8601. */
  createdAt: string;
}

/** GET /api/me, and the reply to register and login. */
export interface MeResponse {
  account: AccountView;
  kindled: KindledView | null;
}

/** POST /api/kindled. */
export interface KindledResponse {
  kindled: KindledView;
}

/** One held item: an id from data/items.json and how many (always more than 0). */
export interface InventoryEntry {
  item: string;
  quantity: number;
}

/** GET /api/inventory: the signed-in Kindled's items, in items.json order. */
export interface InventoryResponse {
  items: InventoryEntry[];
}

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnly = (v: Obj, keys: readonly string[]): boolean =>
  Object.keys(v).every((k) => keys.includes(k));

export function isCredentialsRequest(value: unknown): value is CredentialsRequest {
  return (
    isObject(value) &&
    hasOnly(value, ['username', 'password']) &&
    typeof value.username === 'string' &&
    typeof value.password === 'string'
  );
}

export const isRegisterRequest: (value: unknown) => value is RegisterRequest = isCredentialsRequest;
export const isLoginRequest: (value: unknown) => value is LoginRequest = isCredentialsRequest;

export function isCreateKindledRequest(value: unknown): value is CreateKindledRequest {
  return (
    isObject(value) &&
    hasOnly(value, ['name', 'remembrance', 'clayTone']) &&
    typeof value.name === 'string' &&
    isRemembrance(value.remembrance) &&
    (value.clayTone === undefined || isClayTone(value.clayTone))
  );
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

export function isAccountView(value: unknown): value is AccountView {
  return isObject(value) && typeof value.username === 'string' && isIsoDate(value.createdAt);
}

export function isKindledView(value: unknown): value is KindledView {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    isRemembrance(value.remembrance) &&
    isClayTone(value.clayTone) &&
    isIsoDate(value.createdAt)
  );
}

export function isMeResponse(value: unknown): value is MeResponse {
  return (
    isObject(value) &&
    isAccountView(value.account) &&
    (value.kindled === null || isKindledView(value.kindled))
  );
}

export function isKindledResponse(value: unknown): value is KindledResponse {
  return isObject(value) && isKindledView(value.kindled);
}

export function isInventoryEntry(value: unknown): value is InventoryEntry {
  return (
    isObject(value) &&
    typeof value.item === 'string' &&
    typeof value.quantity === 'number' &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity > 0
  );
}

export function isInventoryResponse(value: unknown): value is InventoryResponse {
  return isObject(value) && Array.isArray(value.items) && value.items.every(isInventoryEntry);
}

const ERROR_CODES = new Set<string>(Object.values(ApiErrorCode));

export function isHealthResponse(value: unknown): value is HealthResponse {
  return isObject(value) && value.status === 'ok' && typeof value.version === 'string';
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    isObject(value) &&
    typeof value.error === 'string' &&
    ERROR_CODES.has(value.error) &&
    typeof value.message === 'string'
  );
}
