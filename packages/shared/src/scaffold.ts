import scaffoldJson from '../data/scaffold.json' with { type: 'json' };
import { itemDef } from './items.js';

/**
 * M2's scaffolding flags (data/scaffold.json, docs/design/holding.md
 * "Kesh"), validated on load: `m2Scaffold` turns on the once-per-tide sliver
 * from Kesh, M2's only Sparkglass after his first sliver, and the `kit`: the
 * weapons given once onto a Kindled's rack by its first holding request
 * while it owns none (M2 Task 8, docs/design/holding.md "The weapon rack";
 * GAME DESIGN: the Hookblade alone). M3 turns it off when caves and wrecks
 * give glass and the first wreck's rack gives the weapons. The server and
 * the client both read it.
 */
export interface ScaffoldData {
  m2Scaffold: boolean;
  /** Item ids of kind `weapon`, each once. */
  kit: readonly string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Check scaffold.json-shaped data; every problem is listed. */
export function validateScaffoldData(data: unknown): { ok: true; data: ScaffoldData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !['$comment', 'm2Scaffold', 'kit'].includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  if (typeof data.m2Scaffold !== 'boolean') problems.push('m2Scaffold must be a boolean');
  const kit = data.kit;
  if (!Array.isArray(kit) || !kit.every((id) => typeof id === 'string' && itemDef(id)?.kind === 'weapon'))
    problems.push('kit must be a list of weapon item ids (items.json, kind weapon)');
  else if (new Set(kit).size !== kit.length) problems.push('kit lists a weapon twice');
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, data: { m2Scaffold: data.m2Scaffold as boolean, kit: [...(kit as string[])] } };
}

function loadScaffoldData(): ScaffoldData {
  const result = validateScaffoldData(scaffoldJson);
  if (!result.ok) throw new Error(`data/scaffold.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const scaffoldData: ScaffoldData = loadScaffoldData();
/** Whether Kesh gives one sliver each tide, and the kit is given (M2 only). */
export const M2_SCAFFOLD: boolean = scaffoldData.m2Scaffold;
/** The weapons a Kindled's first holding request puts on its rack while `M2_SCAFFOLD` is on and it owns none (M2 Task 8). */
export const M2_KIT: readonly string[] = scaffoldData.kit;
