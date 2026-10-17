import { isClayTone, isRemembrance, type Remembrance } from './accounts.js';
import { isHoldingStationId } from './holding.js';
import { isPlace, isStationId, type Place } from './places.js';
import { isSkill, type Skill } from './skills.js';
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
  InventoryMove: '/api/inventory/move',
  Holding: '/api/holding',
  HoldingWork: '/api/holding/work',
  HoldingStop: '/api/holding/stop',
  HoldingTake: '/api/holding/take',
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
  // Inventory moves (docs/design/inventory.md), the same codes inventory.apply refuses with.
  PackFull: 'pack-full',
  StackLimit: 'stack-limit',
  Insufficient: 'insufficient',
  WrongPlace: 'wrong-place',
  // The holding (docs/design/holding.md).
  UnknownStation: 'unknown-station',
  NoAction: 'no-action',
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
  itemId: string;
  quantity: number;
}

/**
 * GET /api/inventory, and the answer to a move: the signed-in Kindled's
 * items by place (docs/design/inventory.md), each list in items.json order,
 * the baskets keyed by station id. Pack slots are derived (packSlots in
 * places.ts), never sent.
 */
export interface InventoryResponse {
  purse: InventoryEntry[];
  pack: InventoryEntry[];
  store: InventoryEntry[];
  baskets: Record<string, InventoryEntry[]>;
}

/**
 * POST /api/inventory/move: `quantity` of an item from one place to
 * another. The pack and the store move both ways; a basket moves to the
 * store; nothing else (canMove in places.ts). Answers the new
 * InventoryResponse, or pack-full, stack-limit, insufficient, wrong-place or
 * bad-request.
 */
export interface InventoryMoveRequest {
  itemId: string;
  from: Place;
  to: Place;
  quantity: number;
}

/**
 * The holding's active action (docs/design/holding.md): the station being
 * worked, when it started (ISO 8601, the server's clock) and its cycle, so
 * the client draws the cycle ring from `startedAt` and the server's `now`.
 */
export interface HoldingActivity {
  stationId: string;
  startedAt: string;
  cycleMs: number;
}

/** A skill's XP, level, XP into the level and XP to the next (skills.ts). */
export interface SkillView {
  xp: number;
  level: number;
  into: number;
  toNext: number;
}

/** What a take-all moved from a station's basket into the store, and what stayed (what didn't fit). */
export interface HoldingTake {
  stationId: string;
  moved: InventoryEntry[];
  left: InventoryEntry[];
}

/**
 * GET /api/holding, and the answer to work, stop and take: the layout, every
 * station's basket (by station id, every station listed), the active action
 * or null, the server's clock and the skills. The server settles the action
 * before answering, so the counts are true as of `now`. A take-all answer
 * adds `take`.
 */
export interface HoldingResponse {
  layoutId: string;
  baskets: Record<string, InventoryEntry[]>;
  activity: HoldingActivity | null;
  now: string;
  skills: Record<Skill, SkillView>;
  take?: HoldingTake;
}

/** POST /api/holding/work and /take: the station, by id (stations.json). */
export interface HoldingStationRequest {
  stationId: string;
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

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function isInventoryEntry(value: unknown): value is InventoryEntry {
  return isObject(value) && typeof value.itemId === 'string' && isPositiveInt(value.quantity);
}

const isEntryList = (value: unknown): value is InventoryEntry[] =>
  Array.isArray(value) && value.every(isInventoryEntry);

export function isInventoryResponse(value: unknown): value is InventoryResponse {
  return (
    isObject(value) &&
    hasOnly(value, ['purse', 'pack', 'store', 'baskets']) &&
    isEntryList(value.purse) &&
    isEntryList(value.pack) &&
    isEntryList(value.store) &&
    isObject(value.baskets) &&
    Object.entries(value.baskets).every(([k, v]) => isStationId(k) && isEntryList(v))
  );
}

/** Shape only: the route then checks the item, the places and the counts. Nothing is clamped. */
export function isInventoryMoveRequest(value: unknown): value is InventoryMoveRequest {
  return (
    isObject(value) &&
    hasOnly(value, ['itemId', 'from', 'to', 'quantity']) &&
    typeof value.itemId === 'string' &&
    isPlace(value.from) &&
    isPlace(value.to) &&
    isPositiveInt(value.quantity)
  );
}

export function isHoldingStationRequest(value: unknown): value is HoldingStationRequest {
  return isObject(value) && hasOnly(value, ['stationId']) && typeof value.stationId === 'string';
}

const isNonNegativeInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function isSkillView(value: unknown): value is SkillView {
  return (
    isObject(value) &&
    hasOnly(value, ['xp', 'level', 'into', 'toNext']) &&
    isNonNegativeInt(value.xp) &&
    isPositiveInt(value.level) &&
    isNonNegativeInt(value.into) &&
    isPositiveInt(value.toNext)
  );
}

export function isHoldingActivity(value: unknown): value is HoldingActivity {
  return (
    isObject(value) &&
    hasOnly(value, ['stationId', 'startedAt', 'cycleMs']) &&
    isHoldingStationId(value.stationId) &&
    isIsoDate(value.startedAt) &&
    isPositiveInt(value.cycleMs)
  );
}

export function isHoldingTake(value: unknown): value is HoldingTake {
  return (
    isObject(value) &&
    hasOnly(value, ['stationId', 'moved', 'left']) &&
    isHoldingStationId(value.stationId) &&
    isEntryList(value.moved) &&
    isEntryList(value.left)
  );
}

export function isHoldingResponse(value: unknown): value is HoldingResponse {
  return (
    isObject(value) &&
    hasOnly(value, ['layoutId', 'baskets', 'activity', 'now', 'skills', 'take']) &&
    typeof value.layoutId === 'string' &&
    isObject(value.baskets) &&
    Object.entries(value.baskets).every(([k, v]) => isHoldingStationId(k) && isEntryList(v)) &&
    (value.activity === null || isHoldingActivity(value.activity)) &&
    isIsoDate(value.now) &&
    isObject(value.skills) &&
    Object.entries(value.skills).every(([k, v]) => isSkill(k) && isSkillView(v)) &&
    (value.take === undefined || isHoldingTake(value.take))
  );
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
