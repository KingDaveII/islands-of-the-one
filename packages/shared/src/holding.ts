import holdingJson from '../data/holding.json' with { type: 'json' };
import stationsJson from '../data/stations.json' with { type: 'json' };
import { isDrawable } from './accounts.js';
import { isItemId } from './items.js';
import { isStationId } from './places.js';
import { isSkill, type Skill } from './skills.js';
import type { TileTemplate } from './tiles.js';

/**
 * The holding (docs/design/holding.md): the Kindled's home Shard. Its layout
 * is pure data (data/holding.json): a tile template in the rooms' style with
 * the stations' tile rectangles and interact points, and the four plot
 * rectangles Task 5 names. The stations' rules (data/stations.json): what
 * each makes, how often, which skill it trains. Both are validated on load
 * like items.json; `holdingLayoutProblems` is the layout rule the test and the
 * loader share. The server settles the active action from these numbers; the
 * client draws the layout with the room tile rule (`holdingTemplate`) and
 * walks it with the sim's `roam` (`holdingRoomTiles`).
 */

export const STATION_KINDS = ['post', 'trees', 'outcrop'] as const;
export type StationKind = (typeof STATION_KINDS)[number];

/** The layout legend: ground, the edge, one letter per station kind, the start. */
export const HOLDING_GROUND = '.';
export const HOLDING_EDGE = '#';
export const HOLDING_START = 'P';
export const STATION_TILE: Readonly<Record<StationKind, string>> = { post: 'W', trees: 'T', outcrop: 'R' };
const STATION_LETTERS = Object.values(STATION_TILE).join('');
/** The legend's solid characters: the edge and every station letter (the sim treats them as walls). */
export const HOLDING_SOLID = `${HOLDING_EDGE}${STATION_LETTERS}`;

/** A plot is this many tiles a side (GAME DESIGN's M2 numbers). */
export const PLOT_SIZE = 6;

export interface TileRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface TilePoint {
  col: number;
  row: number;
}

export interface LayoutStation {
  id: string;
  kind: StationKind;
  rect: TileRect;
  /** The ground tile beside the station the interact prompt and the panel stand on. */
  interact: TilePoint;
}

export interface HoldingLayout {
  id: string;
  tiles: string[];
  stations: LayoutStation[];
  plots: TileRect[];
}

/** What a working station makes each cycle and the skill it trains. */
export interface StationAction {
  /** The action's name in text ("a dead branch"). */
  name: string;
  itemId: string;
  /** Per cycle. */
  quantity: number;
  cycleMs: number;
  skill: Skill;
  /** XP per cycle: the action's base time in seconds (GAME DESIGN's curve). */
  xp: number;
}

export interface StationDef {
  id: string;
  kind: StationKind;
  name: string;
  /** Null for the post: Use opens the inventory with the store instead. */
  action: StationAction | null;
}

export interface HoldingData {
  offlineCapHours: number;
  heartbeatMs: number;
  layouts: HoldingLayout[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isKind = (value: unknown): value is StationKind =>
  typeof value === 'string' && (STATION_KINDS as readonly string[]).includes(value);

function parseRect(v: unknown, at: string, problems: string[]): TileRect | null {
  if (!isObject(v) || !isIndex(v.col) || !isIndex(v.row) || !isCount(v.cols) || !isCount(v.rows)) {
    problems.push(`${at}: must be { col, row, cols, rows } of whole numbers`);
    return null;
  }
  const extra = Object.keys(v).filter((k) => !['col', 'row', 'cols', 'rows'].includes(k));
  if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
  return { col: v.col, row: v.row, cols: v.cols, rows: v.rows };
}

/** Check stations.json-shaped data; every problem is listed. */
export function validateStationsData(
  data: unknown,
): { ok: true; stations: StationDef[] } | { ok: false; problems: string[] } {
  if (!isObject(data) || !Array.isArray(data.stations))
    return { ok: false, problems: ['expected { stations: [...] }'] };
  const problems: string[] = [];
  const stations: StationDef[] = [];
  const seen = new Set<string>();
  data.stations.forEach((entry: unknown, i) => {
    const at = `stations[${i}]`;
    if (!isObject(entry)) {
      problems.push(`${at}: not an object`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !['id', 'kind', 'name', 'action'].includes(k));
    if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
    const { id, kind, name, action } = entry;
    if (!isStationId(id)) {
      problems.push(`${at}: id must be kebab-case (it names the basket)`);
      return;
    }
    const where = `${at} (${id})`;
    if (seen.has(id)) problems.push(`${where}: duplicate id`);
    seen.add(id);
    if (!isKind(kind)) problems.push(`${where}: kind must be one of ${STATION_KINDS.join(', ')}`);
    if (typeof name !== 'string' || name.trim() === '' || !isDrawable(name))
      problems.push(`${where}: name must be non-empty text the game can draw`);
    let parsed: StationAction | null = null;
    if (action !== undefined) {
      if (!isObject(action)) problems.push(`${where}: action must be an object`);
      else {
        const keys = ['name', 'itemId', 'quantity', 'cycleMs', 'skill', 'xp'];
        const more = Object.keys(action).filter((k) => !keys.includes(k));
        if (more.length > 0) problems.push(`${where}: action has unknown field(s) ${more.join(', ')}`);
        const a = action;
        if (typeof a.name !== 'string' || a.name.trim() === '' || !isDrawable(a.name))
          problems.push(`${where}: action.name must be text the game can draw`);
        if (!isItemId(a.itemId)) problems.push(`${where}: action.itemId must be an item of items.json`);
        if (!isCount(a.quantity)) problems.push(`${where}: action.quantity must be a positive integer`);
        if (!isCount(a.cycleMs)) problems.push(`${where}: action.cycleMs must be a positive integer`);
        if (!isSkill(a.skill)) problems.push(`${where}: action.skill must be a skill`);
        if (!isIndex(a.xp)) problems.push(`${where}: action.xp must be a whole number`);
        else if (isCount(a.cycleMs) && a.xp !== a.cycleMs / 1000)
          problems.push(`${where}: action.xp is ${a.xp}; the curve gives the cycle's seconds, ${a.cycleMs / 1000}`);
        if (problems.length === 0)
          parsed = {
            name: a.name as string,
            itemId: a.itemId as string,
            quantity: a.quantity as number,
            cycleMs: a.cycleMs as number,
            skill: a.skill as Skill,
            xp: a.xp as number,
          };
      }
    }
    if (kind === 'post' && action !== undefined) problems.push(`${where}: the post has no action`);
    if (kind !== 'post' && action === undefined) problems.push(`${where}: a ${String(kind)} needs an action`);
    if (problems.length > 0) return;
    stations.push({ id, kind: kind as StationKind, name: name as string, action: parsed });
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, stations };
}

/**
 * Where a layout breaks the rules (docs/design/holding.md), one line each, or
 * none: the template is rectangular and only legend characters; every
 * station's id is in `stations` with its kind, its rectangle is inside the
 * layout and every tile of it is its kind's letter (so solid for the sim),
 * every station letter belongs to a station, its interact point is ground
 * beside the rectangle and reachable from the start; the plots are
 * `PLOT_SIZE` square, on ground, and overlap neither a station nor each
 * other; there is exactly one start, on ground.
 */
export function holdingLayoutProblems(layout: HoldingLayout, stations: readonly StationDef[]): string[] {
  const problems: string[] = [];
  const name = layout.id;
  const rows = layout.tiles.length;
  const cols = layout.tiles[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return [`${name}: the layout has no tiles`];
  const legend = `${HOLDING_GROUND}${HOLDING_EDGE}${HOLDING_START}${STATION_LETTERS}`;
  layout.tiles.forEach((row, r) => {
    if (row.length !== cols) problems.push(`${name}: row ${r} is ${row.length} wide, not ${cols}`);
    for (const ch of row) if (!legend.includes(ch)) problems.push(`${name}: row ${r} has "${ch}", not in the legend`);
  });
  const at = (c: number, r: number): string =>
    r < 0 || r >= rows || c < 0 || c >= cols ? HOLDING_EDGE : (layout.tiles[r]?.[c] ?? HOLDING_EDGE);
  const ground = (c: number, r: number): boolean => at(c, r) === HOLDING_GROUND || at(c, r) === HOLDING_START;
  const inside = (rect: TileRect): boolean =>
    rect.col >= 0 && rect.row >= 0 && rect.col + rect.cols <= cols && rect.row + rect.rows <= rows;
  const overlap = (a: TileRect, b: TileRect): boolean =>
    a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
  const beside = (p: TilePoint, rect: TileRect): boolean =>
    (p.row >= rect.row && p.row < rect.row + rect.rows && (p.col === rect.col - 1 || p.col === rect.col + rect.cols)) ||
    (p.col >= rect.col && p.col < rect.col + rect.cols && (p.row === rect.row - 1 || p.row === rect.row + rect.rows));

  // The start.
  const starts: TilePoint[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === HOLDING_START) starts.push({ col: c, row: r });
  if (starts.length !== 1) problems.push(`${name}: ${starts.length} start tiles (P); there must be one`);
  // Everything the Kindled can walk to from the start.
  const reach = new Set<string>();
  const start = starts[0];
  if (start) {
    const stack = [start];
    reach.add(`${start.col},${start.row}`);
    while (stack.length) {
      const p = stack.pop();
      if (!p) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = p.col + dc;
        const r = p.row + dr;
        const key = `${c},${r}`;
        if (reach.has(key) || !ground(c, r)) continue;
        reach.add(key);
        stack.push({ col: c, row: r });
      }
    }
  }

  // The stations.
  const ids = new Set<string>();
  const covered = new Set<string>();
  for (const s of layout.stations) {
    const where = `${name}: station ${s.id}`;
    if (ids.has(s.id)) problems.push(`${where} is listed twice`);
    ids.add(s.id);
    const def = stations.find((d) => d.id === s.id);
    if (!def) problems.push(`${where} is not in stations.json`);
    else if (def.kind !== s.kind) problems.push(`${where} is a ${s.kind} here but a ${def.kind} in stations.json`);
    if (!inside(s.rect)) {
      problems.push(`${where}: its rectangle is outside the layout`);
      continue;
    }
    const letter = STATION_TILE[s.kind];
    for (let r = s.rect.row; r < s.rect.row + s.rect.rows; r++) {
      for (let c = s.rect.col; c < s.rect.col + s.rect.cols; c++) {
        covered.add(`${c},${r}`);
        if (at(c, r) !== letter) problems.push(`${where}: tile (${c}, ${r}) is "${at(c, r)}", not ${letter}`);
      }
    }
    const p = s.interact;
    if (!ground(p.col, p.row)) problems.push(`${where}: its interact point (${p.col}, ${p.row}) is not ground`);
    else if (!beside(p, s.rect)) problems.push(`${where}: its interact point (${p.col}, ${p.row}) is not beside it`);
    else if (!reach.has(`${p.col},${p.row}`))
      problems.push(`${where}: its interact point (${p.col}, ${p.row}) can't be reached from the start`);
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (STATION_LETTERS.includes(at(c, r)) && !covered.has(`${c},${r}`))
        problems.push(`${name}: tile (${c}, ${r}) is "${at(c, r)}" but belongs to no station`);
    }
  }

  // The plots.
  layout.plots.forEach((plot, i) => {
    const where = `${name}: plot ${i}`;
    if (plot.cols !== PLOT_SIZE || plot.rows !== PLOT_SIZE)
      problems.push(`${where} is ${plot.cols} × ${plot.rows}, not ${PLOT_SIZE} × ${PLOT_SIZE}`);
    if (!inside(plot)) {
      problems.push(`${where} is outside the layout`);
      return;
    }
    for (let r = plot.row; r < plot.row + plot.rows; r++)
      for (let c = plot.col; c < plot.col + plot.cols; c++)
        if (at(c, r) !== HOLDING_GROUND) problems.push(`${where}: tile (${c}, ${r}) is "${at(c, r)}", not ground`);
    for (const s of layout.stations) if (overlap(plot, s.rect)) problems.push(`${where} overlaps station ${s.id}`);
    layout.plots.forEach((other, j) => {
      if (j > i && overlap(plot, other)) problems.push(`${where} overlaps plot ${j}`);
    });
  });
  return problems;
}

/** Check holding.json-shaped data against `stations`; every problem is listed. */
export function validateHoldingData(
  data: unknown,
  stations: readonly StationDef[],
): { ok: true; data: HoldingData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !['$comment', 'offlineCapHours', 'heartbeatMs', 'layouts'].includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  if (!isCount(data.offlineCapHours)) problems.push('offlineCapHours must be a positive integer');
  if (!isCount(data.heartbeatMs)) problems.push('heartbeatMs must be a positive integer');
  const layouts: HoldingLayout[] = [];
  if (!Array.isArray(data.layouts) || data.layouts.length === 0) problems.push('layouts must be a non-empty list');
  else {
    const ids = new Set<string>();
    data.layouts.forEach((entry: unknown, i) => {
      const at = `layouts[${i}]`;
      if (!isObject(entry)) {
        problems.push(`${at}: not an object`);
        return;
      }
      const more = Object.keys(entry).filter((k) => !['id', 'tiles', 'stations', 'plots'].includes(k));
      if (more.length > 0) problems.push(`${at}: unknown field(s) ${more.join(', ')}`);
      const { id, tiles, stations: list, plots } = entry;
      if (!isStationId(id)) {
        problems.push(`${at}: id must be kebab-case`);
        return;
      }
      if (ids.has(id)) problems.push(`${at}: duplicate id ${id}`);
      ids.add(id);
      const before = problems.length;
      if (!Array.isArray(tiles) || tiles.length === 0 || !tiles.every((r) => typeof r === 'string'))
        problems.push(`${at} (${id}): tiles must be a non-empty list of rows`);
      const parsedStations: LayoutStation[] = [];
      if (!Array.isArray(list)) problems.push(`${at} (${id}): stations must be a list`);
      else
        list.forEach((s: unknown, j) => {
          const sat = `${at} (${id}): stations[${j}]`;
          if (!isObject(s) || !isStationId(s.id) || !isKind(s.kind)) {
            problems.push(`${sat}: must have a kebab-case id and a kind (${STATION_KINDS.join(', ')})`);
            return;
          }
          const sExtra = Object.keys(s).filter((k) => !['id', 'kind', 'rect', 'interact'].includes(k));
          if (sExtra.length > 0) problems.push(`${sat}: unknown field(s) ${sExtra.join(', ')}`);
          const rect = parseRect(s.rect, `${sat}.rect`, problems);
          const p = s.interact;
          if (!isObject(p) || !isIndex(p.col) || !isIndex(p.row)) {
            problems.push(`${sat}.interact: must be { col, row }`);
            return;
          }
          if (rect) parsedStations.push({ id: s.id, kind: s.kind, rect, interact: { col: p.col, row: p.row } });
        });
      const parsedPlots: TileRect[] = [];
      if (!Array.isArray(plots)) problems.push(`${at} (${id}): plots must be a list`);
      else
        plots.forEach((p: unknown, j) => {
          const rect = parseRect(p, `${at} (${id}): plots[${j}]`, problems);
          if (rect) parsedPlots.push(rect);
        });
      if (problems.length > before) return;
      const layout: HoldingLayout = { id, tiles: tiles as string[], stations: parsedStations, plots: parsedPlots };
      problems.push(...holdingLayoutProblems(layout, stations));
      layouts.push(layout);
    });
  }
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    data: { offlineCapHours: data.offlineCapHours as number, heartbeatMs: data.heartbeatMs as number, layouts },
  };
}

function loadStations(): readonly StationDef[] {
  const result = validateStationsData(stationsJson);
  if (!result.ok) throw new Error(`data/stations.json:\n${result.problems.join('\n')}`);
  return result.stations;
}

/** Every station, in stations.json order. */
export const STATIONS: readonly StationDef[] = loadStations();
const STATION_BY_ID: ReadonlyMap<string, StationDef> = new Map(STATIONS.map((s) => [s.id, s]));

export function stationDef(id: string): StationDef | undefined {
  return STATION_BY_ID.get(id);
}

export function isHoldingStationId(value: unknown): value is string {
  return typeof value === 'string' && STATION_BY_ID.has(value);
}

function loadHolding(): HoldingData {
  const result = validateHoldingData(holdingJson, STATIONS);
  if (!result.ok) throw new Error(`data/holding.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const holdingData: HoldingData = loadHolding();
/** The most time away a station keeps earning (data, never code). */
export const OFFLINE_CAP_MS: number = holdingData.offlineCapHours * 60 * 60 * 1000;
/** How often the open holding scene calls GET /api/holding. */
export const HOLDING_HEARTBEAT_MS: number = holdingData.heartbeatMs;
/** Every Kindled's holding today: the one layout. */
export const HOLDING_LAYOUT_ID: string = holdingData.layouts[0]?.id ?? 'first-holding';

export function holdingLayout(id: string = HOLDING_LAYOUT_ID): HoldingLayout {
  const layout = holdingData.layouts.find((l) => l.id === id);
  if (!layout) throw new Error(`no holding layout ${id}`);
  return layout;
}

/** The layout as the room tile rule reads it: a template whose stations are open ground (the props stand on it). */
export function holdingTemplate(layout: HoldingLayout = holdingLayout()): TileTemplate {
  return { name: layout.id, tiles: layout.tiles };
}

/** The layout as the sim walks it: every station tile a pillar (`o`), solid like the edge. */
export function holdingRoomTiles(layout: HoldingLayout = holdingLayout()): string[] {
  return layout.tiles.map((row) =>
    row
      .split('')
      .map((ch) => (STATION_LETTERS.includes(ch) ? 'o' : ch))
      .join(''),
  );
}

/** The start tile of a layout (its one `P`). */
export function holdingStart(layout: HoldingLayout = holdingLayout()): TilePoint {
  for (const [r, row] of layout.tiles.entries()) {
    const c = row.indexOf(HOLDING_START);
    if (c >= 0) return { col: c, row: r };
  }
  throw new Error(`layout ${layout.id} has no start`);
}
