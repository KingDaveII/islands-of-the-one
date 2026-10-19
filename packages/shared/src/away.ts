import type { AwayCard, PlotView, WritView } from './api.js';
import { type HoldingLayout, plotKindDef, stationDef } from './holding.js';
import { itemDef, SKILL_NAMES } from './items.js';
import { pluralItemName } from './pieces.js';
import { SKILLS, type Skill } from './skills.js';
import { wordDef } from './words.js';
import { HOUR_MS, writFromView, writView } from './writ.js';

/**
 * Sleep, the While you were away card and the toasts (docs/design/holding.md
 * "Sleep, the away card and toasts", M2 Task 7). The server writes the card
 * (what an absence of `awayCardMinMs` or more made, the levels gained); this
 * module turns it into GAME DESIGN's lines, pure, and holds every line of
 * text the card, the sleep screen and the toasts show: LORE's (Lore §14.22,
 * 2026-10-19) and GAME DESIGN's, word for word, which the tests read.
 */

/** A tide is 24 h of server time (Game design, "The tide and the lighting"): the away card counts time away in tides and hours. */
export const TIDE_MS = 24 * HOUR_MS;
const MINUTE_MS = 60_000;

/** The card shows at most this many lines (GAME DESIGN's screen); M2's lines never pass it. */
export const AWAY_MAX_LINES = 6;

/** The Writ's dark reading (mem, tav), drawn from the letter sheet wherever it appears in text. */
export const MET = 'מת';

/** The arrow between a skill's levels (GAME DESIGN's "Woodcutting 7 → 9"; in both atlases since ART's #109). */
export const LEVEL_ARROW = '→';
/** Between the skills on the card's one skills line. */
export const SKILL_JOIN = ' · ';

/** `n` of a thing, the word plural when n is not 1: "1 tide", "3 hours". */
const count = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * A span as LORE words it: whole tides first, then hours, with minutes only
 * under an hour, in tens, rounded down: "1 tide and 3 hours", "2 tides",
 * "5 hours", "40 minutes" (30 to 39 minutes read "30 minutes"). A whole
 * number of tides drops the hours; tides and minutes never meet.
 */
export function duration(ms: number): string {
  const whole = Math.max(0, ms);
  if (whole < HOUR_MS) return count(Math.floor(whole / (10 * MINUTE_MS)) * 10, 'minute');
  const tides = Math.floor(whole / TIDE_MS);
  const hours = Math.floor((whole % TIDE_MS) / HOUR_MS);
  if (tides === 0) return count(hours, 'hour');
  if (hours === 0) return count(tides, 'tide');
  return `${count(tides, 'tide')} and ${count(hours, 'hour')}`;
}

/** "14 pale grains", "1 twisted log": an item's display name in a count, plural when the count is not 1. */
export function itemCount(itemId: string, quantity: number): string {
  const one = (itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ')).toLowerCase();
  return `${quantity} ${quantity === 1 ? one : pluralItemName(itemId)}`;
}

/** The card's words: LORE's and GAME DESIGN's, final. */
export const AWAY_TEXT = {
  /** The card's title (GAME DESIGN). */
  TITLE: 'While you were away',
  /** Under the lines, muted (LORE): the card closes on any input, the one "press X" line allowed. */
  PRESS_ANY: 'Press anything to wake.',
  /** Line 1 (LORE): "Away " + the duration + ".". */
  away: (ms: number): string => `Away ${duration(ms)}.`,
  /** The short kind labels of the station lines (GAME DESIGN), one and several. */
  KIND: {
    field: { one: 'Field', many: 'Fields' },
    trees: { one: 'Trees', many: 'Trees' },
    outcrop: { one: 'Outcrop', many: 'Outcrop' },
  } as Readonly<Record<string, { one: string; many: string }>>,
  /** The station lines' ending (GAME DESIGN): where the things wait, "basket" for one station, "baskets" for several. */
  BASKET: 'in the basket',
  BASKETS: 'in the baskets',
  /** One line per station kind, summed (GAME DESIGN's format): "Fields: 56 pale grains, in the baskets". */
  made: (label: string, itemId: string, quantity: number, baskets: number): string =>
    `${label}: ${itemCount(itemId, quantity)}, ${baskets > 1 ? AWAY_TEXT.BASKETS : AWAY_TEXT.BASKET}`,
  /** One skill's levels (GAME DESIGN): "Woodcutting 7 → 9"; the skills join with " · " on one line. */
  levels: (skill: string, from: number, to: number): string => `${skill} ${from} ${LEVEL_ARROW} ${to}`,
  /** The Writ lit or flickering (GAME DESIGN): the HUD chip's words. */
  writ: (words: string): string => `Writ: ${words} left`,
  /** The Writ dark, in the grace (LORE). */
  writDark: (darkMs: number): string => `Writ: dark for ${duration(darkMs)}. It still remembers everything.`,
  /** The Writ past the grace (LORE): one line faded, or more in later milestones. */
  writFaded: (darkMs: number, faded: number): string =>
    `Writ: dark for ${duration(darkMs)}; its outer ${faded === 1 ? 'line has' : `${faded} lines have`} faded.`,
  /** LORE's fold line, for the milestones that pass six lines; not drawn in M2. */
  MORE: 'More is waiting at the stations.',
} as const;

/** Sleep (GAME DESIGN: lying down by the Writ post is the in-world log-out; LORE's lines). */
export const SLEEP_TEXT = {
  /** The button at the foot of the Writ panel. */
  SLEEP: 'SLEEP',
  /** Under it, muted: the hint that "says so plainly" (LORE). */
  HINT: 'Lie down to sleep and leave the game. Your holding keeps working while you sleep, until the Writ runs low.',
  /** The sleep screen's line (LORE), while the Writ hums. */
  LYING: 'You lie down by the Writ. Its hum is the last thing you hear.',
  /** The sleep screen's line when the Writ is dark (LORE). */
  LYING_DARK: "You lie down by the Writ. It doesn't hum tonight.",
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

/** The toast kinds of M2, each with a glyph of ART's toast glyph sheet (#109). */
export const TOAST_KINDS = ['skill-level', 'writ-low', 'writ-dark', 'store-full', 'pack-full'] as const;
export type ToastKind = (typeof TOAST_KINDS)[number];

/** The glyph sheet's cell for a toast: a skill level the skill's own (`skill-woodcutting`), the others by kind. */
export function toastGlyphName(kind: ToastKind, skill: Skill | null = null): string {
  return kind === 'skill-level' ? `skill-${skill ?? 'woodcutting'}` : kind;
}

/**
 * A plot's label in the Latin UI (LORE, Lore §14.22): its Virtue's epithet
 * and its kind, "Old field"; just "Field" without a Virtue. Only when two
 * named plots still share a label does the plot's number follow it ("Field
 * 2"), by Writ line order (the layout's plot order). Capitalised at the
 * start of a line. An unnamed plot keeps its id.
 */
export function plotLabel(plot: Pick<PlotView, 'id' | 'kind' | 'virtue'>, plots: readonly Pick<PlotView, 'id' | 'kind' | 'virtue'>[]): string {
  const base = baseLabel(plot);
  if (base === null) return plot.id;
  const sharing = plots.filter((p) => baseLabel(p) === base);
  if (sharing.length <= 1) return base;
  const n = sharing.findIndex((p) => p.id === plot.id);
  return n <= 0 ? base : `${base} ${n + 1}`;
}

/** "Old field" / "Field", or null for an unnamed plot. */
function baseLabel(plot: Pick<PlotView, 'kind' | 'virtue'>): string | null {
  const kind = plot.kind === null ? undefined : plotKindDef(plot.kind);
  if (!kind) return null;
  const epithet = plot.virtue === null ? null : (wordDef(plot.virtue)?.epithet ?? null);
  const label = epithet === null ? kind.name : `${epithet} ${kind.name.toLowerCase()}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The station kinds the card sums, in GAME DESIGN's order: the fields, the trees, the outcrop. */
const KIND_ORDER = ['field', 'trees', 'outcrop'] as const;

/** The kind of a place the card may name: a station's kind (stations.json) or a named plot's kind, or null. */
function placeKind(placeId: string, plots: readonly PlotView[]): string | null {
  const station = stationDef(placeId);
  if (station) return station.kind;
  return plots.find((p) => p.id === placeId)?.kind ?? null;
}

/**
 * The card's lines, in GAME DESIGN's order, each only when it has something
 * to say: the time away; one line per station kind, summed (the fields, the
 * trees, the outcrop: the item and the count made into their baskets, the
 * active action's output with the cycle's, ending with "basket" for one
 * station or "baskets" for several); one line for every skill level gained,
 * in skills order; the Writ now, read from the answer's own view at
 * `serverMs` (none while the island is unnamed). Six lines at most, which
 * M2 never passes; the fold line waits for later milestones.
 */
export function awayLines(card: AwayCard, layout: HoldingLayout, plots: readonly PlotView[], writ: WritView, serverMs: number): string[] {
  const from = Date.parse(card.from);
  const to = Date.parse(card.to);
  const lines = [AWAY_TEXT.away(Number.isNaN(from) || Number.isNaN(to) ? 0 : to - from)];
  const places = [...layout.stations.map((s) => s.id), ...layout.plots.map((p) => p.id)];
  for (const kind of KIND_ORDER) {
    let itemId: string | null = null;
    let quantity = 0;
    let baskets = 0;
    for (const id of places) {
      const made = card.made[id];
      if (!made || made.quantity <= 0 || placeKind(id, plots) !== kind) continue;
      itemId ??= made.itemId;
      quantity += made.quantity;
      baskets++;
    }
    if (itemId === null) continue;
    const label = AWAY_TEXT.KIND[kind] ?? { one: kind, many: kind };
    lines.push(AWAY_TEXT.made(baskets > 1 ? label.many : label.one, itemId, quantity, baskets));
  }
  const skills = SKILLS.filter((s) => (card.levels[s]?.to ?? 0) > (card.levels[s]?.from ?? 0)).map((s) => {
    const level = card.levels[s];
    return AWAY_TEXT.levels(SKILL_NAMES[s], level?.from ?? 1, level?.to ?? 1);
  });
  if (skills.length > 0) lines.push(skills.join(SKILL_JOIN));
  if (writ.name !== null) {
    const d = writView(writFromView(writ), serverMs);
    if (d.state === 'lit' || d.state === 'flickering') lines.push(AWAY_TEXT.writ(d.words));
    else {
      const dark = Math.max(0, serverMs - (d.darkSince ?? serverMs));
      const faded = d.lines.filter((l) => l.state === 'faded').length;
      lines.push(d.state === 'dark' ? AWAY_TEXT.writDark(dark) : AWAY_TEXT.writFaded(dark, Math.max(1, faded)));
    }
  }
  return lines.slice(0, AWAY_MAX_LINES);
}

/** Every fixed line of text this module holds, for the tests (drawable, and the banned names). */
export const AWAY_FIXED_TEXTS: readonly string[] = [
  AWAY_TEXT.TITLE,
  AWAY_TEXT.PRESS_ANY,
  AWAY_TEXT.MORE,
  AWAY_TEXT.BASKET,
  AWAY_TEXT.BASKETS,
  ...Object.values(AWAY_TEXT.KIND).flatMap((k) => [k.one, k.many]),
  SLEEP_TEXT.SLEEP,
  SLEEP_TEXT.HINT,
  SLEEP_TEXT.LYING,
  SLEEP_TEXT.LYING_DARK,
  TOAST_TEXT.WRIT_LOW,
  TOAST_TEXT.WRIT_DARK,
  TOAST_TEXT.PACK_FULL,
];
