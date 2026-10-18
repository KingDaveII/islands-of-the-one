import { validateTypedName, type TypedNameRejection } from './accounts.js';
import type { WritView } from './api.js';
import { hearName, heardLetterCount } from './hear-name.js';
import { isSafe, NAME_REFUSED } from './safe-letters.js';
import { writData, type WritData } from './writ-data.js';

/**
 * The Writ (docs/design/holding.md "The Writ", M2 Task 4a; GAME DESIGN's
 * answers of 2026-10-18): the stored state (the island's Name and its
 * letters, certification, when the charge runs out, how many lines) and
 * everything derived from it by one pure function, `writView`, at a given
 * time; the feed preview the client and the server share, `feedPreview`;
 * and the island's Name validator. No clock, no I/O: the server passes its
 * `now`, the client its estimate of the server's. Times are milliseconds
 * since the epoch.
 */

export const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** What the writs table holds for one Kindled. */
export interface WritStored {
  /** The island's Name as typed, null until named. */
  name: string | null;
  /** Its Old Letters (hearName of the Name), computed on the server; null until named. */
  letters: string | null;
  certified: boolean;
  /** When the charge runs out: set at the pressing (`pressChargeHours` ahead) and moved by every feed. */
  emptyAt: number;
  /** How many lines the Writ has (1 in M2). */
  lineCount: number;
}

/** When a Writ pressed at `pressedAt` runs out: `pressChargeHours` ahead. It drains normally from then. */
export function pressedEmptyAt(pressedAt: number, data: WritData = writData): number {
  return pressedAt + data.pressChargeHours * HOUR_MS;
}

/** A Writ as it is pressed: unnamed, uncertified, one line, two days of charge. */
export function pressedWrit(pressedAt: number, data: WritData = writData): WritStored {
  return { name: null, letters: null, certified: false, emptyAt: pressedEmptyAt(pressedAt, data), lineCount: 1 };
}

export const WRIT_STATES = ['lit', 'flickering', 'dark', 'fading'] as const;
export type WritState = (typeof WRIT_STATES)[number];

export const WRIT_LINE_STATES = ['lit', 'dark', 'faded'] as const;
export type WritLineState = (typeof WRIT_LINE_STATES)[number];

export interface WritLine {
  /** 1 is the Name's line. */
  line: number;
  /** Plots this line tethers (a count in M2). */
  plots: number;
  state: WritLineState;
  /** When this line fades. */
  fadesAt: number;
}

/** Everything the stored state implies at one moment. */
export interface WritDerived {
  state: WritState;
  /** max(0, emptyAt − now). */
  chargeMs: number;
  chargeHours: number;
  /** The charge in words ("about two days"). */
  words: string;
  /** emptyAt, once it is past. */
  darkSince: number | null;
  /** emptyAt plus the grace, by certification. */
  graceEndsAt: number;
  /** The grace this Writ gets, in ms. */
  graceMs: number;
  lines: WritLine[];
  /** Full: not even a sliver fits any more (charge past capacity − sliverHours). The only meaning of full. */
  full: boolean;
  /** How long until a sliver fits again (0 when one fits now): the time the charge needs to drain to capacity − sliverHours. */
  sliverFitsInMs: number;
}

/** The grace a Writ gets, by its certification (both 48 h in M2; the Wet House's task lowers the uncertified one). */
export function graceHours(writ: Pick<WritStored, 'certified'>, data: WritData = writData): number {
  return writ.certified ? data.graceHoursCertified : data.graceHoursUncertified;
}

const SMALL_NUMBERS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/** A number spelled out, up to twenty; digits past that. */
export function spelled(n: number): string {
  return SMALL_NUMBERS[n] ?? String(n);
}

/**
 * The charge in words: under `lowHours` "less than a day" (the ember chip's
 * threshold); otherwise hours / 24 rounded to the nearest whole day, spelled
 * out: "about a day" (24–35 h), "about two days" (36–59 h), up to "about six
 * days" for a full Writ.
 */
export function chargeWords(chargeMs: number, data: WritData = writData): string {
  if (chargeMs < data.lowHours * HOUR_MS) return 'less than a day';
  const days = Math.max(1, Math.round(chargeMs / DAY_MS));
  return days === 1 ? 'about a day' : `about ${spelled(days)} days`;
}

/** The exact time for tooltips: "41 h 12 min", "12 min". Never negative. */
export function exactTime(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/**
 * The derived state of a Writ at `now`: the charge, the state (lit,
 * flickering, dark, fading), when it went dark, when its grace ends, and
 * each line with its plots and state. Line k fades at the grace's end plus
 * (lineCount − k) fade stretches: the outermost line first, the Name's line
 * (1) last; with one line, the moment the grace ends.
 */
export function writView(writ: WritStored, now: number, data: WritData = writData): WritDerived {
  const graceMs = graceHours(writ, data) * HOUR_MS;
  const plots = data.linePlots;
  const chargeMs = Math.max(0, writ.emptyAt - now);
  const graceEndsAt = writ.emptyAt + graceMs;
  const state: WritState =
    chargeMs >= data.lowHours * HOUR_MS ? 'lit' : chargeMs > 0 ? 'flickering' : now < graceEndsAt ? 'dark' : 'fading';
  const dark = chargeMs === 0;
  const lines: WritLine[] = Array.from({ length: writ.lineCount }, (_, i) => {
    const line = i + 1;
    const fadesAt = graceEndsAt + (writ.lineCount - line) * data.lineFadeHours * HOUR_MS;
    const lineState: WritLineState = !dark ? 'lit' : now >= fadesAt ? 'faded' : 'dark';
    return { line, plots, state: lineState, fadesAt };
  });
  return {
    state,
    chargeMs,
    chargeHours: chargeMs / HOUR_MS,
    words: chargeWords(chargeMs, data),
    darkSince: dark ? writ.emptyAt : null,
    graceEndsAt,
    graceMs,
    lines,
    full: isFull(writ, now, data),
    sliverFitsInMs: sliverFitsInMs(writ, now, data),
  };
}

/** The refusals (GAME DESIGN's lines): a full Writ, a piece that doesn't fit now, a piece that never fits. */
export const WRIT_FULL = 'Full.';
export const WRIT_TOO_MUCH_NOW = 'Too much for your Writ now';
export const WRIT_TOO_MUCH_EVER = 'Too much for one Writ';
export const WRIT_NOT_SPARKGLASS = 'The Writ only takes Sparkglass.';

/** What Fill feeds: wild slivers only, never gin. */
export const FILL_ITEM = 'wild-sliver';

export type FeedError = 'not-sparkglass' | 'full' | 'too-much';

export interface FeedPreview {
  ok: true;
  itemId: string;
  count: number;
  /** The charge the feed gives, in hours. */
  hours: number;
  /** The charge's share of a full Writ, as a reduced fraction: "1/3". */
  share: string;
  /** The new emptyAt. */
  emptyAt: number;
  /** The charge after the feed, in ms, and in words. */
  chargeMs: number;
  words: string;
}

export type FeedResult = FeedPreview | { ok: false; error: FeedError; message: string };

/** The hours one of an item gives, or null when it can't be fed. */
export function feedHours(itemId: string, data: WritData = writData): number | null {
  const slivers = data.feeds[itemId];
  return slivers === undefined ? null : slivers * data.sliverHours;
}

/** Where a feed starts from: now for a dark or fading Writ; a lit or flickering one adds to its emptyAt. */
export function feedStart(writ: Pick<WritStored, 'emptyAt'>, now: number): number {
  return writ.emptyAt <= now ? now : writ.emptyAt;
}

/** How many of an item fit: pieces whose hours, with the charge, stay within the capacity. 0 when none does. */
export function fitCount(writ: Pick<WritStored, 'emptyAt'>, itemId: string, now: number, data: WritData = writData): number {
  const hours = feedHours(itemId, data);
  if (hours === null) return 0;
  const room = data.capacityHours * HOUR_MS - (feedStart(writ, now) - now);
  return Math.max(0, Math.floor(room / (hours * HOUR_MS)));
}

/** Fill's count: as many wild slivers as fit, one at a time while the next one fits. */
export function fillCount(writ: Pick<WritStored, 'emptyAt'>, now: number, data: WritData = writData): number {
  return fitCount(writ, FILL_ITEM, now, data);
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** `hours` over the capacity as a reduced fraction. */
export function chargeShare(hours: number, data: WritData = writData): string {
  const g = gcd(hours, data.capacityHours);
  return `${hours / g}/${data.capacityHours / g}`;
}

/** Whether a Writ is full: not even a wild sliver (the smallest piece) fits any more. GAME DESIGN: the only meaning of full. */
export function isFull(writ: Pick<WritStored, 'emptyAt'>, now: number, data: WritData = writData): boolean {
  return fitCount(writ, FILL_ITEM, now, data) === 0;
}

/** How long until a sliver fits (charge + sliverHours ≤ capacityHours): 0 when one fits now. */
export function sliverFitsInMs(writ: Pick<WritStored, 'emptyAt'>, now: number, data: WritData = writData): number {
  const room = (data.capacityHours - data.sliverHours) * HOUR_MS;
  return Math.max(0, feedStart(writ, now) - now - room);
}

/**
 * Why a kind can't be fed right now, or null when one of it fits: a piece
 * too big for any Writ ("Too much for one Writ": deep glass), a full Writ
 * ("Full.": not even a sliver fits), a piece too big for the room left
 * ("Too much for your Writ now": humming glass while any charge is left).
 * The panel greys a kind with this line; feedPreview refuses with it.
 */
export function feedRefusal(
  writ: Pick<WritStored, 'emptyAt'>,
  itemId: string,
  now: number,
  data: WritData = writData,
): { error: FeedError; message: string } | null {
  const perItem = feedHours(itemId, data);
  if (perItem === null) return { error: 'not-sparkglass', message: WRIT_NOT_SPARKGLASS };
  if (perItem > data.capacityHours) return { error: 'too-much', message: WRIT_TOO_MUCH_EVER };
  if (isFull(writ, now, data)) return { error: 'full', message: WRIT_FULL };
  if (fitCount(writ, itemId, now, data) === 0) return { error: 'too-much', message: WRIT_TOO_MUCH_NOW };
  return null;
}

/**
 * What feeding `count` of an item would do, before anything changes (the
 * client's preview and the server's rule): only items in `feeds` can be fed;
 * a dark or fading Writ starts from now, a lit or flickering one adds to its
 * emptyAt; a piece fits when the charge plus its hours stays within the
 * capacity, and no feed is ever partial, so a humming glass fits only an
 * empty Writ and deep glass never fits ("Too much for one Writ"). On a full
 * Writ (not even a sliver fits) the refusal reads "Full."; otherwise a feed
 * that doesn't fit reads "Too much for your Writ now".
 */
export function feedPreview(
  writ: Pick<WritStored, 'emptyAt'>,
  itemId: string,
  count: number,
  now: number,
  data: WritData = writData,
): FeedResult {
  const refusal = feedRefusal(writ, itemId, now, data);
  if (refusal) return { ok: false, ...refusal };
  const perItem = feedHours(itemId, data) ?? 0;
  if (!Number.isSafeInteger(count) || count <= 0 || count > fitCount(writ, itemId, now, data))
    return { ok: false, error: 'too-much', message: WRIT_TOO_MUCH_NOW };
  const hours = perItem * count;
  const emptyAt = feedStart(writ, now) + hours * HOUR_MS;
  const chargeMs = emptyAt - now;
  return { ok: true, itemId, count, hours, share: chargeShare(hours, data), emptyAt, chargeMs, words: chargeWords(chargeMs, data) };
}

/** Fill's preview: as many wild slivers as fit, never gin; "Full." when none does. */
export function fillPreview(writ: Pick<WritStored, 'emptyAt'>, now: number, data: WritData = writData): FeedResult {
  return feedPreview(writ, FILL_ITEM, Math.max(1, fillCount(writ, now, data)), now, data);
}

/** Why the island's Name was refused: the typed text's reasons, or its letters. */
export type IslandNameRejection = TypedNameRejection | 'letters';

export type IslandNameValidation =
  | { ok: true; name: string; letters: string }
  | { ok: false; reason: IslandNameRejection; message: string };

/**
 * The island's Name (docs/design/holding.md "The Writ"): the typed Name by
 * the same rules as a Kindled name (validateTypedName), then its letters by
 * hearName, which must pass the safe-letters filter strict (and be at least
 * one letter). Refusals answer NAME_REFUSED, except a Name the fonts can't
 * draw, which keeps NAME_NOT_DRAWABLE.
 */
export function validateIslandName(input: unknown, data: WritData = writData): IslandNameValidation {
  const typed = validateTypedName(input);
  if (!typed.ok) return typed;
  const letters = hearName(typed.name, data.lineLetters);
  if (heardLetterCount(letters) === 0 || !isSafe(letters, { strict: true }).ok)
    return { ok: false, reason: 'letters', message: NAME_REFUSED };
  return { ok: true, name: typed.name, letters };
}

const iso = (ms: number): string => new Date(ms).toISOString();

/** The Writ on the wire (GET /api/holding): the stored state and `writView` at `now`, times as ISO 8601. */
export function toWritView(writ: WritStored, now: number, data: WritData = writData): WritView {
  const d = writView(writ, now, data);
  return {
    name: writ.name,
    letters: writ.letters,
    certified: writ.certified,
    emptyAt: iso(writ.emptyAt),
    lineCount: writ.lineCount,
    state: d.state,
    chargeMs: d.chargeMs,
    words: d.words,
    darkSince: d.darkSince === null ? null : iso(d.darkSince),
    graceEndsAt: iso(d.graceEndsAt),
    lines: d.lines.map((l) => ({ line: l.line, plots: l.plots, state: l.state, fadesAt: iso(l.fadesAt) })),
  };
}

/** The stored state back from the wire, so the client re-derives with `writView` between heartbeats. */
export function writFromView(view: WritView): WritStored {
  return {
    name: view.name,
    letters: view.letters,
    certified: view.certified,
    emptyAt: Date.parse(view.emptyAt),
    lineCount: view.lineCount,
  };
}
