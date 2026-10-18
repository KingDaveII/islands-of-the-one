import { describe, expect, it } from 'vitest';
import {
  chargeWords,
  exactTime,
  feedPreview,
  feedRefusal,
  FILL_ITEM,
  fillCount,
  fillPreview,
  fitCount,
  graceHours,
  HOUR_MS,
  isFull,
  isHoldingResponse,
  isWritFeedRequest,
  isWritNameRequest,
  isWritView,
  pressedEmptyAt,
  pressedWrit,
  sliverFitsInMs,
  toWritView,
  validateWritData,
  WRIT_FULL,
  WRIT_TOO_MUCH_EVER,
  WRIT_TOO_MUCH_NOW,
  writData,
  writFromView,
  writView,
  type WritData,
  type WritStored,
} from '../src/index.js';
import writJson from '../data/writ.json' with { type: 'json' };

/**
 * The Writ's math (docs/design/holding.md "The Writ"; GAME DESIGN's answers
 * of 2026-10-18): the data validator, writView in every state and at its
 * boundaries, the grace by certification, line 1's fade time, a freshly
 * pressed Writ going dark at 48 h, the charge in words, and feedPreview on
 * lit, dark and fading Writs, Full, humming glass only at 0, deep glass
 * never, Fill's count and Fill never taking gin.
 */
const T0 = Date.parse('2026-10-17T12:00:00Z');
const at = (hours: number): number => T0 + hours * HOUR_MS;
const H = HOUR_MS;

const named = (emptyAt: number, more: Partial<WritStored> = {}): WritStored => ({
  name: 'Black Rock',
  letters: 'בלק רוק',
  certified: false,
  emptyAt,
  lineCount: 1,
  ...more,
});

/** The data once the Wet House opens: a shorter grace for an uncertified Writ. */
const M4: WritData = { ...writData, graceHoursUncertified: 24 };

describe('writ.json', () => {
  it("holds GAME DESIGN's starting values and validates", () => {
    expect(validateWritData(writJson)).toEqual({ ok: true, data: writData });
    expect(writData).toEqual({
      sliverHours: 48,
      capacityHours: 144,
      feeds: { 'wild-sliver': 1, 'sealed-gin': 1, 'glass-chip': 3, 'deep-glass': 9 },
      lowHours: 24,
      pressChargeHours: 48,
      graceHoursCertified: 48,
      graceHoursUncertified: 48,
      lineFadeHours: 24,
      lineLetters: 12,
      linePlots: 4,
      flickerPatternMs: [600, 140, 260, 140],
    });
  });

  it('lists every problem', () => {
    const base = Object.fromEntries(Object.entries(writJson).filter(([k]) => k !== '$comment'));
    const bad = validateWritData({
      ...base,
      sliverHours: 0,
      feeds: { 'wild-sliver': 1, pebble: 2, 'deep-glass': 0 },
      graceHoursUncertified: 'two days',
      extra: 1,
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.problems).toEqual([
      'unknown field(s) extra',
      'sliverHours must be a positive integer',
      'graceHoursUncertified must be a positive integer',
      'feeds: unknown item pebble (see items.json)',
      'feeds.deep-glass must be a positive integer (slivers)',
    ]);
    expect(validateWritData({ ...base, capacityHours: 24 })).toMatchObject({
      ok: false,
      problems: ['capacityHours must hold at least one sliver', 'lowHours must be under capacityHours', 'pressChargeHours must not exceed capacityHours'],
    });
    const flickerProblem = 'flickerPatternMs must be an even-length list of positive integers (ms lit, ms dim, …)';
    for (const pattern of [[600, 140, 260], [600, 0], [], 'steady'])
      expect(validateWritData({ ...base, flickerPatternMs: pattern }), JSON.stringify(pattern)).toEqual({ ok: false, problems: [flickerProblem] });
    expect(validateWritData(null)).toEqual({ ok: false, problems: ['expected an object'] });
    expect(validateWritData({ ...base, feeds: {} })).toMatchObject({ ok: false });
  });
});

describe('writView', () => {
  it('a freshly pressed Writ: two days of charge, lit, then flickering, then dark at 48 h', () => {
    const pressed = pressedWrit(at(0));
    expect(pressed).toEqual({ name: null, letters: null, certified: false, emptyAt: at(48), lineCount: 1 });
    expect(pressedEmptyAt(at(0))).toBe(at(48));
    expect(writView(pressed, at(0))).toEqual({
      state: 'lit',
      chargeMs: 48 * H,
      chargeHours: 48,
      words: 'about two days',
      darkSince: null,
      graceEndsAt: at(96),
      graceMs: 48 * H,
      lines: [{ line: 1, plots: 4, state: 'lit', fadesAt: at(96) }],
      full: false,
      sliverFitsInMs: 0,
    });
    expect(writView(pressed, at(30)).state).toBe('flickering');
    expect(writView(pressed, at(48))).toMatchObject({ state: 'dark', darkSince: at(48) });
    expect(writView(pressed, at(96)).state).toBe('fading');
  });

  it('lit, flickering, dark and fading, with their boundaries', () => {
    const w = named(at(100));
    expect(writView(w, at(0))).toMatchObject({ state: 'lit', chargeMs: 100 * H, chargeHours: 100, darkSince: null, graceEndsAt: at(148) });
    // Exactly lowHours left is still lit; a millisecond under it flickers.
    expect(writView(w, at(76)).state).toBe('lit');
    expect(writView(w, at(76) + 1).state).toBe('flickering');
    expect(writView(w, at(99)).state).toBe('flickering');
    // The moment the charge runs out it is dark, within the grace.
    expect(writView(w, at(100) - 1)).toMatchObject({ state: 'flickering', chargeMs: 1, darkSince: null });
    expect(writView(w, at(100))).toMatchObject({ state: 'dark', chargeMs: 0, chargeHours: 0, darkSince: at(100), graceEndsAt: at(148) });
    expect(writView(w, at(147)).state).toBe('dark');
    expect(writView(w, at(148) - 1).state).toBe('dark');
    // The grace's end: fading, and line 1 faded that moment (the start of the third day for a 48 h grace).
    expect(writView(w, at(148))).toMatchObject({ state: 'fading', darkSince: at(100), graceEndsAt: at(148) });
    expect(writView(w, at(1000)).state).toBe('fading');
  });

  it('the grace: by certification, both 48 h in M2; the uncertified one shortens when the Wet House opens', () => {
    expect(graceHours({ certified: false })).toBe(48);
    expect(graceHours({ certified: true })).toBe(48);
    expect(graceHours({ certified: false }, M4)).toBe(24);
    expect(graceHours({ certified: true }, M4)).toBe(48);
    const w = named(at(100));
    expect(writView(w, at(130), M4)).toMatchObject({ state: 'fading', graceEndsAt: at(124), graceMs: 24 * H });
    expect(writView(w, at(123), M4).state).toBe('dark');
    expect(writView({ ...w, certified: true }, at(130), M4)).toMatchObject({ state: 'dark', graceEndsAt: at(148) });
    expect(writView(w, at(130)).state).toBe('dark');
  });

  it('the lines: lit while the Writ has charge, dark in the grace, faded after; line 1 fades the moment the grace ends', () => {
    const w = named(at(100));
    expect(writView(w, at(50)).lines).toEqual([{ line: 1, plots: 4, state: 'lit', fadesAt: at(148) }]);
    expect(writView(w, at(99)).lines[0]?.state).toBe('lit');
    expect(writView(w, at(100)).lines[0]?.state).toBe('dark');
    expect(writView(w, at(148) - 1).lines[0]?.state).toBe('dark');
    expect(writView(w, at(148)).lines[0]?.state).toBe('faded');
    // More lines (later): the outermost fades first, one each fade stretch, the Name's line last.
    const three = named(at(100), { lineCount: 3 });
    expect(writView(three, at(0)).lines.map((l) => l.fadesAt)).toEqual([at(148 + 48), at(148 + 24), at(148)]);
    expect(writView(three, at(148)).lines.map((l) => l.state)).toEqual(['dark', 'dark', 'faded']);
    expect(writView(three, at(172)).lines.map((l) => l.state)).toEqual(['dark', 'faded', 'faded']);
    expect(writView(three, at(196)).lines.map((l) => l.state)).toEqual(['faded', 'faded', 'faded']);
  });

  it('the charge in words: under 24 h less than a day, then the nearest whole day', () => {
    const cases: [number, string][] = [
      [0, 'less than a day'],
      [23, 'less than a day'],
      [24, 'about a day'],
      [35, 'about a day'],
      [36, 'about two days'],
      [59, 'about two days'],
      [60, 'about three days'],
      [144, 'about six days'],
    ];
    for (const [hours, words] of cases) {
      expect(chargeWords(hours * H), `${hours} h`).toBe(words);
      expect(writView(named(at(hours)), at(0)).words).toBe(words);
    }
    expect(chargeWords(24 * H - 1)).toBe('less than a day');
    expect(chargeWords(-5)).toBe('less than a day');
    expect(exactTime(41 * H + 12 * 60_000 + 59_000)).toBe('41 h 12 min');
    expect(exactTime(12 * 60_000)).toBe('12 min');
    expect(exactTime(0)).toBe('0 min');
    expect(exactTime(-1)).toBe('0 min');
  });
});

describe('feedPreview', () => {
  it('only items in feeds can be fed', () => {
    expect(feedPreview(named(at(10)), 'twisted-log', 1, at(0))).toEqual({ ok: false, error: 'not-sparkglass', message: 'The Writ only takes Sparkglass.' });
    expect(feedPreview(named(at(10)), 'nothing', 1, at(0))).toMatchObject({ ok: false, error: 'not-sparkglass' });
    expect(fitCount(named(at(10)), 'twisted-log', at(0))).toBe(0);
    expect(feedRefusal(named(at(10)), 'twisted-log', at(0))).toMatchObject({ error: 'not-sparkglass' });
  });

  it('a lit or flickering Writ adds to its emptyAt; a dark or fading one starts from now', () => {
    const lit = named(at(30));
    expect(feedPreview(lit, 'wild-sliver', 1, at(0))).toEqual({
      ok: true,
      itemId: 'wild-sliver',
      count: 1,
      hours: 48,
      share: '1/3',
      emptyAt: at(78),
      chargeMs: 78 * H,
      words: 'about three days',
    });
    expect(feedPreview(named(at(10)), 'wild-sliver', 1, at(0))).toMatchObject({ ok: true, emptyAt: at(58), words: 'about two days' }); // flickering
    const dark = named(at(30));
    expect(feedPreview(dark, 'wild-sliver', 1, at(40))).toMatchObject({ ok: true, emptyAt: at(88), chargeMs: 48 * H });
    const fading = named(at(30));
    expect(feedPreview(fading, 'wild-sliver', 2, at(200))).toMatchObject({ ok: true, count: 2, hours: 96, share: '2/3', emptyAt: at(296), words: 'about four days' });
    expect(feedRefusal(lit, 'wild-sliver', at(0))).toBeNull();
  });

  it('nothing is wasted: a piece fits when charge + hours is within the capacity; a full Writ says "Full."', () => {
    expect(WRIT_FULL).toBe('Full.');
    const full = named(at(144));
    expect(isFull(full, at(0))).toBe(true);
    expect(feedPreview(full, 'wild-sliver', 1, at(0))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    expect(feedPreview(full, 'sealed-gin', 1, at(0))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    expect(feedRefusal(full, 'glass-chip', at(0))).toEqual({ error: 'full', message: 'Full.' });
    expect(feedPreview(named(at(200)), 'wild-sliver', 1, at(0))).toMatchObject({ ok: false, error: 'full' });
    // 96 h left: one sliver fits exactly (144); a hair more and the Writ is full (nothing fits any more).
    expect(feedPreview(named(at(96)), 'wild-sliver', 1, at(0))).toMatchObject({ ok: true, emptyAt: at(144), words: 'about six days' });
    expect(isFull(named(at(96)), at(0))).toBe(false);
    expect(feedPreview(named(at(96) + 1), 'wild-sliver', 1, at(0))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    expect(isFull(named(at(96) + 1), at(0))).toBe(true);
    // The only meaning of full, derived too, with the time until a sliver fits again (charge + 48 ≤ 144).
    expect(writView(named(at(100)), at(0))).toMatchObject({ full: true, sliverFitsInMs: 4 * H });
    expect(writView(named(at(96)), at(0))).toMatchObject({ full: false, sliverFitsInMs: 0 });
    expect(writView(named(at(144)), at(0))).toMatchObject({ full: true, sliverFitsInMs: 48 * H });
    expect(writView(named(at(0)), at(10))).toMatchObject({ full: false, sliverFitsInMs: 0 });
    expect(sliverFitsInMs(named(at(100)), at(0))).toBe(4 * H);
    // The order of the refusals: deep glass first, then full for every other kind, humming glass included, then too much now.
    expect(feedRefusal(named(at(100)), 'deep-glass', at(0))).toEqual({ error: 'too-much', message: WRIT_TOO_MUCH_EVER });
    expect(feedRefusal(named(at(100)), 'glass-chip', at(0))).toEqual({ error: 'full', message: 'Full.' });
    expect(feedRefusal(named(at(100)), 'sealed-gin', at(0))).toEqual({ error: 'full', message: 'Full.' });
    expect(feedRefusal(named(at(10)), 'glass-chip', at(0))).toEqual({ error: 'too-much', message: WRIT_TOO_MUCH_NOW });
    expect(WRIT_TOO_MUCH_NOW).toBe('Too much for your Writ now');
    // 90 h left: one sliver fits, two don't.
    expect(feedPreview(named(at(90)), 'wild-sliver', 2, at(0))).toEqual({ ok: false, error: 'too-much', message: WRIT_TOO_MUCH_NOW });
    expect(feedPreview(named(at(10)), 'wild-sliver', 3, at(0))).toMatchObject({ ok: false, error: 'too-much' });
    // Never a zero or fractional count.
    expect(feedPreview(named(at(10)), 'wild-sliver', 0, at(0))).toMatchObject({ ok: false, error: 'too-much' });
    expect(feedPreview(named(at(10)), 'wild-sliver', 1.5, at(0))).toMatchObject({ ok: false, error: 'too-much' });
  });

  it('humming glass is refused at any charge above 0 and accepted at 0; deep glass is always refused', () => {
    expect(feedPreview(named(at(1)), 'glass-chip', 1, at(0))).toEqual({ ok: false, error: 'too-much', message: WRIT_TOO_MUCH_NOW });
    expect(feedPreview(named(at(0) + 1), 'glass-chip', 1, at(0))).toEqual({ ok: false, error: 'too-much', message: WRIT_TOO_MUCH_NOW });
    expect(feedPreview(named(at(0)), 'glass-chip', 1, at(0))).toMatchObject({ ok: true, hours: 144, share: '1/1', emptyAt: at(144), words: 'about six days' });
    expect(feedPreview(named(at(-50)), 'glass-chip', 1, at(0))).toMatchObject({ ok: true, emptyAt: at(144) }); // fading: relit in one go
    expect(feedPreview(named(at(0)), 'glass-chip', 2, at(0))).toMatchObject({ ok: false, error: 'too-much' });
    for (const w of [named(at(0)), named(at(-50)), named(at(50)), named(at(144))])
      expect(feedPreview(w, 'deep-glass', 1, at(0))).toEqual({ ok: false, error: 'too-much', message: WRIT_TOO_MUCH_EVER });
    expect(WRIT_TOO_MUCH_EVER).toBe('Too much for one Writ');
    expect(fitCount(named(at(0)), 'deep-glass', at(0))).toBe(0);
  });

  it("Fill's count: as many wild slivers as fit, one at a time; Fill never takes gin", () => {
    expect(FILL_ITEM).toBe('wild-sliver');
    expect(fillCount(named(at(0)), at(0))).toBe(3);
    expect(fillCount(pressedWrit(at(0)), at(0))).toBe(2);
    expect(fillCount(named(at(50)), at(0))).toBe(1);
    expect(fillCount(named(at(96)), at(0))).toBe(1);
    expect(fillCount(named(at(96) + 1), at(0))).toBe(0);
    expect(fillCount(named(at(10)), at(200))).toBe(3); // fading: from now
    expect(fillPreview(named(at(-5)), at(0))).toMatchObject({ ok: true, itemId: 'wild-sliver', count: 3, hours: 144, share: '1/1', emptyAt: at(144) });
    expect(fillPreview(named(at(50)), at(0))).toMatchObject({ ok: true, itemId: 'wild-sliver', count: 1, emptyAt: at(98) });
    expect(fillPreview(named(at(100)), at(0))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    expect(fillPreview(named(at(144)), at(0))).toEqual({ ok: false, error: 'full', message: 'Full.' });
    // Gin is fed only by the player's own count.
    expect(feedPreview(named(at(50)), 'sealed-gin', 1, at(0))).toMatchObject({ ok: true, emptyAt: at(98) });
  });
});

describe('the wire', () => {
  it('toWritView carries the stored state and the derived one as ISO times, and writFromView reads it back', () => {
    const w = named(at(100));
    const view = toWritView(w, at(120));
    expect(isWritView(view)).toBe(true);
    expect(view).toEqual({
      name: 'Black Rock',
      letters: 'בלק רוק',
      certified: false,
      emptyAt: new Date(at(100)).toISOString(),
      lineCount: 1,
      state: 'dark',
      chargeMs: 0,
      words: 'less than a day',
      darkSince: new Date(at(100)).toISOString(),
      graceEndsAt: new Date(at(148)).toISOString(),
      lines: [{ line: 1, plots: 4, state: 'dark', fadesAt: new Date(at(148)).toISOString() }],
    });
    expect(writFromView(view)).toEqual(w);
    const fresh = toWritView(pressedWrit(at(0)), at(0));
    expect(isWritView(fresh)).toBe(true);
    expect(fresh).toMatchObject({ name: null, letters: null, state: 'lit', darkSince: null, words: 'about two days' });
    expect(writFromView(fresh)).toEqual(pressedWrit(at(0)));
    // The guard: a name without letters, a wrong state, a lines count that doesn't match.
    expect(isWritView({ ...fresh, name: 'x' })).toBe(false);
    expect(isWritView({ ...fresh, state: 'bright' })).toBe(false);
    expect(isWritView({ ...fresh, state: 'new' })).toBe(false);
    expect(isWritView({ ...fresh, emptyAt: null })).toBe(false);
    expect(isWritView({ ...fresh, lines: [] })).toBe(false);
    expect(isWritView({ ...fresh, extra: 1 })).toBe(false);
  });

  it('the request guards refuse unknown fields and bad counts; fill names no item', () => {
    expect(isWritNameRequest({ name: 'Black Rock' })).toBe(true);
    expect(isWritNameRequest({ name: 'Black Rock', letters: 'x' })).toBe(false);
    expect(isWritNameRequest({})).toBe(false);
    expect(isWritFeedRequest({ itemId: 'wild-sliver', count: 1 })).toBe(true);
    expect(isWritFeedRequest({ fill: true })).toBe(true);
    expect(isWritFeedRequest({ itemId: 'wild-sliver', fill: true })).toBe(false);
    expect(isWritFeedRequest({ itemId: 'wild-sliver', count: 0 })).toBe(false);
    expect(isWritFeedRequest({ itemId: 'wild-sliver', count: 1.5 })).toBe(false);
    expect(isWritFeedRequest({ itemId: 'wild-sliver', count: -1 })).toBe(false);
    expect(isWritFeedRequest({ fill: false })).toBe(false);
    expect(isWritFeedRequest({ itemId: 'wild-sliver', count: 1, fill: true })).toBe(false);
    expect(isWritFeedRequest({ itemId: 'wild-sliver' })).toBe(false);
    expect(isWritFeedRequest({ count: 1 })).toBe(false);
  });

  it('the holding answer needs the Writ', () => {
    const response = {
      layoutId: 'first-holding',
      baskets: { 'twisted-trees': [] },
      activity: null,
      now: new Date(T0).toISOString(),
      skills: {
        woodcutting: { xp: 0, level: 1, into: 0, toNext: 40 },
        mining: { xp: 0, level: 1, into: 0, toNext: 40 },
        farming: { xp: 0, level: 1, into: 0, toNext: 40 },
      },
      writ: toWritView(pressedWrit(T0), T0),
    };
    expect(isHoldingResponse(response)).toBe(true);
    expect(isHoldingResponse({ ...response, writ: undefined })).toBe(false);
  });
});
