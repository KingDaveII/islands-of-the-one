import scaffoldJson from '../data/scaffold.json' with { type: 'json' };

/**
 * M2's scaffolding flags (data/scaffold.json, docs/design/holding.md
 * "Kesh"), validated on load: `m2Scaffold` turns on the once-per-tide sliver
 * from Kesh, M2's only Sparkglass after his first sliver; M3 turns it off
 * when caves and wrecks give glass. The server and the client both read it.
 */
export interface ScaffoldData {
  m2Scaffold: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Check scaffold.json-shaped data; every problem is listed. */
export function validateScaffoldData(data: unknown): { ok: true; data: ScaffoldData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !['$comment', 'm2Scaffold'].includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  if (typeof data.m2Scaffold !== 'boolean') problems.push('m2Scaffold must be a boolean');
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, data: { m2Scaffold: data.m2Scaffold as boolean } };
}

function loadScaffoldData(): ScaffoldData {
  const result = validateScaffoldData(scaffoldJson);
  if (!result.ok) throw new Error(`data/scaffold.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const scaffoldData: ScaffoldData = loadScaffoldData();
/** Whether Kesh gives one sliver each tide (M2 only). */
export const M2_SCAFFOLD: boolean = scaffoldData.m2Scaffold;
