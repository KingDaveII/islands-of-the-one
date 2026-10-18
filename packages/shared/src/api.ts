import { isClayTone, isRemembrance, type Remembrance } from './accounts.js';
import { isHoldingStationId, isPlotId } from './holding.js';
import { isPieceRotation, type PieceRotation } from './pieces.js';
import { isPlace, isStationId, type Place } from './places.js';
import { isSkill, type Skill } from './skills.js';
import type { ClayTone } from './sprites.js';
import { WRIT_LINE_STATES, WRIT_STATES, type WritLineState, type WritState } from './writ.js';

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
  WritName: '/api/writ/name',
  WritFeed: '/api/writ/feed',
  KeshSliver: '/api/kesh/sliver',
  KeshWord: '/api/kesh/word',
  KeshSeeds: '/api/kesh/seeds',
  PlotsName: '/api/plots/name',
  PlotsSow: '/api/plots/sow',
  PlotsBuild: '/api/plots/build',
  PlotsMove: '/api/plots/move',
  PlotsTakeDown: '/api/plots/take-down',
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
  // The Writ (docs/design/holding.md "The Writ").
  AlreadyNamed: 'already-named',
  Unnamed: 'unnamed',
  NotSparkglass: 'not-sparkglass',
  Full: 'full',
  TooMuch: 'too-much',
  // Kesh's slivers and gifts (docs/design/holding.md "Kesh").
  NotDue: 'not-due',
  // Plots and plot sentences (docs/design/holding.md "Plots", M2 Task 5).
  UnknownPlot: 'unknown-plot',
  Faded: 'faded',
  UnknownWord: 'unknown-word',
  WrongSlot: 'wrong-slot',
  NoGround: 'no-ground',
  Unchanged: 'unchanged',
  SentenceRefused: 'sentence-refused',
  UnnamedPlot: 'unnamed-plot',
  NotSown: 'not-sown',
  AlreadySown: 'already-sown',
  // Build mode (docs/design/holding.md "Build mode", M2 Task 6).
  UnknownPiece: 'unknown-piece',
  AlreadyBuilt: 'already-built',
  NeedsLine: 'needs-line',
  NeedsSkill: 'needs-skill',
  Limit: 'limit',
  Blocked: 'blocked',
  NotBuilt: 'not-built',
  StoreFull: 'store-full',
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

/** One Writ line on the wire: its number (1 is the Name's), the plots it tethers, its state and when it fades (ISO 8601). */
export interface WritLineView {
  line: number;
  plots: number;
  state: WritLineState;
  fadesAt: string;
}

/**
 * The Writ as GET /api/holding answers it (docs/design/holding.md "The
 * Writ"): the stored state (the island's Name as typed and its letters, null
 * until named; `certified`; `emptyAt`, set at the pressing; the line count) and what `writView` derives from it at the server's `now` (the
 * state, the charge in ms and in words, when it went dark, when the grace
 * ends, the lines). Times are ISO 8601. The client redraws from this and
 * re-derives between heartbeats with the same function.
 */
export interface WritView {
  name: string | null;
  letters: string | null;
  certified: boolean;
  emptyAt: string;
  lineCount: number;
  /** When the Writ was first fed (ISO 8601), null until then; the client plays Kesh's after-first-feeding line when it goes from null to set. */
  fedAt: string | null;
  state: WritState;
  chargeMs: number;
  words: string;
  darkSince: string | null;
  graceEndsAt: string;
  lines: WritLineView[];
}

/** What Kesh has to give (docs/design/holding.md "Kesh"): which sliver is due now, if any. */
export const KESH_DUE = ['first', 'tide'] as const;
export type KeshDue = (typeof KESH_DUE)[number];

/**
 * Kesh in the holding answer (M2 Task 4b): whether his first sliver has been
 * given, which sliver is due now (`first`, `tide` while `m2Scaffold` is on
 * and this tide's hasn't been given, or null) and when the next tide begins
 * (ISO 8601); and his gifts (Task 5): whether the word tile is due (the
 * island has a Name and the Kindled doesn't know the word yet) and whether
 * the seeds are (a plot has been named and they haven't been given). The
 * client decides which flow to play from this: a due gift plays first, the
 * tile, then the seeds, then the sliver.
 */
export interface KeshView {
  firstGiven: boolean;
  due: KeshDue | null;
  nextTideAt: string;
  wordDue: boolean;
  seedsDue: boolean;
}

/** A piece standing in a plot (M2 Task 6): its kind (pieces.json), its footprint's top-left tile and its rotation. */
export interface PlotPieceView {
  pieceId: string;
  col: number;
  row: number;
  rotation: PieceRotation;
}

/**
 * A plot in the holding answer (M2 Task 5), one per layout plot in order:
 * its sentence (`ground` and `virtue` word ids, null while unnamed or without
 * a Virtue), when it was named and when its Virtue was last set (ISO 8601),
 * the kind its Ground builds (null while unnamed), the pieces standing in it
 * (M2 Task 6; none while unnamed), its level (1 plus the distinct pieces) and
 * its state from its Writ line.
 */
export interface PlotView {
  id: string;
  ground: string | null;
  virtue: string | null;
  namedAt: string | null;
  virtueSetAt: string | null;
  /** When the plot was sown (ISO 8601); null until then, and for a kind that needs no sowing. */
  sownAt: string | null;
  kind: string | null;
  pieces: PlotPieceView[];
  level: number;
  state: WritLineState;
}

/**
 * A station's basket cycle in the holding answer (M2 Task 5), per station
 * with a cycle (a named plot whose kind has one): its length, when its clock
 * stood after the settle (ISO 8601; the next cycle lands `cycleMs` after it)
 * and the Virtue's bonus in permille at `now`, so the client draws "Next in
 * 12 min" between heartbeats.
 */
export interface StationCycleView {
  cycleMs: number;
  cycledUntil: string;
  bonusPermille: number;
}

/**
 * GET /api/holding, and the answer to work, stop, take, name, feed and
 * Kesh's sliver: the layout, every station's basket (by station id, every
 * station listed), the active action or null, the server's clock, the
 * skills, the Writ and Kesh. The server settles the action before
 * answering, so the counts are true as of `now`. A take-all answer adds
 * `take`.
 */
export interface HoldingResponse {
  layoutId: string;
  /** By station id, every station of the layout and every plot (a plot's basket belongs to the plot, whatever its kind). */
  baskets: Record<string, InventoryEntry[]>;
  activity: HoldingActivity | null;
  now: string;
  skills: Record<Skill, SkillView>;
  writ: WritView;
  kesh: KeshView;
  /** The word ids the Kindled knows (Task 5). */
  words: string[];
  /** One entry per layout plot, in order (Task 5). */
  plots: PlotView[];
  /** The basket cycles, by station id, for every station with a cycle (Task 5). */
  cycles: Record<string, StationCycleView>;
  take?: HoldingTake;
}

/**
 * POST /api/kesh/sliver, `{}`: asks Kesh for the sliver that is due (his
 * first, else this tide's while `m2Scaffold` is on), one wild sliver into
 * the pack. Answers the holding, or `not-due` or `pack-full` ("Pack full.",
 * and the sliver stays due).
 */
export type KeshSliverRequest = Record<string, never>;

/**
 * POST /api/kesh/word and POST /api/kesh/seeds, `{}` (M2 Task 5): asks Kesh
 * for the word tile (given once the island has a Name, while the Kindled
 * doesn't know the word) or the seeds (once a plot has been named, once; into
 * the pack). Answers the holding, or `not-due`; the seeds `pack-full` too,
 * and then stay due.
 */
export type KeshGiftRequest = Record<string, never>;

/**
 * POST /api/plots/name, `{ plotId, ground, virtue }` (M2 Task 5): names a
 * plot with a plot sentence, the Ground's and the Virtue's word ids (the
 * Virtue may be null; a Ground is needed, `no-ground`). Answers the holding,
 * or `unknown-plot`, `unnamed`, `faded`, `unknown-word`, `wrong-slot`,
 * `no-ground`, `unchanged`, `sentence-refused` or `insufficient` (a rename
 * without the gin).
 */
export interface PlotNameRequest {
  plotId: string;
  ground: string | null;
  virtue: string | null;
}

/**
 * POST /api/plots/sow, `{ plotId }` (M2 Task 5): sows a new field with its
 * kind's seed, from the store first, then the pack; it then cycles and can
 * be worked. Answers the holding, or `unknown-plot`, `unnamed-plot`,
 * `faded`, `already-sown` or `insufficient`.
 */
export interface PlotSowRequest {
  plotId: string;
}

/**
 * POST /api/plots/build and POST /api/plots/move, `{ plotId, pieceId, col,
 * row, rotation }` (M2 Task 6): build a piece of pieces.json in a named plot
 * at a tile and rotation (its cost leaves the store), or move one standing
 * there for free. Build answers the holding, or `unknown-plot`,
 * `unnamed-plot`, `faded`, `unknown-piece`, `already-built`, `needs-line`,
 * `needs-skill`, `limit`, `blocked` or `insufficient`; move the same, or
 * `unknown-plot`, `unnamed-plot`, `faded`, `not-built` or `blocked`.
 */
export interface PlotPieceRequest {
  plotId: string;
  pieceId: string;
  col: number;
  row: number;
  rotation: PieceRotation;
}
export type PlotBuildRequest = PlotPieceRequest;
export type PlotMoveRequest = PlotPieceRequest;

/**
 * POST /api/plots/take-down, `{ plotId, pieceId }` (M2 Task 6): takes a
 * standing piece down and puts every material back into the store, or
 * refuses whole with `store-full` when the refund doesn't fit. Also
 * `unknown-plot`, `unnamed-plot`, `faded`, `not-built`.
 */
export interface PlotTakeDownRequest {
  plotId: string;
  pieceId: string;
}

/** POST /api/writ/name: the island's Name as typed; the server hears its letters. Once only in M2 (`already-named` after). */
export interface WritNameRequest {
  name: string;
}

/**
 * POST /api/writ/feed: feed `count` of a Sparkglass item (data/writ.json
 * `feeds`), or `fill: true` for as many wild slivers as fit (never gin), from
 * the store first, then the pack. Answers the holding, or `unnamed`,
 * `not-sparkglass`, `insufficient`, `full` ("Full.") or `too-much` (the
 * piece doesn't fit).
 */
export type WritFeedRequest = { itemId: string; count: number } | { fill: true };

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

const isIsoOrNull = (value: unknown): value is string | null => value === null || isIsoDate(value);
const isWritState = (value: unknown): value is WritState =>
  typeof value === 'string' && (WRIT_STATES as readonly string[]).includes(value);
const isWritLineState = (value: unknown): value is WritLineState =>
  typeof value === 'string' && (WRIT_LINE_STATES as readonly string[]).includes(value);

export function isWritLineView(value: unknown): value is WritLineView {
  return (
    isObject(value) &&
    hasOnly(value, ['line', 'plots', 'state', 'fadesAt']) &&
    isPositiveInt(value.line) &&
    isNonNegativeInt(value.plots) &&
    isWritLineState(value.state) &&
    isIsoDate(value.fadesAt)
  );
}

export function isWritView(value: unknown): value is WritView {
  return (
    isObject(value) &&
    hasOnly(value, [
      'name',
      'letters',
      'certified',
      'emptyAt',
      'lineCount',
      'fedAt',
      'state',
      'chargeMs',
      'words',
      'darkSince',
      'graceEndsAt',
      'lines',
    ]) &&
    (value.name === null || typeof value.name === 'string') &&
    (value.letters === null || typeof value.letters === 'string') &&
    (value.name === null) === (value.letters === null) &&
    typeof value.certified === 'boolean' &&
    isIsoDate(value.emptyAt) &&
    isPositiveInt(value.lineCount) &&
    isIsoOrNull(value.fedAt) &&
    isWritState(value.state) &&
    isNonNegativeInt(value.chargeMs) &&
    typeof value.words === 'string' &&
    isIsoOrNull(value.darkSince) &&
    isIsoDate(value.graceEndsAt) &&
    Array.isArray(value.lines) &&
    value.lines.length === value.lineCount &&
    value.lines.every(isWritLineView)
  );
}

export function isKeshView(value: unknown): value is KeshView {
  return (
    isObject(value) &&
    hasOnly(value, ['firstGiven', 'due', 'nextTideAt', 'wordDue', 'seedsDue']) &&
    typeof value.firstGiven === 'boolean' &&
    (value.due === null || (typeof value.due === 'string' && (KESH_DUE as readonly string[]).includes(value.due))) &&
    isIsoDate(value.nextTideAt) &&
    typeof value.wordDue === 'boolean' &&
    typeof value.seedsDue === 'boolean'
  );
}

const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** A piece on the wire: its kind (judged by the client against pieces.json), its tile and one of the four rotations. */
export function isPlotPieceView(value: unknown): value is PlotPieceView {
  return (
    isObject(value) &&
    hasOnly(value, ['pieceId', 'col', 'row', 'rotation']) &&
    typeof value.pieceId === 'string' &&
    isNonNegativeInt(value.col) &&
    isNonNegativeInt(value.row) &&
    isPieceRotation(value.rotation)
  );
}

/** A plot on the wire: its id one of the layout's, its name's parts and times consistent (unnamed: no Ground, no kind, no times, no pieces). */
export function isPlotView(value: unknown): value is PlotView {
  return (
    isObject(value) &&
    hasOnly(value, ['id', 'ground', 'virtue', 'namedAt', 'virtueSetAt', 'sownAt', 'kind', 'pieces', 'level', 'state']) &&
    isPlotId(value.id) &&
    isStringOrNull(value.ground) &&
    isStringOrNull(value.virtue) &&
    isIsoOrNull(value.namedAt) &&
    isIsoOrNull(value.virtueSetAt) &&
    isIsoOrNull(value.sownAt) &&
    (value.ground !== null || value.sownAt === null) &&
    isStringOrNull(value.kind) &&
    (value.ground === null) === (value.namedAt === null) &&
    (value.ground === null) === (value.kind === null) &&
    (value.ground !== null || value.virtue === null) &&
    (value.virtue === null) === (value.virtueSetAt === null) &&
    Array.isArray(value.pieces) &&
    value.pieces.every(isPlotPieceView) &&
    (value.ground !== null || value.pieces.length === 0) &&
    isPositiveInt(value.level) &&
    isWritLineState(value.state)
  );
}

export function isStationCycleView(value: unknown): value is StationCycleView {
  return (
    isObject(value) &&
    hasOnly(value, ['cycleMs', 'cycledUntil', 'bonusPermille']) &&
    isPositiveInt(value.cycleMs) &&
    isIsoDate(value.cycledUntil) &&
    isNonNegativeInt(value.bonusPermille)
  );
}

export function isHoldingResponse(value: unknown): value is HoldingResponse {
  return (
    isObject(value) &&
    hasOnly(value, ['layoutId', 'baskets', 'activity', 'now', 'skills', 'writ', 'kesh', 'words', 'plots', 'cycles', 'take']) &&
    typeof value.layoutId === 'string' &&
    isObject(value.baskets) &&
    Object.entries(value.baskets).every(([k, v]) => isHoldingStationId(k) && isEntryList(v)) &&
    (value.activity === null || isHoldingActivity(value.activity)) &&
    isIsoDate(value.now) &&
    isObject(value.skills) &&
    Object.entries(value.skills).every(([k, v]) => isSkill(k) && isSkillView(v)) &&
    isWritView(value.writ) &&
    isKeshView(value.kesh) &&
    Array.isArray(value.words) &&
    value.words.every((w) => typeof w === 'string') &&
    Array.isArray(value.plots) &&
    value.plots.every(isPlotView) &&
    isObject(value.cycles) &&
    Object.entries(value.cycles).every(([k, v]) => isHoldingStationId(k) && isStationCycleView(v)) &&
    (value.take === undefined || isHoldingTake(value.take))
  );
}

export function isWritNameRequest(value: unknown): value is WritNameRequest {
  return isObject(value) && hasOnly(value, ['name']) && typeof value.name === 'string';
}

/** Shape only: the item and the Writ's room are judged by the route. Counts are positive integers; nothing is clamped. */
export function isWritFeedRequest(value: unknown): value is WritFeedRequest {
  if (!isObject(value)) return false;
  if (hasOnly(value, ['itemId', 'count'])) return typeof value.itemId === 'string' && isPositiveInt(value.count);
  if (hasOnly(value, ['fill'])) return value.fill === true;
  return false;
}

/** The body of POST /api/kesh/sliver: an empty object; any field is refused. */
export function isKeshSliverRequest(value: unknown): value is KeshSliverRequest {
  return isObject(value) && Object.keys(value).length === 0;
}

/** The body of POST /api/kesh/word and /seeds: an empty object; any field is refused. */
export const isKeshGiftRequest: (value: unknown) => value is KeshGiftRequest = isKeshSliverRequest;

/** The body of POST /api/plots/build and /move: exactly { plotId, pieceId, col, row, rotation }; the plot, the piece and the place are judged by the route. */
export function isPlotPieceRequest(value: unknown): value is PlotPieceRequest {
  return (
    isObject(value) &&
    hasOnly(value, ['plotId', 'pieceId', 'col', 'row', 'rotation']) &&
    typeof value.plotId === 'string' &&
    typeof value.pieceId === 'string' &&
    isNonNegativeInt(value.col) &&
    isNonNegativeInt(value.row) &&
    isPieceRotation(value.rotation)
  );
}

/** The body of POST /api/plots/take-down: exactly { plotId, pieceId }. */
export function isPlotTakeDownRequest(value: unknown): value is PlotTakeDownRequest {
  return isObject(value) && hasOnly(value, ['plotId', 'pieceId']) && typeof value.plotId === 'string' && typeof value.pieceId === 'string';
}

/** The body of POST /api/plots/sow: exactly { plotId }. */
export function isPlotSowRequest(value: unknown): value is PlotSowRequest {
  return isObject(value) && hasOnly(value, ['plotId']) && typeof value.plotId === 'string';
}

/** Shape only: the plot and the words are judged by the route. `ground` and `virtue` are word ids or null; nothing else. */
export function isPlotNameRequest(value: unknown): value is PlotNameRequest {
  return (
    isObject(value) &&
    hasOnly(value, ['plotId', 'ground', 'virtue']) &&
    typeof value.plotId === 'string' &&
    'ground' in value &&
    isStringOrNull(value.ground) &&
    'virtue' in value &&
    isStringOrNull(value.virtue)
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
