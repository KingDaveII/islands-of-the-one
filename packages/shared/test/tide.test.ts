import { describe, expect, it } from 'vitest';
import { fullOfTideOn, HOUR_MS, isTimeZone, nextFullOfTide, tideData, tideIndex, validateTideData, wallClock, type TideData } from '../src/index.js';
import tideJson from '../data/tide.json' with { type: 'json' };

/**
 * The tide (docs/design/holding.md "Kesh", M2 Task 4b): tide n begins at
 * the full of the tide, 20:00 in Europe/Berlin, found with Intl in that
 * zone, so the full stays at 20:00 local across both daylight-saving
 * changes and a tide is 23 h or 25 h on those days.
 */
const TZ = 'Europe/Berlin';
/** An instant from Berlin wall-clock time, given its UTC offset (+01:00 in winter, +02:00 in summer). */
const berlin = (iso: string, offset: '+01:00' | '+02:00'): number => Date.parse(`${iso}${offset}`);

describe('tide.json', () => {
  it("holds GAME DESIGN's full of the tide and validates", () => {
    expect(validateTideData(tideJson)).toEqual({ ok: true, data: tideData });
    expect(tideData).toEqual({ fullOfTide: '20:00', timeZone: TZ });
  });

  it('refuses a bad hour, an unknown zone and unknown fields', () => {
    expect(validateTideData({ fullOfTide: '8pm', timeZone: TZ })).toEqual({ ok: false, problems: ['fullOfTide must be "HH:MM" (24 h)'] });
    expect(validateTideData({ fullOfTide: '24:00', timeZone: TZ })).toMatchObject({ ok: false });
    expect(validateTideData({ fullOfTide: '20:00', timeZone: 'Hollow/Tehiru' })).toEqual({
      ok: false,
      problems: ['timeZone must be an IANA time zone name Intl knows'],
    });
    expect(validateTideData({ fullOfTide: '20:00', timeZone: TZ, ebb: '08:00' })).toEqual({ ok: false, problems: ['unknown field(s) ebb'] });
    expect(validateTideData('20:00')).toEqual({ ok: false, problems: ['expected an object'] });
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('')).toBe(false);
  });
});

describe('tideIndex and nextFullOfTide', () => {
  it('tide n begins at 20:00 Berlin time: 19:59 is still the tide before', () => {
    const before = berlin('2026-10-17T19:59:00', '+02:00');
    const full = berlin('2026-10-17T20:00:00', '+02:00');
    expect(tideIndex(full)).toBe(tideIndex(before) + 1);
    expect(tideIndex(full - 1)).toBe(tideIndex(before));
    expect(tideIndex(new Date(full))).toBe(tideIndex(full));
    // The index counts the civil day the tide began on: the 17th's tide, from 20:00 on the 17th to 20:00 on the 18th.
    expect(tideIndex(berlin('2026-10-18T19:59:59', '+02:00'))).toBe(tideIndex(full));
    expect(tideIndex(berlin('2026-10-18T20:00:00', '+02:00'))).toBe(tideIndex(full) + 1);
    expect(tideIndex(full)).toBe(Math.floor(Date.UTC(2026, 9, 17) / (24 * HOUR_MS)));
    // The next full: tonight's while it is ahead, else tomorrow's.
    expect(nextFullOfTide(before).getTime()).toBe(full);
    expect(nextFullOfTide(full).getTime()).toBe(berlin('2026-10-18T20:00:00', '+02:00'));
    expect(nextFullOfTide(new Date(full + HOUR_MS)).getTime()).toBe(berlin('2026-10-18T20:00:00', '+02:00'));
    expect(wallClock(full, TZ)).toEqual({ year: 2026, month: 10, day: 17, hour: 20, minute: 0, second: 0 });
  });

  it('is 20:00 local on both sides of the March change (the night of 28 to 29 March 2026): a 23 h tide', () => {
    const saturday = berlin('2026-03-28T20:00:00', '+01:00');
    const sunday = berlin('2026-03-29T20:00:00', '+02:00');
    expect(sunday - saturday).toBe(23 * HOUR_MS);
    expect(fullOfTideOn(tideIndex(saturday))).toBe(saturday);
    expect(fullOfTideOn(tideIndex(saturday) + 1)).toBe(sunday);
    expect(nextFullOfTide(saturday).getTime()).toBe(sunday);
    expect(nextFullOfTide(saturday + 22 * HOUR_MS + 59 * 60_000).getTime()).toBe(sunday);
    expect(tideIndex(sunday - 60_000)).toBe(tideIndex(saturday));
    expect(tideIndex(sunday)).toBe(tideIndex(saturday) + 1);
    // 19:59 and 20:00 local on the Sunday, after the clocks went forward.
    expect(tideIndex(berlin('2026-03-29T19:59:00', '+02:00'))).toBe(tideIndex(saturday));
    expect(tideIndex(berlin('2026-03-29T20:00:00', '+02:00'))).toBe(tideIndex(saturday) + 1);
    // Monday's full is 24 h on again.
    expect(nextFullOfTide(sunday).getTime()).toBe(sunday + 24 * HOUR_MS);
  });

  it('is 20:00 local on both sides of the October change (the night of 24 to 25 October 2026): a 25 h tide', () => {
    const saturday = berlin('2026-10-24T20:00:00', '+02:00');
    const sunday = berlin('2026-10-25T20:00:00', '+01:00');
    expect(sunday - saturday).toBe(25 * HOUR_MS);
    expect(fullOfTideOn(tideIndex(saturday))).toBe(saturday);
    expect(fullOfTideOn(tideIndex(saturday) + 1)).toBe(sunday);
    expect(nextFullOfTide(saturday).getTime()).toBe(sunday);
    expect(nextFullOfTide(saturday + 24 * HOUR_MS).getTime()).toBe(sunday);
    expect(tideIndex(berlin('2026-10-25T19:59:00', '+01:00'))).toBe(tideIndex(saturday));
    expect(tideIndex(berlin('2026-10-25T20:00:00', '+01:00'))).toBe(tideIndex(saturday) + 1);
    expect(tideIndex(sunday - 60_000)).toBe(tideIndex(saturday));
    expect(tideIndex(sunday)).toBe(tideIndex(saturday) + 1);
    expect(wallClock(sunday - 60_000, TZ)).toMatchObject({ day: 25, hour: 19, minute: 59 });
  });

  it('follows the data: another hour and zone', () => {
    const data: TideData = { fullOfTide: '02:30', timeZone: 'America/New_York' };
    // 02:30 is skipped on 8 March 2026 (the clocks jump from 02:00 to 03:00): the full lands on the first instant past it.
    const skipped = Date.parse('2026-03-08T03:00:00-04:00');
    const day = tideIndex(skipped, data);
    expect(fullOfTideOn(day, data)).toBe(skipped);
    expect(tideIndex(skipped - 1, data)).toBe(day - 1);
    expect(fullOfTideOn(day + 1, data)).toBe(Date.parse('2026-03-09T02:30:00-04:00'));
    expect(fullOfTideOn(day - 1, data)).toBe(Date.parse('2026-03-07T02:30:00-05:00'));
    // UTC, 00:00: the tide index is the UTC day itself.
    const utc: TideData = { fullOfTide: '00:00', timeZone: 'UTC' };
    expect(tideIndex(Date.UTC(2026, 0, 2, 12), utc)).toBe(Math.floor(Date.UTC(2026, 0, 2) / (24 * HOUR_MS)));
    expect(nextFullOfTide(Date.UTC(2026, 0, 2, 12), utc).toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });
});
