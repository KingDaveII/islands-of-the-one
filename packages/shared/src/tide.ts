import tideJson from '../data/tide.json' with { type: 'json' };

/**
 * The tide (data/tide.json, docs/design/holding.md "Kesh", M2 Task 4b):
 * tide n begins at the full of the tide, a fixed wall-clock hour in one time
 * zone chosen for the server's players (GAME DESIGN: "The full of the tide
 * is a fixed hour chosen for the server's players"). The hour is found with
 * `Intl.DateTimeFormat` in that zone, so the full is 20:00 local on both
 * sides of a daylight-saving change and a tide is 23 or 25 h on those two
 * days. `tideIndex(date)` numbers the tides (the civil day, in the zone, on
 * which the running tide began, counted from the epoch); `nextFullOfTide`
 * is when the next one begins. No clock of its own: callers pass the time.
 */
export interface TideData {
  /** "HH:MM", the local hour each tide begins at. */
  fullOfTide: string;
  /** An IANA time zone name. */
  timeZone: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Whether `Intl` knows the zone. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Check tide.json-shaped data; every problem is listed. */
export function validateTideData(data: unknown): { ok: true; data: TideData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !['$comment', 'fullOfTide', 'timeZone'].includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  if (typeof data.fullOfTide !== 'string' || !HHMM.test(data.fullOfTide)) problems.push('fullOfTide must be "HH:MM" (24 h)');
  if (!isTimeZone(data.timeZone)) problems.push('timeZone must be an IANA time zone name Intl knows');
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, data: { fullOfTide: data.fullOfTide as string, timeZone: data.timeZone as string } };
}

function loadTideData(): TideData {
  const result = validateTideData(tideJson);
  if (!result.ok) throw new Error(`data/tide.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const tideData: TideData = loadTideData();

const DAY_MS = 24 * 60 * 60 * 1000;

/** The hour and minute of "HH:MM". */
function parseHhmm(hhmm: string): { hour: number; minute: number } {
  const m = HHMM.exec(hhmm);
  return { hour: Number(m?.[1] ?? 0), minute: Number(m?.[2] ?? 0) };
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall clock in a zone at an instant. */
export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function wallClock(ms: number, timeZone: string = tideData.timeZone): WallClock {
  const parts = formatter(timeZone).formatToParts(new Date(ms));
  const n = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: n('year'), month: n('month'), day: n('day'), hour: n('hour') % 24, minute: n('minute'), second: n('second') };
}

/** The wall clock read as if it were UTC: a monotone number for comparing local times. */
const asUtc = (w: WallClock): number => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);

/** The civil day of a wall clock, counted from the epoch. */
const civilDay = (w: WallClock): number => Math.floor(Date.UTC(w.year, w.month - 1, w.day) / DAY_MS);

/** The zone's offset from UTC at an instant, in ms (positive east of Greenwich). */
const offsetAt = (ms: number, timeZone: string): number => asUtc(wallClock(ms, timeZone)) - ms;

/**
 * The instant at which the zone's clock shows `hour:minute` on the civil
 * day `day` (counted from the epoch). The zone's offset changes at most once
 * a day, so the instant is `local − offset` for the offset a day before or
 * a day after; the candidate whose clock reads exactly `local` wins (the
 * earlier one on a day the clock repeats the hour). On a day the clock skips
 * the hour (spring forward) no candidate reads it, and the instant is the
 * first whose clock reads at or past it: the moment the clocks jump.
 */
function instantAt(day: number, hour: number, minute: number, timeZone: string): number {
  const local = day * DAY_MS + (hour * 60 + minute) * 60 * 1000;
  const offsets = [...new Set([offsetAt(local - DAY_MS, timeZone), offsetAt(local, timeZone), offsetAt(local + DAY_MS, timeZone)])];
  const candidates = offsets.map((o) => local - o).sort((a, b) => a - b);
  const exact = candidates.find((t) => asUtc(wallClock(t, timeZone)) === local);
  if (exact !== undefined) return exact;
  // A skipped hour: the clocks jump somewhere between the earliest and the latest candidate.
  let lo = candidates[0] ?? local;
  let hi = candidates[candidates.length - 1] ?? local;
  while (hi - lo > 1000) {
    const mid = lo + Math.floor((hi - lo) / 2000) * 1000;
    if (asUtc(wallClock(mid, timeZone)) < local) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** The full of the tide on the zone's civil day `day`, as an instant (ms). */
export function fullOfTideOn(day: number, data: TideData = tideData): number {
  const { hour, minute } = parseHhmm(data.fullOfTide);
  return instantAt(day, hour, minute, data.timeZone);
}

/**
 * The index of the tide running at `date`: the civil day (in the tide's
 * zone, counted from the epoch) on which it began. Tide n begins at the full
 * of the tide; before today's full the running tide is yesterday's.
 */
export function tideIndex(date: Date | number, data: TideData = tideData): number {
  const ms = typeof date === 'number' ? date : date.getTime();
  const today = civilDay(wallClock(ms, data.timeZone));
  return ms >= fullOfTideOn(today, data) ? today : today - 1;
}

/** When the next tide begins: today's full if it is still ahead, else tomorrow's. */
export function nextFullOfTide(date: Date | number, data: TideData = tideData): Date {
  const ms = typeof date === 'number' ? date : date.getTime();
  return new Date(fullOfTideOn(tideIndex(ms, data) + 1, data));
}
