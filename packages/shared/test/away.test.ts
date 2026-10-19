import { describe, expect, it } from 'vitest';
import {
  AWAY_FIXED_TEXTS,
  AWAY_MAX_LINES,
  AWAY_TEXT,
  awayLines,
  awaySpan,
  holdingLayout,
  HOUR_MS,
  isAwayCard,
  isAwaySeenRequest,
  isDrawable,
  itemCount,
  MET,
  placeName,
  pressedWrit,
  SLEEP_TEXT,
  TIDE_MS,
  TOAST_TEXT,
  toWritView,
  type AwayCard,
  type PlotView,
  type WritView,
} from '../src/index.js';
import { BANNED } from './banned.js';

/**
 * The While you were away card's lines (docs/design/holding.md "Sleep, the
 * away card and toasts", M2 Task 7): every line alone, GAME DESIGN's order,
 * under an hour, tides and hours, plural and singular, two fields, the
 * six-line cut with its fold line, each Writ state and the unnamed Writ;
 * every placeholder drawable and clear of the banned names; the guards for
 * the card and the away/seen body.
 */
const T0 = Date.parse('2026-10-17T12:00:00Z');
const at = (ms: number): string => new Date(T0 + ms).toISOString();
const layout = holdingLayout();
const MIN = 60_000;

/** A Writ view at `now`, named unless `named` is false, with `chargeMs` of charge left (negative: dark that long). */
function writAt(now: number, chargeMs: number, named = true): WritView {
  const stored = { ...pressedWrit(now), emptyAt: now + chargeMs, name: named ? 'Black Rock' : null, letters: named ? 'בלקרק' : null };
  return toWritView(stored, now);
}

const unnamedPlot = (id: string): PlotView => ({ id, ground: null, virtue: null, namedAt: null, virtueSetAt: null, sownAt: null, kind: null, pieces: [], level: 1, state: 'lit' });
const field = (id: string): PlotView => ({ ...unnamedPlot(id), ground: 'adamah', namedAt: at(0), sownAt: at(0), kind: 'field' });
const plots = layout.plots.map((p) => unnamedPlot(p.id));

function card(over: Partial<AwayCard> = {}, now = T0, charge = 4 * TIDE_MS): AwayCard {
  return { from: at(-5 * HOUR_MS), to: at(0), made: {}, levels: {}, writ: writAt(now, charge), ...over };
}

describe('awaySpan', () => {
  it('minutes under an hour, then hours, then tides and hours, singular at 1', () => {
    expect(awaySpan(40 * MIN)).toBe('40 minutes');
    expect(awaySpan(MIN)).toBe('1 minute');
    expect(awaySpan(59 * MIN + 59_000)).toBe('59 minutes');
    expect(awaySpan(HOUR_MS)).toBe('1 hour');
    expect(awaySpan(5 * HOUR_MS + 20 * MIN)).toBe('5 hours');
    expect(awaySpan(TIDE_MS)).toBe('1 tide');
    expect(awaySpan(TIDE_MS + 3 * HOUR_MS)).toBe('1 tide and 3 hours');
    expect(awaySpan(2 * TIDE_MS + HOUR_MS)).toBe('2 tides and 1 hour');
    expect(awaySpan(-5)).toBe('0 minutes');
    expect(TIDE_MS).toBe(24 * HOUR_MS);
  });

  it('counts items with their display name, plural when not 1', () => {
    expect(itemCount('twisted-log', 1)).toBe('1 twisted log');
    expect(itemCount('pale-grain', 14)).toBe('14 pale grains');
    expect(itemCount('black-stone', 0)).toBe('0 black stones');
  });
});

describe('awayLines', () => {
  it('the time away alone, then the Writ line; nothing else while nothing was made', () => {
    expect(awayLines(card(), layout, plots, T0)).toEqual(['Away 5 hours.', 'Writ: about four days left']);
    expect(awayLines(card({ from: at(-40 * MIN) }), layout, plots, T0)).toEqual(['Away 40 minutes.', 'Writ: about four days left']);
    expect(awayLines(card({ from: at(-(TIDE_MS + 3 * HOUR_MS)) }), layout, plots, T0)[0]).toBe('Away 1 tide and 3 hours.');
  });

  it("each station's line in layout order, the stations then the plots, with GAME DESIGN's format and the item's name", () => {
    const c = card({
      made: {
        'plot-1': { itemId: 'pale-grain', quantity: 14 },
        'stone-outcrop': { itemId: 'black-stone', quantity: 1 },
        'twisted-trees': { itemId: 'twisted-log', quantity: 18 },
        'plot-2': { itemId: 'pale-grain', quantity: 0 },
      },
    });
    const named = [field('plot-1'), field('plot-2'), unnamedPlot('plot-3'), unnamedPlot('plot-4')];
    expect(awayLines(c, layout, named, T0)).toEqual([
      'Away 5 hours.',
      'Twisted trees: 18 twisted logs, in the basket',
      'Stone outcrop: 1 black stone, in the basket',
      'Field: 14 pale grains, in the basket',
      'Writ: about four days left',
    ]);
  });

  it('two fields: the first is Field, the second Field 2, in plot order among the named plots of the kind', () => {
    const named = [unnamedPlot('plot-1'), field('plot-2'), unnamedPlot('plot-3'), field('plot-4')];
    expect(placeName('plot-2', layout, named)).toBe('Field');
    expect(placeName('plot-4', layout, named)).toBe('Field 2');
    expect(placeName('twisted-trees', layout, named)).toBe('Twisted trees');
    // An unnamed or unknown plot keeps its id (nothing made there, so no line in practice).
    expect(placeName('plot-1', layout, named)).toBe('plot-1');
    const c = card({ made: { 'plot-4': { itemId: 'pale-grain', quantity: 2 }, 'plot-2': { itemId: 'pale-grain', quantity: 1 } } });
    expect(awayLines(c, layout, named, T0).slice(1, 3)).toEqual(['Field: 1 pale grain, in the basket', 'Field 2: 2 pale grains, in the basket']);
  });

  it("the skill levels gained, one per skill in skills order, GAME DESIGN's line with the placeholder 'to'", () => {
    const c = card({ levels: { farming: { from: 1, to: 2 }, woodcutting: { from: 7, to: 9 } } });
    expect(awayLines(c, layout, plots, T0)).toEqual(['Away 5 hours.', 'Woodcutting 7 to 9', 'Farming 1 to 2', 'Writ: about four days left']);
  });

  it('the Writ now: lit or flickering with the chip words, dark since, faded with the outer line, none while unnamed', () => {
    expect(awayLines(card({}, T0, 20 * HOUR_MS), layout, plots, T0).at(-1)).toBe('Writ: less than a day left');
    expect(awayLines(card({}, T0, 30 * HOUR_MS), layout, plots, T0).at(-1)).toBe('Writ: about a day left');
    expect(awayLines(card({}, T0, -5 * HOUR_MS), layout, plots, T0).at(-1)).toBe('Writ: dark since 5 hours ago');
    expect(awayLines(card({}, T0, -49 * HOUR_MS), layout, plots, T0).at(-1)).toBe('Writ: dark since 2 tides and 1 hour ago; the outer line faded');
    // The Writ is read at the client's server clock, not the card's: an hour later the chip has moved on.
    expect(awayLines(card({}, T0, -5 * HOUR_MS), layout, plots, T0 + HOUR_MS).at(-1)).toBe('Writ: dark since 6 hours ago');
    expect(awayLines(card({ writ: writAt(T0, 4 * TIDE_MS, false) }), layout, plots, T0)).toEqual(['Away 5 hours.']);
  });

  it('six lines at most: the time away and the Writ stay, the middle fills with places then skills, the rest folds into one line', () => {
    const named = layout.plots.map((p) => field(p.id));
    const c = card({
      made: {
        'twisted-trees': { itemId: 'twisted-log', quantity: 18 },
        'stone-outcrop': { itemId: 'black-stone', quantity: 1 },
        'plot-1': { itemId: 'pale-grain', quantity: 14 },
        'plot-2': { itemId: 'pale-grain', quantity: 14 },
        'plot-3': { itemId: 'pale-grain', quantity: 14 },
      },
      levels: { woodcutting: { from: 7, to: 9 } },
    });
    const lines = awayLines(c, layout, named, T0);
    expect(lines).toHaveLength(AWAY_MAX_LINES);
    expect(lines).toEqual([
      'Away 5 hours.',
      'Twisted trees: 18 twisted logs, in the basket',
      'Stone outcrop: 1 black stone, in the basket',
      'Field: 14 pale grains, in the basket',
      AWAY_TEXT.MORE,
      'Writ: about four days left',
    ]);
    // Exactly six fit without the fold line.
    const six = card({ made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 18 }, 'plot-1': { itemId: 'pale-grain', quantity: 14 } }, levels: { woodcutting: { from: 7, to: 9 }, mining: { from: 1, to: 2 } } });
    expect(awayLines(six, layout, named, T0)).toHaveLength(6);
    expect(awayLines(six, layout, named, T0)).not.toContain(AWAY_TEXT.MORE);
    // Unnamed: the Writ line goes and one more line of the middle fits.
    const unnamed = { ...c, writ: writAt(T0, 4 * TIDE_MS, false) };
    expect(awayLines(unnamed, layout, named, T0)).toEqual([
      'Away 5 hours.',
      'Twisted trees: 18 twisted logs, in the basket',
      'Stone outcrop: 1 black stone, in the basket',
      'Field: 14 pale grains, in the basket',
      'Field 2: 14 pale grains, in the basket',
      AWAY_TEXT.MORE,
    ]);
  });
});

describe('the placeholders and the toasts', () => {
  const texts = [
    ...AWAY_FIXED_TEXTS,
    AWAY_TEXT.away(TIDE_MS + 3 * HOUR_MS),
    AWAY_TEXT.made('Field', 'pale-grain', 14),
    AWAY_TEXT.placeN('Field', 2),
    AWAY_TEXT.levels('Woodcutting', 7, 9),
    AWAY_TEXT.writ('about four days'),
    AWAY_TEXT.writDark(5 * HOUR_MS),
    AWAY_TEXT.writFaded(49 * HOUR_MS),
    TOAST_TEXT.skillLevel('woodcutting', 2),
    TOAST_TEXT.storeFull('twisted-log'),
  ];

  it('every line the fonts draw passes isDrawable; the Old Letters in a line are the letter sheet\'s', () => {
    for (const text of texts) expect(isDrawable(text.replaceAll(MET, '')), text).toBe(true);
    // The one line with Old Letters: מת, drawn from the sheet like the HUD chip's.
    expect(TOAST_TEXT.WRIT_DARK).toBe(`Your Writ reads ${MET}.`);
    expect(isDrawable(TOAST_TEXT.WRIT_DARK)).toBe(false);
  });

  it('none carries a banned name', () => {
    for (const text of texts) expect(BANNED.test(text), text).toBe(false);
    for (const text of Object.values(SLEEP_TEXT)) expect(BANNED.test(text), text).toBe(false);
  });

  it("GAME DESIGN's toast lines, word for word", () => {
    expect(TOAST_TEXT.skillLevel('woodcutting', 2)).toBe('Woodcutting 2.');
    expect(TOAST_TEXT.WRIT_LOW).toBe('Your Writ has about a day left.');
    expect(TOAST_TEXT.storeFull('twisted-log')).toBe('Store: twisted logs full.');
    expect(TOAST_TEXT.PACK_FULL).toBe('Pack full.');
    expect(SLEEP_TEXT.SLEEP).toBe('SLEEP');
    expect(AWAY_TEXT.TITLE).toBe('While you were away');
  });
});

describe('the guards', () => {
  const writ = writAt(T0, 4 * TIDE_MS);
  const c: AwayCard = { from: at(-5 * HOUR_MS), to: at(0), made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 18 } }, levels: { woodcutting: { from: 7, to: 9 } }, writ };

  it('isAwayCard: the absence ends after it begins, places are station or plot ids, levels rise, the Writ is a Writ view', () => {
    expect(isAwayCard(c)).toBe(true);
    expect(isAwayCard({ ...c, made: {}, levels: {} })).toBe(true);
    expect(isAwayCard({ ...c, made: { 'plot-3': { itemId: 'pale-grain', quantity: 2 } } })).toBe(true);
    expect(isAwayCard({ ...c, to: c.from })).toBe(false);
    expect(isAwayCard({ ...c, from: 'yesterday' })).toBe(false);
    expect(isAwayCard({ ...c, made: { field: { itemId: 'pale-grain', quantity: 2 } } })).toBe(false);
    expect(isAwayCard({ ...c, made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 0 } } })).toBe(false);
    expect(isAwayCard({ ...c, levels: { woodcutting: { from: 9, to: 7 } } })).toBe(false);
    expect(isAwayCard({ ...c, levels: { cooking: { from: 1, to: 2 } } })).toBe(false);
    expect(isAwayCard({ ...c, writ: { ...writ, state: 'bright' } })).toBe(false);
    expect(isAwayCard({ ...c, extra: 1 })).toBe(false);
    expect(isAwayCard(null)).toBe(false);
  });

  it('isAwaySeenRequest: exactly { to }, an ISO time', () => {
    expect(isAwaySeenRequest({ to: at(0) })).toBe(true);
    expect(isAwaySeenRequest({ to: 'now' })).toBe(false);
    expect(isAwaySeenRequest({ to: at(0), extra: 1 })).toBe(false);
    expect(isAwaySeenRequest({})).toBe(false);
    expect(isAwaySeenRequest('2026-10-17T12:00:00Z')).toBe(false);
  });
});
