import type { AwayCard, PlotView } from './api.js';
import { type HoldingLayout, plotKindDef, stationDef } from './holding.js';
import { itemDef, SKILL_NAMES } from './items.js';
import { pluralItemName } from './pieces.js';
import { SKILLS, type Skill } from './skills.js';
import { HOUR_MS, writFromView, writView } from './writ.js';

/**
 * Sleep, the While you were away card and the toasts (docs/design/holding.md
 * "Sleep, the away card and toasts", M2 Task 7). The server writes the card
 * (what an absence of `awayCardMinMs` or more made, the levels gained); this
 * module turns it into GAME DESIGN's lines, pure, and holds every line of
 * text the card, the sleep screen and the toasts show. Lines marked
 * placeholder wait for LORE's, GAME DESIGN's or ART's answer (MAIN's
 * questions of 2026-10-19): each is one line here, so an answer is a
 * one-line change.
 */

/** A tide is 24 h of server time (Game design, "The tide and the lighting"): the away card counts time away in tides and hours. */
export const TIDE_MS = 24 * HOUR_MS;
const MINUTE_MS = 60_000;

/** The card shows at most this many lines (GAME DESIGN's screen). */
export const AWAY_MAX_LINES = 6;

/** The Writ's dark reading (mem, tav), drawn from the letter sheet wherever it appears in text. */
export const MET = 'מת';

/** `n` of a thing, the word plural when n is not 1: "1 tide", "3 hours". */
const count = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * A span in tides and hours, placeholder wording: "1 tide and 3 hours",
 * "5 hours", or under an hour "40 minutes" ([LORE] the wording).
 */
export function awaySpan(ms: number): string {
  const whole = Math.max(0, Math.floor(ms / MINUTE_MS)) * MINUTE_MS;
  if (whole < HOUR_MS) return count(Math.floor(whole / MINUTE_MS), 'minute');
  const tides = Math.floor(whole / TIDE_MS);
  const hours = Math.floor((whole % TIDE_MS) / HOUR_MS);
  if (tides === 0) return count(hours, 'hour');
  if (hours === 0) return count(tides, 'tide');
  return `${count(tides, 'tide')} and ${count(hours, 'hour')}`;
}

/** "14 pale grain", "1 twisted log": an item's display name in a count, plural when the count is not 1. */
export function itemCount(itemId: string, quantity: number): string {
  const one = (itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ')).toLowerCase();
  return `${quantity} ${quantity === 1 ? one : pluralItemName(itemId)}`;
}

/** The away card's words. Placeholders are marked; GAME DESIGN's lines are final. */
export const AWAY_TEXT = {
  /** The card's title (GAME DESIGN). */
  TITLE: 'While you were away',
  /** Under the lines, muted ([LORE] placeholder): the card closes on any input, the one "press X" line allowed. */
  PRESS_ANY: 'Press any key.',
  /** Line 1, the time away ([LORE] placeholder wording): "Away 1 tide and 3 hours.". */
  away: (ms: number): string => `Away ${awaySpan(ms)}.`,
  /** One line per place (GAME DESIGN's format): "Field: 14 pale grain, in the basket". */
  made: (place: string, itemId: string, quantity: number): string => `${place}: ${itemCount(itemId, quantity)}, in the basket`,
  /** A second field of the same kind, in plot order ([LORE] placeholder): "Field 2". */
  placeN: (name: string, n: number): string => (n === 1 ? name : `${name} ${n}`),
  /** A skill's levels (GAME DESIGN's "Woodcutting 7 → 9"; [ART] the arrow glyph: "to" until it is in the atlases). */
  levels: (skill: string, from: number, to: number): string => `${skill} ${from} to ${to}`,
  /** The Writ lit or flickering: the HUD chip's words. */
  writ: (words: string): string => `Writ: ${words} left`,
  /** The Writ dark, in the grace ([LORE] placeholder): "Writ: dark since 5 hours ago". */
  writDark: (sinceMs: number): string => `Writ: dark since ${awaySpan(sinceMs)} ago`,
  /** The Writ past the grace (GAME DESIGN's line; the "since" as above). */
  writFaded: (sinceMs: number): string => `Writ: dark since ${awaySpan(sinceMs)} ago; the outer line faded`,
  /** The last line when more than six would show ([GAME DESIGN] what goes; [LORE] placeholder wording). */
  MORE: 'And more at the stations.',
} as const;

/** Sleep (GAME DESIGN: lying down by the Writ post is the in-world log-out). */
export const SLEEP_TEXT = {
  /** The button at the foot of the Writ panel ([GAME DESIGN] where the player lies down; MAIN's default). */
  SLEEP: 'SLEEP',
  /** Under it, muted: the hint that "says so plainly" ([LORE] placeholder). */
  HINT: "Lie down here to sleep. Your island keeps working while you're away.",
  /** The sleep screen's one line ([LORE] placeholder). */
  LYING: 'You lie down by the Writ.',
} as const;

/** The toasts of M2 (GAME DESIGN, final). */
export const TOAST_TEXT = {
  /** A skill gains a level while on the holding: "Woodcutting 2.". */
  skillLevel: (skill: Skill, level: number): string => `${SKILL_NAMES[skill]} ${level}.`,
  /** The Writ falls under a day, once per drain. */
  WRIT_LOW: 'Your Writ has about a day left.',
  /** The Writ goes dark (מת is drawn from the letter sheet). */
  WRIT_DARK: `Your Writ reads ${MET}.`,
  /** A take-all leaves some of a stack in the basket: "Store: twisted logs full." (the take-all's line, BUILD_TEXT.STORE_FULL's words). */
  storeFull: (itemId: string): string => `Store: ${pluralItemName(itemId)} full.`,
  /** Anything refused as `pack-full`. */
  PACK_FULL: 'Pack full.',
} as const;

/** The toast kinds of M2, each with its glyph ([ART] the glyphs of the M2 UI kit; placeholders in the client). */
export const TOAST_KINDS = ['skill-level', 'writ-low', 'writ-dark', 'store-full', 'pack-full'] as const;
export type ToastKind = (typeof TOAST_KINDS)[number];

/**
 * The display name of a place the card names: a station's name from
 * stations.json ("Twisted trees"), or a named plot's kind with a number
 * among the named plots of that kind in plot order ("Field", "Field 2";
 * [LORE] how to tell two fields apart). An unnamed or unknown plot keeps
 * its id.
 */
export function placeName(placeId: string, layout: HoldingLayout, plots: readonly PlotView[]): string {
  const station = stationDef(placeId);
  if (station) return station.name;
  const view = plots.find((p) => p.id === placeId);
  const kind = view?.kind === null || view?.kind === undefined ? undefined : plotKindDef(view.kind);
  if (!view || !kind) return placeId;
  let n = 0;
  for (const p of layout.plots) {
    const other = plots.find((v) => v.id === p.id);
    if (other?.kind === view.kind) n++;
    if (p.id === placeId) break;
  }
  return AWAY_TEXT.placeN(kind.name, Math.max(1, n));
}

/**
 * The card's lines, in GAME DESIGN's order, each only when it is true: the
 * time away; what each station made, in layout order (the stations, then
 * the plots by index), one line per place with a count above 0; the skill
 * levels gained, one per skill; the Writ now (none while the island is
 * unnamed). Six lines at most: the time away and the Writ line stay, the
 * middle fills with the places then the skills, and what doesn't fit folds
 * into one last line (placeholder, see AWAY_TEXT.MORE). `serverMs` is the
 * server's clock the Writ is read at.
 */
export function awayLines(card: AwayCard, layout: HoldingLayout, plots: readonly PlotView[], serverMs: number): string[] {
  const from = Date.parse(card.from);
  const to = Date.parse(card.to);
  const head = [AWAY_TEXT.away(Number.isNaN(from) || Number.isNaN(to) ? 0 : to - from)];
  const middle: string[] = [];
  const places = [...layout.stations.map((s) => s.id), ...layout.plots.map((p) => p.id)];
  for (const id of places) {
    const made = card.made[id];
    if (made && made.quantity > 0) middle.push(AWAY_TEXT.made(placeName(id, layout, plots), made.itemId, made.quantity));
  }
  for (const skill of SKILLS) {
    const level = card.levels[skill];
    if (level && level.to > level.from) middle.push(AWAY_TEXT.levels(SKILL_NAMES[skill], level.from, level.to));
  }
  const tail: string[] = [];
  if (card.writ.name !== null) {
    const writ = writView(writFromView(card.writ), serverMs);
    if (writ.state === 'lit' || writ.state === 'flickering') tail.push(AWAY_TEXT.writ(writ.words));
    else {
      const since = Math.max(0, serverMs - (writ.darkSince ?? serverMs));
      tail.push(writ.state === 'dark' ? AWAY_TEXT.writDark(since) : AWAY_TEXT.writFaded(since));
    }
  }
  const room = AWAY_MAX_LINES - head.length - tail.length;
  if (middle.length > room) return [...head, ...middle.slice(0, Math.max(0, room - 1)), AWAY_TEXT.MORE, ...tail];
  return [...head, ...middle, ...tail];
}

/** Every fixed line of text this module holds, for the tests (drawable, and the banned names). */
export const AWAY_FIXED_TEXTS: readonly string[] = [
  AWAY_TEXT.TITLE,
  AWAY_TEXT.PRESS_ANY,
  AWAY_TEXT.MORE,
  SLEEP_TEXT.SLEEP,
  SLEEP_TEXT.HINT,
  SLEEP_TEXT.LYING,
  TOAST_TEXT.WRIT_LOW,
  TOAST_TEXT.WRIT_DARK,
  TOAST_TEXT.PACK_FULL,
];
