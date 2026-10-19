import { describe, expect, it } from 'vitest';
import {
  AWAY_FIXED_TEXTS,
  AWAY_MAX_LINES,
  AWAY_TEXT,
  awayLines,
  duration,
  holdingLayout,
  HOUR_MS,
  isAwayCard,
  isAwaySeenRequest,
  isDrawable,
  itemCount,
  LEVEL_ARROW,
  MET,
  plotLabel,
  pressedWrit,
  SLEEP_TEXT,
  TIDE_MS,
  TOAST_TEXT,
  toastGlyphName,
  toastGlyphsSheet,
  toWritView,
  WORDS,
  type AwayCard,
  type PlotView,
  type WritView,
} from '../src/index.js';
import { BANNED } from './banned.js';

/**
 * The While you were away card's lines (docs/design/holding.md "Sleep, the
 * away card and toasts", M2 Task 7; LORE's and GAME DESIGN's lines of
 * 2026-10-19): the duration, every line alone and the order, one field and
 * several, plural and singular items, the active action's output in its
 * kind's line, one skill and two, each Writ state, no Writ, never more than
 * six lines; the plot labels; every line drawable and clear of the banned
 * names; the guards for the card and the away/seen body.
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
const field = (id: string, virtue: string | null = null): PlotView => ({ ...unnamedPlot(id), ground: 'adamah', virtue, namedAt: at(0), virtueSetAt: virtue ? at(0) : null, sownAt: at(0), kind: 'field' });
const plots = layout.plots.map((p) => unnamedPlot(p.id));
const lit = writAt(T0, 4 * TIDE_MS);

function card(over: Partial<AwayCard> = {}): AwayCard {
  return { from: at(-5 * HOUR_MS), to: at(0), made: {}, levels: {}, ...over };
}

describe('duration (LORE)', () => {
  it('minutes in tens under an hour, then hours, then tides and hours; a whole number of tides drops the hours', () => {
    expect(duration(30 * MIN)).toBe('30 minutes');
    expect(duration(39 * MIN + 59_000)).toBe('30 minutes');
    expect(duration(40 * MIN)).toBe('40 minutes');
    expect(duration(HOUR_MS)).toBe('1 hour');
    expect(duration(5 * HOUR_MS + 59 * MIN)).toBe('5 hours');
    expect(duration(TIDE_MS)).toBe('1 tide');
    expect(duration(TIDE_MS + 3 * HOUR_MS)).toBe('1 tide and 3 hours');
    expect(duration(2 * TIDE_MS)).toBe('2 tides');
    expect(duration(2 * TIDE_MS + HOUR_MS + 50 * MIN)).toBe('2 tides and 1 hour');
    // Tides and minutes never meet: the minutes past the hour are dropped.
    expect(duration(TIDE_MS + 40 * MIN)).toBe('1 tide');
    expect(duration(-5)).toBe('0 minutes');
    expect(TIDE_MS).toBe(24 * HOUR_MS);
  });

  it("counts items with items.json's plural past 1: a count noun takes its s, a mass noun stays, grey seeds stay", () => {
    expect(itemCount('twisted-log', 1)).toBe('1 twisted log');
    expect(itemCount('twisted-log', 18)).toBe('18 twisted logs');
    expect(itemCount('pale-grain', 14)).toBe('14 pale grain');
    expect(itemCount('black-stone', 40)).toBe('40 black stone');
    expect(itemCount('grey-seeds', 4)).toBe('4 grey seeds');
  });
});

describe('awayLines', () => {
  it('the time away alone, then the Writ line; nothing else while nothing was made', () => {
    expect(awayLines(card(), layout, plots, lit, T0)).toEqual(['Away 5 hours.', 'Writ: about four days left']);
    expect(awayLines(card({ from: at(-40 * MIN) }), layout, plots, lit, T0)[0]).toBe('Away 40 minutes.');
    expect(awayLines(card({ from: at(-(TIDE_MS + 3 * HOUR_MS)) }), layout, plots, lit, T0)[0]).toBe('Away 1 tide and 3 hours.');
  });

  it('one line per station kind, summed, in the order fields, trees, outcrop, ending with the basket', () => {
    const c = card({
      made: {
        'plot-1': { itemId: 'pale-grain', quantity: 14 },
        'stone-outcrop': { itemId: 'black-stone', quantity: 40 },
        'twisted-trees': { itemId: 'twisted-log', quantity: 18 },
        'plot-2': { itemId: 'pale-grain', quantity: 0 },
      },
    });
    const named = [field('plot-1'), field('plot-2'), unnamedPlot('plot-3'), unnamedPlot('plot-4')];
    expect(awayLines(c, layout, named, lit, T0)).toEqual([
      'Away 5 hours.',
      'Field: 14 pale grain, in the basket',
      'Trees: 18 twisted logs, in the basket',
      'Outcrop: 40 black stone, in the basket',
      'Writ: about four days left',
    ]);
  });

  it("several fields sum into one line, Fields, in the baskets; the trees' one basket stays one", () => {
    const named = layout.plots.map((p) => field(p.id));
    const c = card({
      made: {
        'plot-1': { itemId: 'pale-grain', quantity: 14 },
        'plot-3': { itemId: 'pale-grain', quantity: 30 },
        'plot-4': { itemId: 'pale-grain', quantity: 12 },
        'twisted-trees': { itemId: 'twisted-log', quantity: 1 },
      },
    });
    expect(awayLines(c, layout, named, lit, T0).slice(1, 3)).toEqual(['Fields: 56 pale grain, in the baskets', 'Trees: 1 twisted log, in the basket']);
  });

  it("the active action's output counts in its kind's line with the cycle's (the server sums them per place already)", () => {
    // A field worked by hand and trickling: one count per place on the wire, one line on the card.
    const c = card({ made: { 'plot-2': { itemId: 'pale-grain', quantity: 1260 + 28 } } });
    expect(awayLines(c, layout, [unnamedPlot('plot-1'), field('plot-2')], lit, T0)[1]).toBe('Field: 1288 pale grain, in the basket');
  });

  it("the skill levels on one line, in skills order, with GAME DESIGN's arrow; one skill alone", () => {
    const c = card({ levels: { farming: { from: 3, to: 4 }, woodcutting: { from: 7, to: 9 } } });
    expect(awayLines(c, layout, plots, lit, T0)).toEqual(['Away 5 hours.', 'Woodcutting 7 → 9 · Farming 3 → 4', 'Writ: about four days left']);
    expect(awayLines(card({ levels: { mining: { from: 1, to: 2 } } }), layout, plots, lit, T0)[1]).toBe('Mining 1 → 2');
    expect(isDrawable(LEVEL_ARROW)).toBe(true);
  });

  it("the Writ now: lit or flickering with the chip words, LORE's dark line, LORE's faded line, none while unnamed", () => {
    const last = (charge: number, now = T0) => awayLines(card(), layout, plots, writAt(T0, charge), now).at(-1);
    expect(last(20 * HOUR_MS)).toBe('Writ: less than a day left');
    expect(last(30 * HOUR_MS)).toBe('Writ: about a day left');
    expect(last(-5 * HOUR_MS)).toBe('Writ: dark for 5 hours. It still remembers everything.');
    expect(last(-(2 * TIDE_MS + 4 * HOUR_MS))).toBe('Writ: dark for 2 tides and 4 hours; its outer line has faded.');
    // The Writ is read at the client's server clock, not the card's: an hour later the chip has moved on.
    expect(last(-5 * HOUR_MS, T0 + HOUR_MS)).toBe('Writ: dark for 6 hours. It still remembers everything.');
    expect(awayLines(card(), layout, plots, writAt(T0, 4 * TIDE_MS, false), T0)).toEqual(['Away 5 hours.']);
    expect(AWAY_TEXT.writFaded(49 * HOUR_MS, 2)).toBe('Writ: dark for 2 tides and 1 hour; its outer 2 lines have faded.');
  });

  it('never more than six lines: every M2 line at once is exactly six, and the fold line is not drawn', () => {
    const named = layout.plots.map((p) => field(p.id));
    const c = card({
      made: {
        'twisted-trees': { itemId: 'twisted-log', quantity: 18 },
        'stone-outcrop': { itemId: 'black-stone', quantity: 1 },
        'plot-1': { itemId: 'pale-grain', quantity: 14 },
        'plot-2': { itemId: 'pale-grain', quantity: 14 },
        'plot-3': { itemId: 'pale-grain', quantity: 14 },
      },
      levels: { woodcutting: { from: 7, to: 9 }, mining: { from: 1, to: 2 }, farming: { from: 1, to: 3 } },
    });
    const lines = awayLines(c, layout, named, lit, T0);
    expect(lines).toHaveLength(AWAY_MAX_LINES);
    expect(lines).toEqual([
      'Away 5 hours.',
      'Fields: 42 pale grain, in the baskets',
      'Trees: 18 twisted logs, in the basket',
      'Outcrop: 1 black stone, in the basket',
      'Woodcutting 7 → 9 · Mining 1 → 2 · Farming 1 → 3',
      'Writ: about four days left',
    ]);
    expect(lines).not.toContain(AWAY_TEXT.MORE);
  });
});

describe('plotLabel (LORE)', () => {
  const old = field('plot-1', 'yashan');
  it("the Virtue's epithet and the kind, just the kind without a Virtue, a number only while two share a label, by plot order", () => {
    expect(plotLabel(old, [old])).toBe('Old field');
    expect(plotLabel(field('plot-2'), [old, field('plot-2')])).toBe('Field');
    const two = [field('plot-1'), unnamedPlot('plot-2'), field('plot-3')];
    expect(plotLabel(two[0] ?? old, two)).toBe('Field');
    expect(plotLabel(two[2] ?? old, two)).toBe('Field 2');
    const twoOld = [old, field('plot-2'), field('plot-3', 'yashan')];
    expect(plotLabel(twoOld[0] ?? old, twoOld)).toBe('Old field');
    expect(plotLabel(twoOld[2] ?? old, twoOld)).toBe('Old field 2');
    expect(plotLabel(twoOld[1] ?? old, twoOld)).toBe('Field');
    // An unnamed plot keeps its id.
    expect(plotLabel(unnamedPlot('plot-4'), twoOld)).toBe('plot-4');
    // The epithet comes from words.json.
    expect(WORDS.find((w) => w.id === 'yashan')?.epithet).toBe('Old');
    expect(WORDS.find((w) => w.id === 'adamah')?.epithet).toBeNull();
  });
});

describe('the lines and the toasts', () => {
  const texts = [
    ...AWAY_FIXED_TEXTS,
    AWAY_TEXT.away(TIDE_MS + 3 * HOUR_MS),
    AWAY_TEXT.made('Fields', 'pale-grain', 56, 3),
    AWAY_TEXT.made('Trees', 'grey-seeds', 4, 1),
    AWAY_TEXT.levels('Woodcutting', 7, 9),
    AWAY_TEXT.writ('about four days'),
    AWAY_TEXT.writDark(5 * HOUR_MS),
    AWAY_TEXT.writFaded(49 * HOUR_MS, 1),
    AWAY_TEXT.writFaded(80 * HOUR_MS, 2),
    TOAST_TEXT.skillLevel('woodcutting', 2),
    TOAST_TEXT.storeFull('twisted-log'),
  ];

  it("every line the fonts draw passes isDrawable; the Old Letters in a line are the letter sheet's", () => {
    for (const text of texts) expect(isDrawable(text.replaceAll(MET, '')), text).toBe(true);
    // The one line with Old Letters: מת, drawn from the sheet like the HUD chip's.
    expect(TOAST_TEXT.WRIT_DARK).toBe(`Your Writ reads ${MET}.`);
    expect(isDrawable(TOAST_TEXT.WRIT_DARK)).toBe(false);
  });

  it('none carries a banned name', () => {
    for (const text of texts) expect(BANNED.test(text), text).toBe(false);
  });

  it("GAME DESIGN's and LORE's lines, word for word", () => {
    expect(TOAST_TEXT.skillLevel('woodcutting', 2)).toBe('Woodcutting 2.');
    expect(TOAST_TEXT.WRIT_LOW).toBe('Your Writ has about a day left.');
    expect(TOAST_TEXT.storeFull('twisted-log')).toBe('Store: twisted logs full.');
    expect(TOAST_TEXT.PACK_FULL).toBe('Pack full.');
    expect(SLEEP_TEXT.SLEEP).toBe('SLEEP');
    expect(SLEEP_TEXT.HINT).toBe('Lie down to sleep and leave the game. Your holding keeps working while you sleep, until the Writ runs low.');
    expect(SLEEP_TEXT.LYING).toBe('You lie down by the Writ. Its hum is the last thing you hear.');
    expect(SLEEP_TEXT.LYING_DARK).toBe("You lie down by the Writ. It doesn't hum tonight.");
    expect(AWAY_TEXT.TITLE).toBe('While you were away');
    expect(AWAY_TEXT.PRESS_ANY).toBe('Press anything to wake.');
    expect(AWAY_TEXT.MORE).toBe('More is waiting at the stations.');
  });

  it("each toast kind names a cell of ART's glyph sheet; a skill level its skill's", () => {
    const cells = new Set(toastGlyphsSheet.cells.map((c) => c.name));
    for (const name of [toastGlyphName('skill-level', 'woodcutting'), toastGlyphName('skill-level', 'mining'), toastGlyphName('skill-level', 'farming'), toastGlyphName('writ-low'), toastGlyphName('writ-dark'), toastGlyphName('store-full'), toastGlyphName('pack-full')])
      expect(cells.has(name), name).toBe(true);
    expect(toastGlyphName('skill-level', 'mining')).toBe('skill-mining');
  });
});

describe('the guards', () => {
  const c: AwayCard = { from: at(-5 * HOUR_MS), to: at(0), made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 18 } }, levels: { woodcutting: { from: 7, to: 9 } } };

  it('isAwayCard: the absence ends after it begins, places are station or plot ids, levels rise; no Writ of its own', () => {
    expect(isAwayCard(c)).toBe(true);
    expect(isAwayCard({ ...c, made: {}, levels: {} })).toBe(true);
    expect(isAwayCard({ ...c, made: { 'plot-3': { itemId: 'pale-grain', quantity: 2 } } })).toBe(true);
    expect(isAwayCard({ ...c, to: c.from })).toBe(false);
    expect(isAwayCard({ ...c, from: 'yesterday' })).toBe(false);
    expect(isAwayCard({ ...c, made: { field: { itemId: 'pale-grain', quantity: 2 } } })).toBe(false);
    expect(isAwayCard({ ...c, made: { 'twisted-trees': { itemId: 'twisted-log', quantity: 0 } } })).toBe(false);
    expect(isAwayCard({ ...c, levels: { woodcutting: { from: 9, to: 7 } } })).toBe(false);
    expect(isAwayCard({ ...c, levels: { cooking: { from: 1, to: 2 } } })).toBe(false);
    expect(isAwayCard({ ...c, writ: lit })).toBe(false);
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
