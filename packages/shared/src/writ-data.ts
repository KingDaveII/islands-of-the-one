import writJson from '../data/writ.json' with { type: 'json' };
import { isItemId } from './items.js';

/**
 * The Writ's numbers (data/writ.json, docs/design/holding.md "The Writ"),
 * validated on load like items.json: a bad file throws, and
 * test/writ.test.ts fails. The math over them is in writ.ts; this module
 * stands alone so hear-name.ts can read `lineLetters` without a cycle.
 */
export interface WritData {
  /** One wild sliver's charge, in hours. */
  sliverHours: number;
  /** A full Writ, in hours. */
  capacityHours: number;
  /** Slivers' worth per item id; only these can be fed. */
  feeds: Readonly<Record<string, number>>;
  /** Under this many hours the Writ flickers. */
  lowHours: number;
  /** The charge a Writ is pressed with when its row is created, in hours. */
  pressChargeHours: number;
  /** Dark, but the island still remembers itself: hours, for a certified Writ. */
  graceHoursCertified: number;
  /** The same for an uncertified Writ (48 until the Wet House opens in M4). */
  graceHoursUncertified: number;
  /** After the grace, one line fades each such stretch, outermost first. */
  lineFadeHours: number;
  /** Letters a Writ line holds (the lean hand). */
  lineLetters: number;
  /** Plots each line tethers. */
  linePlots: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const KEYS = [
  '$comment',
  'sliverHours',
  'capacityHours',
  'feeds',
  'lowHours',
  'pressChargeHours',
  'graceHoursCertified',
  'graceHoursUncertified',
  'lineFadeHours',
  'lineLetters',
  'linePlots',
];

/** Check writ.json-shaped data; every problem is listed, not just the first. */
export function validateWritData(data: unknown): { ok: true; data: WritData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !KEYS.includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  for (const key of [
    'sliverHours',
    'capacityHours',
    'lowHours',
    'pressChargeHours',
    'graceHoursCertified',
    'graceHoursUncertified',
    'lineFadeHours',
    'lineLetters',
    'linePlots',
  ])
    if (!isCount(data[key])) problems.push(`${key} must be a positive integer`);
  const feeds = data.feeds;
  if (!isObject(feeds) || Object.keys(feeds).length === 0) problems.push('feeds must be an object of slivers by item id');
  else
    for (const [id, worth] of Object.entries(feeds)) {
      const known: boolean = isItemId(id);
      if (!known) problems.push(`feeds: unknown item ${id} (see items.json)`);
      if (!isCount(worth)) problems.push(`feeds.${id} must be a positive integer (slivers)`);
    }
  if (isCount(data.sliverHours) && isCount(data.capacityHours) && data.capacityHours < data.sliverHours)
    problems.push('capacityHours must hold at least one sliver');
  if (isCount(data.lowHours) && isCount(data.capacityHours) && data.lowHours >= data.capacityHours)
    problems.push('lowHours must be under capacityHours');
  if (isCount(data.pressChargeHours) && isCount(data.capacityHours) && data.pressChargeHours > data.capacityHours)
    problems.push('pressChargeHours must not exceed capacityHours');
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    data: {
      sliverHours: data.sliverHours as number,
      capacityHours: data.capacityHours as number,
      feeds: feeds as Readonly<Record<string, number>>,
      lowHours: data.lowHours as number,
      pressChargeHours: data.pressChargeHours as number,
      graceHoursCertified: data.graceHoursCertified as number,
      graceHoursUncertified: data.graceHoursUncertified as number,
      lineFadeHours: data.lineFadeHours as number,
      lineLetters: data.lineLetters as number,
      linePlots: data.linePlots as number,
    },
  };
}

function loadWritData(): WritData {
  const result = validateWritData(writJson);
  if (!result.ok) throw new Error(`data/writ.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const writData: WritData = loadWritData();
